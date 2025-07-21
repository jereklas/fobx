import { type IObservableCollectionAdmin, observable } from "./observable.ts"
import type { ObservableSetWithAdmin } from "../observables/observableSet.ts"
import { incrementChangeCount, wrapIteratorForTracking } from "./helpers.ts"
import { $fobx, type Any, getGlobalState } from "../state/global.ts"
import { isMap, isObject, isObservable } from "../utils/predicates.ts"
import { trackObservable } from "../transactions/tracking.ts"
import { runInAction } from "../transactions/action.ts"
import { instanceState, isDifferent } from "../state/instance.ts"
import { sendChange } from "./notifications.ts"
import {
  type EqualityOptions,
  type IObservable,
  type IObservableAdmin,
  observableBox,
  type ObservableBoxWithAdmin,
} from "./observableBox.ts"

export type ObservableMapWithAdmin = ObservableMap & {
  [$fobx]: IObservableCollectionAdmin
}

export interface MapOptions extends EqualityOptions {
  shallow?: boolean
}

const globalState = /* @__PURE__ */ getGlobalState()
const uniqueValue = Symbol("uniqueValue")

export class ObservableMap<K = Any, V = Any> extends Map<K, V> {
  #keys: ObservableSetWithAdmin<K>
  #shallow: boolean
  #pendingKeys: Map<K, IObservable<V>>
  #equalityOptions: EqualityOptions
  override toString(): string {
    return `[object ObservableMap]`
  }

