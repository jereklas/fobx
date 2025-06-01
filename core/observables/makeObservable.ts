import {
  $fobx,
  type Any,
  type ComparisonType,
  type EqualityChecker,
} from "../state/global.ts"
import { isObservableObject, isPlainObject } from "../utils/predicates.ts"
import {
  addObservableAdministration,
  type Annotation,
  type IObservableObjectAdmin,
} from "./observableObject.ts"
import {
  annotateProperty,
  createEqualityOptions,
  getPropertyDescriptors,
  getType,
} from "./utils/common.ts"

// Explicit annotations extend the existing annotations
export type ExplicitAnnotation = Omit<Annotation, "none"> | "observable.shallow"

export type ExplicitAnnotationConfig =
  | ExplicitAnnotation
  | [ExplicitAnnotation, EqualityChecker | ComparisonType]

export type ExplicitAnnotationMap<T extends object> = {
  [K in keyof T]?: ExplicitAnnotationConfig
}

/**
 * makeObservable creates an observable object with explicit annotations for each property.
 *
 * @param source The object to make observable
 * @param annotations Map of property names to annotations
 * @returns The observable object
 */
export function makeObservable<T extends object>(
  source: T,
  annotations: ExplicitAnnotationMap<T>,
): T {
  const type = getType(source)
  if (type !== "object") {
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${type}"`,
    )
  }
  const isPlainObj = isPlainObject(source)

  if (isPlainObj && isObservableObject(source)) {
    return source
  }

  // Create or get the observable object
  const observableObject = isObservableObject(source)
    ? source
    : (isPlainObj ? {} : source)
  if (!isObservableObject(observableObject)) {
    addObservableAdministration(observableObject)
  }

  annotateExplicitObject(observableObject, source, {
    addToPrototype: !isPlainObj,
    annotations,
  })

  return observableObject as T
}

const annotateExplicitObject = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: {
    addToPrototype: boolean
    annotations: ExplicitAnnotationMap<E>
  },
): void => {
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

  const { addToPrototype } = options
  const admin = (observableObject as Any)[$fobx] as IObservableObjectAdmin

  getPropertyDescriptors(source).forEach(
    (value: { owner: unknown; desc: PropertyDescriptor }, key: string) => {
      const { desc, owner: proto } = value

      // Skip properties that don't exist in the annotations map
      const annotationConfig =
        options.annotations[key as keyof typeof options.annotations]
      if (!annotationConfig) return

      // Parse annotation config to get annotation and equality options
      let annotation: ExplicitAnnotation
      let equalityOption: EqualityChecker | ComparisonType | undefined

      if (Array.isArray(annotationConfig)) {
        ;[annotation, equalityOption] = annotationConfig
      } else {
        annotation = annotationConfig
      }

      const equalityOptions = createEqualityOptions(equalityOption)
      const isShallow = annotation === "observable.shallow"

      annotateProperty(
        observableObject,
        key,
        desc,
        annotation as string,
        admin,
        {
          addToPrototype,
          proto,
          shallow: isShallow,
          equalityOptions,
        },
      )
    },
  )
}
