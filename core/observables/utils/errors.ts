import type { Any } from "../../state/global.ts"
import { isGenerator, isMap, isSet } from "../../utils/predicates.ts"

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
 * Warning for non-extensible objects
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