  #moveToPendingIfTracked(key: K, ov: IObservable<V>): void {
    const ovAdmin = (ov as ObservableBoxWithAdmin<V>)[$fobx]
    if (ovAdmin.observers.length > 0) {
      this.#pendingKeys.set(key, ov)
    }
  }

  constructor()
  constructor(entries: readonly (readonly [K, V])[], options?: MapOptions)
  constructor(
    iterable?: Iterable<readonly [K, V]> | null | undefined,
    options?: MapOptions,
  )
  constructor(record?: Record<PropertyKey, V>, options?: MapOptions)
  constructor(entries: Any = [], options?: MapOptions) {
    if (
      isMap(entries) && entries.constructor.name !== "Map" &&
      entries.constructor.name !== "ObservableMap"
    ) {
      throw new Error(
        `[@fobx/core] Cannot make observable map from class that inherit from Map: ${entries.constructor.name}`,
      )
    }
    super()
    const name = `ObservableMap@${globalState.getNextId()}`
    this.#shallow = options?.shallow ?? false
    this.#equalityOptions = {
      equals: options?.equals,
      comparer: options?.comparer,
    }
    this.#keys = observable(new Set<K>(), {
      shallow: true,
    }) as ObservableSetWithAdmin
    this.#pendingKeys = new Map<K, IObservable<V>>()
    // assigning the constructor to Map allows for deep compares to correctly compare this against other maps
    this.constructor = Object.getPrototypeOf(new Map()).constructor
    // make sure options are set before we add initial values
    this.#addEntries(entries)
    Object.defineProperty(this, $fobx, {
      value: {
        value: this,
        name: name,
        changes: 0,
        previous: `${name}.0`,
        current: `${name}.0`,
        observers: [],
      },
    })
    Object.defineProperty(this, Symbol.iterator, {
      value: () => {
        return getEntriesIterator(
          super[Symbol.iterator](),
          (this as unknown as ObservableMapWithAdmin)[$fobx],
        )
      },
    })
  }

  #delete(
    this: ObservableMap,
    key: K,
    opts: { preventNotification?: boolean } = { preventNotification: false },
  ) {
    const result = super.delete(key)
    if (result) {
      this.#keys.delete(key)
      if (!opts.preventNotification) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx])
      }
    }
    return result
  }

  #set(
    this: ObservableMap,
    key: K,
    value: V extends Any ? Any : never,
    reusableValues: Map<K, V> = new Map(),
  ) {
    const val = !this.#shallow && isObject(value) && !isObservable(value)
      ? (observable(value) as V)
      : value
    const reused = reusableValues.get(key) as IObservable<V>
    const ov = reused ?? (super.get(key) as IObservable<V>)

    this.#keys.add(key)

    if (ov) {
      if (
        isDifferent(
          ov.value,
          val,
          this.#equalityOptions?.equals ?? this.#equalityOptions.comparer,
        )
      ) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx])
      }
      if (reused) {
        super.set(key, ov as V)
      }
      ov.value = val
      return
    }

    const pendingOv = this.#pendingKeys.get(key)

    if (pendingOv) {
      // Remove from pending and place into actual map
      this.#pendingKeys.delete(key)
      super.set(key, pendingOv as V)

      incrementChangeCount((this as ObservableMapWithAdmin)[$fobx])
      pendingOv.value = val
    } else {
      super.set(key, observableBox(val, this.#equalityOptions) as V)
    }
  }
  #addEntries(
    entries:
      | [K, V][]
      | Map<K, V>
      | Record<PropertyKey, V>
      | Iterable<readonly [K, V]>,
  ) {
    if (isMap(entries)) {
      entries.forEach((value, key) => {
        this.#set(key, value)
      })
    } else if (Array.isArray(entries)) {
      entries.forEach(([key, value]) => {
        this.#set(key, value)
      })
    } else if (Symbol.iterator in entries) {
      for (const [key, val] of entries as Iterable<[K, V]>) {
        this.#set(key, val)
      }
    } else {
      Object.entries(entries).forEach(([key, val]) => {
        this.#set(key as K, val)
      })
    }
  }
  override get size(): number {
    trackObservable((this as unknown as ObservableMapWithAdmin)[$fobx])
    return super.size
  }
  override clear(this: ObservableMap) {
    const admin = (this as ObservableMapWithAdmin)[$fobx]
    runInAction(() => {
      this.#pendingKeys.forEach((pendingOv, key) => {
        if (super.has(key)) {
          pendingOv.value = uniqueValue
        }
      })
      // Cannot call super.clear() it stops observability
      this.forEach((_value, key) => {
        const ov = super.get(key) as IObservable<V>
        if (ov) {
          // Move to pending keys if someone is tracking it
          this.#moveToPendingIfTracked(key, ov)
        }
        this.set(key, uniqueValue)
        this.#delete(key)
      })
      incrementChangeCount(admin)
      sendChange(admin)
    })
  }
  override delete(this: ObservableMap, key: K): boolean {
    const admin = (this as ObservableMapWithAdmin)[$fobx]
    const ov = super.get(key) as IObservable<V>

    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      if (instanceState.enforceActions) {
        if (
          globalState.batchedActionsCount === 0 && admin.observers.length > 0
        ) {
          console.warn(
            `[@fobx/core] Changing tracked observable value (${admin.name}) outside of an action is discouraged as reactions run more frequently than necessary.`,
          )
        }
      }
    }

    return runInAction(() => {
      if (ov) {
        // Move the observable to pending keys if someone might be tracking it
        this.#moveToPendingIfTracked(key, ov)
        ov.value = uniqueValue as V
      }
      const result = this.#delete(key, { preventNotification: true })
      if (result) {
        if (!this.#pendingKeys.has(key)) {
          this.#pendingKeys.set(
            key,
            observableBox(uniqueValue, this.#equalityOptions),
          )
        }
        incrementChangeCount(admin)
        sendChange(admin)
      }
      return result
    })
  }
  override forEach(
    this: ObservableMap,
    callbackFn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown,
  ) {
    trackObservable((this as ObservableMapWithAdmin)[$fobx])
    const cb = (value: V, key: K, map: Map<K, V>) => {
      callbackFn((value as IObservable<V>).value, key, map)
    }
    super.forEach(cb, thisArg)
  }

  override has(this: ObservableMap, key: K): boolean {
    if (super.has(key)) {
      trackObservable((super.get(key) as ObservableBoxWithAdmin)[$fobx])
      return true
    } else {
      let ov = this.#pendingKeys.get(key)
      if (!ov) {
        ov = observableBox(uniqueValue as V, this.#equalityOptions)
        this.#pendingKeys.set(key, ov)
      }
      trackObservable((ov as ObservableBoxWithAdmin)[$fobx])
      return false
    }
  }

  override get(this: ObservableMap, key: K): V | undefined {
    let ov = super.get(key) as IObservable<V> | undefined
    if (!ov) {
      ov = this.#pendingKeys.get(key)
      if (!ov) {
        ov = observableBox(uniqueValue as V, this.#equalityOptions)
        this.#pendingKeys.set(key, ov)
      }
    }
    trackObservable((ov as ObservableBoxWithAdmin<V>)[$fobx])
    const value = ov.value
    // maps return undefined when key doesn't exist, so make sure that happens if
    // we're actually in a pendingKey scenario
    return value === uniqueValue ? undefined : value
  }

  override set(key: K, value: V): this {
    if (super.has(key)) {
      const oldValue = (super.get(key) as IObservable<V>)?.value
      if (oldValue === value) return this
    }
    const admin = (this as unknown as ObservableMapWithAdmin)[$fobx]

    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      if (
        instanceState.enforceActions && globalState.batchedActionsCount === 0 &&
        admin.observers.length > 0
      ) {
        console.warn(
          `[@fobx/core] Changing tracked observable value (${admin.name}) outside of an action is discouraged as reactions run more frequently than necessary.`,
        )
      }
    }

    runInAction(() => {
      this.#set(key, value)
      incrementChangeCount(admin)
      sendChange(admin)
    })

    return this
  }
  merge(
    this: ObservableMap,
    entries: [K, V][] | Map<K, V> | Record<PropertyKey, V>,
  ) {
    if (isObservable(entries)) {
      trackObservable((entries as Any as { [$fobx]: IObservableAdmin })[$fobx])
    }
    const admin = (this as ObservableMapWithAdmin)[$fobx]
    runInAction(() => {
      this.#addEntries(entries)
      if (admin.previous !== admin.current) {
        sendChange(admin)
      }
    })
  }
  replace(
    this: ObservableMap,
    entries: [K, V][] | Map<K, V> | Record<PropertyKey, V>,
  ): ObservableMap<K, V> {
    const admin = (this as ObservableMapWithAdmin)[$fobx]
    const startingChangeCount = admin.changes

    const originalKeys = [...this.#keys]

    const newKeys = new Set<K>()
    if (isMap(entries)) {
      entries.forEach((_, key) => {
        newKeys.add(key)
      })
    } else if (Array.isArray(entries)) {
      entries.forEach(([key]) => {
        newKeys.add(key)
      })
    } else if (isObject(entries)) {
      Object.entries(entries).forEach(([key]) => {
        newKeys.add(key as K)
      })
    } else {
      throw new Error(`[@fobx/core] Cannot convert to map from '${entries}'`)
    }

    runInAction(() => {
      const oldValue = new Map<K, V>()
      const reusedValues = new Map<K, V>()

      super.forEach((ov, key) => {
        if (newKeys.has(key)) {
          reusedValues.set(key, ov)
          this.#delete(key, { preventNotification: true })
          return
        }
        oldValue.set(key, (ov as IObservable).value)
        // Move to pending if being tracked
        this.#moveToPendingIfTracked(key, ov as IObservable<V>)
        ;(ov as IObservable).value = uniqueValue
        this.#delete(key)
      })

      if (isMap(entries)) {
        entries.forEach((value, key) => {
          this.#set(key, value, reusedValues)
        })
      } else if (Array.isArray(entries)) {
        entries.forEach(([key, value]) => {
          this.#set(key, value, reusedValues)
        })
      } else if (isObject(entries)) {
        Object.entries(entries).forEach(([key, value]) => {
          this.#set(key as K, value, reusedValues)
        })
      }

      if (!areSameOrder(originalKeys, this.#keys)) {
        incrementChangeCount((this as ObservableMapWithAdmin)[$fobx])
      }

      if (startingChangeCount !== admin.changes) {
        sendChange(admin)
      }
    })

    return this
  }
  toJSON(this: ObservableMap): [K, V][] {
    trackObservable((this as ObservableMapWithAdmin)[$fobx])

    return Array.from(this.entries())
  }
  override entries(): MapIterator<[K, V]> {
    return getEntriesIterator(
      super.entries(),
      (this as unknown as ObservableMapWithAdmin)[$fobx],
    ) as MapIterator<[K, V]>
  }
  override keys(): MapIterator<K> {
    return wrapIteratorForTracking(
      super.keys(),
      this.#keys[$fobx],
    ) as MapIterator<K>
  }
  override values(): MapIterator<V> {
    return getValuesIterator(
      super.values(),
      (this as unknown as ObservableMapWithAdmin)[$fobx],
    ) as MapIterator<V>
  }
}

const getValuesIterator = <V>(
  iterable: IterableIterator<V>,
  admin: IObservableCollectionAdmin,
) => {
  const original = iterable.next
  Object.defineProperty(iterable, "next", {
    value: () => {
      trackObservable(admin)
      const next = original.call(iterable)
      if (next.value) {
        next.value = next.value.value
      }
      return next
    },
  })
  return iterable
}

const getEntriesIterator = <K, V>(
  iterable: IterableIterator<[K, V]>,
  admin: IObservableCollectionAdmin,
) => {
  const original = iterable.next
  Object.defineProperty(iterable, "next", {
    value: () => {
      trackObservable(admin)
      const next = original.call(iterable)
      if (next.value) {
        const [key, value] = next.value

        next.value = [key, value.value]
      }
      return next
    },
  })
  return iterable
}

const areSameOrder = <K>(a: K[], b: Set<K>) => {
  if (a.length !== b.size) return false
  let i = 0
  let sameOrder = true
  b.forEach((key) => {
    sameOrder = key === a[i]
    i++
  })
  return sameOrder
}
