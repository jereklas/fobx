import { type IObservableCollectionAdmin, observable } from "./observable.ts"
import { incrementChangeCount, wrapIteratorForTracking } from "./helpers.ts"
import { $fobx, type Any, getGlobalState } from "../state/global.ts"
import { isObject, isObservable, isSet } from "../utils/predicates.ts"
import { trackObservable } from "../transactions/tracking.ts"
import { runInAction } from "../transactions/action.ts"
import { sendChange } from "./notifications.ts"

const globalState = /* @__PURE__ */ getGlobalState()

export type ObservableSetWithAdmin<T = Any> = ObservableSet<T> & {
  [$fobx]: IObservableCollectionAdmin<T>
}
export type SetOptions = {
  shallow?: boolean
}
export class ObservableSet<T = Any> extends Set<T> {
  #shallow: boolean

  constructor()
  constructor(values?: T[], options?: SetOptions)
  constructor(
    iterable?: Iterable<unknown> | null | undefined,
    options?: SetOptions,
  )
  constructor(values: T[] = [], options?: SetOptions) {
    super()
    const name = `ObservableSet@${globalState.getNextId()}`
    this.#shallow = options?.shallow ?? false
    values.forEach((v) => {
      this.#add(v)
    })
    // assigning the constructor to Set allows for deep compares to correctly compare this against other sets
    this.constructor = Object.getPrototypeOf(new Set()).constructor
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
  }

  override get size(): number {
    trackObservable((this as unknown as ObservableSetWithAdmin)[$fobx])
    return super.size
  }

  override toString(): string {
    return `[object ObservableSet]`
  }
  #add(value: T extends Any ? Any : never) {
    const val = !this.#shallow && isObject(value) && !isObservable(value)
      ? (observable(value) as T)
      : value
    super.add(val)
  }
  override add(value: T): this {
    if (super.has(value)) return this
    const admin = (this as unknown as ObservableSetWithAdmin)[$fobx]
    runInAction(() => {
      this.#add(value)
      incrementChangeCount(admin)
      sendChange(admin, admin.previous, admin.current)
    })
    return this
  }
  override clear(this: ObservableSet) {
    const admin = (this as ObservableSetWithAdmin)[$fobx]
    runInAction(() => {
      super.clear()
      incrementChangeCount(admin)
      sendChange(admin, admin.previous, admin.current)
    })
  }
  override delete(this: ObservableSet, value: T): boolean {
    const admin = (this as ObservableSetWithAdmin)[$fobx]
    return runInAction(() => {
      const result = super.delete(value)
      if (result) {
        incrementChangeCount(admin)
        sendChange(admin, admin.previous, admin.current)
      }
      return result
    })
  }
  override forEach(
    this: ObservableSet,
    callbackFn: (value: T, key: T, map: Set<T>) => void,
    thisArg?: unknown,
  ) {
    trackObservable((this as ObservableSetWithAdmin)[$fobx])
    super.forEach(callbackFn, thisArg)
  }
  override has(this: ObservableSet, value: T): boolean {
    trackObservable((this as ObservableSetWithAdmin)[$fobx])
    return super.has(value)
  }
  replace(this: ObservableSet, entries: Set<T> | T[]) {
    const admin = (this as ObservableSetWithAdmin)[$fobx]
    const removed = new Set(this)
    if (!Array.isArray(entries) && !isSet(entries)) {
      throw new Error(
        `[@fobx/core] Supplied entries was not a Set or an Array.`,
      )
    }

    runInAction(() => {
      super.clear()
      entries.forEach((v) => {
        if (removed.has(v)) {
          removed.delete(v)
        }
        super.add(v)
      })
      incrementChangeCount(admin)
      sendChange(admin, admin.previous, admin.current)
    })
  }
  toJSON(this: ObservableSet): T[] {
    trackObservable((this as ObservableSetWithAdmin)[$fobx])
    return Array.from(super.values())
  }
  override entries(this: ObservableSet): SetIterator<[T, T]> {
    return wrapIteratorForTracking(
      super.entries(),
      (this as ObservableSetWithAdmin)[$fobx],
    ) as SetIterator<[T, T]>
  }
  override keys(this: ObservableSet): SetIterator<T> {
    return wrapIteratorForTracking(
      super.keys(),
      (this as ObservableSetWithAdmin)[$fobx],
    ) as SetIterator<T>
  }
  override values(this: ObservableSet): SetIterator<T> {
    return wrapIteratorForTracking(
      super.values(),
      (this as ObservableSetWithAdmin)[$fobx],
    ) as SetIterator<T>
  }
}
