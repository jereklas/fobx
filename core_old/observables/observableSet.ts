import { type IObservableCollectionAdmin, observable } from "./observable.ts"
import { incrementChangeCount, wrapIteratorForTracking } from "./helpers.ts"
import { $fobx, type Any, getGlobalState } from "../state/global.ts"
import { isObject, isObservable, isSet } from "../utils/predicates.ts"
import { trackObservable } from "../transactions/tracking.ts"
import { runInAction } from "../transactions/action.ts"
import { sendChange } from "./notifications.ts"
import {
  type IObservable,
  observableBox,
  type ObservableBoxWithAdmin,
} from "./observableBox.ts"

const globalState = /* @__PURE__ */ getGlobalState()

export type ObservableSetWithAdmin<T = Any> = ObservableSet<T> & {
  [$fobx]: IObservableCollectionAdmin<T>
}
export type SetOptions = {
  shallow?: boolean
}
export class ObservableSet<T = Any> extends Set<T> {
  #shallow: boolean
  #observables: Map<T, IObservable<boolean>>

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
    this.#observables = new Map()

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

  #isObservableTracked(observable: IObservable<boolean>): boolean {
    const ovAdmin = (observable as ObservableBoxWithAdmin<boolean>)[$fobx]
    return ovAdmin.observers.length > 0
  }

  #updateObservable(value: T, exists: boolean): void {
    const observable = this.#observables.get(value)
    if (observable) {
      observable.value = exists
      // If the value doesn't exist and no one is tracking it, we can safely remove it
      if (!exists && !this.#isObservableTracked(observable)) {
        this.#observables.delete(value)
      }
    }
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
      this.#updateObservable(value, true)
      incrementChangeCount(admin)
      sendChange(admin)
    })
    return this
  }

  override clear(this: ObservableSet) {
    const admin = (this as ObservableSetWithAdmin)[$fobx]
    runInAction(() => {
      super.clear()

      // Set all observables to false but only keep the ones being tracked
      this.#observables.forEach((observable, value) => {
        observable.value = false
        if (!this.#isObservableTracked(observable)) {
          this.#observables.delete(value)
        }
      })

      incrementChangeCount(admin)
      sendChange(admin)
    })
  }

  override delete(this: ObservableSet, value: T): boolean {
    const admin = (this as ObservableSetWithAdmin)[$fobx]
    return runInAction(() => {
      const result = super.delete(value)
      if (result) {
        this.#updateObservable(value, false)
        incrementChangeCount(admin)
        sendChange(admin)
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
    // Get or create observable for this value and track it
    let observable = this.#observables.get(value)
    if (!observable) {
      observable = observableBox(super.has(value))
      this.#observables.set(value, observable)
    }

    trackObservable((observable as ObservableBoxWithAdmin<boolean>)[$fobx])
    return observable.value
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
      // Mark all current values as removed (set to false)
      removed.forEach((value) => {
        this.#updateObservable(value, false)
      })
      super.clear()

      // Add new values
      entries.forEach((v) => {
        if (removed.has(v)) {
          removed.delete(v)
        }
        super.add(v)
        this.#updateObservable(v, true)
      })

      // Cleanup unused observables
      this.#observables.forEach((observable, value) => {
        if (!super.has(value) && !this.#isObservableTracked(observable)) {
          this.#observables.delete(value)
        }
      })

      incrementChangeCount(admin)
      sendChange(admin)
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
