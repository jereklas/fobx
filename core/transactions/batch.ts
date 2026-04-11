/**
 * Batch processing and graph resolution — the scheduler.
 *
 * The scheduling cycle:
 *   startBatch() → mutations → endBatch() → runPendingReactions() → safeRunReaction()
 */

import {
  $fobx,
  $scheduler,
  type Any,
  decBatch,
  incBatch,
  KIND_COMPUTED,
  POSSIBLY_STALE,
  type ReactionAdmin,
  setActionThrew,
  STALE,
  UP_TO_DATE,
} from "../state/global.ts"
import {
  isNotProduction,
  setRunPendingReactions,
} from "../state/notifications.ts"
import { $instance } from "../state/instance.ts"
import {
  applyWithoutTracking,
  runWithoutTracking,
} from "../reactions/tracking.ts"

function takePendingBatch(): ReactionAdmin[] {
  const currentBatch = $scheduler.pending
  $scheduler.pending = []
  return currentBatch
}

function appendPendingReactions(target: ReactionAdmin[]): void {
  const pending = $scheduler.pending
  for (let i = 0; i < pending.length; i++) {
    target.push(pending[i])
  }
  pending.length = 0
}

function clearPendingReactions(): void {
  $scheduler.pending.length = 0
}

function drainPendingReactionsIfIdle(): void {
  if ($scheduler.batchDepth === 0) {
    runPendingReactions()
  }
}

function runBatched<T>(fn: () => T): T {
  incBatch()
  try {
    return runWithoutTracking(fn)
  } catch (error) {
    setActionThrew(true)
    throw error
  } finally {
    decBatch()
    drainPendingReactionsIfIdle()
    setActionThrew(false)
  }
}

function applyBatched<TThis, TArgs extends Any[], TResult>(
  fn: (this: TThis, ...args: TArgs) => TResult,
  thisArg: TThis,
  args: TArgs,
): TResult {
  incBatch()
  try {
    return applyWithoutTracking(fn, thisArg, args)
  } catch (error) {
    setActionThrew(true)
    throw error
  } finally {
    decBatch()
    drainPendingReactionsIfIdle()
    setActionThrew(false)
  }
}

// ─── Batch API ───────────────────────────────────────────────────────────────

export function startBatch(): void {
  incBatch()
}

export function endBatch(): void {
  decBatch()
  drainPendingReactionsIfIdle()
}

// ─── Graph Resolution ────────────────────────────────────────────────────────

/**
 * Safely run a reaction's computation, catching and logging errors.
 * Wraps execution in batch context to ensure nested mutations are batched.
 */
export function safeRunReaction(reaction: ReactionAdmin): void {
  incBatch()
  try {
    reaction.run()
  } catch (error) {
    if ($scheduler.actionThrew) {
      if (isNotProduction) {
        console.error(
          `[@fobx/core] "${reaction.name}" exception suppressed because a transaction threw an error first. Fix the transaction's error.`,
        )
      }
    } else {
      if (isNotProduction) {
        console.error(`[@fobx/core] "${reaction.name}" threw an exception`)
        console.error(error)
      }
      $instance.onReactionError?.(error, reaction)
    }
  } finally {
    decBatch()
    drainPendingReactionsIfIdle()
  }
}

/**
 * Resolve the dependency graph by running all pending reactions.
 * Called when batchDepth reaches 0.
 */
function runPendingReactions(): void {
  // Early bail when nothing is pending.
  if ($scheduler.pending.length === 0) return

  let currentBatch = takePendingBatch()
  let unresolved: ReactionAdmin[] = []
  let iterations = 0

  while (currentBatch.length > 0) {
    iterations++
    if (iterations > 100) {
      console.error(
        "[@fobx/core] Reaction doesn't converge to a stable state after 100 iterations. " +
          "Likely cycle in reactive graph or reaction mutating state causing infinite loop. " +
          "Abandoning remaining reactions to prevent app crash.",
      )
      break
    }

    const batchLength = currentBatch.length
    for (let i = 0; i < batchLength; i++) {
      const reaction = currentBatch[i]
      let resolved = false

      if (reaction.state === UP_TO_DATE) {
        resolved = true
      } else if (reaction.state === STALE) {
        safeRunReaction(reaction)
        resolved = true
      } else if (reaction.state === POSSIBLY_STALE) {
        // Check if all deps are up to date
        let allDepsUpToDate = true
        const deps = reaction.deps
        const depsLength = deps.length
        for (let j = 0; j < depsLength; j++) {
          const dep = deps[j]
          // Pure observables (box, collection) don't have state — skip
          if (dep.kind === KIND_COMPUTED) {
            const depState = (dep as unknown as ReactionAdmin).state
            if (
              depState === STALE ||
              depState === POSSIBLY_STALE
            ) {
              allDepsUpToDate = false
              break
            }
          }
        }
        if (allDepsUpToDate) {
          reaction.state = UP_TO_DATE
          resolved = true
        }
      }

      if (!resolved) {
        unresolved.push(reaction)
      }
    }

    // Check if reactions mutated state and pushed more into pending
    appendPendingReactions(unresolved)

    currentBatch = unresolved
    unresolved = []
  }

  clearPendingReactions()
}

// Wire up the notification module's forward reference
setRunPendingReactions(runPendingReactions)

// ─── Transaction API ─────────────────────────────────────────────────────────

export interface TransactionOptions {
  name?: string
}

export function transaction<T extends (...args: Any[]) => Any>(
  fn: T,
  options?: TransactionOptions,
): T {
  const name = options?.name || fn.name || "<unnamed transaction>"

  const wrapper = function (this: unknown, ...args: Any[]) {
    return applyBatched(fn, this, args)
  }

  Object.defineProperty(wrapper, "name", { value: name, configurable: true })
  Object.defineProperty(wrapper, $fobx, {
    value: true,
    enumerable: false,
    configurable: false,
  })
  Object.setPrototypeOf(wrapper, fn)

  return wrapper as T
}

export function runInTransaction<T>(fn: () => T): T {
  return runBatched(fn)
}

export function transactionBound<T, F extends (this: T, ...args: Any[]) => Any>(
  fn: F,
): F {
  return function (this: T, ...args: Any[]) {
    return transaction(() => fn.apply(this, args))
  } as F
}
