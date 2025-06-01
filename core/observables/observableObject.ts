import {
  $fobx,
  type Any,
  getGlobalState,
  type IFobxAdmin,
} from "../state/global.ts"
import {
  type IObservable,
  observableBox,
  type ObservableBoxWithAdmin,
} from "./observableBox.ts"
import type { ComputedWithAdmin } from "../reactions/computed.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObject,
  isObservableObject,
  isPlainObject,
  isSet,
} from "../utils/predicates.ts"
import {
  annotateProperty,
  explicitAnnotations,
  getPropertyDescriptors,
  getType,
} from "./utils/common.ts"

export type Annotation =
  | "action"
  | "action.bound"
  | "computed"
  | "flow"
  | "flow.bound"
  | "observable"
  | "none"

export type AnnotationsMap<T, AdditionalFields extends PropertyKey> =
  & {
    [P in keyof T]?: Annotation
  }
  & Record<AdditionalFields, Annotation>

export type ObservableObjectOptions = {
  shallow?: boolean
}

export type ObservableObject<T = Any> = T
export interface ObservableObjectWithAdmin {
  [$fobx]: IObservableObjectAdmin
}
export interface IObservableObjectAdmin extends IFobxAdmin {
  values: Map<PropertyKey, IObservable>
}

const globalState = /* @__PURE__ */ getGlobalState()

export const createAutoObservableObject = <T extends object>(
  obj: T,
  overrides: AnnotationsMap<T, Any> = {},
  options?: ObservableObjectOptions,
) => {
  options = options ? { shallow: false, ...options } : { shallow: false }
  const type = getType(obj)
  if (type !== "object") {
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${type}"`,
    )
  }
  const isPlainObj = isPlainObject(obj)

  if (isPlainObj && isObservableObject(obj)) {
    return obj
  }
  const observableObject = getObservableObject(obj, {
    asNewObject: isPlainObj,
  })

  annotateObject(observableObject, obj, {
    addToPrototype: !isPlainObj,
    annotations: overrides,
    shallow: options?.shallow ?? false,
  })

  return observableObject as T
}

export const extendObservable = <T extends object, E extends object>(
  source: T,
  extension: E,
  annotations: AnnotationsMap<E, Any> = {},
): T & E => {
  if (!isPlainObject(extension)) {
    throw new Error(
      "[@fobx/core] 2nd argument to extendObservable must be a plain js object.",
    )
  }
  const observableObject = getObservableObject(source, { asNewObject: false })

  annotateObject(observableObject, extension, {
    // extending should always add to instance instead of prototype
    addToPrototype: false,
    annotations,
    shallow: false,
  })
  return observableObject as unknown as T & E
}

/**
 * Handle a property marked with "none" annotation or one that needs to be reset
 */
const handleNoneOrResetAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IObservableObjectAdmin,
  options: {
    addToPrototype: boolean
    proto: unknown
  },
) => {
  const { addToPrototype, proto } = options

  const val = admin.values.get(key)
  if (val) {
    admin.values.delete(key)
    if ("dispose" in val) {
      const computed = val as ComputedWithAdmin
      computed.dispose()
      const { getter, setter } = computed[$fobx]
      Object.defineProperty(observableObject, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true,
      })
    } else {
      const box = val as ObservableBoxWithAdmin
      Object.defineProperty(observableObject, key, {
        value: box[$fobx].value,
        enumerable: true,
        configurable: true,
      })
    }
  } else if (
    (typeof desc.value === "function" || isObject(desc.value)) &&
    $fobx in desc.value
  ) {
    if (isAction(desc.value) || isFlow(desc.value)) {
      Object.defineProperty(
        addToPrototype ? proto : observableObject,
        key,
        {
          value: Object.getPrototypeOf(desc.value),
          enumerable: true,
          configurable: false,
          writable: true,
        },
      )
      return true // Indicates we've handled this case and can break from the calling context
    }
    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `key: ${String(key)} was marked as "none" but is currently annotated`,
      )
    }
  } else if (!addToPrototype) {
    Object.defineProperty(observableObject, key, desc)
  }

  markPropertyAsAnnotated(key, addToPrototype ? proto : observableObject)

  return false
}

/**
 * Marks a property as explicitly annotated in the tracking system.
 * Used to prevent re-annotation across inheritance levels.
 */
