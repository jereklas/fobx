/**
 * Dependency tracking with epoch-based duplicate detection.
 *
 * Each ObservableAdmin is stamped with the current epoch when tracked.
 * If it already matches, the dep is skipped (O(1) duplicate check).
 */

import {
  $scheduler,
  addObserver,
  deleteObserver,
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
  const t = $scheduler.tracking
  if (t === null) return

  // O(1) duplicate check: if this admin was already tracked this epoch, skip
  if (admin._epoch === $scheduler.epoch) return
  admin._epoch = $scheduler.epoch

  // Add bidirectional links
  t.deps.push(admin)
  addObserver(admin, t)
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
  _prevTracking = $scheduler.tracking
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
 * Remove a reaction from a single dep's observers set.  O(1).
 */
function removeObserver(dep: ObservableAdmin, reaction: ReactionAdmin): void {
  if (deleteObserver(dep, reaction)) {
    dep.onLoseObserver?.(dep)
  }
}

/**
 * Clean up old dependency graph edges after tracking.
 *
 * With Set-based observers, trackAccess uses .add() which is idempotent —
 * re-tracked deps keep their single Set entry.  We only need to remove
 * observer links for deps that were NOT re-tracked (stale deps).
 *
 * Uses the epoch stamp: deps re-tracked this pass have `_epoch === currentEpoch`.
 * Stale deps have an older epoch.
 */
export function cleanupGraph(
  reaction: ReactionAdmin,
  oldDeps: ObservableAdmin[],
): void {
  const newDeps = reaction.deps
  const oldLen = oldDeps.length
  // Fast path: empty old deps (first run) — nothing to clean
  if (oldLen === 0) return

  // Fast path: deps unchanged (most common case on re-runs)
  const newLen = newDeps.length
  if (oldLen === newLen) {
    let same = true
    for (let i = 0; i < oldLen; i++) {
      if (oldDeps[i] !== newDeps[i]) {
        same = false
        break
      }
    }
    if (same) return
  }

  // Slow path: find and remove stale deps (linear scan — faster than Set for typical 1-10 deps)
  for (let i = 0; i < oldLen; i++) {
    const dep = oldDeps[i]
    if (newDeps.indexOf(dep) === -1) {
      removeObserver(dep, reaction)
    }
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
  const prev = $scheduler.tracking
  setTracking(null)
  try {
    return fn()
  } finally {
    setTracking(prev)
  }
}
