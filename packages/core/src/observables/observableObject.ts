// eslint-disable-next-line import/no-cycle
import { ObservableSet } from "./observableSet";
// eslint-disable-next-line import/no-cycle
import { ObservableMap } from "./observableMap";
// eslint-disable-next-line import/no-cycle
import { createObservableArray } from "./observableArray";
import { $fobx, getGlobalState, type IFobxAdmin, type Any } from "../state/global";
import { observableBox, type IObservable } from "./observableBox";
import { createComputedValue } from "../reactions/computed";
import { action } from "../transactions/action";
import { flow } from "../transactions/flow";
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObject,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  isPlainObject,
  isSet,
} from "../utils/predicates";

export type Annotation = "action" | "action.bound" | "computed" | "flow" | "flow.bound" | "observable" | "none";

export type AnnotationsMap<T, AdditionalFields extends PropertyKey> = {
  [P in keyof T]?: Annotation;
} & Record<AdditionalFields, Annotation>;

export type ObservableObjectOptions = {
  shallow?: boolean;
};

export type ObservableObject<T = Any> = T;
export interface ObservableObjectWithAdmin {
  [$fobx]: IObservableObjectAdmin;
}
export interface IObservableObjectAdmin extends IFobxAdmin {
  values: Map<PropertyKey, IObservable>;
}

const globalState = /* @__PURE__ */ getGlobalState();

export const createObservableObject = <T extends object>(
  obj: T,
  annotations: AnnotationsMap<T, Any>,
  options?: ObservableObjectOptions
) => {
  const type = getType(obj);
  if (type !== "object") {
    throw new Error(`[@fobx/core] Cannot make an observable object out of type "${type}"`);
  }
  const isPlainObj = isPlainObject(obj);

  if (isPlainObj && isObservableObject(obj)) {
    return obj;
  }
  const observableObject = getObservableObject(obj, {
    asNewObject: isPlainObj,
  });

  annotateObject(observableObject, obj, {
    addToPrototype: !isPlainObj,
    annotations,
    shallow: options?.shallow ?? false,
  });

  return observableObject as T;
};

export const createAutoObservableObject = <T extends object>(
  obj: T,
  overrides: AnnotationsMap<T, Any> = {},
  options?: ObservableObjectOptions
) => {
  options = options ? { shallow: false, ...options } : { shallow: false };
  return createObservableObject(obj, getAutoObservableAnnotationsMap(obj, overrides), options);
};

export const extendObservable = <T extends object, E extends object>(
  source: T,
  extension: E,
  annotations: AnnotationsMap<E, Any> = {}
): T & E => {
  if (!isPlainObject(extension)) {
    throw new Error("[@fobx/core] 2nd argument to extendObservable must be a plain js object.");
  }
  const observableObject = getObservableObject(source, { asNewObject: false });

  annotateObject(observableObject, extension, {
    // extending should always add to instance instead of prototype
    addToPrototype: false,
    annotations: getAutoObservableAnnotationsMap(extension, annotations),
    shallow: false,
  });
  return observableObject as unknown as T & E;
};

