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

const OVERFLOW = 10_000_000
let _nextId = 0

export function getNextId(): number {
  return (++_nextId) % OVERFLOW
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

export const $fobx = Symbol("fobx-admin")
export const NOT_CACHED = Symbol("not-cached")

// ─── Admin Interfaces ────────────────────────────────────────────────────────

export interface ObservableAdmin<T = unknown> {
  kind: number
  id: number
  name: string
  value: T
  observers: ReactionAdmin[]
  comparer: EqualityChecker
  /** Epoch-based tracking: last epoch this admin was added as a dep */
  _epoch: number
  /** Optional: called when losing an observer (enables computed suspension) */
  onLoseObserver?: () => void
  /** Collection mutation counter (used by array/map/set admins) */
  changes?: number
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
}

export type Dispose = () => void

export interface FobxAdmin {
  id: number
  name: string
}

// ─── Global Mutable State ────────────────────────────────────────────────────

/** Currently-tracking reaction (set during reaction execution) */
export let _tracking: ReactionAdmin | null = null
/** Batch nesting depth. Reactions only run when this reaches 0. */
export let _batchDepth = 0
/** Reactions queued for execution at end of batch */
export let _pending: ReactionAdmin[] = []
/** Set to true when a transaction throws, cleared in finally */
export let _actionThrew = false
/** Monotonically increasing epoch for dependency tracking */
export let _epoch = 0

// ─── Mutator Functions ───────────────────────────────────────────────────────

export function setTracking(v: ReactionAdmin | null): void {
  _tracking = v
}
export function incBatch(): void {
  _batchDepth++
}
export function decBatch(): void {
  _batchDepth--
}
export function pushPending(r: ReactionAdmin): void {
  _pending.push(r)
}
/** Swap pending queue for a fresh one, returning the old batch. */
export function swapPending(): ReactionAdmin[] {
  const old = _pending
  _pending = []
  return old
}
export function clearPending(): void {
  _pending.length = 0
}
/** Drain extra items from pending into target array, then clear pending. */
export function drainPendingInto(target: ReactionAdmin[]): void {
  for (let i = 0; i < _pending.length; i++) target.push(_pending[i])
  _pending.length = 0
}
export function setActionThrew(v: boolean): void {
  _actionThrew = v
}
export function nextEpoch(): number {
  return ++_epoch
}
