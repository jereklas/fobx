/**
 * Notification propagation.
 *
 * Uses `kind` discriminant for type checks and inlines per-observer logic.
 * `notifyChanged` centralizes the notify + runPending pattern.
 */

import {
  _batchDepth,
  _pending,
  _tracking,
  type ComputedAdmin,
  KIND_BOX,
  KIND_COLLECTION,
  KIND_COMPUTED,
  NOTIFY_CHANGED,
  NOTIFY_INDETERMINATE,
  type ObservableAdmin,
  POSSIBLY_STALE,
  pushPending,
  STALE,
  UP_TO_DATE,
} from "./global.ts"

// Forward declaration — set by batch.ts to break circular dep
let _runPendingReactions: () => void = () => {}

export function setRunPendingReactions(fn: () => void): void {
  _runPendingReactions = fn
}

// Cache dev mode check at module level (supports both Deno and Node)
const isNotProduction =
  (typeof Deno !== "undefined" && Deno.env?.get("NODE_ENV") !== "production") ||
  // deno-lint-ignore no-process-global no-process-global
  (typeof process !== "undefined" && process.env?.NODE_ENV !== "production")

/**
 * Notify all observers of an observable that it changed.
 * This is the core propagation function — runs on every observable write with observers.
 */
export function notifyObservers(
  observable: ObservableAdmin,
  notificationType: number,
): void {
  const observers = observable.observers
  const length = observers.length

  for (let i = 0; i < length; i++) {
    const reaction = observers[i]

    // Handle the currently-tracking reaction specially
    if (reaction === _tracking) {
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
      continue
    }

    const state = reaction.state

    if (
      state === STALE || state === POSSIBLY_STALE
    ) {
      // Upgrade to STALE if receiving CHANGED notification
      if (notificationType === NOTIFY_CHANGED) {
        reaction.state = STALE
      }
      continue // Already queued
    }

    // state === UP_TO_DATE
    reaction.state = notificationType === NOTIFY_CHANGED
      ? STALE
      : POSSIBLY_STALE

    // Only queue reactions that have observers (don't queue suspended computeds)
    const isComp = reaction.kind === KIND_COMPUTED
    const hasObservers = isComp
      ? (reaction as unknown as ComputedAdmin).observers.length > 0
      : true

    if (hasObservers) {
      pushPending(reaction)
    }

    // Propagate through computed chain
    if (isComp && hasObservers) {
      notifyObservers(
        reaction as unknown as ObservableAdmin,
        NOTIFY_INDETERMINATE,
      )
    }
  }
}

/**
 * Single helper: notify observers that a value changed + run pending if not batching.
 * Centralizes the notify + runPending pattern to avoid per-call-site duplication.
 */
export function notifyChanged(admin: ObservableAdmin): void {
  if (admin.observers.length > 0) {
    notifyObservers(admin, NOTIFY_CHANGED)
  }
  // Skip runPendingReactions when nothing was queued (common for unobserved writes).
  if (_batchDepth === 0 && _pending.length > 0) {
    _runPendingReactions()
  }
}

export { isNotProduction }
