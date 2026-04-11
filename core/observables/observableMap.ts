/**
 * Observable Map — reactive Map implementation.
 */

import {
  $fobx,
  $scheduler,
  type Any,
  defaultComparer,
  type EqualityChecker,
  type EqualityComparison,
  getNextId,
  hasObservers,
  KIND_BOX,
  KIND_COLLECTION,
  type ObservableAdmin,
} from "../state/global.ts"
import { resolveComparer } from "../state/instance.ts"
import { endBatch, startBatch } from "../transactions/batch.ts"
import {
  isNotProduction,
  notifyChanged,
  notifyObserversChanged,
  warnIfObservedWriteOutsideTransaction,
} from "../state/notifications.ts"
import {
  type ObservableBox,
  observableBox,
  setBoxValue,
} from "./observableBox.ts"
import {
  applyWithoutTracking,
  trackAccess,
  trackAccessKnownTracked,
} from "../reactions/tracking.ts"
import {
  rememberConvertedValue,
  withConversionContext,
} from "./conversionContext.ts"

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

class ObservableMap<K = Any, V = Any> implements Map<K, V> {
  private data: Map<K, ObservableAdmin<V>>
  private hasMap: Map<K, ObservableBox<boolean>> | undefined
  private keysAdmin: KeysAdmin
  private collectionAdmin: KeysAdmin
  private _comparer: EqualityChecker
  private _shallow: boolean;
  [$fobx]: KeysAdmin

  constructor(
    entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
    options?: MapOptions,
  ) {
    if (entries instanceof Map && entries.constructor !== Map) {
      const className = entries.constructor.name
      throw new Error(
        `[@fobx/core] Cannot make observable map from class that inherit from Map: ${className}`,
      )
    }

    const id = getNextId()
    const name = options?.name || `Map@${id}`
    const comparer = options?.comparer

    this.data = new Map()
    this._comparer = comparer === undefined
      ? defaultComparer
      : resolveComparer(comparer)
    this._shallow = options?.shallow ?? false
    this.keysAdmin = {
      kind: KIND_COLLECTION,
      id,
      name: `${name}.keys`,
      value: undefined,
      changes: 0,
      observers: null,
      comparer: defaultComparer,
      _epoch: 0,
    }
    this.collectionAdmin = {
      kind: KIND_COLLECTION,
      id: getNextId(),
      name,
      value: undefined,
      changes: 0,
      observers: null,
      comparer: defaultComparer,
      _epoch: 0,
    }
    this[$fobx] = this.collectionAdmin

    if (entries != null && typeof entries === "object") {
      rememberConvertedValue(entries, this)
    }

    if (entries != null) {
      this._init(entries)
    }
  }

  /** Fast init — no batching, no notifications, no existence checks. */
  private _init(
    entries: Iterable<readonly [K, V]> | Record<string, V>,
  ): void {
    if (entries instanceof Map) {
      for (const [key, value] of entries) {
        this.data.set(
          key,
          this._newAdmin(key, _processValue(value, this._shallow)),
        )
      }
    } else if (Symbol.iterator in (entries as Any)) {
      for (const [key, value] of entries as Iterable<readonly [K, V]>) {
        this.data.set(
          key,
          this._newAdmin(key, _processValue(value, this._shallow)),
        )
      }
    } else {
      for (const key of Object.keys(entries as object)) {
        const value = (entries as Record<string, Any>)[key]
        this.data.set(
          key as unknown as K,
          this._newAdmin(
            key as unknown as K,
            _processValue(value, this._shallow),
          ),
        )
      }
    }
  }

  /** Create an ObservableAdmin for a value entry (avoids box() wrapper overhead). */
  private _newAdmin(key: K, value: V): ObservableAdmin<V> {
    const id = getNextId()
    return {
      kind: KIND_BOX,
      id,
      name: `${this.keysAdmin.name}[${String(key)}]`,
      value,
      observers: null,
      comparer: this._comparer,
      _epoch: 0,
    }
  }

  private _warnIfObservedWriteOutsideTransaction(key?: K): void {
    const valueAdmin = key !== undefined ? this.data.get(key) : undefined
    const hasBox = key !== undefined ? this.hasMap?.get(key) : undefined
    const observedAdmin = this.collectionAdmin.observers !== null
      ? this.collectionAdmin
      : this.keysAdmin.observers !== null
      ? this.keysAdmin
      : valueAdmin?.observers !== null && valueAdmin !== undefined
      ? valueAdmin
      : hasBox?.[$fobx].observers !== null && hasBox !== undefined
      ? hasBox[$fobx]
      : undefined

    if (observedAdmin !== undefined) {
      warnIfObservedWriteOutsideTransaction(observedAdmin)
    }
  }

  has(key: K): boolean {
    const tracking = $scheduler.tracking
    if (tracking === null) return this.data.has(key)

    let hasMap = this.hasMap
    let hasBox = hasMap?.get(key)
    if (!hasBox) {
      hasBox = observableBox(this.data.has(key), {
        name: `${this.keysAdmin.name}.has(${String(key)})`,
      })
      if (!hasMap) {
        hasMap = new Map()
        this.hasMap = hasMap
      }
      hasMap.set(key, hasBox)

      const hmRef = hasMap
      const keyRef = key
      hasBox[$fobx].onLoseObserver = () => {
        if (!hasObservers(hasBox![$fobx])) {
          hmRef.delete(keyRef)
        }
      }
    }

    const hasAdmin = hasBox[$fobx]
    trackAccessKnownTracked(hasAdmin, tracking)
    return hasAdmin.value
  }

