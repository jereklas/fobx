// Reaction (two-phase) implementation

import { $fobx, $global, type EqualityComparison, getNextId } from "./global.ts"
import { resolveComparer } from "./instance.ts"
import type { Dispose, ReactionAdmin } from "./types.ts"
import { ReactionState } from "./types.ts"
import { removeFromAllDeps, withoutTracking, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./graph.ts"
import { isObservableArray, isObservableMap, isObservableSet } from "./utils.ts"

// Symbol to represent "no previous value yet" (undefined is a valid value)
// Using Symbol.for allows consumers to identify it if they need to
export const UNDEFINED = Symbol.for("fobx-undefined")

export interface ReactionOptions<T> {
  name?: string
  fireImmediately?: boolean
  comparer?: EqualityComparison
}

/**
 * Creates a two-phase reaction
 * Phase 1: expression function (tracked) - computes a value
 * Phase 2: effect function (untracked) - runs side effects when value changes
 */
export function reaction<T>(
  expression: (dispose: Dispose) => T,
  effect: (
    value: T,
    previousValue: T | typeof UNDEFINED,
    dispose: Dispose,
  ) => void,
  options: ReactionOptions<T> = {},
): Dispose {
  let isDisposed = false
  let isFirst = true
  let previousValue: T | typeof UNDEFINED = UNDEFINED
  let previousChanges: number | undefined = undefined // Track changes counter for collections

  // Resolve comparer
  const comparer = resolveComparer(options.comparer)

  // Dispose function
  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
  }

  // Create admin for the reaction
  const admin: ReactionAdmin = {
    id: getNextId(),
    name: options.name || `Reaction@${getNextId()}`,
    state: ReactionState.STALE,
    deps: [],
    run: () => {
      if (isDisposed) return

      // Set state to UP_TO_DATE before running
      admin.state = ReactionState.UP_TO_DATE

      // Phase 1: Track dependencies while computing new value
      const newValue = withTracking(admin, () => expression(dispose))

      const isObservableCollection = isObservableArray(newValue) ||
        isObservableMap(newValue) ||
        isObservableSet(newValue)

      // CRITICAL: If the result is an observable (array/map/set), register as observer
      // This handles cases like: reaction(() => arr, ...)
      // Without this, returning the array reference doesn't register as a dependency
      if (isObservableCollection) {
        const observable = (newValue as any)[$fobx]
        if (observable) {
          // Ensure this reaction is registered as an observer
          const deps = admin.deps
          if (deps.indexOf(observable) === -1) {
            deps.push(observable)
          }
          const observers = observable.observers
          if (observers.indexOf(admin) === -1) {
            observers.push(admin)
          }
        }
      }

      // Snapshot the changes counter for collections
      let currentChanges: number | undefined = undefined
      if (isObservableCollection) {
        const observable = (newValue as any)[$fobx]
        if (observable && "changes" in observable) {
          currentChanges = observable.changes
        }
      }

      // Check if value changed (or first run with fireImmediately)
      // For collections with changes counter, compare that instead of reference
      let valueChanged: boolean
      if (previousValue === UNDEFINED) {
        // First run - value always "changed" (though we check fireImmediately below)
        valueChanged = true
      } else if (
        currentChanges !== undefined && previousChanges !== undefined
      ) {
        // Collection: compare changes counter
        valueChanged = currentChanges !== previousChanges
      } else {
        // Regular value: use comparer
        valueChanged = !comparer(previousValue as T, newValue)
      }

      const shouldRun = isFirst
        ? (options.fireImmediately === true)
        : valueChanged

      if (shouldRun) {
        // Phase 2: Run effect without tracking (side effects shouldn't create dependencies)
        withoutTracking(() => {
          effect(newValue, previousValue, dispose)
        })
      }

      previousValue = newValue
      previousChanges = currentChanges
      isFirst = false
    },
  }

  // If in a transaction, queue for later execution; otherwise run immediately
  if ($global.batchDepth > 0) {
    $global.pending.push(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
