// ─── Global state, types, and utilities for the reactive system ──────────────

// deno-lint-ignore no-explicit-any
export type Any = any

// ─── Admin Kind Discriminant ─────────────────────────────────────────────────

export const KIND_BOX = 0
export const KIND_COMPUTED = 1
export const KIND_AUTORUN = 2
export const KIND_REACTION = 3
export const KIND_WHEN = 4
export const KIND_COLLECTION = 5 // keysAdmin / collectionAdmin on maps/sets/arrays

// ─── Reaction State ──────────────────────────────────────────────────────────

export const UP_TO_DATE = 0
export const POSSIBLY_STALE = 1
export const STALE = 2

// ─── Notification Type ───────────────────────────────────────────────────────

export const NOTIFY_CHANGED = 0
export const NOTIFY_INDETERMINATE = 1

// ─── IDs ─────────────────────────────────────────────────────────────────────

export function getNextId(): number {
  return ++$scheduler.nextId
}

// ─── Equality ────────────────────────────────────────────────────────────────

export type EqualityChecker = (a: Any, b: Any) => boolean
export type EqualityComparison = EqualityChecker | "structural" | "default"

export function defaultComparer(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (
    a == null || b == null || typeof a !== "object" || typeof b !== "object"
  ) {
    return a !== a && b !== b // NaN check
  }
  return false
}

// ─── Symbols & Sentinels ─────────────────────────────────────────────────────

export const $fobx = Symbol.for("fobx-admin")
export const NOT_CACHED = Symbol.for("fobx-not-cached")

// ─── Admin Interfaces ────────────────────────────────────────────────────────

/**
 * Observers storage — compact union to avoid Set allocation for common cases.
 *
 * - `null`  — no observers (initial state, avoids `new Set()`)
 * - `ReactionAdmin` — exactly 1 observer (most common for label boxes etc.)
 * - `Set<ReactionAdmin>` — 2+ observers (upgraded lazily)
 */
export type Observers = null | ReactionAdmin | Set<ReactionAdmin>

export interface ObservableAdmin<T = unknown> {
  kind: number
  id: number
  name: string
  value: T
  observers: Observers
  comparer: EqualityChecker
  /** Epoch-based tracking: last epoch this admin was added as a dep */
  _epoch: number
  /** Last reaction that tracked this admin in the current dedup fast-path. */
  _tracker?: ReactionAdmin
  /** Optional: called when losing an observer (enables computed suspension) */
  onLoseObserver?: (admin: ObservableAdmin) => void
  /** Collection mutation counter (used by array/map/set admins) */
  changes?: number
}

// ─── Observer helpers ────────────────────────────────────────────────────────

/** Add an observer to an observable's observers (idempotent for single ref). */
export function addObserver(
  admin: ObservableAdmin,
  reaction: ReactionAdmin,
): void {
  const obs = admin.observers
  if (obs === null) {
    admin.observers = reaction
  } else if (obs instanceof Set) {
    obs.add(reaction)
  } else {
    // Single ref — upgrade to Set if different reaction
    if (obs !== reaction) {
      const s = new Set<ReactionAdmin>()
      s.add(obs)
      s.add(reaction)
      admin.observers = s
    }
  }
}

/** Delete an observer. Returns true if it was present. */
export function deleteObserver(
  admin: ObservableAdmin,
  reaction: ReactionAdmin,
): boolean {
  const obs = admin.observers
  if (obs === null) return false
  if (obs instanceof Set) {
    const deleted = obs.delete(reaction)
    if (obs.size === 0) admin.observers = null
    return deleted
  }
  // Single ref
  if (obs === reaction) {
    admin.observers = null
    return true
  }
  return false
}

/** Check if an observable has any observers. */
export function hasObservers(admin: ObservableAdmin): boolean {
  return admin.observers !== null
}

/** Get observer count (for tests). */
export function observerCount(admin: ObservableAdmin): number {
  const obs = admin.observers
  if (obs === null) return 0
  if (obs instanceof Set) return obs.size
  return 1
}

/** Check if a specific reaction is observing this admin (for tests). */
export function observerHas(
  admin: ObservableAdmin,
  reaction: ReactionAdmin,
): boolean {
  const obs = admin.observers
  if (obs === null) return false
  if (obs instanceof Set) return obs.has(reaction)
  return obs === reaction
}

export interface ReactionAdmin {
  kind: number
  id: number
  name: string
  state: number
  deps: ObservableAdmin[]
  run: () => void
}

