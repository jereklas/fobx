/**
 * Utility functions for type checking observable values.
 */

import {
  $fobx,
  type Any,
  KIND_BOX,
  KIND_COLLECTION,
  KIND_COMPUTED,
} from "./global.ts"
import type { ObservableObjectAdmin } from "./object.ts"

/**
 * Check if a value has fobx administration
 */
export function hasFobxAdmin(value: Any): boolean {
  return value != null && typeof value === "object" && $fobx in value
}

/**
 * Check if value is a plain object (not array, map, set, class instance, etc.)
 */
export function isPlainObject(value: Any): boolean {
  if (value == null || typeof value !== "object") return false
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (value instanceof RegExp) return false
  if (value instanceof Map) return false
  if (value instanceof Set) return false

  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Internal helper to dig into observable object properties.
 * If `prop` is given, drills into the object's property admin.
 */
function getAdminForCheck(value: Any, prop?: PropertyKey): Any | null {
  if (!hasFobxAdmin(value)) return null

  const admin = value[$fobx]

  if (prop !== undefined) {
    // Must be an observable object (has .values Map) to look up property admins
    if (admin.values instanceof Map) {
      const propValue = admin.values.get(prop)
      if (propValue != null && hasFobxAdmin(propValue)) {
        return propValue[$fobx]
      }
    }
    return null
  }

  return admin
}

/**
 * Check if a value is observable (any fobx-managed reactive value).
 * Uses `kind` discriminant for O(1) checks.
 */
export function isObservable(value: Any, prop?: PropertyKey): boolean {
  const admin = getAdminForCheck(value, prop)
  if (admin == null) return false

  const k = admin.kind
  return k === KIND_BOX || k === KIND_COMPUTED || k === KIND_COLLECTION
}

/**
 * Check if a value is a computed observable.
 */
export function isComputed(value: Any, prop?: PropertyKey): boolean {
  const admin = getAdminForCheck(value, prop)
  if (admin == null) return false
  return admin.kind === KIND_COMPUTED
}

/**
 * Check if a value is an observable object.
 * Observable objects use a different admin shape (no `kind` field).
 */
export function isObservableObject(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false
  const admin = value[$fobx]
  return admin != null && typeof admin === "object" && "target" in admin &&
    (admin as ObservableObjectAdmin).values instanceof Map
}

/**
 * Check if a value is an observable array.
 */
export function isObservableArray(value: Any): boolean {
  return Array.isArray(value) && hasFobxAdmin(value)
}

/**
 * Check if a value is an observable map.
 * Both maps and sets are KIND_COLLECTION; maps have a `get` method.
 */
export function isObservableMap(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false
  return value[$fobx].kind === KIND_COLLECTION &&
    typeof value.get === "function"
}

/**
 * Check if a value is an observable set.
 * Both sets and maps are KIND_COLLECTION; sets have `add` but not `get`.
 */
export function isObservableSet(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false
  return value[$fobx].kind === KIND_COLLECTION &&
    typeof value.add === "function"
}

/**
 * Check if a value is an observable box.
 */
export function isObservableBox(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false
  return value[$fobx].kind === KIND_BOX
}

/**
 * Check if a value (in practice, a function with the $fobx flag) is a collection-type
 * observable — array, map, or set.
 */
export function isObservableCollection(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false
  return value[$fobx].kind === KIND_COLLECTION
}

/**
 * Check if a value is a transaction.
 */
export function isTransaction(value: Any): boolean {
  if (typeof value !== "function") return false
  return $fobx in value && value[$fobx] === true
}
