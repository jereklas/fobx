import {
  $fobx,
  type Any,
  type ComparisonType,
  type EqualityChecker,
  type IFobxAdmin,
} from "../state/global.ts"
import type { IObservable } from "./observableBox.ts"
import { isObservableObject, isPlainObject } from "../utils/predicates.ts"
import {
  addObservableAdministration,
  getPropertyDescriptors,
  handleNoneOrResetAnnotation,
  inferAnnotationType,
} from "./utils/property.ts"
import { createShallowObservableForCollection } from "./utils/create.ts"
import {
  annotateProperty,
  markPropertyAsAnnotated,
  parseAnnotationConfig,
} from "./utils/annotations.ts"
import { resolveShallowOption } from "./utils/equality.ts"
import { getType, warnNonExtensibleObject } from "./utils/errors.ts"
import { createEqualityOptions } from "./utils/equality.ts"

export type Annotation =
  | "action"
  | "action.bound"
  | "computed"
  | "flow"
  | "flow.bound"
  | "observable"
  | "observable.shallow"
  | "observable.ref"
  | "none"

export type AnnotationConfig =
  | Annotation
  | [Annotation, EqualityChecker | ComparisonType]

export type AnnotationsMap<T, AdditionalFields extends PropertyKey> =
  & {
    [P in keyof T]?: AnnotationConfig
  }
  & Record<AdditionalFields, AnnotationConfig>

export type ObservableObjectOptions = {
  /**
   * @deprecated Use `shallowRef: true` instead. Will be removed in a future version.
   */
  shallow?: boolean
  /**
   * When true, makes property values directly observable without transforming them.
   * Property values will maintain their original object references but will be tracked for changes.
   */
  shallowRef?: boolean
}

/**
 * Options for the processAnnotations function
 */
export interface ProcessAnnotationsOptions<E> {
  addToPrototype: boolean
  annotations: AnnotationsMap<E, Any> | Record<string, Any>
  shallow: boolean
  inferAnnotations?: boolean
}

/**
 * Options for processing a single property
 */
export interface ProcessPropertyOptions {
  addToPrototype: boolean
  shallow: boolean
  annotationConfig: Any
}

export type ObservableObject<T = Any> = T
export interface ObservableObjectWithAdmin {
  [$fobx]: IObservableObjectAdmin
}
export interface IObservableObjectAdmin extends IFobxAdmin {
  values: Map<PropertyKey, IObservable>
}

/**
 * Common utility function to prepare an observable object, handling type checking
 * and ensuring the object is properly initialized
 *
 * @param source Source object to make observable
 * @param asNewObject Whether to create a new object or modify the source
 * @param forExtendObservable Whether this is being used for extendObservable (allows arrays)
 * @returns The prepared observable object
 */
export const prepareObservableObject = <T extends object>(
  source: T,
  asNewObject: boolean,
  forExtendObservable = false,
): T => {
  const type = getType(source)

  // Special case: Allow arrays in extendObservable for compatibility with tests
  // Arrays normally aren't valid objects for observableObject, but this special
  // case is needed for the 'tuple' test to pass
  if (
    type !== "object" &&
    !(type === "array" && forExtendObservable && !asNewObject)
  ) {
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${type}"`,
    )
  }

  const isPlainObj = isPlainObject(source)

  if (isPlainObj && isObservableObject(source)) {
    return source
  }

  const observableObject = isObservableObject(source)
    ? source
    : (asNewObject ? {} : source)

  if (!isObservableObject(observableObject)) {
    addObservableAdministration(observableObject)
  }

  return observableObject as T
}

export const createAutoObservableObject = <T extends object>(
  obj: T,
  overrides: AnnotationsMap<T, Any> = {},
  options?: ObservableObjectOptions,
) => {
  // Use the shared utility function for handling shallow options
  const effectiveShallow = resolveShallowOption(options)

  const isPlainObj = isPlainObject(obj)
  const observableObject = prepareObservableObject(obj, isPlainObj)

  processAnnotations(observableObject, obj, {
    addToPrototype: !isPlainObj,
    annotations: overrides,
    shallow: effectiveShallow,
    inferAnnotations: true,
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
  const observableObject = prepareObservableObject(source, false, true)

  processAnnotations(observableObject, extension, {
    // extending should always add to instance instead of prototype
    addToPrototype: false,
    annotations,
    shallow: false,
    inferAnnotations: true,
  })
  return observableObject as unknown as T & E
}

/**
 * Process a single property during annotation
 */
const processProperty = <T extends object>(
  observableObject: T,
  key: PropertyKey,
  desc: PropertyDescriptor,
  proto: unknown,
  admin: IObservableObjectAdmin,
  options: ProcessPropertyOptions,
): void => {
  const { addToPrototype, shallow, annotationConfig } = options

  // If no annotation is provided, copy the property as-is (non-observable)
  if (!annotationConfig) {
    // For makeObservable (inferAnnotations=false), we should copy unannotated properties
    // as regular properties without making them observable
    if (!addToPrototype) {
      // Only copy if we're working on the instance (not prototype)
      Object.defineProperty(observableObject, key, desc)
    }
    return
  }

  // Parse annotation config to get annotation and equality options
  const [annotation, equalityOption] = parseAnnotationConfig(annotationConfig)
  const equalityOptions = createEqualityOptions(equalityOption)

  // Handle "none" annotation as a special case first
  if (annotation === "none") {
    handleNoneOrResetAnnotation(observableObject, key, desc, admin, {
      addToPrototype,
      proto,
    })
    return
  }

  // Special case for observable + shallow combination
  if (annotation === "observable" && shallow && "value" in desc) {
    const value = desc.value
    if (
      createShallowObservableForCollection(
        observableObject,
        key,
        value,
        admin,
      )
    ) {
      markPropertyAsAnnotated(key, addToPrototype ? proto : observableObject)
      return
    }
  }

  // For all other annotations, delegate to annotateProperty
  annotateProperty(observableObject, key, desc, annotation, admin, {
    addToPrototype,
    proto,
    shallow: annotation === "observable.shallow" ||
      (annotation === "observable" && shallow),
    skipIfAlreadyAnnotated: true,
    equalityOptions,
  })
}

/**
 * Process annotations for an object, applying the appropriate behaviors to each property
 */
export const processAnnotations = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: ProcessAnnotationsOptions<E>,
): void => {
  if (!isObservableObject(observableObject)) {
    warnNonExtensibleObject(observableObject)
    return
  }

  // remove prototype from the annotations object so prototype functions are not considered as an annotation
  Object.setPrototypeOf(options.annotations, null)

  const { addToPrototype, shallow, inferAnnotations = false } = options
  const admin = (observableObject as ObservableObjectWithAdmin)[$fobx]

  getPropertyDescriptors(source).forEach((value, key) => {
    const { desc, owner: proto } = value

    // Get the annotation config, or infer it if not provided
    const annotationConfig =
      options.annotations[key as keyof typeof options.annotations] ||
      (inferAnnotations ? inferAnnotationType(desc) : undefined)

    // Process the property
    processProperty(observableObject, key, desc, proto, admin, {
      addToPrototype,
      shallow,
      annotationConfig,
    })
  })
}
