/**
 * Observable Set — reactive Set implementation.
 */

import {
  $fobx,
  $scheduler,
  type Any,
  defaultComparer,
  getNextId,
  hasObservers,
  KIND_COLLECTION,
  type ObservableAdmin,
} from "../state/global.ts"
import { endBatch, startBatch } from "../transactions/batch.ts"
import {
  isNotProduction,
  notifyChanged,
  warnIfObservedWriteOutsideTransaction,
} from "../state/notifications.ts"
import { trackAccess } from "../reactions/tracking.ts"
import {
  type ObservableBox,
  observableBox,
  setBoxValue,
} from "./observableBox.ts"
import {
  rememberConvertedValue,
  withConversionContext,
} from "./conversionContext.ts"

// Forward declaration — set after object.ts is loaded
let _processValue: <T>(value: T, shallow: boolean) => T = (v) => v

export function setSetProcessValue(
  fn: <T>(value: T, shallow: boolean) => T,
): void {
  _processValue = fn
}

export interface SetOptions {
  name?: string
  shallow?: boolean
}

export interface SetAdmin extends ObservableAdmin<undefined> {
  changes: number
}

class ObservableSet<T = unknown> implements Set<T> {
  private data: Set<T>
  private options: SetOptions
  private shallow: boolean
  private hasMap: Map<T, ObservableBox<boolean>>;
  [$fobx]: SetAdmin

  constructor(values?: Iterable<T> | null, options: SetOptions = {}) {
    const id = getNextId()
    this.data = new Set()
    this.hasMap = new Map()
    this.options = options
    this.shallow = options.shallow ?? false
    this[$fobx] = {
      kind: KIND_COLLECTION,
      id,
      name: options.name || `Set@${id}`,
      value: undefined,
      observers: null,
      comparer: defaultComparer,
      _epoch: 0,
      changes: 0,
    }

    if (values != null && typeof values === "object") {
      rememberConvertedValue(values, this)
    }

    if (values != null) {
      for (const value of values) {
        this.data.add(_processValue(value, this.shallow))
      }
    }

    this.constructor = Set
  }

  has(value: T): boolean {
    if ($scheduler.tracking === null) return this.data.has(value)

    let hasBox = this.hasMap.get(value)
    if (!hasBox) {
      hasBox = observableBox(this.data.has(value), {
        name: `${this[$fobx].name}.has(${String(value)})`,
      })
      this.hasMap.set(value, hasBox)

      // Cleanup when unobserved (prevents memory leaks)
      const hmRef = this.hasMap
      const valRef = value
      hasBox[$fobx].onLoseObserver = () => {
        if (!hasObservers(hasBox![$fobx])) {
          hmRef.delete(valRef)
        }
      }
    }

    return hasBox.get()
  }

  add(value: T): this {
    if (this.data.has(value)) return this

    if (isNotProduction) {
      warnIfObservedWriteOutsideTransaction(this[$fobx])
    }

    const processedValue = _processValue(value, this.shallow)
    this.data.add(processedValue)

    const hasBox = this.hasMap.get(value)
    if (hasBox) setBoxValue(hasBox[$fobx], true)

    this[$fobx].changes++
    notifyChanged(this[$fobx])
    return this
  }

  delete(value: T): boolean {
    if (!this.data.has(value)) return false

    if (isNotProduction) {
      warnIfObservedWriteOutsideTransaction(this[$fobx])
    }

    this.data.delete(value)

    const hasBox = this.hasMap.get(value)
    if (hasBox) setBoxValue(hasBox[$fobx], false)

    this[$fobx].changes++
    notifyChanged(this[$fobx])
    return true
  }

  clear(): void {
    if (this.data.size === 0) return

    if (isNotProduction) {
      warnIfObservedWriteOutsideTransaction(this[$fobx])
    }

    startBatch()
    try {
      this.data.clear()
      this.hasMap.forEach((hasBox) => {
        setBoxValue(hasBox[$fobx], false)
      })
      this[$fobx].changes++
      notifyChanged(this[$fobx])
    } finally {
      endBatch()
    }
  }

  get size(): number {
    trackAccess(this[$fobx])
    return this.data.size
  }

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

  keys(): SetIterator<T> {
    return this.values()
  }

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

  forEach(
    callback: (value: T, value2: T, set: Set<T>) => void,
    thisArg?: unknown,
  ): void {
    trackAccess(this[$fobx])
    this.data.forEach((value) => {
      callback.call(thisArg, value, value, this)
    })
  }

  replace(values: Iterable<T> | T[]): void {
    if (values == null || typeof values !== "object") {
      throw new Error(
        "[@fobx/core] Supplied entries was not a Set or an Array.",
      )
    }
    if (
      !Array.isArray(values) &&
      typeof (values as Any)[Symbol.iterator] !== "function"
    ) {
      throw new Error(
        "[@fobx/core] Supplied entries was not a Set or an Array.",
      )
    }

    if (isNotProduction) {
      warnIfObservedWriteOutsideTransaction(this[$fobx])
    }

    startBatch()
    try {
      const valuesArray = Array.isArray(values) ? values : Array.from(values)
      const newValues = new Set(
        valuesArray.map((v) => _processValue(v, this.shallow)),
      )

      const toDelete: T[] = []
      this.data.forEach((value) => {
        if (!newValues.has(value)) toDelete.push(value)
      })

      const toAdd: T[] = []
      newValues.forEach((value) => {
        if (!this.data.has(value)) toAdd.push(value)
      })

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
        toDelete.forEach((value) => {
          this.data.delete(value)
          const hasBox = this.hasMap.get(value)
          if (hasBox) setBoxValue(hasBox[$fobx], false)
        })

        if (orderChanged) {
          this.data.clear()
          newValues.forEach((value) => {
            this.data.add(value)
          })
        } else {
          toAdd.forEach((value) => {
            this.data.add(value)
            const hasBox = this.hasMap.get(value)
            if (hasBox) setBoxValue(hasBox[$fobx], true)
          })
        }

        this[$fobx].changes++
        notifyChanged(this[$fobx])
      }
    } finally {
      endBatch()
    }
  }

  toJSON(): T[] {
    trackAccess(this[$fobx])
    return Array.from(this.data)
  }

  toString(): string {
    return "[object ObservableSet]"
  }

  get [Symbol.toStringTag](): string {
    return "Set"
  }

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

export function observableSet<T = unknown>(
  values?: Iterable<T> | null,
  options: SetOptions = {},
): ObservableSet<T> {
  return withConversionContext(() => new ObservableSet(values, options))
}

export type { ObservableSet }