  get(key: K): V | undefined {
    const tracking = $scheduler.tracking
    if (tracking === null) {
      const admin = this.data.get(key)
      return admin !== undefined ? admin.value : undefined
    }
    if (this.has(key)) {
      const admin = this.data.get(key)!
      trackAccessKnownTracked(admin, tracking)
      return admin.value
    }
    return undefined
  }

  getOrInsert(key: K, defaultValue: V): V {
    if (this.data.has(key)) {
      return this.get(key)!
    }

    this.set(key, defaultValue)
    return this.get(key)!
  }

  getOrInsertComputed(key: K, callback: (key: K) => V): V {
    if (this.data.has(key)) {
      return this.get(key)!
    }

    if (typeof callback !== "function") {
      throw new TypeError(
        `[@fobx/core] ObservableMap.getOrInsertComputed requires a callback function.`,
      )
    }

    this.set(key, applyWithoutTracking(callback, undefined, [key]))
    return this.get(key)!
  }

  set(key: K, value: V): this {
    const hadKey = this.data.has(key)
    const processedValue = _processValue(value, this._shallow)

    if (isNotProduction) {
      this._warnIfObservedWriteOutsideTransaction(key)
    }

    if (hadKey) {
      const admin = this.data.get(key)!
      const changed = setBoxValue(admin, processedValue)
      if (changed) {
        this.collectionAdmin.changes++
        notifyChanged(this.collectionAdmin)
      }
    } else {
      this.data.set(key, this._newAdmin(key, processedValue))

      const hasBox = this.hasMap?.get(key)
      if (hasBox) setBoxValue(hasBox[$fobx], true)

      this.keysAdmin.changes++
      this.collectionAdmin.changes++
      notifyChanged(this.keysAdmin)
      notifyChanged(this.collectionAdmin)
    }

    return this
  }

  delete(key: K): boolean {
    if (!this.data.has(key)) return false

    if (isNotProduction) {
      this._warnIfObservedWriteOutsideTransaction(key)
    }

    const admin = this.data.get(key)!
    notifyObserversChanged(admin)

    this.data.delete(key)

    const hasBox = this.hasMap?.get(key)
    if (hasBox) setBoxValue(hasBox[$fobx], false)

    this.keysAdmin.changes++
    this.collectionAdmin.changes++
    notifyChanged(this.keysAdmin)
    notifyChanged(this.collectionAdmin)

    return true
  }

  clear(): void {
    if (this.data.size === 0) return

    if (isNotProduction) {
      this._warnIfObservedWriteOutsideTransaction()
    }

    startBatch()
    try {
      this.data.forEach((admin) => {
        notifyObserversChanged(admin)
      })

      this.hasMap?.forEach((hasBox) => {
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
    for (const admin of this.data.values()) {
      trackAccess(admin)
      values[i++] = admin.value
    }
    return values.values() as MapIterator<V>
  }

  entries(): MapIterator<[K, V]> {
    trackAccess(this.keysAdmin)
    const size = this.data.size
    const entries: [K, V][] = new Array(size)
    let i = 0
    for (const [key, admin] of this.data.entries()) {
      trackAccess(admin)
      entries[i++] = [key, admin.value]
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
    this.data.forEach((admin, key) => {
      trackAccess(admin)
      callback.call(thisArg, admin.value, key, this as Any)
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
        const admin = this.data.get(key)!
        this.data.delete(key)
        notifyObserversChanged(admin)
        const hasBox = this.hasMap?.get(key)
        if (hasBox) setBoxValue(hasBox[$fobx], false)
      })

      entriesArray.forEach(([key, value]) => {
        const processedValue = _processValue(value, this._shallow)
        const existingAdmin = oldData.get(key)

        if (existingAdmin) {
          this.data.delete(key)
          setBoxValue(existingAdmin, processedValue)
          this.data.set(key, existingAdmin)
        } else {
          this.data.set(key, this._newAdmin(key, processedValue))

          const hasBox = this.hasMap?.get(key)
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
        const processedValue = _processValue(value, this._shallow)
        const existingAdmin = this.data.get(key)

        if (existingAdmin) {
          setBoxValue(existingAdmin, processedValue)
        } else {
          this.data.set(key, this._newAdmin(key, processedValue))

          const hasBox = this.hasMap?.get(key)
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
      [k, admin],
    ) => {
      trackAccess(admin)
      return [k, admin.value]
    })
  }

  toString(): string {
    return "[object ObservableMap]"
  }

  get [Symbol.toStringTag](): string {
    return "Map"
  }
} // Prototype-level assignment (one-time, preserves V8 hidden class)

;(ObservableMap.prototype as Any).constructor = Map

export function observableMap<K = Any, V = Any>(
  entries?: Iterable<readonly [K, V]> | Record<string, V> | null,
  options?: MapOptions,
): ObservableMap<K, V> {
  return withConversionContext(() => new ObservableMap(entries, options))
}

export type { ObservableMap }
