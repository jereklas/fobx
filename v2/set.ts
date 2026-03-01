/**
 * Observable Set implementation for v2
 *
 * Per-key has() tracking (matching MobX behavior):
 * - Plain class implementing Set interface (NOT extending)
 * - data: Set<T> - plain Set storage (values NOT boxed)
 * - admin: Single admin tracks ALL structural changes (for iteration, size, etc.)
 * - hasMap: Map<T, ObservableBox<boolean>> - lazy per-key has() tracking
 * - has() lazily creates per-key boxes when tracked
 * - Native iterators for performance
 *
 * Performance targets:
 * - Match or beat MobX across ALL operations
 * - Lazy has() tracking eliminates unnecessary reactions
 * - Native iterators for best performance
 */

import { $fobx, $global, defaultComparer, getNextId } from "./global.ts"
import type { ObservableAdmin } from "./types.ts"
import { NotificationType } from "./types.ts"
import { endBatch, startBatch } from "./batch.ts"
import { notifyObservers } from "./notifications.ts"
import { runPendingReactions } from "./graph.ts"
import { processValue } from "./object.ts"
import { trackAccess } from "./tracking.ts"
import { box, type ObservableBox, setBoxValue } from "./box.ts"

export interface SetOptions {
  name?: string
  shallow?: boolean // Shallow: values not converted (default: false = deep observable)
}

/**
 * Set administration
 */
export interface SetAdmin<T = unknown> extends ObservableAdmin<undefined> {
  changes: number // Incremented on every mutation - used to detect content changes
}

/**
 * Observable Set - Plain class implementing Set<T>
 * Per-key has() tracking for precise reactivity
 */
class ObservableSet<T = unknown> implements Set<T> {
  // Plain Set storage
  private data: Set<T>

  private options: SetOptions

  // Per-key has() tracking (lazy created)
  private hasMap: Map<T, ObservableBox<boolean>>

  // Single admin - tracks all structural changes (add/delete/clear)
  // Used for iteration, size, forEach, etc.
  [$fobx]: SetAdmin<T>

  constructor(
    values?: Iterable<T> | null,
    options: SetOptions = {},
  ) {
    const id = getNextId()

    this.data = new Set()
    this.hasMap = new Map()
    this.options = options

    // Single admin - tracks all structural changes
    this[$fobx] = {
      id,
      name: options.name || `Set@${id}`,
      value: undefined,
      observers: [],
      comparer: defaultComparer,
      changes: 0,
    }

    // Process initial values
    if (values != null) {
      const shallow = options.shallow ?? false
      for (const value of values) {
        const processed = processValue(value, shallow)
        this.data.add(processed)
      }
    }

    // Assigning the constructor to Set allows for deep compares to correctly compare this against other sets
    // This makes ObservableSet appear as a native Set to libraries like fast-equals
    this.constructor = Object.getPrototypeOf(new Set()).constructor
  }

  /**
   * has(value): boolean
   * Per-key tracking: lazily creates an ObservableBox<boolean> for each tracked key.
   * Only reactions that track specific keys are notified when those keys change.
   */
  has(value: T): boolean {
    // Fast path: not tracking
    if ($global.tracking === null) {
      return this.data.has(value)
    }

    // Tracking: lazy create has observable for this specific key
    let hasBox = this.hasMap.get(value)
    if (!hasBox) {
      hasBox = box(this.data.has(value), {
        name: `${this[$fobx].name}.has(${String(value)})`,
      })
      this.hasMap.set(value, hasBox)
    }

    return hasBox.get()
  }

  /**
   * add(value): this
   */
  add(value: T): this {
    if (this.data.has(value)) return this

    const shallow = this.options.shallow ?? false
    const processedValue = processValue(value, shallow)
    this.data.add(processedValue)

    // Update hasMap if it exists for this key
    const hasBox = this.hasMap.get(value)
    if (hasBox) {
      setBoxValue(hasBox[$fobx], true)
    }

    // Notify structural change
    this[$fobx].changes++
    notifyObservers(this[$fobx], NotificationType.CHANGED)
    if ($global.batchDepth === 0) {
      runPendingReactions()
    }

    return this
  }

  /**
   * delete(value): boolean
   */
  delete(value: T): boolean {
    if (!this.data.has(value)) return false

    this.data.delete(value)

    // Update hasMap if it exists for this key
    const hasBox = this.hasMap.get(value)
    if (hasBox) {
      setBoxValue(hasBox[$fobx], false)
    }

    // Notify structural change
    this[$fobx].changes++
    notifyObservers(this[$fobx], NotificationType.CHANGED)
    if ($global.batchDepth === 0) {
      runPendingReactions()
    }

    return true
  }

  /**
   * clear(): void
   */
  clear(): void {
    if (this.data.size === 0) return

    startBatch()
    try {
      // Clear data
      this.data.clear()

      // Update all hasMap entries to false
      this.hasMap.forEach((hasBox) => {
        setBoxValue(hasBox[$fobx], false)
      })

      // Notify structural change
      this[$fobx].changes++
      notifyObservers(this[$fobx], NotificationType.CHANGED)
    } finally {
      endBatch()
    }
  }

  /**
   * size getter
   */
  get size(): number {
    // Fast path: not tracking
    trackAccess(this[$fobx])
    return this.data.size
  }

