// Box (Pure Observable) implementation

import { $fobx, $global, type EqualityComparison, getNextId } from "./global.ts"
import { resolveComparer } from "./instance.ts"
import type { ObservableAdmin } from "./types.ts"
import { NotificationType } from "./types.ts"
import { notifyObservers } from "./notifications.ts"
import { runPendingReactions } from "./graph.ts"
import { trackAccess } from "./tracking.ts"

export interface ObservableBox<T> {
  get(): T
  set(value: T): void
  [$fobx]: ObservableAdmin<T>
}

export interface BoxOptions {
  name?: string
  comparer?: EqualityComparison
}

/**
 * Creates a box - the simplest observable primitive
 * A container for a single mutable value that notifies observers when changed
 */
export function box<T>(
  initialValue: T,
  options: BoxOptions = {},
): ObservableBox<T> {
  // Resolve comparer at creation time
  const comparer = resolveComparer(options.comparer)
  const id = getNextId()

  // Create admin
  const admin: ObservableAdmin<T> = {
    id,
    name: options.name || `Box@${id}`,
    value: initialValue,
    observers: [],
    comparer: comparer,
  }

  // Create box object with methods that delegate to helper functions
  const observableBox: ObservableBox<T> = {
    [$fobx]: admin,
    get(): T {
      return getBoxValue(admin)
    },
    set(newValue: T): void {
      setBoxValue(admin, newValue)
    },
  }

  return observableBox
}

/**
 * Get box value directly from admin (tracks access)
 *
 * PERF: Used by collections (map, array, set) to avoid box wrapper overhead.
 * This is a hot path - every collection value read goes through here.
 */
export function getBoxValue<T>(admin: ObservableAdmin<T>): T {
  trackAccess(admin)
  return admin.value
}

/**
 * Set box value directly on admin (notifies observers if changed)
 *
 * PERF: Used by collections (map, array, set) to avoid box wrapper overhead.
 * Returns true if value changed, false otherwise.
 */
export function setBoxValue<T>(
  admin: ObservableAdmin<T>,
  newValue: T,
): boolean {
  // PERF: Fast path - check equality first (most common case is no change)
  if (admin.comparer(admin.value, newValue)) {
    return false
  }

  // Update value
  admin.value = newValue

  // PERF: Fast path - if no observers, skip notification overhead entirely
  const observers = admin.observers
  if (observers.length === 0) {
    return true
  }

  // Notify and run pending if not batching
  notifyObservers(admin, NotificationType.CHANGED)
  if ($global.batchDepth === 0) {
    runPendingReactions()
  }

  return true
}
