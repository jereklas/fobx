/**
 * Observable Array - High-performance reactive array for v2
 *
 * Performance optimizations:
 * - Fast tracking via trackAccess helper
 * - Public $ property (no Symbol lookup)
 * - Minimal admin overhead
 * - Deep observability with fast paths
 * - Batched notifications
 */

import type { EqualityComparison } from "./global.ts"
import { $fobx, $global, getNextId } from "./global.ts"
import { resolveComparer } from "./instance.ts"
import type { ObservableAdmin } from "./types.ts"
import { NotificationType } from "./types.ts"
import { notifyObservers } from "./notifications.ts"
import { runPendingReactions } from "./graph.ts"
import { processValue } from "./object.ts"
import { trackAccess } from "./tracking.ts"

/**
 * Array options
 */
export interface ArrayOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean // Shallow: items not converted (default: false = deep observable)
}

/**
 * Array administration
 */
export interface ArrayAdmin<T = unknown> extends ObservableAdmin<T[]> {
  shallow: boolean // true = don't convert items, false = convert items (deep observable)
  changes: number // Incremented on every mutation - used to detect content changes when reference unchanged
}

/**
 * Observable array interface
 */
export interface ObservableArray<T> extends Array<T> {
  [$fobx]: ArrayAdmin<T>
  replace(newArray: T[]): T[]
  remove(item: T): number // Returns index of removed item, or -1 if not found
  clear(): T[]
  toJSON(): T[]
}

// MAX_SPLICE_SIZE from MobX - prevent stack overflow on large splice operations
const MAX_SPLICE_SIZE = 10000

/**
 * Create an observable array
 *
 * PERF: Optimized for creation speed to match MobX
 * - Minimal admin structure
 * - Fast value processing with early returns
 * - Proxy with inline hot path tracking
 */
export function array<T>(
  initialValue: T[] = [],
  options: ArrayOptions = {},
): ObservableArray<T> {
  const id = getNextId()
  const shallow = options.shallow ?? false // false = deep (convert items), true = shallow (don't convert)

  // Create the backing array and process initial values
  const arr: T[] = []

  // PERF: Use for loop (faster than forEach, handles sparse arrays)
  for (let i = 0; i < initialValue.length; i++) {
    arr[i] = initialValue[i] // Store raw values initially
  }

  const admin: ArrayAdmin<T> = {
    id,
    name: options.name || `Array@${id}`,
    value: arr,
    observers: [],
    comparer: resolveComparer(options.comparer),
    shallow,
    changes: 0,
  }

  // Now process initial values
  if (!shallow) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = processValue(arr[i], shallow)
    }
  }

  // Create proxy with optimized traps
  const proxy = new Proxy(arr as any, {
    get(_target: any, prop: string | symbol): any {
      // PERF: Handle numeric indices first (hottest path)
      if (typeof prop === "string" && isNumericIndex(prop)) {
        trackAccess(admin)
        return arr[prop as any]
      }

      // Length access (also hot path)
      if (prop === "length") {
        trackAccess(admin)
        return arr.length
      }

      // Admin access
      if (prop === $fobx) {
        return admin
      }

      // Custom methods
      if (prop === "replace") {
        return replace
      }
      if (prop === "remove") {
        return remove
      }
      if (prop === "clear") {
        return clear
      }
      if (prop === "toJSON") {
        return toJSON
      }

      // Symbol.iterator - track when array is iterated
      if (prop === Symbol.iterator) {
        return function () {
          trackAccess(admin)
          return arr[Symbol.iterator]()
        }
      }

      // Array methods - handle tracking and mutations
      const value = arr[prop as any]
      if (typeof value === "function") {
        return wrapArrayMethod(prop as string, value as (...args: any[]) => any, arr, admin, proxy)
      }

      return value
    },

    set(_target: any, prop: string | symbol, newValue: any): boolean {
      // Handle length setting
      if (prop === "length") {
        const oldLength = arr.length
        if (newValue !== oldLength) {
          arr.length = newValue
          admin.changes++
          notifyObservers(admin, NotificationType.CHANGED)
          if ($global.batchDepth === 0) {
            runPendingReactions()
          }
        }
        return true
      }

      // Handle index setting
      if (typeof prop === "string" && isNumericIndex(prop)) {
        const index = prop as any
        const oldValue = arr[index]

        // Check if value actually changed
        if (admin.comparer(oldValue, newValue)) {
          return true
        }

        // Process value for observability
        const processedValue = processValue(newValue, admin.shallow)
        arr[index] = processedValue
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return true
      }

      // Other properties (shouldn't happen, but handle gracefully)
      _target[prop] = newValue
      return true
    },

    has(_target: any, prop: string | symbol): boolean {
      // Admin symbol
      if (prop === $fobx) {
        return true
      }

      // Numeric indices - track access
      if (typeof prop === "string" && isNumericIndex(prop)) {
        trackAccess(admin)
        return prop in arr
      }

      // Other properties - delegate to array
      return prop in arr
    },
  })

  return proxy
}

