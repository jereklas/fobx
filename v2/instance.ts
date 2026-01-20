/**
 * v2 Instance Configuration
 * 
 * Global configuration for the fobx runtime.
 * Matches core fobx API for consistency.
 */

import type { EqualityChecker, EqualityComparison } from "./global.ts"
import { defaultComparer } from "./global.ts"

// deno-lint-ignore no-explicit-any
type Any = any

/**
 * Global instance state
 * Kept minimal for performance and cross-version compatibility
 */
export const $instance = {
  // Structural comparer (must be configured by user)
  structuralCompare: null as EqualityChecker | null,
  
  // Action enforcement
  enforceActions: false,
  
  // Error handling
  onReactionError: undefined as ((error: Any, reaction: Any) => void) | undefined,
}

/**
 * Configuration options
 */
export interface ConfigureOptions {
  enforceActions?: boolean
  comparer?: {
    structural?: EqualityChecker
  }
  onReactionError?: (error: Any, reaction: Any) => void
}

/**
 * Configure fobx runtime behavior
 * 
 * Example:
 * ```typescript
 * import { configure } from "@fobx/core"
 * import { deepEqual } from "fast-equals"
 * 
 * configure({
 *   comparer: {
 *     structural: deepEqual
 *   }
 * })
 * ```
 */
export function configure(options: ConfigureOptions): void {
  if (options.enforceActions !== undefined) {
    $instance.enforceActions = options.enforceActions
  }
  
  if (options.comparer?.structural) {
    $instance.structuralCompare = options.comparer.structural
  }
  
  if (options.onReactionError !== undefined) {
    $instance.onReactionError = options.onReactionError
  }
}

/**
 * Resolve a comparer option to an actual equality checker function
 * 
 * PERF: This is called at creation time (not on every comparison)
 * to avoid dispatch overhead. The resolved function is stored in admin.
 */
export function resolveComparer(comparer?: EqualityComparison): EqualityChecker {
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
