import type {
  Any,
  ComparisonType,
  EqualityChecker,
  IFobxAdmin,
} from "../../state/global.ts"
import type { IObservable } from "../observableBox.ts"
import { createComputedValue } from "../../reactions/computed.ts"
import { action } from "../../transactions/action.ts"
import { flow } from "../../transactions/flow.ts"
import { createObservable } from "./create.ts"
import { createDirectObservableProperty } from "./create.ts"
import { defineObservableProperty } from "./property.ts"
import { isAction, isFlow } from "../../utils/predicates.ts"
import { validateFunctionType } from "./errors.ts"
import { identityFunction, preventGlobalThis } from "./property.ts"

/**
 * Store for tracking explicitly annotated properties
 */
export const explicitAnnotations = new WeakMap<Any, Set<PropertyKey>>()

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