/**
 * Check if a string is a numeric array index
 *
 * PERF: Optimized for speed - common case is numeric
 */
function isNumericIndex(key: string): boolean {
  // Fast path: check first character
  const code = key.charCodeAt(0)
  if (code < 48 || code > 57) return false // Not 0-9

  // For single digit, we're done
  if (key.length === 1) return true

  // Check remaining characters
  for (let i = 1; i < key.length; i++) {
    const c = key.charCodeAt(i)
    if (c < 48 || c > 57) return false
  }

  return true
}

/**
 * Wrap array method with tracking and mutation handling
 *
 * PERF: Return inline functions (not stored on instance)
 */
function wrapArrayMethod(
  method: string,
  fn: (...args: any[]) => any,
  arr: any[],
  admin: ArrayAdmin,
  proxy: any,
): (...args: any[]) => any {
  // Mutation methods that need special handling
  switch (method) {
    case "push":
      return function (...items: any[]) {
        // Process values
        if (!admin.shallow) {
          for (let i = 0; i < items.length; i++) {
            items[i] = processValue(items[i], admin.shallow)
          }
        }
        const result = arr.push(...items)
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return result
      }

    case "pop":
      return function () {
        const result = arr.pop()
        if (result !== undefined) {
          admin.changes++
          notifyObservers(admin, NotificationType.CHANGED)
          if ($global.batchDepth === 0) {
            runPendingReactions()
          }
        }
        return result
      }

    case "shift":
      return function () {
        const result = arr.shift()
        if (result !== undefined) {
          admin.changes++
          notifyObservers(admin, NotificationType.CHANGED)
          if ($global.batchDepth === 0) {
            runPendingReactions()
          }
        }
        return result
      }

    case "unshift":
      return function (...items: any[]) {
        // Process values
        if (!admin.shallow) {
          for (let i = 0; i < items.length; i++) {
            items[i] = processValue(items[i], admin.shallow)
          }
        }
        const result = arr.unshift(...items)
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return result
      }

    case "splice":
      return function (start: number, deleteCount?: number, ...items: any[]) {
        // Process values
        if (!admin.shallow && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            items[i] = processValue(items[i], admin.shallow)
          }
        }

        let result: any[]

        // Handle large splices (MAX_SPLICE_SIZE pattern from MobX)
        if (items.length < MAX_SPLICE_SIZE) {
          result = arr.splice(start, deleteCount ?? 0, ...items)
        } else {
          // Manual splice to avoid stack overflow
          const index = start < 0 ? Math.max(0, arr.length + start) : Math.min(start, arr.length)
          const delCount = deleteCount === undefined ? arr.length - index : Math.max(0, deleteCount)

          // Get removed items
          result = arr.slice(index, index + delCount)

          // Get items after splice point
          const tail = arr.slice(index + delCount)

          // Adjust length
          arr.length = index + items.length + tail.length

          // Insert new items
          for (let i = 0; i < items.length; i++) {
            arr[index + i] = items[i]
          }

          // Restore tail
          for (let i = 0; i < tail.length; i++) {
            arr[index + items.length + i] = tail[i]
          }
        }

        // Only notify if something changed
        if (result.length > 0 || items.length > 0) {
          admin.changes++
          notifyObservers(admin, NotificationType.CHANGED)
          if ($global.batchDepth === 0) {
            runPendingReactions()
          }
        }

        return result
      }

    case "reverse":
      return function () {
        // Check if in reaction (not allowed)
        if ($global.tracking !== null) {
          throw new Error(
            `[${admin.name}] reverse() mutates in-place and cannot be called in a reaction. Use toReversed() instead.`,
          )
        }
        const result = arr.reverse()
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return result
      }

    case "sort":
      return function (compareFn?: (a: any, b: any) => number) {
        // Check if in reaction (not allowed)
        if ($global.tracking !== null) {
          throw new Error(
            `[${admin.name}] sort() mutates in-place and cannot be called in a reaction. Use toSorted() instead.`,
          )
        }
        const result = arr.sort(compareFn)
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return result
      }

    case "fill":
      return function (value: any, start?: number, end?: number) {
        const processedValue = processValue(value, admin.shallow)
        arr.fill(processedValue, start, end)
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return proxy
      }

    case "copyWithin":
      return function (target: number, start: number, end?: number) {
        arr.copyWithin(target, start, end)
        admin.changes++
        notifyObservers(admin, NotificationType.CHANGED)
        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
        return proxy
      }

    // Iteration methods - track once
    // PERF: Pass backing array to callbacks instead of proxy for performance
    case "forEach":
    case "map":
    case "filter":
    case "find":
    case "findIndex":
    case "findLast":
    case "findLastIndex":
    case "some":
    case "every":
    case "reduce":
    case "reduceRight":
    case "flat":
    case "flatMap":
      return function (...args: any[]) {
        trackAccess(admin)
        return fn.apply(arr, args)
      }

    // Read methods that track
    case "at":
    case "includes":
    case "indexOf":
    case "lastIndexOf":
    case "join":
    case "toString":
    case "toLocaleString":
    case "slice":
    case "concat":
    case "entries":
    case "keys":
    case "values":
    case "toReversed":
    case "toSorted":
    case "toSpliced":
    case "with":
      return function (...args: any[]) {
        trackAccess(admin)
        return fn.apply(arr, args)
      }

    // Default: just call the method
    default:
      return function (...args: any[]) {
        return fn.apply(arr, args)
      }
  }
}

