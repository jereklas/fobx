// Batching and transaction functions

import { $fobx, $global } from "./global.ts"
import { runPendingReactions } from "./graph.ts"
import { withoutTracking } from "./tracking.ts"

/**
 * Start a batch - increments the batch depth counter
 */
export function startBatch(): void {
  $global.batchDepth++
}

/**
 * End a batch - decrements the batch depth counter and runs pending reactions if at 0
 */
export function endBatch(): void {
  $global.batchDepth--

  if ($global.batchDepth === 0) {
    runPendingReactions()
  }
}

export interface TransactionOptions {
  name?: string
}

/**
 * Execute a function within a transaction (batched and untracked)
 *
 * Can be called two ways:
 * 1. As executor: transaction(() => code) - runs immediately
 * 2. As wrapper: transaction(fn, options) - returns wrapped function
 *
 * Transactions are batched and untracked:
 * - Batched: mutations don't trigger reactions until transaction completes
 * - Untracked: reading observables inside transaction doesn't create dependencies
 */
export function transaction<T extends (...args: any[]) => any>(
  fn: T,
  options?: TransactionOptions,
): T {
  const name = options?.name || fn.name || "<unnamed transaction>"

  const wrapper = function (this: unknown, ...args: any[]) {
    startBatch()
    try {
      return withoutTracking(() => fn.apply(this, args))
    } catch (e) {
      $global.actionThrew = true
      throw e
    } finally {
      endBatch()
      $global.actionThrew = false
    }
  }

  // Set the function name
  Object.defineProperty(wrapper, "name", {
    value: name,
    configurable: true,
  })

  // Mark as transaction with $fobx symbol
  Object.defineProperty(wrapper, $fobx, {
    value: true,
    enumerable: false,
    configurable: false,
  })

  return wrapper as T
}

/**
 * Execute code immediately in a transaction
 */
export function runInTransaction<T>(fn: () => T): T {
  startBatch()
  try {
    return withoutTracking(() => fn())
  } catch (e) {
    $global.actionThrew = true
    throw e
  } finally {
    endBatch()
    $global.actionThrew = false
  }
}

/**
 * Create a bound transaction wrapper for a method
 * The returned function is bound to 'this' when created
 */
export function transactionBound<T, F extends (this: T, ...args: any[]) => any>(
  fn: F,
): F {
  return function (this: T, ...args: any[]) {
    return transaction(() => fn.apply(this, args))
  } as F
}
