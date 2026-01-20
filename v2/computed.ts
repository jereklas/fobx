// Computed Observable implementation

import {
  $fobx,
  $global,
  type EqualityComparison,
  getNextId,
  NOT_CACHED,
} from "./global.ts"
import type { ComputedAdmin } from "./types.ts"
import { ReactionState } from "./types.ts"
import {
  cleanupGraph,
  removeFromAllDeps,
  startTracking,
  stopTracking,
  trackAccess,
} from "./tracking.ts"
import { endBatch, startBatch } from "./batch.ts"
import { notifyObservers } from "./notifications.ts"
import { NotificationType } from "./types.ts"
import { safeRunReaction } from "./graph.ts"
import { resolveComparer } from "./instance.ts"

export interface Computed<T> {
  get(): T
  set(value: T): void
  [$fobx]: ComputedAdmin<T>
}

export interface ComputedOptions<T> {
  name?: string
  comparer?: EqualityComparison
  set?: (value: T) => void
  bind?: unknown
}

/**
 * Creates a computed observable
 * Derives information from other observables, evaluates lazily, caches output
 */
export function computed<T>(
  fn: () => T,
  options: ComputedOptions<T> = {},
): Computed<T> {
  const comparer = resolveComparer(options.comparer)
  const bindContext = options.bind
  const userSetter = options.set
  const id = getNextId()

  // Create admin
  const admin: ComputedAdmin<T> = {
    id,
    name: options.name || `Computed@${id}`,
    value: NOT_CACHED as T,
    observers: [],
    comparer: comparer,
    // Initial state is POSSIBLY_STALE to ensure first access triggers computation while allowing it to be batched
    state: ReactionState.POSSIBLY_STALE,
    deps: [],
    run: () => {
      runComputed(admin, fn, bindContext)
    },
    // CRITICAL: When computed loses its last observer, suspend (clear cache)
    // This enables computed cascade suspension and prevents stale cached values
    onLoseObserver: () => {
      suspendIfNeeded(admin)
    },
  }

  // Create computed object
  const computedObj: Computed<T> = {
    [$fobx]: admin,
    get(): T {
      return getComputedValue(admin, fn, bindContext)
    },
    set(value: T): void {
      setComputedValue(admin, value, userSetter, bindContext)
    },
  }

  return computedObj
}

function suspendIfNeeded(admin: ComputedAdmin<unknown>): void {
  if (admin.observers.length > 0) return

  // Suspend: clear cache and dependencies
  admin.value = NOT_CACHED
  admin.state = ReactionState.STALE

  // Remove self from all dependencies
  removeFromAllDeps(admin)
}

function getComputedValue<T>(
  admin: ComputedAdmin<T>,
  fn: () => T,
  bindContext?: unknown,
): T {
  // PERF: Cache batchDepth and observers.length locally
  const batchDepth = $global.batchDepth
  const observersLength = admin.observers.length
  const shouldCache = batchDepth > 0 || observersLength > 0

  // SUSPENDED: Pure function mode - compute without tracking
  if (!shouldCache) {
    // No tracking, no caching, just compute and return
    return bindContext ? fn.call(bindContext) : fn()
  }

  // CACHED MODE:

  // If not UP_TO_DATE or no cached value, recompute
  if (
    admin.state !== ReactionState.UP_TO_DATE ||
    admin.value === NOT_CACHED
  ) {
    safeRunReaction(admin)
  }

  trackAccess(admin)

  return admin.value
}

function setComputedValue<T>(
  admin: ComputedAdmin<T>,
  value: T,
  userSetter: ((value: T) => void) | undefined,
  bindContext?: unknown,
): void {
  // Track if we're inside the setter to detect self-assignment
  if (userSetter) {
    if (admin.isInsideSetter) {
      throw new Error(
        `[@fobx/core] Computed setter is assigning to itself, this will cause an infinite loop.`,
      )
    }
    admin.isInsideSetter = true
    startBatch()
    try {
      bindContext ? userSetter.call(bindContext, value) : userSetter(value)
    } finally {
      endBatch()
      admin.isInsideSetter = false
    }
  } else {
    console.warn(
      `[@fobx/core] There was an attempt to set a value on a computed value without any setter. Nothing was set.`,
    )
  }
}

function runComputed<T>(
  admin: ComputedAdmin<T>,
  fn: () => T,
  bindContext?: unknown,
): void {
  // Note: runPendingReactions guarantees state === STALE before calling run()
  // No state checking needed here - single source of truth in runPendingReactions

  const oldValue = admin.value

  // Track dependencies during recomputation
  const { oldDeps, prevTracking } = startTracking(admin)
  try {
    admin.value = bindContext ? fn.call(bindContext) : fn() // fn captured via closure
    admin.state = ReactionState.UP_TO_DATE
  } catch (error) {
    // On exception, don't update value - keep the last cached value (or NOT_CACHED)
    // This prevents notifications on exceptions, and allows recovering to compare
    // against the last valid value when computation succeeds again
    // Mark as UP_TO_DATE even though we have the old value - prevents re-runs until dependencies change
    admin.state = ReactionState.UP_TO_DATE
    throw error
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(admin, oldDeps)
  }

  // If value changed, notify observers
  // Note: No batching needed - run() is called during runPendingReactions (already in batch)
  // Skip comparer on first evaluation (when oldValue is NOT_CACHED, so no valid old value)
  if (oldValue !== NOT_CACHED && !admin.comparer(oldValue, admin.value)) {
    notifyObservers(admin, NotificationType.CHANGED)
  }
}
