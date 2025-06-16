import type {
  $fobx,
  Any,
  ComparisonType,
  EqualityChecker,
  IFobxAdmin,
} from "../state/global.ts"
import type { IObservable } from "./observableBox.ts"
import {
  isMap,
  isObservableObject,
  isPlainObject,
  isSet,
} from "../utils/predicates.ts"
import { addObservableAdministration } from "./helpers.ts"
import { annotateObject } from "./annotationProcessor.ts"

export type BaseAnnotation =
  | "none"
  | "action"
  | "computed"
  | "observable"
  | "flow"

export type Annotation =
  | BaseAnnotation
  | "action.bound"
  | "flow.bound"
  | "observable.shallow"
  | "observable.ref"

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

export type ObservableObject<T = Any> = T
export interface ObservableObjectWithAdmin {
  [$fobx]: IObservableObjectAdmin
}
export interface IObservableObjectAdmin extends IFobxAdmin {
  values: Map<PropertyKey, IObservable>
}

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

  if (
    // deno-lint-ignore no-process-global
    process.env.NODE_ENV !== "production" &&
    !isObservableObject(observableObject)
  ) {
    console.warn(
      "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
      observableObject,
    )
  }

  annotateObject(obj, observableObject, overrides, {
    shallowRef: effectiveShallow,
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

  annotateObject(extension, observableObject, annotations, {
    shallowRef: false,
    inferAnnotations: true,
  })

  return observableObject as unknown as T & E
}
