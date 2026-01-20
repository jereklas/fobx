// When (one-time reaction) implementation

import { $global, getNextId } from "./global.ts"
import type { Dispose, ReactionAdmin } from "./types.ts"
import { ReactionState } from "./types.ts"
import { removeFromAllDeps, withoutTracking, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./graph.ts"

export interface WhenOptions {
  name?: string
  timeout?: number
}

/**
 * Creates a when reaction
 * Runs once when the predicate becomes true, then auto-disposes
 * Returns a Promise that resolves when the predicate becomes true
 */
export function when(
  predicate: () => boolean,
  options?: WhenOptions,
): Promise<void>

export function when(
  predicate: () => boolean,
  effect: () => void,
  options?: WhenOptions,
): Dispose

export function when(
  predicate: () => boolean,
  effectOrOptions?: (() => void) | WhenOptions,
  maybeOptions?: WhenOptions,
): Promise<void> | Dispose {
  // Parse arguments
  const hasEffect = typeof effectOrOptions === "function"
  const effect = hasEffect ? effectOrOptions : undefined
  const options = hasEffect
    ? maybeOptions
    : effectOrOptions as WhenOptions | undefined

  let isDisposed = false
  let timeoutHandle: number | undefined

  // Promise mode (no effect provided)
  if (!effect) {
    return new Promise<void>((resolve, reject) => {
      const dispose = createWhen(
        predicate,
        () => resolve(),
        options,
        (error) => reject(error),
      )

      // Store dispose for cleanup
      if (options?.timeout) {
        timeoutHandle = setTimeout(() => {
          dispose()
          reject(new Error("Timeout waiting for condition"))
        }, options.timeout)
      }
    })
  }

  // Callback mode (effect provided)
  return createWhen(predicate, effect, options)
}

function createWhen(
  predicate: (dispose: Dispose) => boolean,
  effect: () => void,
  options?: WhenOptions,
  onError?: (error: Error) => void,
): Dispose {
  let isDisposed = false

  // Dispose function
  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
  }

  // Create admin for the reaction
  const admin: ReactionAdmin = {
    id: getNextId(),
    name: options?.name || `When@${getNextId()}`,
    state: ReactionState.STALE,
    deps: [],
    run: () => {
      if (isDisposed) return

      // Set state to UP_TO_DATE before running
      admin.state = ReactionState.UP_TO_DATE

      // Track dependencies while evaluating predicate
      let predicateResult: boolean
      try {
        predicateResult = withTracking(admin, () => predicate(dispose))
      } catch (error) {
        dispose()
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }
        return
      }

      // If predicate is true, run effect and dispose
      if (predicateResult) {
        // Run effect without tracking (side effects shouldn't create dependencies)
        withoutTracking(() => {
          try {
            effect()
          } catch (error) {
            if (onError) {
              onError(error instanceof Error ? error : new Error(String(error)))
            }
          }
        })

        // Auto-dispose after running once
        dispose()
      }
    },
  }

  // If in a transaction, queue for later execution; otherwise run immediately
  if ($global.batchDepth > 0) {
    $global.pending.push(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
