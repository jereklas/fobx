/**
 * Observable Array — reactive array backed by a Proxy.
 *
 * Method wrappers are cached per-instance (created once, not per access).
 */

import {
  $fobx,
  _tracking,
  type Any,
  type EqualityComparison,
  getNextId,
  KIND_COLLECTION,
  type ObservableAdmin,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import { notifyChanged } from "./notifications.ts"
import { trackAccess } from "./tracking.ts"

// Forward declaration — set after object.ts is loaded to break circular dep
let _processValue: <T>(value: T, shallow: boolean) => T = (v) => v

export function setProcessValue(
  fn: <T>(value: T, shallow: boolean) => T,
): void {
  _processValue = fn
}

export interface ArrayOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean
}

export interface ArrayAdmin<T = unknown> extends ObservableAdmin<T[]> {
  shallow: boolean
  changes: number
}

export interface ObservableArray<T> extends Array<T> {
  [$fobx]: ArrayAdmin<T>
  replace(newArray: T[]): T[]
  remove(item: T): number
  clear(): T[]
  toJSON(): T[]
}

const MAX_SPLICE_SIZE = 10000

function isNumericIndex(key: string): boolean {
  const code = key.charCodeAt(0)
  if (code < 48 || code > 57) return false
  if (key.length === 1) return true
  for (let i = 1; i < key.length; i++) {
    const c = key.charCodeAt(i)
    if (c < 48 || c > 57) return false
  }
  return true
}

