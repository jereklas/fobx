/**
 * Observable Map — reactive Map implementation.
 */

import {
  $fobx,
  _tracking,
  type Any,
  defaultComparer,
  type EqualityComparison,
  getNextId,
  KIND_COLLECTION,
  NOTIFY_CHANGED,
  type ObservableAdmin,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import { endBatch, startBatch } from "./batch.ts"
import { notifyChanged, notifyObservers } from "./notifications.ts"
import { box, getBoxValue, type ObservableBox, setBoxValue } from "./box.ts"
import { trackAccess } from "./tracking.ts"

// Forward declaration — set after object.ts is loaded
let _processValue: <T>(value: T, shallow: boolean) => T = (v) => v

export function setMapProcessValue(
  fn: <T>(value: T, shallow: boolean) => T,
): void {
  _processValue = fn
}

interface KeysAdmin extends ObservableAdmin<undefined> {
  changes: number
}

export interface MapOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean
}

function processMapValue<V>(value: V, options: MapOptions): V {
  const shallow = options.shallow ?? false
  return _processValue(value, shallow)
}

class ObservableMap<K = Any, V = Any> implements Map<K, V> {
  private data: Map<K, ObservableBox<V>>
  private hasMap: Map<K, ObservableBox<boolean>>
  private keysAdmin: KeysAdmin
  private collectionAdmin: KeysAdmin
  private options: MapOptions;
  [$fobx]: KeysAdmin

  constructor(
    entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
    options: MapOptions = {},
  ) {
    if (entries instanceof Map && entries.constructor !== Map) {
      const className = entries.constructor.name
      throw new Error(
        `[@fobx/core] Cannot make observable map from class that inherit from Map: ${className}`,
      )
    }

    const id = getNextId()
    const name = options.name || `Map@${id}`
    const _comparer = resolveComparer(options.comparer)

    this.data = new Map()
    this.hasMap = new Map()
    this.keysAdmin = {
      kind: KIND_COLLECTION,
      id,
      name: `${name}.keys`,
      value: undefined,
      changes: 0,
      observers: [],
      comparer: defaultComparer,
      _epoch: 0,
    }
    this.collectionAdmin = {
      kind: KIND_COLLECTION,
      id: getNextId(),
      name,
      value: undefined,
      changes: 0,
      observers: [],
      comparer: defaultComparer,
      _epoch: 0,
    }
    this.options = { ...options, comparer: _comparer as EqualityComparison }
    this[$fobx] = this.collectionAdmin

    this.constructor = Map

    if (entries != null) {
      this.merge(entries as Any)
    }
  }

  private has_(key: K): boolean {
    return this.data.has(key)
  }

  has(key: K): boolean {
    if (_tracking === null) return this.has_(key)

    let hasBox = this.hasMap.get(key)
    if (!hasBox) {
      hasBox = box(this.has_(key), {
        name: `${this.keysAdmin.name}.has(${String(key)})`,
      })
      this.hasMap.set(key, hasBox)

      // Use onLoseObserver instead of monkey-patching (preserves V8 hidden class)
      const hmRef = this.hasMap
      const keyRef = key
      hasBox[$fobx].onLoseObserver = () => {
        if (hasBox![$fobx].observers.length === 0) {
          hmRef.delete(keyRef)
        }
      }
    }

    return hasBox.get()
  }

  get(key: K): V | undefined {
    if (this.has(key)) {
      return getBoxValue(this.data.get(key)![$fobx])
    }
    return undefined
  }

  set(key: K, value: V): this {
    const hadKey = this.has_(key)
    const processedValue = processMapValue(value, this.options)

    if (hadKey) {
      const valueBox = this.data.get(key)!
      const changed = setBoxValue(valueBox[$fobx], processedValue)
      if (changed) {
        this.collectionAdmin.changes++
        notifyChanged(this.collectionAdmin)
      }
    } else {
      const valueBox = box(processedValue, {
        name: `${this.keysAdmin.name}[${String(key)}]`,
        comparer: this.options.comparer,
      })
      this.data.set(key, valueBox)

      const hasBox = this.hasMap.get(key)
      if (hasBox) setBoxValue(hasBox[$fobx], true)

      this.keysAdmin.changes++
      this.collectionAdmin.changes++
      notifyChanged(this.keysAdmin)
      notifyChanged(this.collectionAdmin)
    }

    return this
  }

  delete(key: K): boolean {
    if (!this.has_(key)) return false

    const valueBox = this.data.get(key)!
    if (valueBox[$fobx].observers.length > 0) {
      notifyObservers(valueBox[$fobx], NOTIFY_CHANGED)
    }

    this.data.delete(key)

    const hasBox = this.hasMap.get(key)
    if (hasBox) setBoxValue(hasBox[$fobx], false)

    this.keysAdmin.changes++
    this.collectionAdmin.changes++
    notifyChanged(this.keysAdmin)
    notifyChanged(this.collectionAdmin)

    return true
  }

  clear(): void {
    if (this.data.size === 0) return

    startBatch()
    try {
      this.data.forEach((valueBox) => {
        if (valueBox[$fobx].observers.length > 0) {
          notifyObservers(valueBox[$fobx], NOTIFY_CHANGED)
        }
      })

      this.hasMap.forEach((hasBox) => {
        setBoxValue(hasBox[$fobx], false)
      })
      // NOTE: Do NOT clear hasMap — reactions may still be tracking those hasBox references.
      // Setting their values to false above is sufficient. Future set() calls will update them.
      this.data.clear()

      this.keysAdmin.changes++
      this.collectionAdmin.changes++
      notifyChanged(this.keysAdmin)
      notifyChanged(this.collectionAdmin)
    } finally {
      endBatch()
    }
  }

