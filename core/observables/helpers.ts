import type { IObservableCollectionAdmin } from "../observables/observable.ts"
import type { IObservable, IObservableAdmin } from "./observableBox.ts"
import { trackObservable } from "../transactions/tracking.ts"
import {
  $fobx,
  type Any,
  getGlobalState,
  type IFobxAdmin,
} from "../state/global.ts"

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

/**
 * Adds administration object to an object to make it observable
 */
export function addObservableAdministration<T extends object>(
  obj: T,
  adminName: string = `ObservableObject@${globalState.getNextId()}`,
) {
  if (!Object.isExtensible(obj)) return

  const adm: IFobxAdmin & { values: Map<PropertyKey, IObservable> } = {
    name: adminName,
    values: new Map<PropertyKey, IObservable>(),
  }
  Object.defineProperty(obj, $fobx, { value: adm })
}

/**
 * Helper function for 'this' binding in methods
 */
export const preventGlobalThis = (
  that: unknown,
) => (that === globalThis ? undefined : that)

/**
 * Helper function for 'this' binding in methods
 */
export const identityFunction = (that: unknown) => that

type ObjectType = "plain" | "class"

type PropertyDescription = {
  key: string
  level: number
  prototype: Any
  descriptor: PropertyDescriptor
}

/**
 * Get property descriptors based on object type.
 * Plain objects: own properties only
 * Class instances: prototype chain with first occurrence rule
 */
export function getPropertyDescriptions(
  source: Any,
  objectType: ObjectType,
): PropertyDescription[] {
  if (objectType === "plain") {
    const descriptors = Object.getOwnPropertyDescriptors(source)
    return Object.entries(descriptors).map(([key, descriptor]) => ({
      key,
      level: 0,
      prototype: null,
      descriptor,
    }))
  }

  // For class instances, walk the prototype chain and get first occurrence of each property
  const descriptors: PropertyDescription[] = []
  let current = source
  let level = 0

  while (current && current !== Object.prototype) {
    const ownDescriptors = Object.getOwnPropertyDescriptors(current)

    for (const [name, descriptor] of Object.entries(ownDescriptors)) {
      if (name === "constructor") continue

      if (descriptors.some((d) => d.key === name)) {
        continue
      }

      const isInstance = current === source
      descriptors.push({
        key: name,
        level,
        prototype: isInstance ? null : current,
        descriptor,
      })
    }
    current = Object.getPrototypeOf(current)
    level++
  }

  return descriptors
}
