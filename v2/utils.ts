/**
 * Utility functions for type checking observable values
 */

import { $fobx } from "./global.ts"
import type { ObservableObjectAdmin } from "./object.ts"

// deno-lint-ignore no-explicit-any
type Any = any

/**
 * Check if a value has fobx administration
 * This is the most basic check - does it have the $fobx symbol?
 */
export function hasFobxAdmin(value: Any): boolean {
  return value != null && typeof value === "object" && $fobx in value
}

/**
 * Internal helper to get the admin for a value, handling optional property lookup
 * Returns the admin object if valid, or null if not found
 */
function getAdminForCheck(value: Any, prop?: PropertyKey): Any | null {
  if (!hasFobxAdmin(value)) return null

  const admin = value[$fobx]

  // If checking a specific property of an observable object
  if (prop !== undefined) {
    if (
      admin != null && typeof admin === "object" && admin.values instanceof Map
    ) {
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
 * Check if a value is observable (any fobx-managed reactive value)
 * This includes: boxes, computeds, maps, arrays, sets, and observable objects
 *
 * When prop is provided, checks if that specific property of an observable object is observable
 */
export function isObservable(value: Any, prop?: PropertyKey): boolean {
  const admin = getAdminForCheck(value, prop)
  if (admin == null) return false

  // Valid observables have an admin with an id and observers array
  return typeof admin === "object" &&
    typeof admin.id === "number" &&
    Array.isArray(admin.observers)
}

/**
 * Check if a value is a computed observable
 * Computeds have both observable admin (value, observers) and reaction admin (deps, run)
 *
 * When prop is provided, checks if that specific property of an observable object is computed
 */
export function isComputed(value: Any, prop?: PropertyKey): boolean {
  const admin = getAdminForCheck(value, prop)
  if (admin == null) return false

  // Computeds have both observers (observable) and deps (reaction)
  return typeof admin === "object" &&
    Array.isArray(admin.observers) &&
    Array.isArray(admin.deps) &&
    typeof admin.run === "function"
}

/**
 * Check if a value is an observable object (plain object with observable properties)
 * Observable objects have a special admin structure with target and values map
 */
export function isObservableObject(value: Any): boolean {
  if (!hasFobxAdmin(value)) return false

  const admin = value[$fobx] as ObservableObjectAdmin
  return admin != null &&
    typeof admin === "object" &&
    "target" in admin &&
    "values" in admin &&
    admin.values instanceof Map
}

/**
 * Check if a value is an observable array
 * Observable arrays are Proxy objects wrapping native arrays
 */
export function isObservableArray(value: Any): boolean {
  if (!Array.isArray(value)) return false
  if (!hasFobxAdmin(value)) return false

  return true
}

/**
 * Check if a value is an observable map
 * Observable maps implement the Map interface
 */
export function isObservableMap(value: Any): boolean {
  if (value == null || typeof value !== "object") return false
  if (!hasFobxAdmin(value)) return false

  // Check if it has Map methods and structure
  return typeof value.get === "function" &&
    typeof value.set === "function" &&
    typeof value.has === "function" &&
    typeof value.delete === "function" &&
    typeof value.size === "number"
}

/**
 * Check if a value is an observable set
 * Observable sets implement the Set interface
 */
export function isObservableSet(value: Any): boolean {
  if (value == null || typeof value !== "object") return false
  if (!hasFobxAdmin(value)) return false

  // Check if it has Set methods
  // Distinguish from Map by checking it doesn't have get/set (which take key, value)
  return typeof value.add === "function" &&
    typeof value.has === "function" &&
    typeof value.delete === "function" &&
    typeof value.size === "number" &&
    typeof value.get !== "function" // Sets don't have get()
}

/**
 * Check if a value is an observable box
 * Boxes have get() and set() methods with a simple admin structure
 */
export function isObservableBox(value: Any): boolean {
  if (value == null || typeof value !== "object") return false
  if (!hasFobxAdmin(value)) return false

  const admin = value[$fobx]
  // Box has get/set methods and admin has value but not deps (distinguishes from computed)
  return typeof value.get === "function" &&
    typeof value.set === "function" &&
    admin != null &&
    "value" in admin &&
    !("deps" in admin) // Computeds have deps, boxes don't
}

/**
 * Check if a value is a transaction
 * Transactions are functions with the $fobx symbol set to true
 */
export function isTransaction(value: Any): boolean {
  if (typeof value !== "function") return false

  // Check if the function has the $fobx symbol with value true
  return $fobx in value && (value as Any)[$fobx] === true
}
