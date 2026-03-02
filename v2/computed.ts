/**
 * Computed Observable — derives values from other observables.
 */

import {
  $fobx,
  _batchDepth,
  type ComputedAdmin,
  defaultComparer,
  type EqualityComparison,
  getNextId,
  KIND_COMPUTED,
  NOT_CACHED,
  NOTIFY_CHANGED,
  type ObservableAdmin,
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
  options?: ComputedOptions<T>,
): Computed<T> {
  const comparer = options?.comparer
    ? resolveComparer(options.comparer)
    : defaultComparer
  const bindContext = options?.bind
  const userSetter = options?.set
  const id = getNextId()

  const admin: ComputedAdmin<T> = {
    kind: KIND_COMPUTED,
    id,
    name: options?.name || `Computed@${id}`,
    value: NOT_CACHED as T,
    observers: new Set(),
    comparer,
    _epoch: 0,
    state: POSSIBLY_STALE,
    deps: [],
    _fn: fn,
    _bind: bindContext,
    run: _runComputed,
    onLoseObserver: _suspendIfNeeded,
  }

  return {
    [$fobx]: admin,
    get(): T {
      return getComputedValue(admin)
    },
    set(value: T): void {
      setComputedValue(admin, value, userSetter, bindContext)
    },
    dispose(): void {
      removeFromAllDeps(admin)
    },
  }
}

/** Shared onLoseObserver — receives admin from removeObserver. No per-instance closure. */
function _suspendIfNeeded(admin: ObservableAdmin): void {
  if (admin.observers.size > 0) return
  admin.value = NOT_CACHED
  ;(admin as ComputedAdmin).state = STALE
  removeFromAllDeps(admin as ComputedAdmin)
}

function getComputedValue<T>(
  admin: ComputedAdmin<T>,
): T {
  const shouldCache = _batchDepth > 0 || admin.observers.size > 0

  // SUSPENDED: Pure function mode — compute without tracking
  if (!shouldCache) {
    return admin._bind ? admin._fn.call(admin._bind) : admin._fn()
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

/** Shared run function — stored on admin.run, no per-instance closure. */
function _runComputed(this: ComputedAdmin): void {
  // deno-lint-ignore no-this-alias
  const admin = this
  const oldValue = admin.value

  startTracking(admin)
  const oldDeps = getOldDeps()
  const prevTracking = getPrevTracking()
  try {
    admin.value = admin._bind
      ? admin._fn.call(admin._bind)
      : admin._fn()
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
