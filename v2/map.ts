/**
 * Observable Map implementation for v2
 *
 * Following MobX patterns exactly:
 * - Plain class implementing Map interface (NOT extending)
 * - data: Map<K, ObservableBox<V>> - each value is boxed
 * - hasMap: Map<K, ObservableBox<boolean>> - lazy per-key has() tracking
 * - keysAdmin: tracks structural changes (add/delete)
 * - Lazy has() observables - only created when tracked
 * - Auto-cleanup of unused observables
 * - get() delegates to has() for tracking
 *
 * Performance targets:
 * - Match or beat MobX across ALL operations
 * - Lazy tracking should eliminate has/size overhead
 */

import {
  $fobx,
  $global,
  defaultComparer,
  type EqualityComparison,
  getNextId,
} from "./global.ts"
import type { ObservableAdmin } from "./types.ts"
import { NotificationType } from "./types.ts"
import { endBatch, startBatch } from "./batch.ts"
import { notifyObservers } from "./notifications.ts"
import { runPendingReactions } from "./graph.ts"
import { box, getBoxValue, type ObservableBox, setBoxValue } from "./box.ts"
import { processValue } from "./object.ts"
import { resolveComparer } from "./instance.ts"
import { trackAccess } from "./tracking.ts"

interface KeysAdmin extends ObservableAdmin<undefined> {
  changes: number
}

export interface MapOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean // Shallow: values not converted (default: false = deep observable)
}

/**
 * Process a value based on map options
 * Wrapper around shared processValue that extracts shallow flag
 */
function processMapValue<V>(value: V, options: MapOptions): V {
  const shallow = options.shallow ?? false
  return processValue(value, shallow)
}

/**
 * Observable Map - Plain class implementing Map<K, V>
 * Follows MobX architecture exactly
 */
class ObservableMap<K = any, V = any> implements Map<K, V> {
  // MobX equivalent: data_ - each value is wrapped in a box
  private data: Map<K, ObservableBox<V>>

  // MobX equivalent: hasMap_ - lazy created per-key has tracking
  private hasMap: Map<K, ObservableBox<boolean>>

  // MobX equivalent: keysAtom_ - tracks structural changes ONLY (keys, size)
  private keysAdmin: KeysAdmin

  // collectionAdmin - tracks ALL changes (structural + values) for whole-map tracking
  private collectionAdmin: KeysAdmin

  private options: MapOptions;

  // Admin property for fobx compatibility - exposes collectionAdmin for reaction(() => map, ...)
  [$fobx]: KeysAdmin

  constructor(
    entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
    options: MapOptions = {},
  ) {
    // Check if entries is a Map subclass (inheriting from Map but not plain Map)
    if (entries instanceof Map && entries.constructor !== Map) {
      const className = entries.constructor.name
      throw new Error(
        `[@fobx/core] Cannot make observable map from class that inherit from Map: ${className}`,
      )
    }

    const id = getNextId()
    const name = options.name || `Map@${id}`

    // Resolve comparer at creation time
    const comparer = resolveComparer(options.comparer)

    this.data = new Map()
    this.hasMap = new Map()
    this.keysAdmin = {
      id,
      name: `${name}.keys`,
      value: undefined,
      changes: 0,
      observers: [],
      comparer: defaultComparer,
    }
    this.collectionAdmin = {
      id: getNextId(),
      name,
      value: undefined,
      changes: 0,
      observers: [],
      comparer: defaultComparer,
    }
    this.options = { ...options, comparer }

    // Expose collectionAdmin for whole-map tracking
    this[$fobx] = this.collectionAdmin

    // Assigning the constructor to Map allows for deep compares to correctly compare this against other maps
    // This makes ObservableMap appear as a native Map to libraries like fast-equals
    this.constructor = Object.getPrototypeOf(new Map()).constructor

    // Process initial entries
    if (entries != null) {
      this.merge(entries as any)
    }
  }

  // Private helper: check if key exists (no tracking)
  private has_(key: K): boolean {
    return this.data.has(key)
  }

