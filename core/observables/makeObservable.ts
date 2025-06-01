import type { ComparisonType, EqualityChecker } from "../state/global.ts"
import { isPlainObject } from "../utils/predicates.ts"
import {
  type Annotation,
  prepareObservableObject,
  processAnnotations,
} from "./observableObject.ts"

// Explicit annotations extend the existing annotations
export type ExplicitAnnotation = Omit<Annotation, "none">

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
  const isPlainObj = isPlainObject(source)
  const observableObject = prepareObservableObject(source, isPlainObj)

  // Use the shared processAnnotations function with inferAnnotations=false
  // since makeObservable requires explicit annotations
  processAnnotations(observableObject, source, {
    addToPrototype: !isPlainObj,
    annotations,
    shallow: false,
    inferAnnotations: false,
  })

  return observableObject as T
}
