// Global state and utilities for the reactive system

import type { ReactionAdmin } from "./types.ts"

// Incrementing ID for unique identification
// OVERFLOW: Protects against Number.MAX_SAFE_INTEGER issues
// Using modulo is faster than conditional checks (if id === MAX_SAFE_INTEGER)
// At 10M, duplicate IDs are extremely unlikely in practice
// Worst case: something recalculates once more than needed (not catastrophic)
const OVERFLOW = 10_000_000
let nextId = 0

export function getNextId(): number {
  nextId++
  return nextId % OVERFLOW
}

// deno-lint-ignore no-explicit-any
export type EqualityChecker = (a: any, b: any) => boolean

export type EqualityComparison = EqualityChecker | "structural"

// used for a key on objects in the system for tracking state
export const $fobx = Symbol("fobx-admin")

// Sentinel value to distinguish "no cached value" from "cached undefined"
export const NOT_CACHED = Symbol("not-cached")

// Global state for dependency tracking and batch processing
interface GlobalState {
  tracking: ReactionAdmin | null
  batchDepth: number
  pending: ReactionAdmin[]
  actionThrew: boolean // Set to true when a transaction throws, cleared in finally block
}

export const $global: GlobalState = {
  tracking: null,
  batchDepth: 0,
  pending: [],
  actionThrew: false,
}

// Default equality comparer - reference equality + NaN handling
export function defaultComparer(a: unknown, b: unknown): boolean {
  // If the items are strictly equal, no need to do a value comparison
  if (a === b) {
    return true
  }
  // If the items are not non-nullish objects, then the only possibility of them being equal but
  // not strictly is if they are both `NaN`. Since `NaN` is uniquely not equal to itself, we can
  // use self-comparison of both objects, which is faster than `isNaN()`.
  if (
    a == null || b == null || typeof a !== "object" || typeof b !== "object"
  ) {
    return a !== a && b !== b
  }
  return false
}
