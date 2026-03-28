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
import {
  $scheduler,
  defaultComparer,
  hasObservers,
  KIND_BOX,
  NOTIFY_CHANGED,
  type ObservableAdmin,
} from "../state/global.ts"
import { trackAccess } from "./tracking.ts"
import { notifyObservers } from "../state/notifications.ts"

// deno-lint-ignore no-explicit-any
type Any = any

/**
 * Create a reactive selector function.
 *
 * @param source - A reactive function returning the current selected key.
 * @param equals - Optional custom equality function (defaults to ===).
 * @returns A function `(key) => boolean` that is reactive and O(1).
 */
export function createSelector<T>(
  source: () => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b,
): (key: T) => boolean {
  // Map from key → the admin that observers of that key track
  const subs = new Map<Any, ObservableAdmin<boolean>>()
  let currentValue: T

  // Auto-track the source; on change, only notify old + new key admins
  const disposeAutorun = autorun(() => {
    const newValue = source()
    const prevValue = currentValue
    currentValue = newValue

    // Notify the previously-selected key's observers (it's now false)
    if (prevValue !== undefined) {
      const prevAdmin = subs.get(prevValue)
      if (prevAdmin && hasObservers(prevAdmin)) {
        prevAdmin.value = false
        notifyObservers(prevAdmin, NOTIFY_CHANGED)
      }
    }

    // Notify the newly-selected key's observers (it's now true)
    if (newValue !== undefined) {
      const newAdmin = subs.get(newValue)
      if (newAdmin && hasObservers(newAdmin)) {
        newAdmin.value = true
        notifyObservers(newAdmin, NOTIFY_CHANGED)
      }
    }
  })

  /**
   * Check if `key` matches the current selection. Reactive — tracks
   * only the admin for this specific key, not the source signal.
   */
  function isSelected(key: T): boolean {
    if ($scheduler.tracking === null) {
      return equals(currentValue, key)
    }

    // Get or create a per-key admin for tracking
    let admin = subs.get(key)
    if (!admin) {
      admin = {
        kind: KIND_BOX,
        id: 0,
        name: "",
        value: equals(currentValue, key),
        observers: null,
        comparer: defaultComparer,
        _epoch: 0,
        onLoseObserver: _cleanupKey as Any,
      } // Stash the key on the admin so the cleanup function can find it
      ;(admin as Any)._key = key
      ;(admin as Any)._subs = subs
      subs.set(key, admin)
    }

    trackAccess(admin)
    return admin.value
  }

  // Dispose function: tears down the autorun + clears all subscriptions
  isSelected.dispose = (): void => {
    disposeAutorun()
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
        value: equals(currentValue, key),
        observers: null,
        comparer: defaultComparer,
        _epoch: 0,
        onLoseObserver: _cleanupKey as Any,
      }
      ;(admin as Any)._key = key
      ;(admin as Any)._subs = subs
      subs.set(key, admin)
    }
    return admin
  }

  return isSelected
}

/** Shared onLoseObserver — cleans up the per-key admin when unobserved. */
function _cleanupKey(admin: ObservableAdmin): void {
  if (hasObservers(admin)) return
  const key = (admin as Any)._key
  const subs = (admin as Any)._subs as Map<Any, ObservableAdmin>
  subs.delete(key)
}
