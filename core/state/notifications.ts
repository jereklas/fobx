/**
 * Notification propagation.
 *
 * Uses `kind` discriminant for type checks and inlines per-observer logic.
 * `notifyChanged` centralizes the notify + runPending pattern.
 */

import {
  $scheduler,
  type ComputedAdmin,
  hasObservers as _hasObservers,
  isTrackingReactiveRun,
  isTransactionActive,
  KIND_BOX,
  KIND_COLLECTION,
  KIND_COMPUTED,
  NOTIFY_CHANGED,
  NOTIFY_INDETERMINATE,
  type ObservableAdmin,
  POSSIBLY_STALE,
  pushPending,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import { debug } from "../utils/debug.ts"
import { $instance } from "./instance.ts"

// Forward declaration — set by transaction.ts to break circular dep
let _runPendingReactions: () => void = () => {}

export function setRunPendingReactions(fn: () => void): void {
  _runPendingReactions = fn
}

const isNotProduction =
  // deno-lint-ignore no-process-global no-process-global
  typeof process !== "undefined" && process.env?.NODE_ENV !== "production"

/**
 * Process a single observer notification — extracted to avoid duplication
 * between the single-observer and Set iteration paths.
 */
function _notifyOneObserver(
  reaction: ReactionAdmin,
  observable: ObservableAdmin,
  notificationType: number,
): void {
  // Handle the currently-tracking reaction specially
  if (reaction === $scheduler.tracking) {
    // Pure observables (box, collection) can re-queue the tracker
    // Computed lazy recomputation during tracking should NOT re-queue
    const kind = observable.kind
    if (
      (kind === KIND_BOX || kind === KIND_COLLECTION) &&
      notificationType === NOTIFY_CHANGED &&
      reaction.state === UP_TO_DATE
    ) {
      reaction.state = STALE
      pushPending(reaction)
    }
    return
  }

  const state = reaction.state

  if (
    state === STALE || state === POSSIBLY_STALE
  ) {
    // Upgrade to STALE if receiving CHANGED notification
    if (notificationType === NOTIFY_CHANGED) {
      reaction.state = STALE
    }
    return // Already queued
  }

  // state === UP_TO_DATE
  reaction.state = notificationType === NOTIFY_CHANGED ? STALE : POSSIBLY_STALE

  // Only queue reactions that have observers (don't queue suspended computeds)
  const isComp = reaction.kind === KIND_COMPUTED
  const hasObs = isComp
    ? _hasObservers(reaction as unknown as ComputedAdmin)
    : true

  if (hasObs) {
    pushPending(reaction)
  }

  // Propagate through computed chain
  if (isComp && hasObs) {
    notifyObservers(
      reaction as unknown as ObservableAdmin,
      NOTIFY_INDETERMINATE,
    )
  }
}

/**
 * Notify all observers of an observable that it changed.
 * This is the core propagation function — runs on every observable write with observers.
 */
export function notifyObservers(
  observable: ObservableAdmin,
  notificationType: number,
): void {
  const obs = observable.observers
  if (obs === null) return

  if (obs instanceof Set) {
    for (const reaction of obs) {
      _notifyOneObserver(reaction, observable, notificationType)
    }
  } else {
    // Single observer — fast path (no Set iteration overhead)
    _notifyOneObserver(obs, observable, notificationType)
  }
}

/**
 * Notify observers of a direct CHANGED event without triggering an immediate
 * pending-reaction flush. Useful for callers that batch or perform additional
 * related notifications before the scheduler drains.
 */
export function notifyObserversChanged(observable: ObservableAdmin): void {
  if (observable.observers !== null) {
    notifyObservers(observable, NOTIFY_CHANGED)
  }
}

/**
 * Single helper: notify observers that a value changed + run pending if not batching.
 * Centralizes the notify + runPending pattern to avoid per-call-site duplication.
 */
export function notifyChanged(admin: ObservableAdmin): void {
  notifyObserversChanged(admin)
  // Skip runPendingReactions when nothing was queued (common for unobserved writes).
  if (
    !isTransactionActive() && !isTrackingReactiveRun() &&
    $scheduler.pending.length > 0
  ) {
    _runPendingReactions()
  }
}

export function warnIfObservedWriteOutsideTransaction(
  admin: ObservableAdmin,
  label: "observable value" | "observable values" = "observable value",
): void {
  if (
    $instance.enforceTransactions &&
    !isTransactionActive() &&
    _hasObservers(admin)
  ) {
    debug.warn(
      `[@fobx/core] Changing tracked ${label} (${admin.name}) outside of a transaction is discouraged as reactions run more frequently than necessary.`,
    )
  }
}

export { isNotProduction }
