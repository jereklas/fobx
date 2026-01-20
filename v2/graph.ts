// Dependency graph resolution

import { $global } from "./global.ts"
import type { ReactionAdmin } from "./types.ts"
import { ReactionState } from "./types.ts"
import { endBatch, startBatch } from "./batch.ts" // For wrapping reaction execution in safeRunReaction

// PERF: Cache dev mode check at module level to avoid repeated env checks
const isNotProduction = process.env.NODE_ENV !== "production"

/**
 * Safely run a reaction's computation, catching and logging errors
 * Wraps execution in batch context to ensure any mutations are properly batched
 * Used consistently across all reaction execution contexts
 */
export function safeRunReaction(reaction: ReactionAdmin): void {
  startBatch()
  try {
    reaction.run()
  } catch (error) {
    if ($global.actionThrew) {
      // Suppress reaction error - transaction already threw, only log suppression message
      if (isNotProduction) {
        console.error(
          `[@fobx/core] "${reaction.name}" exception suppressed because a transaction threw an error first. Fix the transaction's error.`,
        )
      }
    } else {
      // Normal error handling - log but don't throw
      if (isNotProduction) {
        console.error(
          `[@fobx/core] "${reaction.name}" threw an exception`,
        )
        console.error(error)
      }
    }
  } finally {
    endBatch()
  }
}

/**
 * Resolves the dependency graph by running all pending reactions
 * Called when batchDepth reaches 0
 */
export function runPendingReactions(): void {
  // PERF: First iteration uses global array directly
  let currentBatch = $global.pending
  // Clear immediately - new additions indicate anti-pattern usage
  $global.pending = []
  // Reactions that couldn't run this iteration
  let unresolved = []
  let iterations = 0

  while (currentBatch.length > 0) {
    iterations++
    if (iterations > 100) {
      console.error(
        "Reaction doesn't converge to a stable state after 100 iterations. " +
          "Likely cycle in reactive graph or reaction mutating state causing infinite loop. " +
          "Abandoning remaining reactions to prevent app crash.",
      )
      // Clear remaining reactions and exit - better to gracefully degrade than crash
      break
    }

    // PERF: Cache length for loop
    const batchLength = currentBatch.length
    for (let i = 0; i < batchLength; i++) {
      const reaction = currentBatch[i]
      let resolved = false

      if (reaction.state === ReactionState.UP_TO_DATE) {
        // Already resolved (can happen if upgraded during another reaction's run)
        resolved = true
      } else if (reaction.state === ReactionState.STALE) {
        safeRunReaction(reaction)
        resolved = true
      } else if (reaction.state === ReactionState.POSSIBLY_STALE) {
        let allDepsUpToDate = true

        // PERF: Cache deps and use indexed loop to minimize prototype lookups
        const deps = reaction.deps
        const depsLength = deps.length
        for (let j = 0; j < depsLength; j++) {
          const dep = deps[j]
          // Skip pure observables (boxes) - they don't have state
          if (!("state" in dep)) continue
          const depState = dep.state
          if (
            depState === ReactionState.STALE ||
            depState === ReactionState.POSSIBLY_STALE
          ) {
            allDepsUpToDate = false
            break // Short circuit - reaction is not ready to run yet
          }
        }

        if (allDepsUpToDate) {
          // All deps are current and none changed value
          reaction.state = ReactionState.UP_TO_DATE
          resolved = true
        }
      }

      if (!resolved) {
        unresolved.push(reaction)
      }
    }

    // Check if any reactions mutated state and push them into unresolved (anti-pattern usage)
    const pendingLength = $global.pending.length
    for (let i = 0; i < pendingLength; i++) {
      unresolved.push($global.pending[i])
    }
    $global.pending.length = 0

    // Prepare for next iteration
    currentBatch = unresolved
    unresolved = []
  }

  // Ensure global.pending is clear, this will happen through the normal path, but handle it here for any early breaks
  $global.pending.length = 0
}
