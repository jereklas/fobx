/**
 * Instance Configuration
 *
 * Global configuration for the fobx runtime.
 */

import {
  type Any,
  defaultComparer,
  type EqualityChecker,
  type EqualityComparison,
} from "./global.ts"

/**
 * Global instance state
 */
export const $instance = {
  structuralCompare: null as EqualityChecker | null,
  enforceTransactions: true,
  warnOnDependentlessComputeds: false,
  onReactionError: undefined as
    | ((error: Any, reaction: Any) => void)
    | undefined,
}

export interface ConfigureOptions {
  enforceTransactions?: boolean
  warnOnDependentlessComputeds?: boolean
  comparer?: {
    structural?: EqualityChecker
  }
  onReactionError?: (error: Any, reaction: Any) => void
}

export function configure(options: ConfigureOptions): void {
  if (options.enforceTransactions !== undefined) {
    $instance.enforceTransactions = options.enforceTransactions
  }
  if (options.warnOnDependentlessComputeds !== undefined) {
    $instance.warnOnDependentlessComputeds =
      options.warnOnDependentlessComputeds
  }
  if (options.comparer?.structural) {
    $instance.structuralCompare = options.comparer.structural
  }
  if (options.onReactionError !== undefined) {
    $instance.onReactionError = options.onReactionError
  }
}

/**
 * Resolve a comparer option to an actual equality checker function.
 * Called at creation time (not on every comparison) to avoid dispatch overhead.
 */
export function resolveComparer(
  comparer?: EqualityComparison,
): EqualityChecker {
  if (comparer === "structural") {
    if (!$instance.structuralCompare) {
      throw new Error(
        `[@fobx/core] Need to supply a structural equality comparer in order to use struct comparisons. See 'configure' api for more details.`,
      )
    }
    return $instance.structuralCompare
  }
  if (typeof comparer === "function") {
    return comparer
  }
  return defaultComparer
}