export interface ComputedAdmin<T = unknown>
  extends ReactionAdmin, ObservableAdmin<T> {
  isInsideSetter?: boolean
  didWarnNoDependencies?: boolean
  batchToken?: ReactionAdmin[]
  /** The computation function — stored here so `run` can be a shared function. */
  _fn: () => T
  /** Optional bind context for the computation function. */
  _bind?: unknown
}

export type Dispose = () => void

export interface FobxAdmin {
  id: number
  name: string
}

// ─── DOM-Global Scheduler State ──────────────────────────────────────────────
//
// ⚠️  STABILITY CONTRACT — DO NOT MODIFY THIS SHAPE WITHOUT CAREFUL CONSIDERATION
//
// This state is stored on `globalThis` via `Symbol.for` so that multiple bundled
// copies of fobx in the same page share a single scheduling context. This is
// critical for correctness: all reactions must participate in one batch queue,
// and there can only be one "currently tracking" reaction at a time.
//
// If the shape of SchedulerState changes, all existing deployed copies of fobx
// become incompatible. Treat this interface as a cross-bundle protocol:
//   - NEVER remove or rename existing fields
//   - NEVER change the semantics of existing fields
//   - New fields may be added with fallback behavior for older copies
//   - Version the Symbol key if a breaking change is truly unavoidable
//

const $fobxScheduler = Symbol.for("fobx-scheduler")

interface SchedulerState {
  /** Currently-tracking reaction (set during reaction execution) */
  tracking: ReactionAdmin | null
  /** Batch nesting depth. Reactions only run when this reaches 0. */
  batchDepth: number
  /** Reactions queued for execution at end of batch */
  pending: ReactionAdmin[]
  /** Set to true when a transaction throws, cleared in finally */
  actionThrew: boolean
  /** Monotonically increasing epoch for dependency tracking */
  epoch: number
  /**
   * Active cleanup scope — when non-null, subscribe() pushes the reaction
   * object directly here instead of creating a dispose closure.
   * Set/cleared by the DOM layer's enterScope/exitScope.
   */
  activeScope: Any[] | null
  /** Monotonically increasing ID counter */
  nextId: number
  /**
   * Monotonically increasing write epoch — incremented on every observable
   * value change (any call to notifyChanged). Used by the React adapter to
   * distinguish a true "something changed while suspended" case from a
   * StrictMode cleanup/resubscribe cycle where nothing was actually written.
   * Fallback: older copies of fobx that don't bump this field leave it at 0;
   * the reactV2 integration then conservatively treats epoch=0 as "may have
   * changed" and falls back to always bumping stateVersion.
   */
  writeEpoch: number
}

function getSchedulerState(): SchedulerState {
  const g = globalThis as Any
  if (g[$fobxScheduler] !== undefined) {
    return g[$fobxScheduler] as SchedulerState
  }
  const state: SchedulerState = {
    tracking: null,
    batchDepth: 0,
    pending: [],
    actionThrew: false,
    epoch: 0,
    activeScope: null,
    nextId: 0,
    writeEpoch: 0,
  }
  Object.defineProperty(g, $fobxScheduler, { value: state })
  return state
}

/**
 * Shared scheduler state — lives on globalThis so all copies of fobx
 * in the page participate in the same batch queue and tracking context.
 */
export const $scheduler: SchedulerState = getSchedulerState()

// ─── Mutator Functions ───────────────────────────────────────────────────────

export function setTracking(v: ReactionAdmin | null): void {
  $scheduler.tracking = v
}
export function incBatch(): void {
  if ($scheduler.batchDepth === 0) {
    // Fresh queue identity doubles as the outer-batch token for computed reuse.
    $scheduler.pending = []
  }
  $scheduler.batchDepth++
}
export function decBatch(): void {
  $scheduler.batchDepth--
}
export function pushPending(r: ReactionAdmin): void {
  $scheduler.pending.push(r)
}
/** Swap pending queue for a fresh one, returning the old batch. */
export function swapPending(): ReactionAdmin[] {
  const old = $scheduler.pending
  $scheduler.pending = []
  return old
}
export function clearPending(): void {
  $scheduler.pending.length = 0
}
/** Drain extra items from pending into target array, then clear pending. */
export function drainPendingInto(target: ReactionAdmin[]): void {
  const p = $scheduler.pending
  for (let i = 0; i < p.length; i++) target.push(p[i])
  p.length = 0
}
export function setActionThrew(v: boolean): void {
  $scheduler.actionThrew = v
}
export function nextEpoch(): number {
  return ++$scheduler.epoch
}
export function setActiveScope(scope: Any[] | null): void {
  $scheduler.activeScope = scope
}
