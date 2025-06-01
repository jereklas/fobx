import type {
  Any,
  ComparisonType,
  EqualityChecker,
} from "../../state/global.ts"
import { $fobx, getGlobalState, type IFobxAdmin } from "../../state/global.ts"
import { type IObservable, observableBox } from "../observableBox.ts"
import { ObservableMap } from "../observableMap.ts"
import { ObservableSet } from "../observableSet.ts"
import { createObservableArray } from "../observableArray.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObject,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  isSet,
} from "../../utils/predicates.ts"
import { createAutoObservableObject } from "../observableObject.ts"
import { action } from "../../transactions/action.ts"
import { flow } from "../../transactions/flow.ts"
import { createComputedValue } from "../../reactions/computed.ts"
import type { ComputedWithAdmin } from "../../reactions/computed.ts"
import type { ObservableBoxWithAdmin } from "../observableBox.ts"

const globalState = /* @__PURE__ */ getGlobalState()

/**
 * Store for tracking explicitly annotated properties
 */
export const explicitAnnotations = new WeakMap<Any, Set<PropertyKey>>()

/**
 * Helper function to define a property with getter/setter that accesses an observable value
 */
export const defineObservableProperty = (
  target: object,
  key: PropertyKey,
  box: IObservable,
  enumerable = true,
  configurable = true,
) => {
  Object.defineProperty(target, key, {
    get: () => box.value,
    set: (v) => {
      box.value = v
    },
    enumerable,
    configurable,
  })
}

/**
 * Gets all property descriptors for an object, including those from its prototype chain
 */
export const getPropertyDescriptors = <T extends object>(obj: T): Map<
  string,
  { owner: unknown; desc: PropertyDescriptor }
> => {
  let curr: object | null = obj
  const descriptorsByName = new Map<
    string,
    { owner: unknown; desc: PropertyDescriptor }
  >()

  do {
    Object.entries(Object.getOwnPropertyDescriptors(curr)).forEach(
      ([key, descriptor]) => {
        if (!descriptorsByName.has(key) && key !== "constructor") {
          descriptorsByName.set(key, { owner: curr, desc: descriptor })
        }
      },
    )
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype)
  return descriptorsByName
}

/**
 * Helper to handle equality checking options properly
 */
export const createEqualityOptions = (
  equalityOption?: EqualityChecker | ComparisonType,
): { equals?: EqualityChecker; comparer?: ComparisonType } => {
  if (!equalityOption) return {}

  if (typeof equalityOption === "function") {
    return { equals: equalityOption as EqualityChecker }
  } else if (equalityOption === "structural" || equalityOption === "default") {
    return { comparer: equalityOption }
  }
  return {}
}

/**
 * Helper function for 'this' binding in methods
 */
export const preventGlobalThis = (
  that: unknown,
) => (that === globalThis ? undefined : that)

/**
 * Helper function for 'this' binding in methods
 */
