import type {
  ArrayOptions,
  MapOptions,
  AnnotationsMap,
  SetOptions,
  ObservableValueOptions,
  ObservableArray,
  ObservableValue,
  ObservableObjectOptions,
  ObservableObject,
  Any,
} from "../types";

import { isDecoratorContext, isObject, isObservableArray, isObservableMap, isObservableSet } from "../utils/predicates";
import { createObservableValue } from "./observableValue";

// eslint-disable-next-line import/no-cycle
import { createAutoObservableObject } from "./observableObject";
// eslint-disable-next-line import/no-cycle
import { ObservableSet } from "./observableSet";
// eslint-disable-next-line import/no-cycle
import { ObservableMap } from "./observableMap";
// eslint-disable-next-line import/no-cycle
import { createObservableArray } from "./observableArray";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const observable = ((obj: any, a?: any, b?: any) => {
  if (isDecoratorContext(a)) {
    throw new Error('[@fobx/core] @observable decorator must be imported from "@fobx/core/decorators"');
  }

  if (obj instanceof Map) {
    if (isObservableMap(obj)) return obj;
    return new ObservableMap(obj, a);
  } else if (obj instanceof Set) {
    if (isObservableSet(obj)) return obj;
    return new ObservableSet(obj, a);
  } else if (Array.isArray(obj)) {
    if (isObservableArray(obj)) return obj;
    return createObservableArray(obj, a);
  } else if (isObject(obj)) {
    return createAutoObservableObject(obj, a, b);
  }
  return createObservableValue(obj, a);
}) as ObservableFactory;

/* @__PURE__ */ Object.defineProperty(observable, "array", {
  value: <T>(value: T[] = [], options?: ArrayOptions) => createObservableArray(value, options),
});
/* @__PURE__ */ Object.defineProperty(observable, "map", {
  value: <K, V>(value: [K, V][] = [], options?: MapOptions) => new ObservableMap<K, V>(value, options),
});
/* @__PURE__ */ Object.defineProperty(observable, "set", {
  value: <T>(value: T[] = [], options?: SetOptions) => new ObservableSet(value, options),
});

export interface ObservableFactory {
  /**
   * Creates a new observable array based on the supplied array.
   * @param array the array to make observable.
   * @param options the array options.
   * @returns an observable array.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(array: Array<T>, options?: ArrayOptions): ObservableArray<T>;
  /**
   * Creates a new observable map based on the supplied map.
   * @param map the map to make observable.
   * @param options the map options.
   * @returns an observable map
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <K = any, V = any>(map: Map<K, V>, options?: MapOptions): ObservableMap<K, V>;
  /**
   * Creates a new observable set based on the supplied set.
   * @param set the set to make observable.
   * @param options the set options.
   * @returns an observable set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(set: Set<T>, options?: SetOptions): ObservableSet<T>;
  /**
   * Creates a new observable object based on the supplied object.
   * @param obj the object to make observable
   * @param annotationOverrides overrides if the auto assigned annotations are not correct
   * @param options the object options
   * @returns an observable object.
   */
  <T extends object>(
    obj: T,
    annotationOverrides?: AnnotationsMap<T>,
    options?: ObservableObjectOptions
  ): ObservableObject<T>;
  /**
   * Creates a new observable value.
   * @param value the initial value for the observable.
   * @param options the observable value options.
   * @returns an observable value.
   */
  <T>(value: T, options?: ObservableValueOptions<T>): ObservableValue<T>;
  array: ObservableArrayFactory;
  map: ObservableMapFactory;
  set: ObservableSetFactory;
}

export interface ObservableMapFactory {
  /**
   * Creates a new observable map.
   * @returns the observable map
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <K = any, V = any>(): ObservableMap<K, V>;
  /**
   * Creates a new observable map.
   * @param entries - the entries to seed the map with.
   * @param options - the map options.
   * @returns the observable map
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <K = any, V = any>(entries: readonly (readonly [K, V])[], options?: MapOptions): ObservableMap<K, V>;
  /**
   * Creates a new observable map.
   * @param iterable - the iterable to seed the map with
   * @param options - the map options.
   * @returns the observable map
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <K = any, V = any>(
    iterable?: Iterable<readonly [K, V]> | null | undefined,
    options?: MapOptions
  ): ObservableMap<K, V>;

  <K = Any, V = Any>(record?: Record<PropertyKey, V>, options?: MapOptions): ObservableMap<K, V>;
}

export interface ObservableSetFactory {
  /**
   * Creates a new observable set.
   * @returns the observable set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(): ObservableSet<T>;
  /**
   * Creates a new observable set.
   * @param values the values to seed the set with.
   * @param options the set options.
   * @returns the observable set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(values?: T[], options?: SetOptions): ObservableSet<T>;
  /**
   * Creates a new observable set.
   * @param iterable the iterable to seed the set with.
   * @param options the set options.
   * @returns the observable set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(iterable?: Iterable<unknown> | null | undefined, options?: SetOptions): ObservableSet<T>;
}

export interface ObservableArrayFactory {
  /**
   * Creates a new observable array.
   * @returns the observable array
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(): ObservableArray<T>;
  /**
   * Creates a new observable array.
   * @param initialValues: the values to seed the array with.
   * @param options the array options
   * @returns the observable array
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T = any>(initialValues?: T[], options?: ArrayOptions): ObservableArray<T>;
}

export interface ObservableObjectFactory {
  /**
   * Creates a new observable object based on the supplied object.
   * @param obj the object to make observable
   * @param annotationOverrides overrides if the auto assigned annotations are not correct
   * @param options the object options
   * @returns an observable object.
   */
  <T>(obj: T, annotationOverrides?: AnnotationsMap<T>, options?: ObservableObjectOptions): ObservableObject<T>;
}
