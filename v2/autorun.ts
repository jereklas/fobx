import { $global, getNextId } from "./global.ts"
import type { Dispose, ReactionAdmin } from "./types.ts"
import { ReactionState } from "./types.ts"
import { removeFromAllDeps, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./graph.ts"
import { isTransaction } from "./utils.ts"

export interface AutorunOptions {
  name?: string
}

/**
 * Creates an autorun reaction
 * Runs immediately and re-runs whenever any observed observables change
 */
export function autorun(
  fn: (dispose: Dispose) => void,
  options: AutorunOptions = {},
): Dispose {
  let isDisposed = false
  if (isTransaction(fn)) {
    throw new Error(
      "[@fobx/core] Autorun cannot have a transaction as the tracked function.",
    )
  }

  // Dispose function
  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
  }

  // Create admin for the reaction
  const admin: ReactionAdmin = {
    id: getNextId(),
    name: options.name || `Autorun@${getNextId()}`,
    state: ReactionState.STALE,
    deps: [],
    run: () => {
      if (isDisposed) return

      // Set state to UP_TO_DATE before running
      admin.state = ReactionState.UP_TO_DATE

      // Track dependencies while running the effect
      withTracking(admin, () => {
        fn(dispose)
      })
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
