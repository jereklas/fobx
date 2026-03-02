/**
 * Autorun reaction — runs immediately, re-runs on dependency changes.
 */

import {
  _batchDepth,
  type Dispose,
  getNextId,
  KIND_AUTORUN,
  pushPending,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import {
  cleanupGraph,
  getOldDeps,
  getPrevTracking,
  removeFromAllDeps,
  startTracking,
  stopTracking,
} from "./tracking.ts"
import { safeRunReaction } from "./batch.ts"
import { isTransaction } from "./utils.ts"

export interface AutorunOptions {
  name?: string
}

interface AutorunAdmin extends ReactionAdmin {
  _fn: (dispose: Dispose) => void
  _isDisposed: boolean
  _dispose: Dispose
}

/** Shared run function — no per-instance closure. Uses this-based dispatch. */
function _runAutorun(this: AutorunAdmin): void {
  if (this._isDisposed) return
  this.state = UP_TO_DATE
  startTracking(this)
  const oldDeps = getOldDeps()
  const prevTracking = getPrevTracking()
  try {
    this._fn(this._dispose)
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(this, oldDeps)
  }
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

  if (_batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
