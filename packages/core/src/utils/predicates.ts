import type {
  Any,
  IComputedAdmin,
  IObservableArrayAdmin,
  IObservableCollectionAdmin,
  ObservableObjectWithAdmin,
  IObservableObjectAdmin,
  IObservableValueAdmin,
} from "../types";

import { $fobx } from "../state/global";

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
  if (obj === null || typeof obj !== "object") return false;

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
export const isObservableObject = (obj: unknown): obj is ObservableObjectWithAdmin => {
  if (!isObject(obj)) return false;
  const admin = (obj as Any)[$fobx];
  if (!admin) return false;
  return isObservableObjectAdmin(admin);
};
export const isObservableObjectAdmin = (obj: unknown): obj is IObservableObjectAdmin => {
  if (!isObject(obj)) return false;
  return (obj as Any).values !== undefined;
};
export const isObservableProp = (obj: unknown, prop: PropertyKey) => {
  return isObservableObject(obj) && obj[$fobx].values.has(prop);
};

/**
 * Determines if the supplied object is a computed value or not.
 * @param obj the object to check
 * @returns returns true if the object is a computed value, false otherwise
 */
export const isComputed = (obj: unknown): boolean => {
  if (!isObject(obj)) return false;
  const admin = obj[$fobx];
  if (!admin) return false;
  return isComputedValueAdmin(admin);
};
export const isComputedValueAdmin = (obj: Any): obj is IComputedAdmin => {
  if (!isObject(obj)) return false;
  return obj.observers !== undefined && obj.dependencies !== undefined;
};

/**
 * Determines if the supplied object is an observable value or not.
 * @param obj the object to check
 * @returns returns true if the object is an observable value, false otherwise
 */
export const isObservableValue = (obj: unknown) => {
  if (!isObject(obj)) return false;
  const admin = obj[$fobx];
  if (!admin) return false;
  return isObservableValueAdmin(admin);
};
export const isObservableValueAdmin = (obj: unknown): obj is IObservableValueAdmin => {
  if (!isObject(obj)) return false;
  return obj.value !== undefined;
};

/**
 * Determines if supplied array is observable or not.
 * @param arr the array to check
 * @returns true if the supplied array is observable, false otherwise
 */
export const isObservableArray = (arr: unknown) => {
  return Array.isArray(arr) && arr[$fobx as unknown as keyof typeof arr] !== undefined;
};
export const isObservableArrayAdmin = (obj: unknown): obj is IObservableArrayAdmin => {
  return isObject(obj) && obj.runningAction !== undefined;
};

/**
 * Determines if the supplied map is observable or not.
 * @param map the map to check
 * @returns true if the supplied map is observable, false otherwise
 */
export const isObservableMap = (map: unknown) => {
  return map instanceof Map && map[$fobx as unknown as keyof typeof map] !== undefined;
};

/**
 * Determines if the supplied set is observable or not.
 * @param set the set to check
 * @returns true if the supplied set is observable, false otherwise
 */
export const isObservableSet = (set: unknown) => {
  return set instanceof Set && set[$fobx as unknown as keyof typeof set] !== undefined;
};

/**
 * Determines if the supplied value is observable
 * @param value the value to check
 * @returns true if the supplied value is observable, false otherwise
 */
export const isObservable = (value: unknown, prop?: PropertyKey) => {
  if (!isObject(value)) return false;
  const admin = value[$fobx];
  if (!admin || !isObject(admin)) return false;
  // TODO: this currently returns true for observable objects, it probably shouldn't (anything using this might need the current behavior)
  return prop ? admin.values !== undefined && admin.values.has(prop) : "value" in admin || "values" in admin;
};

export const isAction = (value: unknown) => {
  return typeof value === "function" && value[$fobx as unknown as keyof typeof value] === "action";
};

export const isFlow = (value: unknown) => {
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
export const isObservableCollectionAdmin = (obj: unknown): obj is IObservableCollectionAdmin => {
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
