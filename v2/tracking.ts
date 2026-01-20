// Dependency tracking functions

import { $global } from "./global.ts"
import type { ObservableAdmin, ReactionAdmin } from "./types.ts"

/**
 * Track access to an observable during a reaction
 * Called when an observable is read - registers dependency and observer
 * 
 * PERF: Optimized for hot paths with indexOf checks to avoid duplicates
 */
export function trackAccess(admin: ObservableAdmin): void {
  const tracking = $global.tracking
  if (tracking === null) return // Not in a reaction, nothing to track

  // Add observable to current reaction's dependencies (if not already present)
  const deps = tracking.deps
  if (deps.indexOf(admin) === -1) {
    deps.push(admin)
  }

  // Add reaction to observable's observers (if not already present)
  const observers = admin.observers
  if (observers.indexOf(tracking) === -1) {
    observers.push(tracking)
  }
}

/**
 * Begins tracking dependencies for a reaction
 */
export function startTracking(
  reaction: ReactionAdmin,
): { oldDeps: ObservableAdmin[]; prevTracking: ReactionAdmin | null } {
  // Cache the current dependencies before clearing
  const oldDeps = reaction.deps

  // Clear deps array to collect fresh dependencies
  reaction.deps = []

  // Set as currently tracking reaction
  const prevTracking = $global.tracking
  $global.tracking = reaction

  // Return old deps and previous tracking for cleanup
  return { oldDeps, prevTracking }
}

/**
 * Ends tracking and restores previous context
 */
export function stopTracking(prevTracking: ReactionAdmin | null): void {
  // Restore previous tracking context
  $global.tracking = prevTracking
}

/**
 * Internal helper: removes a specific dependency from reaction's observer list
 * Used by both cleanupGraph and removeFromAllDeps
 */
function removeObserver(dep: ObservableAdmin, reaction: ReactionAdmin): void {
  const observers = dep.observers
  const idx = observers.indexOf(reaction)
  if (idx >= 0) {
    // PERF: Swap-and-pop for O(1) removal
    observers[idx] = observers[observers.length - 1]
    observers.pop()
    
    // CRITICAL: Notify dependency it lost an observer (enables computed suspension)
    dep.onLoseObserver?.()
  }
}

/**
 * Cleans up dependency graph edges for dependencies that are no longer tracked
 */
export function cleanupGraph(
  reaction: ReactionAdmin,
  oldDeps: ObservableAdmin[],
): void {
  // newDeps is already in reaction.deps (populated during tracking)
  const newDeps = reaction.deps

  // Remove reaction from observers that are no longer dependencies
  for (let i = 0; i < oldDeps.length; i++) {
    const dep = oldDeps[i]
    if (newDeps.indexOf(dep) === -1) {
      // This dependency is no longer needed
      removeObserver(dep, reaction)
    }
  }

  // reaction.deps already contains the new dependencies (no reassignment needed)
}

/**
 * Removes a reaction from all its dependencies' observer lists
 * Used when a reaction is being disposed or suspended
 * 
 * PERF: Uses swap-and-pop for O(1) removal from observer arrays
 */
export function removeFromAllDeps(reaction: ReactionAdmin): void {
  const deps = reaction.deps
  for (let i = 0; i < deps.length; i++) {
    removeObserver(deps[i], reaction)
  }
  reaction.deps = []
}

/**
 * Execute a function with dependency tracking enabled
 */
export function withTracking<T>(reaction: ReactionAdmin, fn: () => T): T {
  const { oldDeps, prevTracking } = startTracking(reaction)
  try {
    return fn()
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(reaction, oldDeps)
  }
}

/**
 * Execute a function with dependency tracking disabled
 */
export function withoutTracking<T>(fn: () => T): T {
  const prevTracking = $global.tracking
  $global.tracking = null
  try {
    return fn()
  } finally {
    $global.tracking = prevTracking
  }
}
