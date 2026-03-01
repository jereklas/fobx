/**
 * Reaction — two-phase: expression (tracked) → effect (untracked on change).
 */

import {
  $fobx,
  _batchDepth,
  type Any,
  type Dispose,
  type EqualityComparison,
  getNextId,
  KIND_COLLECTION,
  KIND_REACTION,
  pushPending,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import { removeFromAllDeps, withoutTracking, withTracking } from "./tracking.ts"
import { safeRunReaction } from "./batch.ts"
import { hasFobxAdmin } from "./utils.ts"

export const UNDEFINED = Symbol.for("fobx-undefined")

export interface ReactionOptions<T> {
  name?: string
  fireImmediately?: boolean
  comparer?: EqualityComparison
}

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
  let previousChanges: number | undefined = undefined

  const comparer = resolveComparer(options.comparer)

  const dispose: Dispose = () => {
    if (isDisposed) return
    isDisposed = true
    removeFromAllDeps(admin)
  }

  const id = getNextId()
  const admin: ReactionAdmin = {
    kind: KIND_REACTION,
    id,
    name: options.name || `Reaction@${id}`,
    state: STALE,
    deps: [],
    run: () => {
      if (isDisposed) return
      admin.state = UP_TO_DATE

      // Phase 1: Track dependencies
      const newValue = withTracking(admin, () => expression(dispose))

      // Check if result is an observable collection (array, map, or set)
      let currentChanges: number | undefined = undefined
      const collectionAdmin = hasFobxAdmin(newValue)
        ? (newValue as Any)[$fobx]
        : undefined
      const isObservableCollection = collectionAdmin?.kind === KIND_COLLECTION

      // If result is an observable collection, register as observer and snapshot changes
      if (isObservableCollection) {
        const deps = admin.deps
        if (deps.indexOf(collectionAdmin) === -1) {
          deps.push(collectionAdmin)
        }
        const observers = collectionAdmin.observers
        if (observers.indexOf(admin) === -1) {
          observers.push(admin)
        }
        currentChanges = collectionAdmin.changes
      }

      // Check if value changed
      let valueChanged: boolean
      if (previousValue === UNDEFINED) {
        valueChanged = true
      } else if (
        currentChanges !== undefined && previousChanges !== undefined
      ) {
        valueChanged = currentChanges !== previousChanges
      } else {
        valueChanged = !comparer(previousValue as T, newValue)
      }

      const shouldRun = isFirst
        ? (options.fireImmediately === true)
        : valueChanged

      if (shouldRun) {
        withoutTracking(() => {
          effect(newValue, previousValue, dispose)
        })
      }

      previousValue = newValue
      previousChanges = currentChanges
      isFirst = false
    },
  }

  if (_batchDepth > 0) {
    pushPending(admin)
  } else {
    safeRunReaction(admin)
  }

  return dispose
}