/**
 * Replace entire array contents
 */
function replace<T>(this: ObservableArray<T>, newArray: T[]): T[] {
  const admin = this[$fobx]
  const arr = admin.value // Access underlying array
  const oldLength = arr.length
  const newLength = newArray.length
  const removed: T[] = []

  // Process new values
  const processedValues = newArray.map((v) => processValue(v, admin.shallow))

  // Use MAX_SPLICE_SIZE pattern for large arrays
  if (newLength > MAX_SPLICE_SIZE) {
    // Collect all removed items first
    for (let i = 0; i < oldLength; i++) {
      removed.push(arr[i])
    }

    // Clear array
    arr.length = 0

    // Add new items in chunks
    for (let i = 0; i < newLength; i += MAX_SPLICE_SIZE) {
      const chunk = processedValues.slice(i, i + MAX_SPLICE_SIZE)
      arr.push(...chunk)
    }
  } else {
    // Small array: use splice
    const removedItems = arr.splice(0, oldLength, ...processedValues)
    removed.push(...removedItems)
  }

  admin.changes++
  notifyObservers(admin, NotificationType.CHANGED)
  if ($global.batchDepth === 0) {
    runPendingReactions()
  }
  return removed
}

/**
 * Remove first occurrence of item
 */
function remove<T>(this: ObservableArray<T>, item: T): number {
  const admin = this[$fobx]
  const index = this.indexOf(item)

  if (index === -1) {
    return -1
  }

  this.splice(index, 1)
  admin.changes++
  notifyObservers(admin, NotificationType.CHANGED)
  if ($global.batchDepth === 0) {
    runPendingReactions()
  }
  return index
}

/**
 * Clear array (remove all items)
 */
function clear<T>(this: ObservableArray<T>): T[] {
  const admin = this[$fobx]
  const removed = this.slice()
  this.length = 0
  admin.changes++
  notifyObservers(admin, NotificationType.CHANGED)
  if ($global.batchDepth === 0) {
    runPendingReactions()
  }
  return removed
}

/**
 * Return plain array representation (for JSON serialization)
 */
function toJSON<T>(this: ObservableArray<T>): T[] {
  return this.slice()
}
