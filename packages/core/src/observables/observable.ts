// eslint-disable-next-line import/no-cycle
import {
  createAutoObservableObject,
  type ObservableObjectWithAdmin,
  type ObservableObject,
  type ObservableObjectOptions,
  type AnnotationsMap,
} from "./observableObject";
// eslint-disable-next-line import/no-cycle
import { ObservableSet, type SetOptions, type ObservableSetWithAdmin } from "./observableSet";
// eslint-disable-next-line import/no-cycle
import { ObservableMap, type MapOptions, type ObservableMapWithAdmin } from "./observableMap";
// eslint-disable-next-line import/no-cycle
import {
  createObservableArray,
  type ObservableArray,
  type ArrayOptions,
  type ObservableArrayWithAdmin,
} from "./observableArray";
import {
  isDecoratorContext,
  isMap,
  isObject,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  isSet,
} from "../utils/predicates";
import type { Any } from "../state/global";
import {
  createObservableValue,
  type ObservableValue,
  type ObservableValueOptions,
  type IObservableValueAdmin,
  type ObservableValueWithAdmin,
} from "./observableValue";

export interface IObservableCollectionAdmin<T = Any> extends IObservableValueAdmin<T> {
  changes: number;
  previous: string;
  current: string;
}

export type IObservable =
  | ObservableValueWithAdmin
  | ObservableObjectWithAdmin
  | ObservableArrayWithAdmin
  | ObservableMapWithAdmin
  | ObservableSetWithAdmin;

export function observable<T extends any = any>(set: Set<T>, options?: SetOptions): ObservableSet<T>;
export function observable<T extends any = any>(arr: T[], options?: ArrayOptions): ObservableArray<T>;
export function observable<K extends any = any, V extends any = any>(
  map: Map<K, V>,
  options?: MapOptions
): ObservableMap<K, V>;
export function observable<T extends number | string | boolean | bigint | symbol | undefined | null>(
  value: T,
  options?: ObservableValueOptions<T>
): ObservableValue<
  T extends number
    ? number
    : T extends string
      ? string
      : T extends boolean
        ? boolean
        : T extends bigint
          ? bigint
          : T extends symbol
            ? symbol
            : T extends undefined | null
              ? any
              : never
>;
export function observable<T extends Object, AdditionalFields extends PropertyKey>(
  obj: T,
  annotations?: AnnotationsMap<T, AdditionalFields>,
  options?: ObservableObjectOptions
): ObservableObject<T>;
export function observable(obj: Any, a?: Any, b?: Any) {
  if (isDecoratorContext(a)) {
    throw new Error('[@fobx/core] @observable decorator must be imported from "@fobx/core/decorators"');
  }

  if (isMap(obj)) {
    if (isObservableMap(obj)) return obj;
    return new ObservableMap(obj, a);
  } else if (isSet(obj)) {
    if (isObservableSet(obj)) return obj;
    return new ObservableSet(obj, a);
  } else if (Array.isArray(obj)) {
    if (isObservableArray(obj)) return obj;
    return createObservableArray(obj, a);
  } else if (isObject(obj)) {
    return createAutoObservableObject(obj, a, b);
  }
  return createObservableValue(obj, a);
}
