/**
 * Reaction — two-phase: expression (tracked) → effect (untracked on change).
 */

import {
  $fobx,
  addObserver,
  type Any,
  defaultComparer,
  type Dispose,
  type EqualityChecker,
  type EqualityComparison,
  getNextId,
  KIND_COLLECTION,
  KIND_REACTION,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "../state/global.ts"
import { resolveComparer } from "../state/instance.ts"
import {
  applyWithoutTracking,
  removeFromAllDeps,
  runWithTrackingAdmin,
} from "./tracking.ts"
import { scheduleReaction } from "../transactions/transaction.ts"
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
  const newValue = runWithTrackingAdmin(this, _evaluateReactionExpression)

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

  const shouldRun = !hasPrevious ? this._fireImmediately : valueChanged

  if (shouldRun) {
    applyWithoutTracking(this._effect, this, [
      newValue,
      hasPrevious ? this._previousValue : undefined,
      {
        dispose: this._dispose,
        hasPrevious,
      },
    ])
  }

  this._previousValue = newValue
  this._previousChanges = currentChanges
}

function _evaluateReactionExpression(admin: ReactionRunAdmin): Any {
  return admin._expression(admin._dispose)
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
    _previousValue: UNDEFINED,
    _previousChanges: undefined,
    _dispose: dispose,
    _fireImmediately: options?.fireImmediately === true,
    run: _runReaction,
  }

  scheduleReaction(admin)

  return dispose
}
