import type {
  Any,
  ComparisonType,
  EqualityChecker,
} from "../../state/global.ts"
import { type IObservable, observableBox } from "../observableBox.ts"
import { ObservableMap } from "../observableMap.ts"
import { ObservableSet } from "../observableSet.ts"
import { createObservableArray } from "../observableArray.ts"
import {
  isMap,
  isObject,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  isSet,
} from "../../utils/predicates.ts"
import { createAutoObservableObject } from "../observableObject.ts"

/**
 * Gets all property descriptors for an object, including those from its prototype chain
 */
export const getPropertyDescriptors = <T extends object>(obj: T): Map<
  string,
  { owner: unknown; desc: PropertyDescriptor }
> => {
  let curr: object | null = obj
  const descriptorsByName = new Map<
    string,
    { owner: unknown; desc: PropertyDescriptor }
  >()

  do {
    Object.entries(Object.getOwnPropertyDescriptors(curr)).forEach(
      ([key, descriptor]) => {
        if (!descriptorsByName.has(key) && key !== "constructor") {
          descriptorsByName.set(key, { owner: curr, desc: descriptor })
        }
      },
    )
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype)
  return descriptorsByName
}

/**
 * Helper to handle equality checking options properly
 */
export const createEqualityOptions = (
  equalityOption?: EqualityChecker | ComparisonType,
): { equals?: EqualityChecker; comparer?: ComparisonType } => {
  if (!equalityOption) return {}

  if (typeof equalityOption === "function") {
    return { equals: equalityOption as EqualityChecker }
  } else if (equalityOption === "structural" || equalityOption === "default") {
    return { comparer: equalityOption }
  }
  return {}
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

/**
 * Creates an observable value box with the appropriate transformation based on value type
 */
export const createObservableValue = (
  value: Any,
  shallow: boolean,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  if (shallow) {
    // For shallow observables, we don't make nested values observable
    return observableBox(value, equalityOptions)
  }

  if (Array.isArray(value)) {
    const array = isObservableArray(value)
      ? value
      : createObservableArray(value, { shallow: false })
    return observableBox(array, {
      valueTransform: (v) => {
        if (!isObservableArray(v)) {
          return createObservableArray(v, { shallow: false })
        }
        return v
      },
      ...equalityOptions,
    })
  } else if (isMap(value)) {
    const map = isObservableMap(value)
      ? value
      : new ObservableMap(value.entries(), { shallow: false })
    return observableBox(map, {
      valueTransform: (v) => {
        if (!isObservableMap(v)) {
          return new ObservableMap(v.entries(), { shallow: false })
        }
        return v
      },
      ...equalityOptions,
    })
  } else if (isSet(value)) {
    const set = isObservableSet(value)
      ? value
      : new ObservableSet(value, { shallow: false })
    return observableBox(set, {
      valueTransform: (v) => {
        if (!isObservableSet(v)) {
          return new ObservableSet(v, { shallow: false })
        }
        return v
      },
      ...equalityOptions,
    })
  } else if (isObject(value) && !isObservable(value)) {
    // For deep observation, we need to recursively make objects observable
    const obj = createAutoObservableObject(value as object)
    return observableBox(obj, {
      valueTransform: (v) => {
        if (isObject(v) && !isObservable(v)) {
          return createAutoObservableObject(v as object)
        }
        return v
      },
      ...equalityOptions,
    })
  } else {
    return observableBox(value, equalityOptions)
  }
}

/**
 * Determines the type of an object for error messages
 */
export const getType = (obj: unknown): string => {
  if (typeof obj === "object") {
    if (obj === null) return "null"
    if (Array.isArray(obj)) return "array"
    if (isMap(obj)) return "map"
    if (isSet(obj)) return "set"
    return "object"
  }
  return typeof obj
}