export function array<T>(
  initialValue: T[] = [],
  options: ArrayOptions = {},
): ObservableArray<T> {
  const id = getNextId()
  const shallow = options.shallow ?? false

  const arr: T[] = []
  for (let i = 0; i < initialValue.length; i++) {
    arr[i] = initialValue[i]
  }

  const admin: ArrayAdmin<T> = {
    kind: KIND_COLLECTION,
    id,
    name: options.name || `Array@${id}`,
    value: arr,
    observers: [],
    comparer: resolveComparer(options.comparer),
    _epoch: 0,
    shallow,
    changes: 0,
  }

  if (!shallow) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = _processValue(arr[i], shallow)
    }
  }

  // ─── Cached method wrappers ────────────────────────────────────────────────
  // Null prototype avoids Object.prototype.toString/valueOf false positives
  const methodCache: Record<string, ((...args: Any[]) => Any) | undefined> =
    Object.create(null)

  function getOrCreateMethod(
    prop: string,
    fn: (...args: Any[]) => Any,
  ): (...args: Any[]) => Any {
    let cached = methodCache[prop]
    if (cached) return cached
    cached = createMethod(prop, fn)
    methodCache[prop] = cached
    return cached
  }

  function createMethod(
    method: string,
    fn: (...args: Any[]) => Any,
  ): (...args: Any[]) => Any {
    switch (method) {
      case "push":
        return function (...items: Any[]) {
          if (!admin.shallow) {
            for (let i = 0; i < items.length; i++) {
              items[i] = _processValue(items[i], admin.shallow)
            }
          }
          const result = arr.push(...items)
          admin.changes++
          notifyChanged(admin)
          return result
        }
      case "pop":
        return function () {
          const len = arr.length
          const result = arr.pop()
          if (len > 0) {
            admin.changes++
            notifyChanged(admin)
          }
          return result
        }
      case "shift":
        return function () {
          const len = arr.length
          const result = arr.shift()
          if (len > 0) {
            admin.changes++
            notifyChanged(admin)
          }
          return result
        }
      case "unshift":
        return function (...items: Any[]) {
          if (!admin.shallow) {
            for (let i = 0; i < items.length; i++) {
              items[i] = _processValue(items[i], admin.shallow)
            }
          }
          const result = arr.unshift(...items)
          admin.changes++
          notifyChanged(admin)
          return result
        }
      case "splice":
        return function (start: number, deleteCount?: number, ...items: Any[]) {
          if (!admin.shallow && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
              items[i] = _processValue(items[i], admin.shallow)
            }
          }
          let result: Any[]
          if (items.length < MAX_SPLICE_SIZE) {
            result = arr.splice(start, deleteCount ?? 0, ...items)
          } else {
            const index = start < 0
              ? Math.max(0, arr.length + start)
              : Math.min(start, arr.length)
            const delCount = deleteCount === undefined
              ? arr.length - index
              : Math.max(0, deleteCount)
            result = arr.slice(index, index + delCount)
            const tail = arr.slice(index + delCount)
            arr.length = index + items.length + tail.length
            for (let i = 0; i < items.length; i++) arr[index + i] = items[i]
            for (let i = 0; i < tail.length; i++) {
              arr[index + items.length + i] = tail[i]
            }
          }
          if (result.length > 0 || items.length > 0) {
            admin.changes++
            notifyChanged(admin)
          }
          return result
        }
      case "reverse":
        return function () {
          if (_tracking !== null) {
            throw new Error(
              `[${admin.name}] reverse() mutates in-place and cannot be called in a reaction. Use toReversed() instead.`,
            )
          }
          const result = arr.reverse()
          admin.changes++
          notifyChanged(admin)
          return result
        }
      case "sort":
        return function (compareFn?: (a: Any, b: Any) => number) {
          if (_tracking !== null) {
            throw new Error(
              `[${admin.name}] sort() mutates in-place and cannot be called in a reaction. Use toSorted() instead.`,
            )
          }
          const result = arr.sort(compareFn)
          admin.changes++
          notifyChanged(admin)
          return result
        }
      case "fill":
        return function (value: Any, start?: number, end?: number) {
          const processedValue = _processValue(value, admin.shallow)
          arr.fill(processedValue, start, end)
          admin.changes++
          notifyChanged(admin)
          return proxy
        }
      case "copyWithin":
        return function (target: number, start: number, end?: number) {
          arr.copyWithin(target, start, end)
          admin.changes++
          notifyChanged(admin)
          return proxy
        }
      // Iteration methods — track once, delegate to backing array
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
        return function (...args: Any[]) {
          trackAccess(admin)
          return fn.apply(arr, args)
        }
      // Read methods — track once
      case "at":
      case "includes":
      case "indexOf":
      case "lastIndexOf":
      case "join":
      case "toString":
      case "toLocaleString":
      case "slice":
      case "concat":
      case "toReversed":
      case "toSorted":
      case "toSpliced":
      case "with":
        return function (...args: Any[]) {
          trackAccess(admin)
          return fn.apply(arr, args)
        }
      // Iterator methods — lazy tracking
      case "entries":
      case "keys":
      case "values":
        return function (...args: Any[]) {
          const iterator = fn.apply(arr, args)
          let tracked = false
          return {
            next() {
              if (!tracked) {
                tracked = true
                trackAccess(admin)
              }
              return iterator.next()
            },
            [Symbol.iterator]() {
              return this
            },
          }
        }
      default:
        return function (...args: Any[]) {
          return fn.apply(arr, args)
        }
    }
  }

  // Track user-defined property overrides (e.g. Object.defineProperty(ar, "toString", ...))
  // Null prototype avoids Object.prototype.toString/valueOf false positives
  const userProps: Record<string | symbol, PropertyDescriptor> = Object.create(
    null,
  )

  // Custom methods bound to proxy
  function replace(newArray: T[]): T[] {
    const oldLength = arr.length
    const newLength = newArray.length
    const removed: T[] = []
    const processedValues = newArray.map((v) => _processValue(v, admin.shallow))

    if (newLength > MAX_SPLICE_SIZE) {
      for (let i = 0; i < oldLength; i++) removed.push(arr[i])
      arr.length = 0
      for (let i = 0; i < newLength; i += MAX_SPLICE_SIZE) {
        const chunk = processedValues.slice(i, i + MAX_SPLICE_SIZE)
        arr.push(...chunk)
      }
    } else {
      const removedItems = arr.splice(0, oldLength, ...processedValues)
      removed.push(...removedItems)
    }
    admin.changes++
    notifyChanged(admin)
    return removed
  }

  function remove(item: T): number {
    const index = arr.indexOf(item)
    if (index === -1) return -1
    arr.splice(index, 1)
    admin.changes++
    notifyChanged(admin)
    return index
  }

  function clear(): T[] {
    const removed = arr.slice()
    arr.length = 0
    admin.changes++
    notifyChanged(admin)
    return removed
  }

  function toJSON(): T[] {
    trackAccess(admin)
    return arr.slice()
  }

  const proxy = new Proxy(arr as Any, {
    get(_target: Any, prop: string | symbol): Any {
      // Numeric indices first (hottest path)
      if (typeof prop === "string" && isNumericIndex(prop)) {
        trackAccess(admin)
        return arr[prop as Any]
      }
      if (prop === "length") {
        trackAccess(admin)
        return arr.length
      }
      if (prop === $fobx) return admin

      // Check user-defined property overrides BEFORE built-in methods
      // This allows Object.defineProperty(arr, "toString", ...) to work
      const userProp = userProps[prop as string]
      if (userProp) {
        if (userProp.get) return userProp.get.call(proxy)
        return userProp.value
      }

      if (prop === "replace") return replace.bind(proxy)
      if (prop === "remove") return remove.bind(proxy)
      if (prop === "clear") return clear.bind(proxy)
      if (prop === "toJSON") return toJSON.bind(proxy)
      if (prop === Symbol.iterator) {
        return function () {
          trackAccess(admin)
          return arr[Symbol.iterator]()
        }
      }

      const value = arr[prop as Any]
      if (typeof value === "function") {
        return getOrCreateMethod(
          prop as string,
          value as (...args: Any[]) => Any,
        )
      }
      return value
    },

    set(_target: Any, prop: string | symbol, newValue: Any): boolean {
      if (prop === "length") {
        const oldLength = arr.length
        if (newValue !== oldLength) {
          arr.length = newValue
          admin.changes++
          notifyChanged(admin)
        }
        return true
      }
      if (typeof prop === "string" && isNumericIndex(prop)) {
        const index = prop as Any
        const oldValue = arr[index]
        if (admin.comparer(oldValue, newValue)) return true
        arr[index] = _processValue(newValue, admin.shallow)
        admin.changes++
        notifyChanged(admin)
        return true
      }
      _target[prop] = newValue
      return true
    },

    has(_target: Any, prop: string | symbol): boolean {
      if (prop === $fobx) return true
      if (typeof prop === "string" && isNumericIndex(prop)) {
        trackAccess(admin)
        return prop in arr
      }
      return prop in arr
    },

    defineProperty(
      _target: Any,
      prop: string | symbol,
      descriptor: PropertyDescriptor,
    ): boolean {
      userProps[prop as string] = descriptor
      return true
    },
  })

  return proxy
}
