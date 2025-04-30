import type { IObservableCollectionAdmin } from "../observables/observable.ts"
import type { IObservableAdmin } from "./observableBox.ts"
import { trackObservable } from "../transactions/tracking.ts"
import { getGlobalState } from "../state/global.ts"

const globalState = /* @__PURE__ */ getGlobalState()

export const wrapIteratorForTracking = <T>(
  iterator: IterableIterator<T>,
  admin: IObservableAdmin,
) => {
  const desc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(iterator),
    "next",
  )
  if (desc && typeof desc.value === "function") {
    Object.defineProperty(iterator, "next", {
      value: () => {
        trackObservable(admin)
        return (desc.value as (this: IterableIterator<T>) => IteratorResult<T>)
          .call(iterator)
      },
    })
  }
  return iterator
}

export const incrementChangeCount = (admin: IObservableCollectionAdmin) => {
  admin.previous = admin.current
  admin.changes = globalState.getNextId()
  admin.current = `${admin.name}.${admin.changes}`
}
