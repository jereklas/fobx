/**
 * Dependency tracking with epoch-based duplicate detection.
 *
 * Each ObservableAdmin is stamped with the current epoch when tracked.
 * If it already matches, the dep is skipped (O(1) duplicate check).
 */

import {
  _epoch,
  _tracking,
  nextEpoch,
  type ObservableAdmin,
  type ReactionAdmin,
  setTracking,
} from "./global.ts"

// ─── Module-level state ──────────────────────────────────────────────────────

let _prevTracking: ReactionAdmin | null = null
let _oldDeps: ObservableAdmin[] = []

/**
 * Track access to an observable during a reaction.
 * Called when an observable is read.
 */
export function trackAccess(admin: ObservableAdmin): void {
  const t = _tracking
  if (t === null) return

  // O(1) duplicate check: if this admin was already tracked this epoch, skip
  if (admin._epoch === _epoch) return
  admin._epoch = _epoch

  // Add bidirectional links
  t.deps.push(admin)
  admin.observers.push(t)
}

/**
 * Begin tracking dependencies for a reaction.
 * Uses module-level vars to avoid allocating a return object.
 */
export function startTracking(reaction: ReactionAdmin): void {
  // Increment epoch for this tracking pass (used by trackAccess dedup)
  nextEpoch()

  // Stash current deps for cleanup
  _oldDeps = reaction.deps
  reaction.deps = []

  // Stash previous tracking context
  _prevTracking = _tracking
  setTracking(reaction)
}

/**
 * Get the old deps saved by startTracking (for callers that need them).
 */
export function getOldDeps(): ObservableAdmin[] {
  return _oldDeps
}

/**
 * Get the previous tracking context saved by startTracking.
 */
export function getPrevTracking(): ReactionAdmin | null {
  return _prevTracking
}

/**
 * End tracking and restore previous context.
 * Takes the saved prevTracking value to correctly handle nested tracking
 * (module-level _prevTracking gets overwritten by inner startTracking calls).
 */
export function stopTracking(prevTracking: ReactionAdmin | null): void {
  setTracking(prevTracking)
}

/**
 * Remove a reaction from a single dep's observers list.
 * Uses swap-and-pop for O(1) removal.
 */
function removeObserver(dep: ObservableAdmin, reaction: ReactionAdmin): void {
  const observers = dep.observers
  const idx = observers.indexOf(reaction)
  if (idx >= 0) {
    const last = observers.length - 1
    if (idx !== last) observers[idx] = observers[last]
    observers.pop()
    dep.onLoseObserver?.()
  }
}

/**
 * Clean up old dependency graph edges after tracking.
 *
 * Always removes the old observer link for every previous dep.
 * - For stale deps (not re-tracked): removes the only link → fully disconnected.
 * - For re-tracked deps: trackAccess already added a fresh link, so removing
 *   the old one leaves exactly one. This prevents O(N) observer list growth.
 */
export function cleanupGraph(
  reaction: ReactionAdmin,
  oldDeps: ObservableAdmin[],
): void {
  for (let i = 0; i < oldDeps.length; i++) {
    removeObserver(oldDeps[i], reaction)
  }
}

/**
 * Remove a reaction from ALL its dependencies' observer lists.
 * Used when disposing a reaction.
 */
export function removeFromAllDeps(reaction: ReactionAdmin): void {
  const deps = reaction.deps
  for (let i = 0; i < deps.length; i++) {
    removeObserver(deps[i], reaction)
  }
  reaction.deps = []
}

/**
 * Execute fn with dependency tracking enabled.
 * Handles startTracking → fn → stopTracking → cleanupGraph.
 */
export function withTracking<T>(reaction: ReactionAdmin, fn: () => T): T {
  startTracking(reaction)
  const oldDeps = _oldDeps
  const prevTracking = _prevTracking
  try {
    return fn()
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(reaction, oldDeps)
  }
}

/**
 * Execute fn with dependency tracking disabled.
 */
export function withoutTracking<T>(fn: () => T): T {
  const prev = _tracking
  setTracking(null)
  try {
    return fn()
  } finally {
    setTracking(prev)
  }
}