  /**
   * values(): SetIterator<T>
   * Lazy tracking: only tracks when .next() is called
   */
  values(): SetIterator<T> {
    const admin = this[$fobx]
    const iterator = this.data.values()
    const origNext = iterator.next.bind(iterator)
    let tracked = false
    Object.defineProperty(iterator, "next", {
      value: function () {
        if (!tracked) {
          tracked = true
          trackAccess(admin)
        }
        return origNext()
      },
      writable: true,
      configurable: true,
      enumerable: false,
    })
    return iterator
  }

  /**
   * keys(): SetIterator<T> (same as values for Set)
   * Lazy tracking: only tracks when .next() is called
   */
  keys(): SetIterator<T> {
    return this.values()
  }

  /**
   * entries(): SetIterator<[T, T]>
   * Lazy tracking: only tracks when .next() is called
   */
  entries(): SetIterator<[T, T]> {
    const admin = this[$fobx]
    const iterator = this.data.entries()
    const origNext = iterator.next.bind(iterator)
    let tracked = false
    Object.defineProperty(iterator, "next", {
      value: function () {
        if (!tracked) {
          tracked = true
          trackAccess(admin)
        }
        return origNext()
      },
      writable: true,
      configurable: true,
      enumerable: false,
    })
    return iterator
  }

  [Symbol.iterator](): SetIterator<T> {
    return this.values()
  }

  /**
   * forEach(callback, thisArg?)
   */
  forEach(
    callback: (value: T, value2: T, set: Set<T>) => void,
    thisArg?: unknown,
  ): void {
    trackAccess(this[$fobx])
    this.data.forEach((value) => {
      callback.call(thisArg, value, value, this)
    })
  }

  /**
   * replace(values): void
   */
  replace(values: Iterable<T> | T[]): void {
    // Validate input
    if (values == null || (typeof values !== "object")) {
      throw new Error(
        "[@fobx/core] Supplied entries was not a Set or an Array.",
      )
    }
    if (
      !Array.isArray(values) && typeof values[Symbol.iterator] !== "function"
    ) {
      throw new Error(
        "[@fobx/core] Supplied entries was not a Set or an Array.",
      )
    }

    // Wrap in batch to ensure consistency
    startBatch()
    try {
      // Convert to array
      const shallow = this.options.shallow ?? false
      const valuesArray = Array.isArray(values) ? values : Array.from(values)
      const newValues = new Set(
        valuesArray.map((v) => processValue(v, shallow)),
      )

      // Check which values need to be deleted
      const toDelete: T[] = []
      this.data.forEach((value) => {
        if (!newValues.has(value)) {
          toDelete.push(value)
        }
      })

      // Check which values need to be added
      const toAdd: T[] = []
      newValues.forEach((value) => {
        if (!this.data.has(value)) {
          toAdd.push(value)
        }
      })

      // Check if order has changed (iteration order matters!)
      let orderChanged = false
      if (toDelete.length === 0 && toAdd.length === 0) {
        const currentValues = Array.from(this.data)
        const newValuesArray = Array.from(newValues)
        if (currentValues.length === newValuesArray.length) {
          for (let i = 0; i < currentValues.length; i++) {
            if (currentValues[i] !== newValuesArray[i]) {
              orderChanged = true
              break
            }
          }
        }
      }

      const hasChanges = toDelete.length > 0 || toAdd.length > 0 || orderChanged

      if (hasChanges) {
        // Delete values not in replacement
        toDelete.forEach((value) => {
          this.data.delete(value)
          // Update hasMap for deleted values
          const hasBox = this.hasMap.get(value)
          if (hasBox) {
            setBoxValue(hasBox[$fobx], false)
          }
        })

        // If order changed, rebuild the Set
        if (orderChanged) {
          this.data.clear()
          newValues.forEach((value) => {
            this.data.add(value)
          })
        } else {
          // Just add new values
          toAdd.forEach((value) => {
            this.data.add(value)
            // Update hasMap for added values
            const hasBox = this.hasMap.get(value)
            if (hasBox) {
              setBoxValue(hasBox[$fobx], true)
            }
          })
        }

        // Single notification for structural changes
        this[$fobx].changes++
        notifyObservers(this[$fobx], NotificationType.CHANGED)
      }
    } finally {
      endBatch()
    }
  }

  /**
   * toJSON(): T[]
   */
  toJSON(): T[] {
    trackAccess(this[$fobx])
    return Array.from(this.data)
  }

  /**
   * toString and toStringTag for proper Set behavior
   */
  toString(): string {
    return "[object ObservableSet]"
  }

  get [Symbol.toStringTag](): string {
    return "Set"
  }

  /**
   * ES2015+ Set methods (delegate to native Set)
   */
  union<U>(other: ReadonlySetLike<U>): Set<T | U> {
    return new Set(this).union(other)
  }

  intersection<U>(other: ReadonlySetLike<U>): Set<T & U> {
    return new Set(this).intersection(other)
  }

  difference<U>(other: ReadonlySetLike<U>): Set<T> {
    return new Set(this).difference(other)
  }

  symmetricDifference<U>(other: ReadonlySetLike<U>): Set<T | U> {
    return new Set(this).symmetricDifference(other)
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this).isSubsetOf(other)
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this).isSupersetOf(other)
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    return new Set(this).isDisjointFrom(other)
  }
}

/**
 * Create an observable set
 */
export function set<T = unknown>(
  values?: Iterable<T> | null,
  options: SetOptions = {},
): ObservableSet<T> {
  return new ObservableSet(values, options)
}

/**
 * Export ObservableSet type
 */
export type { ObservableSet }
