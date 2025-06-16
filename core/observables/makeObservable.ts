import type { Any } from "../state/global.ts"
import { isPlainObject } from "../utils/predicates.ts"
import { annotateObject } from "./annotationProcessor.ts"
import {
  type AnnotationsMap,
  prepareObservableObject,
} from "./observableObject.ts"

/**
 * makeObservable creates an observable object with explicit annotations for each property.
 *
 * @param source The object to make observable
 * @param annotations Map of property names to annotations
 * @returns The observable object
 */
export function makeObservable<T extends object>(
  source: T,
  annotations: AnnotationsMap<T, Any>,
): T {
  const isPlainObj = isPlainObject(source)
  const observableObject = prepareObservableObject(source, isPlainObj)

  annotateObject(source, observableObject, annotations, {
    inferAnnotations: false,
  })

  return observableObject as T
}
