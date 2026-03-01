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
import { removeFromAllDeps, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./batch.ts"
import { isTransaction } from "./utils.ts"

export interface AutorunOptions {
  name?: string
}

export function autorun(
  fn: (dispose: Dispose) => void,
  options: AutorunOptions = {},
): Dispose {
  let isDisposed = false

  if (isTransaction(fn)) {
    throw new Error(
      "[@fobx/core] Autorun cannot have a transaction as the tracked function.",
    )
  }

  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
  }

  const id = getNextId()
  const admin: ReactionAdmin = {
    kind: KIND_AUTORUN,
    id,
    name: options.name || `Autorun@${id}`,
    state: STALE,
    deps: [],
    run: () => {
      if (isDisposed) return
      admin.state = UP_TO_DATE
      withTracking(admin, () => {
        fn(dispose)
      })
    },
  }

  if (_batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
