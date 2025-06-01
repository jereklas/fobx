import type { ComparisonType, EqualityChecker } from "../../state/global.ts"

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
