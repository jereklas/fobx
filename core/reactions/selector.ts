/**
 * createSelector — O(1) selection primitive.
 *
 * Optimized for the "one-of-many" selection pattern common in lists.
 * Instead of every row observing the selection signal (O(n) reactions),
 * only the previously-selected and newly-selected items are notified.
 *
 * Inspired by SolidJS's createSelector.
 *
 * @example
 * ```ts
 * const selectedId = box(0)
 * const isSelected = createSelector(() => selectedId.get())
 *
 * // In each row:
 * const active = isSelected(row.id) // returns boolean, reactive
 * ```
 */

import { autorun } from "./autorun.ts"
import { UNDEFINED } from "./reaction.ts"
import {
  $scheduler,
  defaultComparer,
  hasObservers,
  KIND_BOX,
  type ObservableAdmin,
} from "../state/global.ts"
import { trackAccessKnownTracked } from "./tracking.ts"
import { notifyObserversChanged } from "../state/notifications.ts"
import {
  attachDebugNodeMetadata,
  markDebugDisposed,
  registerDebugNode,
} from "../state/debugGraph.ts"

// deno-lint-ignore no-explicit-any
type Any = any

export type Selector<T> = ((key: T) => boolean) & {
  dispose(): void
  getAdmin(key: T): ObservableAdmin<boolean>
}

/**
 * Create a reactive selector function.
 *
 * @param source - A reactive function returning the current selected key.
 * @param equals - Optional custom equality function
 * @returns A function `(key) => boolean` that is reactive and O(1).
 */
export function createSelector<T>(
  source: () => T,
  equals: (a: T, b: T) => boolean = defaultComparer,
): Selector<T> {
  // Map from key → the admin that observers of that key track
  const subs = new Map<Any, ObservableAdmin<boolean>>()
  let currentValue: T | typeof UNDEFINED = UNDEFINED
  const isDefaultEquals = equals === defaultComparer

  // Auto-track the source; on change, only notify old + new key admins
  const disposeAutorun = autorun(() => {
    const newValue = source()
    const prevValue = currentValue
    currentValue = newValue

    // Notify the previously-selected key's observers (it's now false)
    if (prevValue !== UNDEFINED) {
      notifyMatchingAdmins(prevValue, false)
    }

    // Notify the newly-selected key's observers (it's now true)
    if (newValue !== UNDEFINED) {
      notifyMatchingAdmins(newValue, true)
    }
  })

  /**
   * Check if `key` matches the current selection. Reactive — tracks
   * only the admin for this specific key, not the source signal.
   */
  const isSelected = ((key: T): boolean => {
    const tracking = $scheduler.tracking
    if (tracking === null) {
      if (currentValue === UNDEFINED) return false
      return equals(currentValue, key)
    }

    // Get or create a per-key admin for tracking
    let admin = subs.get(key)
    if (!admin) {
      admin = {
        kind: KIND_BOX,
        id: 0,
        name: "",
        value: currentValue !== UNDEFINED && equals(currentValue, key),
        observers: null,
        comparer: defaultComparer,
        _epoch: 0,
        onLoseObserver: _cleanupKey as Any,
      }
      ;(admin as Any)._key = key
      ;(admin as Any)._subs = subs
      subs.set(key, admin)

      // deno-lint-ignore no-process-global
      if (process.env.FOBX_DEBUG) {
        registerDebugNode(admin, {
          admin,
          kind: "selector-entry",
          name: `selector(${String(key)})`,
        })
        attachDebugNodeMetadata(admin, {
          parentTarget: isSelected,
          propertyKey: String(key),
        })
      }
    }

    trackAccessKnownTracked(admin, tracking)
    return admin.value
  }) as Selector<T>

  // Dispose function: tears down the autorun + clears all subscriptions
  isSelected.dispose = (): void => {
    disposeAutorun()
    // deno-lint-ignore no-process-global
    if (process.env.FOBX_DEBUG) {
      for (const admin of subs.values()) {
        markDebugDisposed(admin)
      }
      markDebugDisposed(isSelected)
    }
    subs.clear()
  }

  /**
   * Get or create the per-key ObservableAdmin for direct subscription.
   * Useful for `subscribe(isSelected.getAdmin(key), fn)` to bypass tracking.
   */
  isSelected.getAdmin = (key: T): ObservableAdmin<boolean> => {
    let admin = subs.get(key)
    if (!admin) {
      admin = {
        kind: KIND_BOX,
        id: 0,
        name: "",
        value: currentValue !== UNDEFINED && equals(currentValue, key),
        observers: null,
        comparer: defaultComparer,
        _epoch: 0,
        onLoseObserver: _cleanupKey as Any,
      }
      ;(admin as Any)._key = key
      ;(admin as Any)._subs = subs
      subs.set(key, admin)

      // deno-lint-ignore no-process-global
      if (process.env.FOBX_DEBUG) {
        registerDebugNode(admin, {
          admin,
          kind: "selector-entry",
          name: `selector(${String(key)})`,
        })
        attachDebugNodeMetadata(admin, {
          parentTarget: isSelected,
          propertyKey: String(key),
        })
      }
    }
    return admin
  }

  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    registerDebugNode(isSelected, {
      kind: "selector",
      name: "selector",
    })
  }

  return isSelected

  function notifyMatchingAdmins(value: T, nextState: boolean): void {
    if (isDefaultEquals) {
      const admin = subs.get(value)
      if (admin && hasObservers(admin) && admin.value !== nextState) {
        admin.value = nextState
        notifyObserversChanged(admin)
      }
      return
    }

    for (const [key, admin] of subs) {
      if (!equals(value, key)) continue
      if (!hasObservers(admin) || admin.value === nextState) continue
      admin.value = nextState
      notifyObserversChanged(admin)
    }
  }
}

/** Shared onLoseObserver — cleans up the per-key admin when unobserved. */
function _cleanupKey(admin: ObservableAdmin): void {
  if (hasObservers(admin)) return
  const key = (admin as Any)._key
  const subs = (admin as Any)._subs as Map<Any, ObservableAdmin>
  subs.delete(key)
  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    markDebugDisposed(admin)
  }
}
