/**
 * Box — the simplest reactive primitive.
 */

import {
  $fobx,
  defaultComparer,
  type EqualityComparison,
  getNextId,
  KIND_BOX,
  type ObservableAdmin,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import { notifyChanged } from "./notifications.ts"
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

export function box<T>(
  initialValue: T,
  options?: BoxOptions,
): ObservableBox<T> {
  const comparer = options?.comparer
    ? resolveComparer(options.comparer)
    : defaultComparer
  const id = getNextId()

  const admin: ObservableAdmin<T> = {
    kind: KIND_BOX,
    id,
    name: options?.name || `Box@${id}`,
    value: initialValue,
    observers: new Set(),
    comparer,
    _epoch: 0,
  }

  return {
    [$fobx]: admin,
    get(): T {
      return getBoxValue(admin)
    },
    set(newValue: T): void {
      setBoxValue(admin, newValue)
    },
  }
}

/**
 * Get box value directly from admin (tracks access).
 * Used by collections to avoid box wrapper overhead.
 */
export function getBoxValue<T>(admin: ObservableAdmin<T>): T {
  trackAccess(admin)
  return admin.value
}

/**
 * Set box value directly on admin (notifies if changed).
 * Used by collections to avoid box wrapper overhead.
 * Returns true if value changed.
 */
export function setBoxValue<T>(
  admin: ObservableAdmin<T>,
  newValue: T,
): boolean {
  if (admin.comparer(admin.value, newValue)) return false

  admin.value = newValue

  notifyChanged(admin)
  return true
}
