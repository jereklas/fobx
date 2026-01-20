// Type definitions for the reactive system

import type { EqualityChecker } from "./global.ts"

export interface FobxAdmin {
  id: number
  name: string
}

export interface ObservableAdmin<T = unknown> extends FobxAdmin {
  value: T
  observers: ReactionAdmin[]
  comparer: EqualityChecker
  onLoseObserver?: () => void // Called when losing an observer (enables computed suspension)
}

export interface ReactionAdmin extends FobxAdmin {
  state: ReactionState
  deps: ObservableAdmin<unknown>[]
  run: () => void
}

export interface ComputedAdmin<T = unknown>
  extends ReactionAdmin, ObservableAdmin<T> {
  // TODO: this could potentially be omitted from the admin if the setComputedValue helper used an object for args?
  isInsideSetter?: boolean
}

export enum ReactionState {
  UP_TO_DATE = 0, // Value cached (computed) / No execution needed (reaction)
  POSSIBLY_STALE = 1, // Computed dependency changed, needs verification before use
  STALE = 2, // Observable changed, must recompute/re-execute
}

export enum NotificationType {
  CHANGED = 0, // Direct observable changed
  INDETERMINATE = 1, // Computed dependency might have changed
}

export type Dispose = () => void
