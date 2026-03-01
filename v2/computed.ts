/**
 * Computed Observable — derives values from other observables.
 */

import {
  $fobx,
  _batchDepth,
  type ComputedAdmin,
  type EqualityComparison,
  getNextId,
  KIND_COMPUTED,
  NOT_CACHED,
  NOTIFY_CHANGED,
  POSSIBLY_STALE,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import {
  cleanupGraph,
  getOldDeps,
  getPrevTracking,
  removeFromAllDeps,
  startTracking,
  stopTracking,
  trackAccess,
} from "./tracking.ts"
import { endBatch, safeRunReaction, startBatch } from "./batch.ts"
import { notifyObservers } from "./notifications.ts"

export interface Computed<T> {
  get(): T
  set(value: T): void
  dispose(): void
  [$fobx]: ComputedAdmin<T>
}

export interface ComputedOptions<T> {
  name?: string
  comparer?: EqualityComparison
  set?: (value: T) => void
  bind?: unknown
}

export function computed<T>(
  fn: () => T,
  options: ComputedOptions<T> = {},
): Computed<T> {
  const comparer = resolveComparer(options.comparer)
  const bindContext = options.bind
  const userSetter = options.set
  const id = getNextId()

  const admin: ComputedAdmin<T> = {
    kind: KIND_COMPUTED,
    id,
    name: options.name || `Computed@${id}`,
    value: NOT_CACHED as T,
    observers: [],
    comparer,
    _epoch: 0,
    state: POSSIBLY_STALE,
    deps: [],
    run: () => runComputed(admin, fn, bindContext),
    onLoseObserver: () => suspendIfNeeded(admin),
  }

  return {
    [$fobx]: admin,
    get(): T {
      return getComputedValue(admin, fn, bindContext)
    },
    set(value: T): void {
      setComputedValue(admin, value, userSetter, bindContext)
    },
    dispose(): void {
      removeFromAllDeps(admin)
    },
  }
}

function suspendIfNeeded(admin: ComputedAdmin<unknown>): void {
  if (admin.observers.length > 0) return
  admin.value = NOT_CACHED
  admin.state = STALE
  removeFromAllDeps(admin)
}

function getComputedValue<T>(
  admin: ComputedAdmin<T>,
  fn: () => T,
  bindContext?: unknown,
): T {
  const shouldCache = _batchDepth > 0 || admin.observers.length > 0

  // SUSPENDED: Pure function mode — compute without tracking
  if (!shouldCache) {
    return bindContext ? fn.call(bindContext) : fn()
  }

  // CACHED MODE: recompute if stale
  if (admin.state !== UP_TO_DATE || admin.value === NOT_CACHED) {
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
  const oldValue = admin.value

  startTracking(admin)
  const oldDeps = getOldDeps()
  const prevTracking = getPrevTracking()
  try {
    admin.value = bindContext ? fn.call(bindContext) : fn()
    admin.state = UP_TO_DATE
  } catch (error) {
    admin.state = UP_TO_DATE
    throw error
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(admin, oldDeps)
  }

  // Notify observers if value changed (skip on first computation)
  if (oldValue !== NOT_CACHED && !admin.comparer(oldValue, admin.value)) {
    notifyObservers(admin, NOTIFY_CHANGED)
  }
}
