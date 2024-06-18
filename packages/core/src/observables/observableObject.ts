import type { IObservableValue, IFobxAdmin, Any } from "../types";

import {
  isAction,
  isFlow,
  isGenerator,
  isObject,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  isPlainObject,
} from "../utils/predicates";

import { action } from "../transactions/action";
import { flow } from "../transactions/flow";
import { createComputedValue } from "../reactions/computed";
import { $fobx, getGlobalState } from "../state/global";
import { createObservableValue } from "./observableValue";

// eslint-disable-next-line import/no-cycle
import { ObservableSet } from "./observableSet";
// eslint-disable-next-line import/no-cycle
import { ObservableMap } from "./observableMap";
// eslint-disable-next-line import/no-cycle
import { createObservableArray } from "./observableArray";

export type Annotation = "action" | "action.bound" | "computed" | "flow" | "flow.bound" | "observable" | "none";

export type AnnotationsMap<T> = {
  [P in keyof T]?: Annotation;
};

export type ObservableObjectOptions = {
  shallow?: boolean;
};

export type ObservableObject<T = Any> = T;
export interface ObservableObjectWithAdmin {
  [$fobx]: IObservableObjectAdmin;
}
export interface IObservableObjectAdmin extends IFobxAdmin {
  values: Map<PropertyKey, IObservableValue>;
}

const globalState = /* @__PURE__ */ getGlobalState();

export const createObservableObject = <T extends object>(
  obj: T,
  annotations: AnnotationsMap<T>,
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
  overrides: AnnotationsMap<T> = {},
  options?: ObservableObjectOptions
) => {
  options = options ? { ...options, shallow: false } : { shallow: false };
  return createObservableObject(obj, getAutoObservableAnnotationsMap(obj, overrides), options);
};

export const extendObservable = <T extends object, E extends object>(
  source: T,
  extension: E,
  annotations: AnnotationsMap<E> = {}
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

/**
 * Asserts object is observable
 * @param obj the object to check
 */
function assertObservableObject(obj: unknown): asserts obj is ObservableObjectWithAdmin {
  if (!isObservableObject(obj)) throw new Error("Object was not correctly made observable.");
}

const annotateObject = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: {
    addToPrototype: boolean;
    annotations: AnnotationsMap<E>;
    shallow: boolean;
  }
) => {
  assertObservableObject(observableObject);
  const admin = observableObject[$fobx];
  getPropertyDescriptors(source).forEach((value, key) => {
    const { desc, owner: proto } = value;
    const objAnnotations = source === proto ? new Set() : getAnnotations(proto);
    if (objAnnotations.has(key)) {
      return;
    }

    const annotation = options.annotations[key as keyof typeof options.annotations];
    switch (annotation) {
      case "observable": {
        if (desc.get || desc.set) {
          throw new Error(`[@fobx/core] "observable" cannot be used on getter/setter properties`);
        }
        const value = source[key as keyof typeof source];
        let ov: IObservableValue;
        if (Array.isArray(value)) {
          const array = isObservableArray(value) ? value : createObservableArray(value);
          ov = createObservableValue(array, {
            valueTransform: (v) => {
              if (!isObservableArray(v)) return createObservableArray(v);
              return v;
            },
          });
        } else if (value instanceof Map) {
          const map = isObservableMap(value) ? value : new ObservableMap(value.entries());
          ov = createObservableValue(map, {
            valueTransform: (v) => {
              if (!isObservableMap(v)) return new ObservableMap(v.entries());
              return v;
            },
          });
        } else if (value instanceof Set) {
          const set = isObservableSet(value) ? value : new ObservableSet(value);
          ov = createObservableValue(set, {
            valueTransform: (v) => {
              if (!isObservableSet(v)) return new ObservableSet(v);
              return v;
            },
          });
        } else if (options?.shallow === false && isObject(value)) {
          const obj = isObservable(value) ? value : createAutoObservableObject(value as object, {});
          ov = createObservableValue(obj, {
            valueTransform: (v) => {
              if (isObject(v) && !isObservable(v)) {
                return createAutoObservableObject(v as object, {});
              }
              return v;
            },
          });
        } else {
          ov = createObservableValue(value);
        }
        admin.values.set(key, ov);
        Object.defineProperty(observableObject, key, {
          get: () => ov.value,
          set: (v) => {
            ov.value = v;
          },
          enumerable: true,
          configurable: true,
        });
        break;
      }
      case "computed": {
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
        if (options.addToPrototype && isAction(desc.value)) break;

        Object.defineProperty(options.addToPrototype ? proto : observableObject, key, {
          value: action(desc.value, {
            name: key,
            getThis: (that: unknown) => {
              if (annotation === "action.bound") return observableObject;
              return options.addToPrototype && that === globalThis ? undefined : that;
            },
          }),
          enumerable: true,
          configurable: false,
          writable: true,
        });
        if (options.addToPrototype) {
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
        if (options.addToPrototype && isFlow(desc.value)) break;

        Object.defineProperty(options.addToPrototype ? proto : observableObject, key, {
          value: flow(desc.value, {
            name: key,
            getThis: (that: unknown) => {
              if (annotation === "flow.bound") return observableObject;
              return options.addToPrototype && that === globalThis ? undefined : that;
            },
          }),
          enumerable: true,
          configurable: false,
          writable: false,
        });
        if (options.addToPrototype) {
          objAnnotations.add(key);
        }
        break;
      }
      case "none":
      default: {
        if (key !== "constructor" && annotation && annotation !== "none") {
          throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`);
        }
        if (!options.addToPrototype) {
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
    if (obj instanceof Map) return "map";
    if (obj instanceof Set) return "set";
    return "object";
  }
  return typeof obj;
};

export function addObservableAdministration<T extends object>(obj: T) {
  const adm: IObservableObjectAdmin = {
    name: `ObservableObject@${globalState.getNextId()}`,
    values: new Map<PropertyKey, IObservableValue>(),
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

const getAutoObservableAnnotationsMap = <T extends object>(obj: T, overrides: AnnotationsMap<T> = {}) => {
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