const annotateObject = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: {
    addToPrototype: boolean;
    annotations: AnnotationsMap<E, Any>;
    shallow: boolean;
  }
) => {
  if (!isObservableObject(observableObject)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
        observableObject
      );
    }
    return;
  }

  const { addToPrototype, annotations, shallow } = options;
  const sourceIsPlainObj = isPlainObject(source);
  const admin = (observableObject as ObservableObjectWithAdmin)[$fobx];

  getPropertyDescriptors(source).forEach((value, key) => {
    const { desc, owner: proto } = value;

    const isPrototype = !sourceIsPlainObj && source === proto;
    const protoAnnotations = isPrototype ? getAnnotations(proto) : new Set();
    const objAnnotations = sourceIsPlainObj ? new Set() : getAnnotations(source);
    if (objAnnotations.has(key) || (addToPrototype && protoAnnotations.has(key))) {
      return;
    }

    const annotation = annotations[key as keyof typeof annotations];
    switch (annotation) {
      case "observable": {
        objAnnotations.add(key);
        if (desc.get || desc.set) {
          throw new Error(`[@fobx/core] "observable" cannot be used on getter/setter properties`);
        }
        const value = source[key as keyof typeof source];
        let box: IObservable;
        if (shallow) {
          box = observableBox(value);
        } else {
          if (Array.isArray(value)) {
            const array = isObservableArray(value) ? value : createObservableArray(value);
            box = observableBox(array, {
              valueTransform: (v) => {
                if (!isObservableArray(v)) return createObservableArray(v);
                return v;
              },
            });
          } else if (isMap(value)) {
            const map = isObservableMap(value) ? value : new ObservableMap(value.entries());
            box = observableBox(map, {
              valueTransform: (v) => {
                if (!isObservableMap(v)) return new ObservableMap(v.entries());
                return v;
              },
            });
          } else if (isSet(value)) {
            const set = isObservableSet(value) ? value : new ObservableSet(value);
            box = observableBox(set, {
              valueTransform: (v) => {
                if (!isObservableSet(v)) return new ObservableSet(v);
                return v;
              },
            });
          } else if (isObject(value)) {
            const obj = isObservable(value) ? value : createAutoObservableObject(value as object);
            box = observableBox(obj, {
              valueTransform: (v) => {
                if (isObject(v) && !isObservable(v)) {
                  return createAutoObservableObject(v as object);
                }
                return v;
              },
            });
          } else {
            box = observableBox(value);
          }
        }
        admin.values.set(key, box);
        Object.defineProperty(observableObject, key, {
          get: () => box.value,
          set: (v) => {
            box.value = v;
          },
          enumerable: true,
          configurable: true,
        });
        break;
      }
      case "computed": {
        objAnnotations.add(key);
        if (!desc || !desc.get) {
          throw new Error(`[@fobx/core] "${key}" property was marked as computed but object has no getter.`);
        }
        const computed = createComputedValue(desc.get, desc.set, {
          thisArg: observableObject,
        });
        admin.values.set(key, computed);
        Object.defineProperty(observableObject, key, {
          get: () => computed.value,
          set: (v) => {
            computed.value = v;
          },
          enumerable: true,
          configurable: true,
        });
        break;
      }
      case "action":
      case "action.bound": {
        if (desc.value === undefined || typeof desc.value !== "function") {
          throw new Error(`[@fobx/core] "${key}" was marked as an action but it is not a function.`);
        }
        // someone used action() directly and assigned it as a instance member of class
        if (addToPrototype && isAction(desc.value)) break;

        Object.defineProperty(addToPrototype ? proto : observableObject, key, {
          value: action(desc.value, {
            name: key,
            getThis: (that: unknown) => {
              if (annotation === "action.bound") return observableObject;
              return addToPrototype && that === globalThis ? undefined : that;
            },
          }),
          enumerable: true,
          configurable: false,
          writable: true,
        });
        if (addToPrototype) {
          protoAnnotations.add(key);
        } else {
          objAnnotations.add(key);
        }
        break;
      }
      case "flow":
      case "flow.bound": {
        if (desc.value === undefined || !isGenerator(desc.value)) {
          throw new Error(`[@fobx/core] "${key}" was marked as a flow but is not a generator function.`);
        }

        // someone used flow() directly and assigned it as a instance member of class
        if (addToPrototype && isFlow(desc.value)) break;

        Object.defineProperty(addToPrototype ? proto : observableObject, key, {
          value: flow(desc.value, {
            name: key,
            getThis: (that: unknown) => {
              if (annotation === "flow.bound") return observableObject;
              return addToPrototype && that === globalThis ? undefined : that;
            },
          }),
          enumerable: true,
          configurable: false,
          writable: false,
        });
        if (addToPrototype) {
          protoAnnotations.add(key);
        } else {
          objAnnotations.add(key);
        }
        break;
      }
      case "none":
      default: {
        if (key !== "constructor" && annotation && annotation !== "none") {
          throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`);
        }
        if (!addToPrototype) {
          Object.defineProperty(observableObject, key, desc);
        }
      }
    }
  });
};

const annotated = /* @__PURE__ */ Symbol("annotated");
const getAnnotations = (obj: unknown) => {
  if (!Object.getOwnPropertyDescriptor(obj, annotated)) {
    Object.defineProperty(obj, annotated, {
      value: new Set<string | symbol>(),
    });
  }
  return (obj as { [annotated]: Set<string | symbol> })[annotated];
};

const getType = (obj: unknown) => {
  if (typeof obj === "object") {
    if (obj === null) return "null";
    if (Array.isArray(obj)) return "array";
    if (isMap(obj)) return "map";
    if (isSet(obj)) return "set";
    return "object";
  }
  return typeof obj;
};

export function addObservableAdministration<T extends object>(obj: T) {
  if (!Object.isExtensible(obj)) return;

  const adm: IObservableObjectAdmin = {
    name: `ObservableObject@${globalState.getNextId()}`,
    values: new Map<PropertyKey, IObservable>(),
  };
  Object.defineProperty(obj, $fobx, { value: adm });
}

function getObservableObject<T extends object>(
  obj: T,
  options: {
    asNewObject: boolean;
  }
) {
  if (isObservableObject(obj)) return obj;

  const observableObject = options.asNewObject ? {} : obj;
  addObservableAdministration(observableObject);
  return observableObject as T;
}

const getPropertyDescriptors = <T extends object>(obj: T) => {
  let curr: object | null = obj;
  const descriptorsByName = new Map<string, { owner: unknown; desc: PropertyDescriptor }>();

  do {
    Object.entries(Object.getOwnPropertyDescriptors(curr)).forEach(([key, descriptor]) => {
      if (!descriptorsByName.has(key)) {
        descriptorsByName.set(key, { owner: curr, desc: descriptor });
      }
    });
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype);
  return descriptorsByName;
};

const getAutoObservableAnnotationsMap = <T extends object>(obj: T, overrides: AnnotationsMap<T, Any> = {}) => {
  if (!isObject(obj)) return {};
  const annotations: Record<PropertyKey, Annotation> = {};
  getPropertyDescriptors(obj).forEach((value, key) => {
    if (key === "constructor") return;
    const { desc } = value;
    const override = overrides[key as keyof typeof overrides];
    if (override) {
      annotations[key] = override;
    } else if ("value" in desc) {
      annotations[key] =
        typeof desc.value === "function"
          ? isFlow(desc.value) || isGenerator(desc.value)
            ? "flow"
            : "action"
          : "observable";
    } else if (desc.get) {
      annotations[key] = "computed";
    }
  });
  return annotations;
};