  get size(): number {
    trackAccess(this.keysAdmin)
    return this.data.size
  }

  keys(): MapIterator<K> {
    trackAccess(this.keysAdmin)
    return this.data.keys() as MapIterator<K>
  }

  values(): MapIterator<V> {
    trackAccess(this.keysAdmin)
    const size = this.data.size
    const values: V[] = new Array(size)
    let i = 0
    for (const valueBox of this.data.values()) {
      values[i++] = getBoxValue(valueBox[$fobx])
    }
    return values.values() as MapIterator<V>
  }

  entries(): MapIterator<[K, V]> {
    trackAccess(this.keysAdmin)
    const size = this.data.size
    const entries: [K, V][] = new Array(size)
    let i = 0
    for (const [key, valueBox] of this.data.entries()) {
      entries[i++] = [key, getBoxValue(valueBox[$fobx])]
    }
    return entries.values() as MapIterator<[K, V]>
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }

  forEach(
    callback: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: Any,
  ): void {
    trackAccess(this.keysAdmin)
    this.data.forEach((valueBox, key) => {
      callback.call(thisArg, getBoxValue(valueBox[$fobx]), key, this as Any)
    })
  }

  replace(entries: Iterable<[K, V]> | { [key: string]: V } | Map<K, V>): void {
    startBatch()
    try {
      let entriesArray: [K, V][]
      if (entries instanceof Map) {
        entriesArray = Array.from(entries.entries())
      } else if (entries != null && typeof entries === "object") {
        if (Symbol.iterator in (entries as Any)) {
          try {
            entriesArray = Array.from(entries as Iterable<[K, V]>)
          } catch (_e) {
            throw new Error(
              `[@fobx/core] Cannot convert to map from '${typeof entries}'`,
            )
          }
        } else {
          entriesArray = Object.entries(entries) as unknown as [K, V][]
        }
      } else {
        throw new Error(`[@fobx/core] Cannot convert to map from '${entries}'`)
      }

      const newKeys = new Set(entriesArray.map(([k]) => k))

      const toDelete: K[] = []
      this.data.forEach((_box, key) => {
        if (!newKeys.has(key)) toDelete.push(key)
      })

      let hasStructuralChanges = toDelete.length > 0

      for (const [key] of entriesArray) {
        if (!this.data.has(key)) {
          hasStructuralChanges = true
          break
        }
      }

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

      const oldData = new Map(this.data)

      toDelete.forEach((key) => {
        const valueBox = this.data.get(key)!
        this.data.delete(key)
        if (valueBox[$fobx].observers.length > 0) {
          notifyObservers(valueBox[$fobx], NOTIFY_CHANGED)
        }
        const hasBox = this.hasMap.get(key)
        if (hasBox) setBoxValue(hasBox[$fobx], false)
      })

      entriesArray.forEach(([key, value]) => {
        const processedValue = processMapValue(value, this.options)
        const existingBox = oldData.get(key)

        if (existingBox) {
          this.data.delete(key)
          setBoxValue(existingBox[$fobx], processedValue)
          this.data.set(key, existingBox)
        } else {
          const valueBox = box(processedValue, {
            name: `${this.keysAdmin.name}[${String(key)}]`,
            comparer: this.options.comparer,
          })
          this.data.set(key, valueBox)

          const hasBox = this.hasMap.get(key)
          if (hasBox) setBoxValue(hasBox[$fobx], true)
        }
      })

      if (hasStructuralChanges) {
        this.keysAdmin.changes++
        this.collectionAdmin.changes++
        notifyChanged(this.keysAdmin)
        notifyChanged(this.collectionAdmin)
      }
    } finally {
      endBatch()
    }
  }

  merge(entries: Iterable<[K, V]> | { [key: string]: V } | Map<K, V>): void {
    startBatch()
    try {
      let entriesArray: [K, V][]
      if (entries instanceof Map) {
        entriesArray = Array.from(entries.entries())
      } else if (Symbol.iterator in (entries as Any)) {
        entriesArray = Array.from(entries as Iterable<[K, V]>)
      } else {
        entriesArray = Object.entries(entries) as unknown as [K, V][]
      }

      let hasStructuralChanges = false

      entriesArray.forEach(([key, value]) => {
        const processedValue = processMapValue(value, this.options)
        const existingBox = this.data.get(key)

        if (existingBox) {
          setBoxValue(existingBox[$fobx], processedValue)
        } else {
          const valueBox = box(processedValue, {
            name: `${this.keysAdmin.name}[${String(key)}]`,
            comparer: this.options.comparer,
          })
          this.data.set(key, valueBox)

          const hasBox = this.hasMap.get(key)
          if (hasBox) setBoxValue(hasBox[$fobx], true)

          hasStructuralChanges = true
        }
      })

      if (hasStructuralChanges) {
        this.keysAdmin.changes++
        this.collectionAdmin.changes++
        notifyChanged(this.keysAdmin)
        notifyChanged(this.collectionAdmin)
      }
    } finally {
      endBatch()
    }
  }

  toJSON(): [K, V][] {
    trackAccess(this.keysAdmin)
    return Array.from(this.data.entries()).map((
      [k, valueBox],
    ) => [k, getBoxValue(valueBox[$fobx])])
  }

  toString(): string {
    return "[object ObservableMap]"
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }
}

export function map<K = Any, V = Any>(
  entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
  options: MapOptions = {},
): ObservableMap<K, V> {
  return new ObservableMap(entries, options)
}

export type { ObservableMap }
