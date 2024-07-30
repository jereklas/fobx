import type { IObservableObjectAdmin } from "../observables/observableObject";
import type { IObservableCollectionAdmin } from "../observables/observable";
import type { IComputedAdmin } from "../reactions/computed";
import { $fobx, type Any } from "../state/global";

const OBJ_STR = /* @__PURE__ */ Object.toString();
const FN_STR = "function";
const CTOR_STR = "constructor";

/**
 * Determines if supplied object is typeof "object"
 * @param obj the object to check
 * @returns returns true if not null and typeof obj === "object", false otherwise
 */
export const isObject = (obj: unknown): obj is Any => {
  return obj !== null && typeof obj === "object";
};

/**
 * Determines if the supplied object has a prototype of null or a prototype of Object.
 * @param obj the object to check
 * @returns returns true if object is a plain JS object, false otherwise
 */
export const isPlainObject = (obj: unknown) => {
  if (!isObject(obj)) return false;

  const proto = Object.getPrototypeOf(obj);
  if (proto === null) return true;

  const protoCtor = Object.hasOwnProperty.call(proto, CTOR_STR) && proto.constructor;
  return typeof protoCtor === FN_STR && protoCtor.toString() === OBJ_STR;
};

/**
 * Determines if the supplied object is an observable object
 * @param obj the object to check
 * @returns true if the supplied object is observable, false otherwise
 */
export const isObservableObject = (obj: unknown): boolean => {
  if (!isObject(obj)) return false;
  const admin = (obj as Any)[$fobx];
  if (!admin) return false;
  return isObservableObjectAdmin(admin);
};
const isObservableObjectAdmin = (obj: unknown): obj is IObservableObjectAdmin => {
  if (!isObject(obj)) return false;
  return (obj as Any).values !== undefined;
};

/**
 * Determines if the supplied object is a computed value or not.
 * @param obj the object to check
 * @returns returns true if the object is a computed value, false otherwise
 */
export const isComputed = (obj: unknown, prop?: PropertyKey): boolean => {
  if (!isObject(obj)) return false;
  const admin = obj[$fobx];
  if (!admin) return false;
  return prop
    ? admin.values !== undefined && admin.values.has(prop) && isComputedValueAdmin(admin.values.get(prop)[$fobx])
    : isComputedValueAdmin(admin);
};
export const isComputedValueAdmin = (obj: Any): obj is IComputedAdmin => {
  if (!isObject(obj)) return false;
  return obj.observers !== undefined && obj.dependencies !== undefined;
};

/**
 * Determines if supplied array is observable or not.
 * @param arr the array to check
 * @returns true if the supplied array is observable, false otherwise
 */
export const isObservableArray = (arr: unknown): boolean => {
  return Array.isArray(arr) && arr[$fobx as unknown as keyof typeof arr] !== undefined;
};

export const isMap = (thing: unknown): thing is Map<Any, Any> => {
  return thing != null && Object.prototype.toString.call(thing) === "[object Map]";
};

/**
 * Determines if the supplied map is observable or not.
 * @param map the map to check
 * @returns true if the supplied map is observable, false otherwise
 */
export const isObservableMap = (map: unknown): boolean => {
  return isMap(map) && map[$fobx as unknown as keyof typeof map] !== undefined;
};

export const isSet = (thing: unknown): thing is Set<Any> => {
  return thing != null && Object.prototype.toString.call(thing) === "[object Set]";
};
/**
 * Determines if the supplied set is observable or not.
 * @param set the set to check
 * @returns true if the supplied set is observable, false otherwise
 */
export const isObservableSet = (set: unknown): boolean => {
  return isSet(set) && set[$fobx as unknown as keyof typeof set] !== undefined;
};

/**
 * Determines if the supplied value is observable
 * @param value the value to check
 * @returns true if the supplied value is observable, false otherwise
 */
export const isObservable = (value: unknown, prop?: PropertyKey): boolean => {
  if (!isObject(value)) return false;
  const admin = value[$fobx];
  if (!admin || !isObject(admin)) return false;
  return prop ? admin.values !== undefined && admin.values.has(prop) : "value" in admin;
};

export const isAction = (value: unknown): boolean => {
  return typeof value === "function" && value[$fobx as unknown as keyof typeof value] === "action";
};

export const isFlow = (value: unknown): boolean => {
  return typeof value === "function" && value[$fobx as unknown as keyof typeof value] === "flow";
};

/**
 * Determines if the supplied object is an observable collection (array, map, set)
 * @param obj - the object to check
 * @returns true if the supplied object is an observable collection, false otherwise
 */
export const isObservableCollection = (obj: unknown): obj is { [$fobx]: IObservableCollectionAdmin } => {
  if (!isObject(obj)) return false;
  const admin = obj[$fobx];
  if (!admin) return false;
  return isObservableCollectionAdmin(admin);
};
const isObservableCollectionAdmin = (obj: unknown): obj is IObservableCollectionAdmin => {
  if (!isObject(obj)) return false;
  return obj.changes !== undefined && obj.previous !== undefined && obj.current !== undefined;
};

const decoratorKinds = new Set(["class", "method", "getter", "setter", "field", "accessor"]);
/**
 * Determines if the supplied context object is a decorator context object
 * @param context - the value to check
 * @returns true if the supplied value is a decorator context, false otherwise
 */
export const isDecoratorContext = (context: unknown): context is DecoratorContext => {
  return isObject(context) && decoratorKinds.has(context.kind);
};

export const isPromise = (obj: unknown): obj is Promise<unknown> => {
  return isObject(obj) && obj.then !== undefined;
};

export const isGenerator = (value: unknown) => {
  // @ts-expect-error - generators do have toStringTag symbol
  return typeof value === "function" && value[Symbol.toStringTag] === "GeneratorFunction";
};
