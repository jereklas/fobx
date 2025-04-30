import type { ReactionAdmin } from "../reactions/reaction.ts"
import type { Any, ComparisonType, EqualityChecker } from "../state/global.ts"

// structuralCompare isn't on the instanceState object for performance reasons
let structuralCompare: EqualityChecker | null = null

export const instanceState = {
  enforceActions: true,
  actionThrew: false,
  onReactionError: undefined as
    | undefined
    | ((error: Any, reaction: ReactionAdmin) => void),
}

export function configure(options: {
  enforceActions?: boolean
  comparer?: {
    structural?: EqualityChecker
  }
  onReactionError?: (error: Any, reaction: ReactionAdmin) => void
}) {
  instanceState.onReactionError = options?.onReactionError
  if (options.enforceActions !== undefined) {
    instanceState.enforceActions = options.enforceActions
  }
  if (options.comparer && options.comparer.structural) {
    structuralCompare = options.comparer.structural
  }
}

function defaultCompare(a: Any, b: Any) {
  // If the items are strictly equal, no need to do a value comparison.
  if (a === b) {
    return true
  }
  // If the items are not non-nullish objects, then the only possibility of them being equal but
  // not strictly is if they are both `NaN`. Since `NaN` is uniquely not equal to itself, we can
  // use self-comparison of both objects, which is faster than `isNaN()`.
  if (
    a == null || b == null || typeof a !== "object" || typeof b !== "object"
  ) {
    return a !== a && b !== b
  }
  return false
}

export function isDifferent(
  a: Any,
  b: Any,
  fn?: ComparisonType | EqualityChecker,
) {
  if (typeof fn === "function") {
    return !fn(a, b)
  }
  switch (fn) {
    case "structural":
      if (!structuralCompare) {
        throw new Error(
          `[@fobx/core] Need to supply a structural equality comparer in order to use struct comparisons. See 'configure' api for more details.`,
        )
      }
      return !structuralCompare(a, b)
    case "default":
    default:
      return !defaultCompare(a, b)
  }
}