export const identityFunction = (that: unknown) => that

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
const createObservableCollection = <T, O>(
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
 * Determines the type of an object for error messages
 */
export const getType = (obj: unknown): string => {
  if (typeof obj === "object") {
    if (obj === null) return "null"
    if (Array.isArray(obj)) return "array"
    if (isMap(obj)) return "map"
    if (isSet(obj)) return "set"
    return "object"
  }
  return typeof obj
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

/**
 * Marks a property as explicitly annotated in the tracking system.
 * Used to prevent re-annotation across inheritance levels.
 */
export const markPropertyAsAnnotated = (key: PropertyKey, target: unknown) => {
  let annotations = explicitAnnotations.get(target)
  if (!annotations) {
    annotations = new Set<PropertyKey>([key])
    explicitAnnotations.set(target, annotations)
  } else {
    annotations.add(key)
  }
}

/**
 * Helper function to validate the function type for action/flow annotations
 */
export const validateFunctionType = (
  value: Any,
  key: PropertyKey,
  isFlow: boolean,
): void => {
  if (value === undefined) {
    throw new Error(
      `[@fobx/core] "${String(key)}" was marked as ${
        isFlow ? "a flow" : "an action"
      } but is not a ${isFlow ? "generator " : ""}function.`,
    )
  }

  const isValid = isFlow ? isGenerator(value) : typeof value === "function"
  if (!isValid) {
    throw new Error(
      `[@fobx/core] "${String(key)}" was marked as ${
        isFlow ? "a flow" : "an action"
      } but is not a ${isFlow ? "generator " : ""}function.`,
    )
  }
}

/**
 * Common annotation handling function that processes different annotation types
 * Using the annotation handlers factory for better organization and extensibility
 */
export const annotateProperty = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  annotation: string,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    addToPrototype: boolean
    proto: unknown
    shallow?: boolean
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
    skipIfAlreadyAnnotated?: boolean
  },
) => {
  const { addToPrototype, proto, equalityOptions = {}, shallow = false } =
    options

  // Skip if already annotated (if needed)
  if (options.skipIfAlreadyAnnotated) {
    if (
      explicitAnnotations.get(options.addToPrototype ? proto : observableObject)
        ?.has(key)
    ) {
      return
    }
    // Skip if already in the admin values
    if (admin.values.has(key)) {
      return
    }
  }

  // Handle invalid annotation
  if (
    annotation !== "none" &&
    !annotationHandlers[annotation as keyof typeof annotationHandlers]
  ) {
    throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`)
  }

  // Special case for 'none' annotation
  if (annotation === "none") {
    return
  }

  // Use the appropriate handler for this annotation type
  const handlerOptions = {
    addToPrototype,
    proto,
    shallow,
    equalityOptions,
  }

  const handler =
    annotationHandlers[annotation as keyof typeof annotationHandlers]
  handler(observableObject, key, desc, admin, handlerOptions)

  // Track explicitly annotated properties
  markPropertyAsAnnotated(key, addToPrototype ? proto : observableObject)
}

/**
 * Parse annotation configuration into annotation name and equality option
 */
export const parseAnnotationConfig = (
  annotationConfig: Any,
): [string, EqualityChecker | ComparisonType | undefined] => {
  let annotation: string
  let equalityOption: EqualityChecker | ComparisonType | undefined

  if (Array.isArray(annotationConfig)) {
    ;[annotation, equalityOption] = annotationConfig
  } else {
    annotation = annotationConfig
  }

  return [annotation, equalityOption]
}

/**
 * Resolve shallow options handling both deprecated and current option names
 */
export const resolveShallowOption = (
  options?: { shallow?: boolean; shallowRef?: boolean },
): boolean => {
  if (!options) return false

  let effectiveShallow = false

  // Check for deprecated shallow option
  if (options.shallow !== undefined) {
    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[@fobx/core] The 'shallow: true' option is deprecated. Please use 'shallowRef: true' instead. " +
          "'shallow: true' will be removed in a future version.",
      )
    }
    effectiveShallow = options.shallow
  }

  // shallowRef takes precedence if both are specified
  if (options.shallowRef !== undefined) {
    effectiveShallow = options.shallowRef
  }

  return effectiveShallow
}

/**
 * Determine the appropriate annotation type for a property when none is specified
 */
export const inferAnnotationType = (desc: PropertyDescriptor): string => {
  if ("value" in desc) {
    if (typeof desc.value === "function") {
      return isFlow(desc.value) || isGenerator(desc.value) ? "flow" : "action"
    }
    return "observable"
  }
  return "computed"
}

/**
 * Handle a property marked with "none" annotation or one that needs to be reset
 */
export const handleNoneOrResetAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    addToPrototype: boolean
    proto: unknown
  },
): boolean => {
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
 * Adds administration object to an object to make it observable
 */
export function addObservableAdministration<T extends object>(
  obj: T,
  adminName: string = `ObservableObject@${globalState.getNextId()}`,
) {
  if (!Object.isExtensible(obj)) return

  const adm: IFobxAdmin & { values: Map<PropertyKey, IObservable> } = {
    name: adminName,
    values: new Map<PropertyKey, IObservable>(),
  }
  Object.defineProperty(obj, $fobx, { value: adm })
}

/**
 * Standardized error handling for annotation errors
 */
export const throwAnnotationError = (
  annotation: string,
  key: PropertyKey,
  message: string,
): never => {
  throw new Error(
    `[@fobx/core] "${annotation}" on "${String(key)}": ${message}`,
  )
}

/**
 * Error for invalid property type
 */
export const throwInvalidPropertyTypeError = (
  key: PropertyKey,
  expected: string,
  actual: string,
): never => {
  throw new Error(
    `[@fobx/core] "${String(key)}" expected ${expected}, but got ${actual}`,
  )
}

/**
 * Error for invalid annotation
 */
export const throwInvalidAnnotationError = (
  annotation: string,
): never => {
  throw new Error(`[@fobx/core] "${annotation}" is not a valid annotation.`)
}

/**
 * Error for non-extensible objects
 */
export const warnNonExtensibleObject = (object: object): void => {
  // deno-lint-ignore no-process-global
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
      object,
    )
  }
}

/**
 * Handler for observable annotations
 */
const handleObservableAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    shallow?: boolean
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
  },
): void => {
  if (desc.get || desc.set) {
    throw new Error(
      `[@fobx/core] "observable" cannot be used on getter/setter properties`,
    )
  }

  if ("value" in desc) {
    const value = desc.value
    const isShallow = options.shallow ?? false
    const equalityOptions = options.equalityOptions ?? {}

    // Create observable using our unified function
    const box = createObservable(value, isShallow, equalityOptions)

    admin.values.set(key, box)
    defineObservableProperty(observableObject, key, box)
  }
}

/**
 * Handler for observable.shallow annotations
 */
const handleObservableShallowAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
  },
): void => {
  if (desc.get || desc.set) {
    throw new Error(
      `[@fobx/core] "observable.shallow" cannot be used on getter/setter properties`,
    )
  }

  if ("value" in desc) {
    const value = desc.value
    const equalityOptions = options.equalityOptions ?? {}

    // Create observable using our unified function with shallow=true
    const box = createObservable(value, true, equalityOptions)

    admin.values.set(key, box)
    defineObservableProperty(observableObject, key, box)
  }
}

/**
 * Handler for observable.ref annotations
 */
const handleObservableRefAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
  },
): void => {
  if (desc.get || desc.set) {
    throw new Error(
      `[@fobx/core] "observable.ref" cannot be used on getter/setter properties`,
    )
  }

  if ("value" in desc) {
    const value = desc.value
    const equalityOptions = options.equalityOptions ?? {}

    // Observable.ref creates a direct box without transforming the value
    createDirectObservableProperty(
      observableObject,
      key,
      value,
      admin,
      equalityOptions,
    )
  }
}

/**
 * Handler for computed annotations
 */
const handleComputedAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
  },
): void => {
  if (!desc || !desc.get) {
    throw new Error(
      `[@fobx/core] "${
        String(key)
      }" property was marked as computed but object has no getter.`,
    )
  }

  const equalityOptions = options.equalityOptions ?? {}
  const computed = createComputedValue(desc.get, desc.set, {
    thisArg: observableObject,
    ...equalityOptions,
  })

  admin.values.set(key, computed)
  defineObservableProperty(observableObject, key, computed)
}

