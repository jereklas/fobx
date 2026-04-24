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
} from "../state/global.ts"
import { resolveComparer } from "../state/instance.ts"
import {
  isNotProduction,
  notifyChanged,
  warnIfObservedWriteOutsideTransaction,
} from "../state/notifications.ts"
import { trackAccess } from "../reactions/tracking.ts"
import { recordDebugWrite, registerDebugNode } from "../state/debugGraph.ts"

export interface ObservableBox<T> {
  get(): T
  set(value: T): void
  [$fobx]: ObservableAdmin<T>
}

export interface BoxOptions {
  name?: string
  comparer?: EqualityComparison
}

export function observableBox<T>(
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
    observers: null,
    comparer,
    _epoch: 0,
  }

  const box: ObservableBox<T> = {
    [$fobx]: admin,
    get(): T {
      return getBoxValue(admin)
    },
    set(newValue: T): void {
      if (isNotProduction) {
        warnIfObservedWriteOutsideTransaction(admin, "observable values")
      }
      setBoxValue(admin, newValue)
    },
  }

  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    registerDebugNode(box, {
      admin,
      kind: "box",
      name: admin.name,
      aliases: [admin],
    })
  }

  return box
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
  const previousValue = admin.value
  if (admin.comparer(admin.value, newValue)) {
    // deno-lint-ignore no-process-global
    if (process.env.FOBX_DEBUG) {
      recordDebugWrite(admin, {
        changed: false,
        operation: "set-box:no-op",
        value: newValue,
        previousValue,
      })
    }
    return false
  }

  admin.value = newValue

  // deno-lint-ignore no-process-global
  if (process.env.FOBX_DEBUG) {
    recordDebugWrite(admin, {
      changed: true,
      operation: "set-box",
      value: newValue,
      previousValue,
    })
  }

  notifyChanged(admin)
  return true
}
