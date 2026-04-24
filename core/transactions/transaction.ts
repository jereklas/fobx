/**
 * Transaction processing and graph resolution.
 */

import {
  $fobx,
  $scheduler,
  type Any,
  decBatch,
  incBatch,
  isTrackingReactiveRun,
  isTransactionActive,
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
import {
  recordDebugRunEnd,
  recordDebugRunStart,
  recordDebugSchedule,
} from "../state/debugGraph.ts"

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
  if (!isTransactionActive() && !isTrackingReactiveRun()) {
    runPendingReactions()
  }
}

function runTransactionScope<T>(fn: () => T): T {
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

function applyTransactionScope<TThis, TArgs extends Any[], TResult>(
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

export function startBatch(): void {
  incBatch()
}

export function endBatch(): void {
  decBatch()
  drainPendingReactionsIfIdle()
}

export function scheduleReaction(reaction: ReactionAdmin): void {
  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    recordDebugSchedule(reaction, {
      reason: "run-immediately",
      fromState: reaction.state,
      toState: reaction.state,
    })
  }

  safeRunReaction(reaction)
}

export function safeRunReaction(reaction: ReactionAdmin): void {
  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    recordDebugRunStart(reaction)
  }
  let runDetail = "completed"
  try {
    reaction.run()
  } catch (error) {
    runDetail = "threw"
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
    // deno-lint-ignore no-process-global
    if (process.env.FOBX_DEBUG) {
      recordDebugRunEnd(reaction, runDetail)
    }
    drainPendingReactionsIfIdle()
  }
}

function runPendingReactions(): void {
  if ($scheduler.pending.length === 0) return

  let currentBatch = takePendingBatch()
  let unresolved: ReactionAdmin[] = []
  let iterations = 0

  while (currentBatch.length > 0) {
    iterations++
    if (iterations > 100) {
      console.error(
        "[@fobx/core] Reaction doesn't converge to a stable state after 100 iterations. Likely cycle in reactive graph or reaction mutating state causing infinite loop. Abandoning remaining reactions to prevent app crash.",
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
        let allDepsUpToDate = true
        const deps = reaction.deps
        const depsLength = deps.length
        for (let j = 0; j < depsLength; j++) {
          const dep = deps[j]
          if (dep.kind === KIND_COMPUTED) {
            const depState = dep as unknown as ReactionAdmin
            if (depState.state === STALE || depState.state === POSSIBLY_STALE) {
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

    appendPendingReactions(unresolved)
    currentBatch = unresolved
    unresolved = []
  }

  clearPendingReactions()
}

setRunPendingReactions(runPendingReactions)

export interface TransactionOptions {
  name?: string
}

export function transaction<T extends (...args: Any[]) => Any>(
  fn: T,
  options?: TransactionOptions,
): T {
  const name = options?.name || fn.name || "<unnamed transaction>"

  const wrapper = function (this: unknown, ...args: Any[]) {
    return applyTransactionScope(fn, this, args)
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
  return runTransactionScope(fn)
}

export function transactionBound<T, F extends (this: T, ...args: Any[]) => Any>(
  fn: F,
): F {
  return function (this: T, ...args: Any[]) {
    return transaction(() => fn.apply(this, args))
  } as F
}
