import type {
  Any,
  ComparisonType,
  EqualityChecker,
  IFobxAdmin,
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
import { defineObservableProperty } from "./property.ts"

/**
 * Creates an observable value box with the appropriate transformation based on value type
 * @param value The value to make observable
 * @param shallow When true, creates a shallow observable where only the top level properties are observed
 * @param equalityOptions Options for equality checking
 */
export const createObservable = (
  value: Any,
  shallow = false,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  // Handle collections (Array, Map, Set)
  if (Array.isArray(value)) {
    return createObservableCollection(
      value,
      isObservableArray,
      (v) => createObservableArray(v, { shallow }),
      equalityOptions,
    )
  } else if (isMap(value)) {
    return createObservableCollection(
      value,
      isObservableMap,
      (v) => new ObservableMap(v.entries(), { shallow }),
      equalityOptions,
    )
  } else if (isSet(value)) {
    return createObservableCollection(
      value,
      isObservableSet,
      (v) => new ObservableSet(v, { shallow }),
      equalityOptions,
    )
  } else if (isObject(value) && !isObservable(value) && !shallow) {
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
    // For non-collections or shallow objects, just use a regular observable box
    return observableBox(value, equalityOptions)
  }
}

/**
 * Helper function to create observable collections with consistent patterns
 */
export const createObservableCollection = <T, O>(
  value: T,
  isObservableCheck: (val: Any) => boolean,
  createObservable: (val: Any) => O,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  const collection = isObservableCheck(value) ? value : createObservable(value)

  return observableBox(collection, {
    valueTransform: (v) => {
      if (!isObservableCheck(v)) {
        return createObservable(v)
      }
      return v
    },
    ...equalityOptions,
  })
}

/**
 * Creates an observable property by wrapping the value in an observable box without transformation.
 * Used for observable.ref and shallow collection handling.
 *
 * @param observableObject The target object to define the property on
 * @param key The property key
 * @param value The value to make observable
 * @param admin The object administration
 * @param equalityOptions Optional equality checking options
 * @returns true, indicating the property was successfully handled
 */
export const createDirectObservableProperty = (
  observableObject: object,
  key: PropertyKey,
  value: Any,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): boolean => {
  const box = observableBox(value, equalityOptions)
  admin.values.set(key, box)
  defineObservableProperty(observableObject, key, box)
  return true
}

/**
 * Creates a shallow observable box for collection types (arrays, maps, sets)
 */
export const createShallowObservableForCollection = (
  observableObject: object,
  key: PropertyKey,
  value: Any,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
): boolean => {
  if (Array.isArray(value) || isMap(value) || isSet(value)) {
    return createDirectObservableProperty(observableObject, key, value, admin)
  }
  return false
}