  /**
   * has(key): boolean
   * MobX pattern: lazy create ObservableValue for this key when tracked
   */
  has(key: K): boolean {
    // Fast path: not tracking
    if ($global.tracking === null) {
      return this.has_(key)
    }

    // Tracking: lazy create has observable for this specific key
    let hasBox = this.hasMap.get(key)
    if (!hasBox) {
      hasBox = box(this.has_(key), {
        name: `${this.keysAdmin.name}.has(${String(key)})`,
      })
      this.hasMap.set(key, hasBox)

      // Auto-cleanup: Remove hasBox from hasMap when it becomes unobserved
      const admin = hasBox[$fobx]
      const originalObservers = admin.observers
      // Monkey-patch to detect when observers array becomes empty
      Object.defineProperty(admin, "observers", {
        get() {
          return originalObservers
        },
        set(newObservers) {
          originalObservers.length = 0
          originalObservers.push(...newObservers)
          if (newObservers.length === 0) {
            this.hasMap.delete(key)
          }
        },
        configurable: true,
      })
    }

    return hasBox.get()
  }

  /**
   * get(key): V | undefined
   * MobX pattern: delegate to has() for tracking, then read value
   */
  get(key: K): V | undefined {
    if (this.has(key)) { // ← Tracks via has() lazily
      // PERF: Use getBoxValue to avoid box wrapper overhead
      return getBoxValue(this.data.get(key)![$fobx])
    }
    return undefined
  }

  /**
   * set(key, value): this
   */
  set(key: K, value: V): this {
    const hadKey = this.has_(key)
    const processedValue = processMapValue(value, this.options)

    if (hadKey) {
      // Update existing value
      const valueBox = this.data.get(key)!

      // PERF: Use setBoxValue to avoid box wrapper overhead
      const changed = setBoxValue(valueBox[$fobx], processedValue)

      if (changed) {
        // Notify collectionAdmin (whole-map tracking)
        this.collectionAdmin.changes++
        if (this.collectionAdmin.observers.length > 0) {
          notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
        }

        if ($global.batchDepth === 0) {
          runPendingReactions()
        }
      }

      // No need to update hasMap - key still exists
    } else {
      // Add new key
      const valueBox = box(processedValue, {
        name: `${this.keysAdmin.name}[${String(key)}]`,
        comparer: this.options.comparer,
      })
      this.data.set(key, valueBox)

      // Update hasMap if it exists for this key
      const hasBox = this.hasMap.get(key)
      if (hasBox) {
        // PERF: Use setBoxValue to avoid box wrapper overhead
        setBoxValue(hasBox[$fobx], true)
      }

      // Notify both admins for structural change (new key)
      this.keysAdmin.changes++
      this.collectionAdmin.changes++

      if (this.keysAdmin.observers.length > 0) {
        notifyObservers(this.keysAdmin, NotificationType.CHANGED)
      }
      if (this.collectionAdmin.observers.length > 0) {
        notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
      }

      if ($global.batchDepth === 0) {
        runPendingReactions()
      }
    }

    return this
  }