/**
 * Handler for action and flow annotations
 */
const handleActionFlowAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  _admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    isFlow?: boolean
    isBound?: boolean
    addToPrototype?: boolean
    proto?: unknown
  },
): void => {
  const {
    isFlow: isFlowType = false,
    isBound = false,
    addToPrototype = false,
    proto = null,
  } = options

  // Validate the function type
  validateFunctionType(desc.value, key, isFlowType)

  // Skip if already wrapped for prototype
  if (
    addToPrototype && (isFlowType ? isFlow(desc.value) : isAction(desc.value))
  ) {
    return
  }

  const fn = isFlowType ? flow : action
  // @ts-expect-error: TypeScript doesn't recognize the overloads correctly
  const wrappedFn = fn(desc.value, {
    name: String(key),
    getThis: isBound
      ? () => observableObject
      : addToPrototype
      ? preventGlobalThis
      : identityFunction,
  })

  // Define the property
  Object.defineProperty(addToPrototype ? proto : observableObject, key, {
    value: wrappedFn,
    enumerable: true,
    configurable: false,
    writable: true,
  })
}

/**
 * Map of annotation types to their handlers
 */
export const annotationHandlers = {
  "observable": handleObservableAnnotation,
  "observable.shallow": handleObservableShallowAnnotation,
  "observable.ref": handleObservableRefAnnotation,
  "computed": handleComputedAnnotation,
  "action": (
    observableObject: object,
    key: PropertyKey,
    desc: PropertyDescriptor,
    admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
    options: Record<string, unknown>,
  ) =>
    handleActionFlowAnnotation(observableObject, key, desc, admin, {
      ...options,
      isFlow: false,
      isBound: false,
    }),
  "action.bound": (
    observableObject: object,
    key: PropertyKey,
    desc: PropertyDescriptor,
    admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
    options: Record<string, unknown>,
  ) =>
    handleActionFlowAnnotation(observableObject, key, desc, admin, {
      ...options,
      isFlow: false,
      isBound: true,
    }),
  "flow": (
    observableObject: object,
    key: PropertyKey,
    desc: PropertyDescriptor,
    admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
    options: Record<string, unknown>,
  ) =>
    handleActionFlowAnnotation(observableObject, key, desc, admin, {
      ...options,
      isFlow: true,
      isBound: false,
    }),
  "flow.bound": (
    observableObject: object,
    key: PropertyKey,
    desc: PropertyDescriptor,
    admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
    options: Record<string, unknown>,
  ) =>
    handleActionFlowAnnotation(observableObject, key, desc, admin, {
      ...options,
      isFlow: true,
      isBound: true,
    }),
}
