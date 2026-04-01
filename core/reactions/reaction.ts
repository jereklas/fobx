/**
 * Reaction — two-phase: expression (tracked) → effect (untracked on change).
 */

import {
  $fobx,
  $scheduler,
  addObserver,
  type Any,
  defaultComparer,
  type Dispose,
  type EqualityChecker,
  type EqualityComparison,
  getNextId,
  KIND_COLLECTION,
  KIND_REACTION,
  pushPending,
  type ReactionAdmin,
  setTracking,
  STALE,
  UP_TO_DATE,
} from "../state/global.ts"
import { resolveComparer } from "../state/instance.ts"
import {
  cleanupGraph,
  getOldDeps,
  getPrevTracking,
  removeFromAllDeps,
  startTracking,
  stopTracking,
} from "./tracking.ts"
import { safeRunReaction } from "../transactions/batch.ts"
import { hasFobxAdmin } from "../utils/utils.ts"

export const UNDEFINED = Symbol.for("fobx-undefined")

export interface ReactionEffectContext {
  dispose: Dispose
  hasPrevious: boolean
}

export interface ReactionOptions<T> {
  name?: string
  fireImmediately?: boolean
  comparer?: EqualityComparison
}

interface ReactionRunAdmin extends ReactionAdmin {
  _expression: (dispose: Dispose) => Any
  _effect: (
    value: Any,
    previousValue: Any,
    context: ReactionEffectContext,
  ) => void
  _comparer: EqualityChecker
  _isDisposed: boolean
  _isFirst: boolean
  _previousValue: Any
  _previousChanges: number | undefined
  _dispose: Dispose
  _fireImmediately: boolean
}

/** Shared run function — no per-instance closure. Uses this-based dispatch. */
function _runReaction(this: ReactionRunAdmin): void {
  if (this._isDisposed) return
  this.state = UP_TO_DATE

  // Phase 1: Track dependencies (inlined withTracking — avoids closure)
  startTracking(this)
  const oldDeps = getOldDeps()
  const prevTracking = getPrevTracking()
  let newValue: Any
  try {
    newValue = this._expression(this._dispose)
  } finally {
    stopTracking(prevTracking)
    cleanupGraph(this, oldDeps)
  }

  // Check if result is an observable collection (array, map, or set)
  let currentChanges: number | undefined = undefined
  const collectionAdmin = hasFobxAdmin(newValue)
    ? (newValue as Any)[$fobx]
    : undefined
  const isObservableCollection = collectionAdmin?.kind === KIND_COLLECTION

  // If result is an observable collection, register as observer and snapshot changes
  if (isObservableCollection) {
    const deps = this.deps
    if (deps.indexOf(collectionAdmin) === -1) {
      deps.push(collectionAdmin)
    }
    addObserver(collectionAdmin, this)
    currentChanges = collectionAdmin.changes
  }

  // Check if value changed
  const hasPrevious = this._previousValue !== UNDEFINED

  let valueChanged: boolean
  if (!hasPrevious) {
    valueChanged = true
  } else if (
    currentChanges !== undefined && this._previousChanges !== undefined
  ) {
    valueChanged = currentChanges !== this._previousChanges
  } else {
    valueChanged = !this._comparer(this._previousValue, newValue)
  }

  const shouldRun = this._isFirst ? this._fireImmediately : valueChanged

  if (shouldRun) {
    // Inlined withoutTracking — avoids closure allocation
    const prevTrack = $scheduler.tracking
    setTracking(null)
    try {
      this._effect(
        newValue,
        hasPrevious ? this._previousValue : undefined,
        {
          dispose: this._dispose,
          hasPrevious,
        },
      )
    } finally {
      setTracking(prevTrack)
    }
  }

  this._previousValue = newValue
  this._previousChanges = currentChanges
  this._isFirst = false
}

export function reaction<T>(
  expression: (dispose: Dispose) => T,
  effect: (
    value: T,
    previousValue: T | undefined,
    context: ReactionEffectContext,
  ) => void,
  options?: ReactionOptions<T>,
): Dispose {
  const comparer = options?.comparer
    ? resolveComparer(options.comparer)
    : defaultComparer

  const id = getNextId()
  // Use let + forward reference so dispose closure captures admin
  // deno-lint-ignore prefer-const
  let admin: ReactionRunAdmin

  const dispose: Dispose = () => {
    if (admin._isDisposed) return
    admin._isDisposed = true
    removeFromAllDeps(admin)
  }

  admin = {
    kind: KIND_REACTION,
    id,
    name: options?.name || `Reaction@${id}`,
    state: STALE,
    deps: [],
    _expression: expression as (dispose: Dispose) => Any,
    _effect: effect as (
      value: Any,
      previousValue: Any,
      context: ReactionEffectContext,
    ) => void,
    _comparer: comparer,
    _isDisposed: false,
    _isFirst: true,
    _previousValue: UNDEFINED,
    _previousChanges: undefined,
    _dispose: dispose,
    _fireImmediately: options?.fireImmediately === true,
    run: _runReaction,
  }

  if ($scheduler.batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