  /**
   * delete(key): boolean
   */
  delete(key: K): boolean {
    if (!this.has_(key)) return false

    const valueBox = this.data.get(key)!

    // Notify box observers (value -> undefined)
    if (valueBox[$fobx].observers.length > 0) {
      notifyObservers(valueBox[$fobx], NotificationType.CHANGED)
    }

    // Delete from data
    this.data.delete(key)

    // Update hasMap if it exists for this key
    const hasBox = this.hasMap.get(key)
    if (hasBox) {
      // PERF: Use setBoxValue to avoid box wrapper overhead
      setBoxValue(hasBox[$fobx], false)
      // Don't delete hasMap entry - cleanup handled by monkey-patched observers
    }

    // Notify structural change to both admins
    this.keysAdmin.changes++
    this.collectionAdmin.changes++

    if (this.keysAdmin.observers.length > 0) {
      notifyObservers(this.keysAdmin, NotificationType.CHANGED)
    }
    if (this.collectionAdmin.observers.length > 0) {
      notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
    }

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
      // Notify all box observers
      this.data.forEach((valueBox) => {
        if (valueBox[$fobx].observers.length > 0) {
          notifyObservers(valueBox[$fobx], NotificationType.CHANGED)
        }
      })

      // Notify all hasMap observers
      this.hasMap.forEach((hasBox, _key) => {
        // PERF: Use setBoxValue to avoid box wrapper overhead
        setBoxValue(hasBox[$fobx], false)
      })
      this.hasMap.clear()

      // Clear data
      this.data.clear()

      // Notify structural change to both admins
      this.keysAdmin.changes++
      this.collectionAdmin.changes++

      if (this.keysAdmin.observers.length > 0) {
        notifyObservers(this.keysAdmin, NotificationType.CHANGED)
      }
      if (this.collectionAdmin.observers.length > 0) {
        notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
      }
    } finally {
      endBatch()
    }
  }

  /**
   * size getter
   */
  get size(): number {
    // Fast path: not tracking
    trackAccess(this.keysAdmin)
    return this.data.size
  }

  /**
   * keys(): MapIterator<K>
   */
  keys(): MapIterator<K> {
    trackAccess(this.keysAdmin)
    return this.data.keys() as MapIterator<K>
  }

  /**
   * values(): MapIterator<V>
   */
  values(): MapIterator<V> {
    trackAccess(this.keysAdmin)

    // Pre-allocate array and unwrap values (faster than generator)
    const size = this.data.size
    const values: V[] = new Array(size)
    let i = 0
    for (const valueBox of this.data.values()) {
      // PERF: Track each value box using getBoxValue to avoid wrapper overhead
      values[i++] = getBoxValue(valueBox[$fobx])
    }

    return values.values() as MapIterator<V>
  }

  /**
   * entries(): MapIterator<[K, V]>
   */
  entries(): MapIterator<[K, V]> {
    trackAccess(this.keysAdmin)

    // Pre-allocate array and unwrap entries (faster than generator)
    const size = this.data.size
    const entries: [K, V][] = new Array(size)
    let i = 0
    for (const [key, valueBox] of this.data.entries()) {
      // PERF: Track each value box using getBoxValue to avoid wrapper overhead
      entries[i++] = [key, getBoxValue(valueBox[$fobx])]
    }

    return entries.values() as MapIterator<[K, V]>
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }

  /**
   * forEach(callback, thisArg?)
   */
  forEach(
    callback: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: any,
  ): void {
    trackAccess(this.keysAdmin)

    this.data.forEach((valueBox, key) => {
      // PERF: Track each value box using getBoxValue to avoid wrapper overhead
      callback.call(thisArg, getBoxValue(valueBox[$fobx]), key, this as any)
    })
  }

  /**
   * replace(entries): void
   * Replaces entire map content with new entries
   */
  replace(entries: Iterable<[K, V]> | { [key: string]: V } | Map<K, V>): void {
    startBatch()
    try {
      // Validate input - must be Map, iterable, or object
      let entriesArray: [K, V][]
      if (entries instanceof Map) {
        entriesArray = Array.from(entries.entries())
      } else if (entries != null && typeof entries === "object") {
        // Check for iterable first
        if (Symbol.iterator in (entries as any)) {
          try {
            entriesArray = Array.from(entries as Iterable<[K, V]>)
          } catch (e) {
            // Iterator error - provide user-friendly message
            throw new Error(
              `[@fobx/core] Cannot convert to map from '${typeof entries}'`,
            )
          }
        } else {
          // Plain object - use Object.entries
          entriesArray = Object.entries(entries) as unknown as [K, V][]
        }
      } else {
        // Not an object, map, or iterable
        throw new Error(`[@fobx/core] Cannot convert to map from '${entries}'`)
      }

      // Track which keys are in the replacement
      const newKeys = new Set(entriesArray.map(([k]) => k))

      // Check which keys need to be deleted
      const toDelete: K[] = []
      this.data.forEach((box, key) => {
        if (!newKeys.has(key)) {
          toDelete.push(key)
        }
      })

      // Track if we have structural changes (additions or deletions)
      let hasStructuralChanges = toDelete.length > 0

      // Check if any keys are being added (not just replaced)
      for (const [key] of entriesArray) {
        if (!this.data.has(key)) {
          hasStructuralChanges = true
          break
        }
      }

      // Check if order has changed (iteration order matters!)
      if (!hasStructuralChanges) {
        const currentKeys = Array.from(this.data.keys())
        const newKeysArray = entriesArray.map(([k]) => k)
        if (currentKeys.length === newKeysArray.length) {
          for (let i = 0; i < currentKeys.length; i++) {
            if (currentKeys[i] !== newKeysArray[i]) {
              hasStructuralChanges = true
              break
            }
          }
        }
      }

      // Save all existing boxes before we reorder
      const oldData = new Map(this.data)

      // Delete keys not in replacement FIRST
      toDelete.forEach((key) => {
        const valueBox = this.data.get(key)!
        this.data.delete(key)

        // Notify box observers (value -> undefined)
        if (valueBox[$fobx].observers.length > 0) {
          notifyObservers(valueBox[$fobx], NotificationType.CHANGED)
        }

        // Update hasMap if exists
        const hasBox = this.hasMap.get(key)
        if (hasBox) {
          // PERF: Use setBoxValue to avoid box wrapper overhead
          setBoxValue(hasBox[$fobx], false)
        }
      })

      // Now reorder by deleting and re-inserting all remaining keys
      // This preserves the new insertion order
      entriesArray.forEach(([key, value]) => {
        const processedValue = processMapValue(value, this.options)
        const existingBox = oldData.get(key)

        if (existingBox) {
          // Existing key - delete it first to reset its position
          this.data.delete(key)
          // PERF: Update its value using setBoxValue (checks equality and notifies if needed)
          setBoxValue(existingBox[$fobx], processedValue)
          // Re-insert in new position
          this.data.set(key, existingBox)
        } else {
          // New key - create new box
          const valueBox = box(processedValue, {
            name: `${this.keysAdmin.name}[${String(key)}]`,
            comparer: this.options.comparer,
          })
          this.data.set(key, valueBox)

          // Update hasMap if exists
          const hasBox = this.hasMap.get(key)
          if (hasBox) {
            // PERF: Use setBoxValue to avoid box wrapper overhead
            setBoxValue(hasBox[$fobx], true)
          }
        }
      })

      // Single notification for structural changes (additions/deletions)
      // Changes in iteration order are considered structural
      if (hasStructuralChanges) {
        this.keysAdmin.changes++
        this.collectionAdmin.changes++

        if (this.keysAdmin.observers.length > 0) {
          notifyObservers(this.keysAdmin, NotificationType.CHANGED)
        }
        if (this.collectionAdmin.observers.length > 0) {
          notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
        }
      }
    } finally {
      endBatch()
    }
  }

  /**
   * merge(entries): void
   * Merges entries into the map without removing existing keys
   */
  merge(entries: Iterable<[K, V]> | { [key: string]: V } | Map<K, V>): void {
    startBatch()
    try {
      // Convert to array of entries
      let entriesArray: [K, V][]
      if (entries instanceof Map) {
        entriesArray = Array.from(entries.entries())
      } else if (Symbol.iterator in (entries as any)) {
        entriesArray = Array.from(entries as Iterable<[K, V]>)
      } else {
        entriesArray = Object.entries(entries) as unknown as [K, V][]
      }

      let hasStructuralChanges = false

      // Set/update all entries
      entriesArray.forEach(([key, value]) => {
        const processedValue = processMapValue(value, this.options)
        const existingBox = this.data.get(key)

        if (existingBox) {
          // PERF: Use setBoxValue to avoid box wrapper overhead
          setBoxValue(existingBox[$fobx], processedValue)
        } else {
          const valueBox = box(processedValue, {
            name: `${this.keysAdmin.name}[${String(key)}]`,
            comparer: this.options.comparer,
          })
          this.data.set(key, valueBox)

          // Update hasMap if exists
          const hasBox = this.hasMap.get(key)
          if (hasBox) {
            // PERF: Use setBoxValue to avoid box wrapper overhead
            setBoxValue(hasBox[$fobx], true)
          }

          hasStructuralChanges = true
        }
      })

      // Single notification for structural changes only
      if (hasStructuralChanges) {
        this.keysAdmin.changes++
        this.collectionAdmin.changes++

        if (this.keysAdmin.observers.length > 0) {
          notifyObservers(this.keysAdmin, NotificationType.CHANGED)
        }
        if (this.collectionAdmin.observers.length > 0) {
          notifyObservers(this.collectionAdmin, NotificationType.CHANGED)
        }
      }
    } finally {
      endBatch()
    }
  }

  /**
   * toJSON(): [K, V][]
   */
  toJSON(): [K, V][] {
    // Track keysAdmin if tracking
    if ($global.tracking !== null) {
      const tracking = $global.tracking
      const deps = tracking.deps
      if (deps.indexOf(this.keysAdmin) === -1) {
        deps.push(this.keysAdmin)
      }
      const observers = this.keysAdmin.observers
      if (observers.indexOf(tracking) === -1) {
        observers.push(tracking)
      }
    }

    // PERF: Track each value box using getBoxValue to avoid wrapper overhead
    return Array.from(this.data.entries()).map((
      [k, valueBox],
    ) => [k, getBoxValue(valueBox[$fobx])])
  }

  /**
   * toString and toStringTag for proper Map behavior
   */
  toString(): string {
    return "[object ObservableMap]"
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }
}

/**
 * Create an observable map
 */
export function map<K = any, V = any>(
  entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
  options: MapOptions = {},
): ObservableMap<K, V> {
  return new ObservableMap(entries, options)
}

/**
 * Export ObservableMap type
 */
export type { ObservableMap }
