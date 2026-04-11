/**
 * Autorun reaction — runs immediately, re-runs on dependency changes.
 */

import {
  $scheduler,
  addObserver,
  deleteObserver,
  type Dispose,
  getNextId,
  KIND_AUTORUN,
  type ObservableAdmin,
  pushPending,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "../state/global.ts"
import { removeFromAllDeps, runWithTrackingAdmin } from "./tracking.ts"
import { safeRunReaction } from "../transactions/batch.ts"
import { isTransaction } from "../utils/utils.ts"

interface AutorunAdmin extends ReactionAdmin {
  _fn: (dispose: Dispose) => void
  _isDisposed: boolean
  _dispose: Dispose
}

/** Shared run function — no per-instance closure. Uses this-based dispatch. */
function _runAutorun(this: AutorunAdmin): void {
  if (this._isDisposed) return
  this.state = UP_TO_DATE
  runWithTrackingAdmin(this, _runTrackedAutorun)
}

function _runTrackedAutorun(admin: AutorunAdmin): void {
  admin._fn(admin._dispose)
}

export interface AutorunOptions {
  name?: string
}

export function autorun(
  fn: (dispose: Dispose) => void,
  options?: AutorunOptions,
): Dispose {
  if (isTransaction(fn)) {
    throw new Error(
      "[@fobx/core] Autorun cannot have a transaction as the tracked function.",
    )
  }

  const id = getNextId()
  // Use let + forward reference so dispose closure captures admin
  // deno-lint-ignore prefer-const
  let admin: AutorunAdmin

  const dispose: Dispose = () => {
    if (admin._isDisposed) return
    admin._isDisposed = true
    removeFromAllDeps(admin)
  }

  admin = {
    kind: KIND_AUTORUN,
    id,
    name: options?.name || `Autorun@${id}`,
    state: STALE,
    deps: [],
    _fn: fn,
    _isDisposed: false,
    _dispose: dispose,
    run: _runAutorun,
  }

  if ($scheduler.batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}

/**
 * Lightweight effect — like autorun but always runs immediately.
 *
 * Designed for DOM effects that only read observables and write to the DOM.
 * Unlike autorun, `effect` is never deferred by batch/transaction context,
 * ensuring DOM elements are fully constructed before insertion.
 *
 * On subsequent dependency changes, the effect is scheduled normally.
 */
export function effect(fn: () => void): Dispose {
  // deno-lint-ignore prefer-const
  let admin: AutorunAdmin

  const dispose: Dispose = () => {
    if (admin._isDisposed) return
    admin._isDisposed = true
    removeFromAllDeps(admin)
  }

  admin = {
    kind: KIND_AUTORUN,
    id: 0,
    name: "",
    state: STALE,
    deps: _EMPTY_DEPS as unknown as ObservableAdmin[],
    _fn: fn,
    _isDisposed: false,
    _dispose: dispose,
    run: _runAutorun,
  }

  // Always run immediately — no batch deferral for initial execution
  admin.run()

  return dispose
}

/** Shared empty deps sentinel — avoids 1 allocation per effect on first run. */
const _EMPTY_DEPS = [] as never[]

// ─── Subscribe ───────────────────────────────────────────────────────────────

/**
 * Ultra-lightweight direct subscription to a single observable admin.
 *
 * Bypasses the entire tracking machinery (startTracking/stopTracking/cleanupGraph).
 * Ideal for DOM effects that read exactly one observable and write to the DOM:
 *
 *   subscribe(labelAdmin, (v) => { a.textContent = v })
 *
 * On initial call, `fn` is invoked synchronously with the current value.
 * On subsequent changes, the reaction is scheduled normally via the batch system.
 *
 * Returns a dispose function that removes the subscription.
 */
// ─── Reaction Pool ───────────────────────────────────────────────────────────

const _reactionPool: SubscriptionReaction<unknown>[] = []

function _getReaction<T>(
  fn: (value: T) => void,
  admin: ObservableAdmin<T>,
): SubscriptionReaction<T> {
  if (_reactionPool.length > 0) {
    const r = _reactionPool.pop()! as SubscriptionReaction<T>
    r._fn = fn
    r._admin = admin
    r.state = UP_TO_DATE
    return r
  }
  return {
    kind: KIND_AUTORUN,
    id: 0,
    name: "",
    state: UP_TO_DATE,
    deps: _EMPTY_DEPS as unknown as ObservableAdmin[],
    run: _runSubscription,
    _fn: fn,
    _admin: admin,
  }
}

/** Recycle a subscription reaction back to the pool. */
export function recycleReaction(r: unknown): void {
  const reaction = r as SubscriptionReaction<unknown>
  reaction._fn = null as unknown as (value: unknown) => void
  reaction._admin = null as unknown as ObservableAdmin<unknown>
  _reactionPool.push(reaction)
}

export function subscribe<T>(
  admin: ObservableAdmin<T>,
  fn: (value: T) => void,
): Dispose {
  const reaction = _getReaction(fn, admin)

  addObserver(admin, reaction)
  fn(admin.value) // initial synchronous run

  // If a scope is active (inside mountList), push the reaction directly
  // instead of creating a dispose closure. The scope's disposal loop
  // handles SubscriptionReaction objects by calling deleteObserver.
  if ($scheduler.activeScope !== null) {
    $scheduler.activeScope.push(reaction)
    return reaction as unknown as Dispose // placeholder — caller won't use it
  }

  // Dispose triggers onLoseObserver for proper cleanup (e.g. selector key removal)
  return () => {
    deleteObserver(admin, reaction)
    if (admin.observers === null && admin.onLoseObserver) {
      admin.onLoseObserver(admin)
    }
  }
}

interface SubscriptionReaction<T> extends ReactionAdmin {
  _fn: (value: T) => void
  _admin: ObservableAdmin<T>
}

/** Shared run function for subscribe — no tracking, just read value and call fn. */
function _runSubscription(this: SubscriptionReaction<unknown>): void {
  this.state = UP_TO_DATE
  this._fn(this._admin.value)
}
