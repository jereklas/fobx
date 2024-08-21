// eslint-disable-next-line import/no-cycle
import { ObservableSet } from "./observableSet";
// eslint-disable-next-line import/no-cycle
import { ObservableMap } from "./observableMap";
// eslint-disable-next-line import/no-cycle
import { createObservableArray } from "./observableArray";
import { $fobx, getGlobalState, type IFobxAdmin, type Any } from "../state/global";
import { observableBox, ObservableBoxWithAdmin, type IObservable } from "./observableBox";
import { ComputedWithAdmin, createComputedValue } from "../reactions/computed";
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

export const createAutoObservableObject = <T extends object>(
  obj: T,
  overrides: AnnotationsMap<T, Any> = {},
  options?: ObservableObjectOptions
) => {
  options = options ? { shallow: false, ...options } : { shallow: false };
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
    annotations: overrides,
    shallow: options?.shallow ?? false,
  });

  return observableObject as T;
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
    annotations,
    shallow: false,
  });
  return observableObject as unknown as T & E;
};

const explicitAnnotations = new Map<any, Set<PropertyKey>>();

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

  // remove prototype from the annotations object so prototype functions are not considered as an annotation
  Object.setPrototypeOf(options.annotations, null);

  const { addToPrototype, shallow } = options;
  const admin = (observableObject as ObservableObjectWithAdmin)[$fobx];
  const annotatedKeys = admin.values;

  getPropertyDescriptors(source).forEach((value, key) => {
    const { desc, owner: proto } = value;

    let annotation = options.annotations[key as keyof typeof options.annotations];
    let isExplicitlyAnnotated = false;
    if (annotation) {
      isExplicitlyAnnotated = true;
    } else if ("value" in desc) {
      annotation =
        typeof desc.value === "function"
          ? isFlow(desc.value) || isGenerator(desc.value)
            ? "flow"
            : "action"
          : "observable";
    } else {
      annotation = "computed";
    }

    switch (annotation) {
      case "observable": {
        if (desc.get || desc.set) {
          throw new Error(`[@fobx/core] "observable" cannot be used on getter/setter properties`);
        }
        if (explicitAnnotations.get(observableObject)?.has(key) === true) break;
        if (annotatedKeys.has(key)) break;

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
        if (!desc || !desc.get) {
          throw new Error(`[@fobx/core] "${key}" property was marked as computed but object has no getter.`);
        }
        if (explicitAnnotations.get(observableObject)?.has(key) === true) break;
        if (annotatedKeys.has(key)) break;

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
        if (explicitAnnotations.get(addToPrototype ? proto : observableObject)?.has(key) === true) break;

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
        break;
      }
      case "flow":
      case "flow.bound": {
        if (desc.value === undefined || !isGenerator(desc.value)) {
          throw new Error(`[@fobx/core] "${key}" was marked as a flow but is not a generator function.`);
        }
        if (explicitAnnotations.get(addToPrototype ? proto : observableObject)?.has(key) === true) break;
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
          writable: true,
        });
        break;
      }
      case "none":
      default: {
        if (annotation && annotation !== "none") {
          throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`);
        }
        if (explicitAnnotations.get(addToPrototype ? proto : observableObject)?.has(key) === true) break;

        // it's possible with inheritance for something to be annotated incorrectly before the correct
        // annotation gets applied, if that happens we undo it here.
        const val = admin.values.get(key);
        if (val) {
          admin.values.delete(key);
          if ("dispose" in val) {
            const computed = val as ComputedWithAdmin;
            computed.dispose();
            const { getter, setter } = computed[$fobx];
            Object.defineProperty(observableObject, key, {
              get: getter,
              set: setter,
              enumerable: true,
              configurable: true,
            });
          } else {
            const box = val as ObservableBoxWithAdmin;
            Object.defineProperty(observableObject, key, {
              value: box[$fobx].value,
              enumerable: true,
              configurable: true,
            });
          }
        } else if ((typeof desc.value === "function" || isObject(desc.value)) && $fobx in desc.value) {
          if (isAction(desc.value) || isFlow(desc.value)) {
            Object.defineProperty(addToPrototype ? proto : observableObject, key, {
              value: Object.getPrototypeOf(desc.value),
              enumerable: true,
              configurable: false,
              writable: true,
            });
            break;
          }
          if (process.env.NODE_ENV !== "production") {
            console.error(`key: ${key} was marked as "none" but is currently annotated`);
          }
        } else if (!addToPrototype) {
          Object.defineProperty(observableObject, key, desc);
        }
      }
    }

    if (isExplicitlyAnnotated) {
      const p = explicitAnnotations.get(proto);
      if (!p) {
        explicitAnnotations.set(proto, new Set([key]));
      } else {
        p.add(key);
      }
    }
  });
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
      if (!descriptorsByName.has(key) && key !== "constructor") {
        descriptorsByName.set(key, { owner: curr, desc: descriptor });
      }
    });
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype);
  return descriptorsByName;
};