const markPropertyAsAnnotated = (key: PropertyKey, target: unknown) => {
  let annotations = explicitAnnotations.get(target)
  if (!annotations) {
    annotations = new Set<PropertyKey>([key])
    explicitAnnotations.set(target, annotations)
  } else {
    annotations.add(key)
  }
}

/**
 * Creates a shallow observable box for collection types (arrays, maps, sets)
 */
const createShallowObservableForCollection = (
  observableObject: object,
  key: PropertyKey,
  value: Any,
  admin: IObservableObjectAdmin,
): boolean => {
  if (Array.isArray(value) || isMap(value) || isSet(value)) {
    const box = observableBox(value)
    admin.values.set(key, box)
    Object.defineProperty(observableObject, key, {
      get: () => box.value,
      set: (v) => {
        box.value = v
      },
      enumerable: true,
      configurable: true,
    })
    return true
  }
  return false
}

/**
 * Determine the appropriate annotation type for a property when none is specified
 */
const inferAnnotationType = (desc: PropertyDescriptor): Annotation => {
  if ("value" in desc) {
    if (typeof desc.value === "function") {
      return isFlow(desc.value) || isGenerator(desc.value) ? "flow" : "action"
    }
    return "observable"
  }
  return "computed"
}

const annotateObject = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: {
    addToPrototype: boolean
    annotations: AnnotationsMap<E, Any>
    shallow: boolean
  },
) => {
  if (!isObservableObject(observableObject)) {
    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
        observableObject,
      )
    }
    return
  }

  // remove prototype from the annotations object so prototype functions are not considered as an annotation
  Object.setPrototypeOf(options.annotations, null)

  const { addToPrototype, shallow } = options
  const admin = (observableObject as ObservableObjectWithAdmin)[$fobx]

  getPropertyDescriptors(source).forEach((value, key) => {
    const { desc, owner: proto } = value

    // Get the annotation, or infer it if not provided
    const annotation =
      options.annotations[key as keyof typeof options.annotations] ||
      inferAnnotationType(desc)

    // Important: In inheritance cases, respect the "none" annotation to prevent incorrect property interpretation
    if (annotation === "none") {
      // Skip properties that are explicitly marked as "none"
      if (
        handleNoneOrResetAnnotation(observableObject, key, desc, admin, {
          addToPrototype,
          proto,
        })
      ) {
        return
      }
      return // Skip further processing of this property
    }

    switch (annotation) {
      case "observable": {
        // Create the appropriate observable value based on the property value and shallow option
        if (shallow && "value" in desc) {
          const value = desc.value

          // For shallow mode, don't make arrays, maps, and sets observable internally
          if (
            createShallowObservableForCollection(
              observableObject,
              key,
              value,
              admin,
            )
          ) {
            break
          }
        }

        // Use standard annotation for other cases
        annotateProperty(observableObject, key, desc, annotation, admin, {
          addToPrototype,
          proto,
          shallow,
          skipIfAlreadyAnnotated: true,
        })
        break
      }
      case "computed":
      case "action":
      case "action.bound":
      case "flow":
      case "flow.bound": {
        annotateProperty(observableObject, key, desc, annotation, admin, {
          addToPrototype,
          proto,
          skipIfAlreadyAnnotated: true,
        })
        break
      }
      default: {
        if (annotation && annotation !== "none") {
          throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`)
        }

        // it's possible with inheritance for something to be annotated incorrectly before the correct
        // annotation gets applied, if that happens we undo it here.
        handleNoneOrResetAnnotation(observableObject, key, desc, admin, {
          addToPrototype,
          proto,
        })
      }
    }
  })
}

export function addObservableAdministration<T extends object>(obj: T) {
  if (!Object.isExtensible(obj)) return

  const adm: IObservableObjectAdmin = {
    name: `ObservableObject@${globalState.getNextId()}`,
    values: new Map<PropertyKey, IObservable>(),
  }
  Object.defineProperty(obj, $fobx, { value: adm })
}

function getObservableObject<T extends object>(
  obj: T,
  options: {
    asNewObject: boolean
  },
) {
  if (isObservableObject(obj)) return obj

  const observableObject = options.asNewObject ? {} : obj
  addObservableAdministration(observableObject)
  return observableObject as T
}
