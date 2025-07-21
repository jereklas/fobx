import {
  type AnnotationsMap,
  createAutoObservableObject,
  type ObservableObject,
  type ObservableObjectOptions,
} from "./observableObject.ts"
import { ObservableSet, type SetOptions } from "./observableSet.ts"
import { type MapOptions, ObservableMap } from "./observableMap.ts"
import {
  type ArrayOptions,
  createObservableArray,
  type ObservableArray,
} from "./observableArray.ts"
import {
  isDecoratorContext,
  isMap,
  isObject,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  isSet,
} from "../utils/predicates.ts"
import type { Any } from "../state/global.ts"
import type { IObservableAdmin } from "./observableBox.ts"

export interface IObservableCollectionAdmin<T = Any>
  extends IObservableAdmin<T> {
  changes: number
  previous: string
  current: string
}

export function observable<T extends Any = Any>(
  set: Set<T>,
  options?: SetOptions,
): ObservableSet<T>
export function observable<T extends Any = Any>(
  arr: T[],
  options?: ArrayOptions,
): ObservableArray<T>
export function observable<K extends Any = Any, V extends Any = Any>(
  map: Map<K, V>,
  options?: MapOptions,
): ObservableMap<K, V>
export function observable<
  T extends object,
  AdditionalFields extends PropertyKey,
>(
  obj: T,
  annotations?: AnnotationsMap<T>,
  options?: ObservableObjectOptions,
): ObservableObject<T>
export function observable(obj: Any, a?: Any, b?: Any) {
  if (isDecoratorContext(a)) {
    throw new Error(
      '[@fobx/core] @observable decorator must be imported from "@fobx/core/decorators"',
    )
  }

  if (isMap(obj)) {
    if (isObservableMap(obj)) return obj
    return new ObservableMap(obj, a)
  } else if (isSet(obj)) {
    if (isObservableSet(obj)) return obj
    return new ObservableSet(obj, a)
  } else if (Array.isArray(obj)) {
    if (isObservableArray(obj)) return obj
    return createObservableArray(obj, a)
  } else if (isObject(obj)) {
    return createAutoObservableObject(obj, a, b)
  }

  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production") {
    console.error(
      "[@fobx/core] observable() was called with a primitive value, primitives must use observableBox().",
    )
  }
  return undefined
}
