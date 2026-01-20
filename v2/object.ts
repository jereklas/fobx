/**
 * v2 Observable Objects - Descriptor-based implementation
 *
 * PERFORMANCE PRINCIPLES:
 * 1. Prototype-based to minimize per-instance memory
 * 2. Cache lookups before loops/hot paths
 * 3. Reuse existing box/computed/transaction implementations
 * 4. No Proxy (62x faster than Proxy-based approach)
 *
 * KEY BEHAVIOR:
 * - observable(plainObject) -> creates NEW object, source untouched
 * - observable(classInstance) -> modifies instance, prototype descriptors for inherited members
 * - makeObservable() -> explicit opt-in, modifies target
 * - extendObservable() -> adds properties to existing observable
 */

import {
  $fobx,
  $global,
  type EqualityChecker,
  type EqualityComparison,
  getNextId,
} from "./global.ts"
import { resolveComparer } from "./instance.ts"
import { box, type ObservableBox } from "./box.ts"
import { type Computed, computed } from "./computed.ts"
import { endBatch, startBatch, transaction, transactionBound } from "./batch.ts"
import { withoutTracking } from "./tracking.ts"
import { array, type ArrayOptions, type ObservableArray } from "./array.ts"
import { map, type MapOptions, type ObservableMap } from "./map.ts"
import { type ObservableSet, set, type SetOptions } from "./set.ts"
import { isObservable, isObservableObject } from "./utils.ts"

// deno-lint-ignore no-explicit-any
type Any = any

/**
 * Observable object administration
 *
 * Stores boxes/computeds for all observable properties
 * Attached to objects via $fobx symbol
 */
export interface ObservableObjectAdmin {
  id: number
  name: string
  target: object
  values: Map<PropertyKey, ObservableBox<Any> | Computed<Any>>
}

/**
 * Annotation types
 */
export type AnnotationString =
  | "observable"
  | "observable.ref"
  | "observable.shallow"
  | "computed"
  | "transaction"
  | "transaction.bound"
  | "flow"
  | "flow.bound"
  | "none"

/**
 * Annotation value - can be string, array with options, or false to exclude
 */
export type AnnotationValue =
  | AnnotationString
  | [AnnotationString, EqualityComparison]
  | false

/**
 * Annotation map for object properties
 */
export type AnnotationsMap<T extends object> = {
  [K in keyof T]?: AnnotationValue
}

/**
 * Options for makeObservable
 */
export interface MakeObservableOptions {
  name?: string
}

/**
 * Options for observable
 */
export interface ObservableOptions {
  name?: string
  defaultAnnotation?: AnnotationString
}

/**
 * Equality options parsed from annotation array syntax
 */
interface EqualityOptions {
  comparer?: EqualityChecker
}

/**
 * Property descriptor with metadata
 */
interface PropertyInfo {
  key: PropertyKey
  descriptor: PropertyDescriptor
  prototype: object | null
  level: number
}

/**
 * Track which properties have been annotated on each prototype
 * Prevents double-annotation in inheritance hierarchies
 */
const annotatedPrototypes = new WeakMap<object, Set<PropertyKey>>()

/**
 * Check if value is a plain object (not a class instance)
 * PERF: Optimized checks in order of likelihood
 */
function isPlainObject(value: Any): boolean {
  if (value == null || typeof value !== "object") return false

  // Fast rejection: arrays and common built-ins
  if (Array.isArray(value)) return false
  if (value instanceof Date) return false
  if (value instanceof RegExp) return false
  if (value instanceof Map) return false
  if (value instanceof Set) return false

  // Check prototype chain
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Convert a value to observable (DEEP conversion)
 *
 * This function ALWAYS creates deep observable structures.
 * Collections are created with shallow: false, meaning their items
 * are also recursively converted to observables.
 *
 * Used by:
 * - observable() for deep observability (default annotation)
 * - Collections (array, map, set) when shallow: false (deep mode)
 *
 * Note: For one-level collection tracking (structure only, not items),
 * use observable.shallow which creates collections with shallow: true.
 *
 * @param value - Value to convert
 * @returns Observable version of the value (or original if primitive/already observable)
 */
export function convertToObservable(value: Any): Any {
  // Fast path: already observable (includes boxes, computeds, collections, observable objects)
  if (isObservable(value) || isObservableObject(value)) return value

  // Collections
  if (Array.isArray(value)) {
    return array(value) // Deep observability
  }
  if (value instanceof Map) {
    return map(value) // Deep observability
  }
  if (value instanceof Set) {
    return set(value) // Deep observability
  }

  // Plain objects (recursively make observable)
  if (isPlainObject(value)) {
    return object(value)
  }

  // Primitives and other values - return as-is
  return value
}

/**
 * Process a value based on shallow flag
 *
 * Used by collections (array, map, set) to conditionally convert items.
 * This is the shared implementation that prevents duplication.
 *
 * @param value - Value to process
 * @param shallow - If true, return value as-is; if false, convert to observable
 * @returns Processed value
 */
export function processValue<T>(value: T, shallow: boolean): T {
  // Fast path: shallow mode (don't convert)
  if (shallow) return value

  // Fast path: primitives (null, undefined, number, string, boolean, symbol, bigint)
  if (value === null || typeof value !== "object") {
    return value
  }

  // Fast path: already observable
  if (isObservable(value) || isObservableObject(value)) {
    return value
  }

  // Deep mode: recursively convert to observable
  return convertToObservable(value) as T
}

/**
 * Get constructor name for default naming
 * PERF: Cache result if this becomes a hot path
 */
function getConstructorName(target: object): string {
  const ctor = target.constructor
  if (ctor && ctor.name && ctor.name !== "Object") {
    return ctor.name
  }
  return `ObservableObject@${getNextId()}`
}

/**
 * Install data property (observable, observable.ref, observable.shallow)
 *
 * PERF: Method references cached before use to avoid prototype lookups
 */
function installDataProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  initialValue: Any,
  installTarget: object,
  annotation: "observable" | "observable.ref" | "observable.shallow",
  equalityOptions?: EqualityOptions,
): void {
  // Handle value conversion based on annotation
  let boxValue = initialValue

  if (annotation === "observable") {
    // Deep conversion: recursively convert nested structures
    boxValue = convertToObservable(initialValue)
  } else if (annotation === "observable.shallow") {
    // Shallow collection: convert collections with shallow flag
    if (Array.isArray(initialValue)) {
      boxValue = array(initialValue, { shallow: true })
    } else if (initialValue instanceof Map) {
      boxValue = map(initialValue, { shallow: true })
    } else if (initialValue instanceof Set) {
      boxValue = set(initialValue, { shallow: true })
    }
    // Note: non-collections remain as-is
  }
  // else annotation === "observable.ref": keep original reference

  // Create box with equality options
  const observableBox = box(boxValue, {
    name: `${admin.name}.${String(key)}`,
    comparer: equalityOptions?.comparer,
  })

  // Store in admin (always on instance admin)
  admin.values.set(key, observableBox)

  // Install descriptor on the specified target
  Object.defineProperty(installTarget, key, {
    get() {
      // 'this' will be the instance when called
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceBox = instanceAdmin.values.get(key) as ObservableBox<Any>
      return instanceBox.get()
    },
    set(v) {
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceBox = instanceAdmin.values.get(key) as ObservableBox<Any>

      // Apply conversion on write (based on annotation)
      let convertedValue = v
      if (annotation === "observable") {
        convertedValue = convertToObservable(v)
      } else if (annotation === "observable.shallow") {
        if (Array.isArray(v)) {
          convertedValue = array(v, { shallow: true })
        } else if (v instanceof Map) {
          convertedValue = map(v, { shallow: true })
        } else if (v instanceof Set) {
          convertedValue = set(v, { shallow: true })
        }
      }
      // observable.ref: no conversion

      instanceBox.set(convertedValue)
    },
    enumerable: true,
    configurable: true,
  })
}

/**
 * Install computed property
 *
 * PERF: Computed.get bound once, not on every access
 */
function installComputedProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  getter: () => Any,
  installTarget: object,
  equalityOptions?: EqualityOptions,
  setter?: (value: Any) => void,
): void {
  // Create computed with equality options
  // PERF: Bind getter to target once, not on every call
  const boundGetter = getter.bind(admin.target)
  const boundSetter = setter ? setter.bind(admin.target) : undefined
  const comp = computed(boundGetter, {
    name: `${admin.name}.${String(key)}`,
    comparer: equalityOptions?.comparer,
    set: boundSetter,
  })

  // Store in admin (always on instance admin)
  admin.values.set(key, comp)

  // Install descriptor on the specified target
  Object.defineProperty(installTarget, key, {
    get() {
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceComp = instanceAdmin.values.get(key) as Computed<Any>
      return instanceComp.get()
    },
    set(v) {
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceComp = instanceAdmin.values.get(key) as Computed<Any>
      instanceComp.set(v)
    },
    enumerable: true,
    configurable: true,
  })
}

/**
 * Install action method
 *
 * PERF: Action wrapper created once, not on every call
 */
function installAction(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  // deno-lint-ignore no-explicit-any
  method: (...args: any[]) => any,
  installTarget: object,
  bound: boolean = false,
): void {
  if (bound) {
    // For bound methods, create a descriptor that captures the target in closure
    const boundWrapper = function (this: Any, ...args: Any[]) {
      // For bound methods, we use admin.target (the observable object)
      // This ensures 'this' refers to the observable instance, not the proxy
      startBatch()
      try {
        return withoutTracking(() => method.apply(admin.target, args))
      } catch (e) {
        $global.actionThrew = true
        throw e
      } finally {
        endBatch()
        $global.actionThrew = false
      }
    }

    // Mark as transaction with $fobx symbol
    Object.defineProperty(boundWrapper, $fobx, {
      value: true,
      enumerable: false,
      configurable: false,
    })

    Object.defineProperty(installTarget, key, {
      value: boundWrapper,
      writable: false,
      enumerable: true,
      configurable: true,
    })
  } else {
    // For regular methods, wrap in transaction normally
    const wrappedMethod = transaction(method)

    // Install wrapped method
    Object.defineProperty(installTarget, key, {
      value: wrappedMethod,
      writable: false,
      enumerable: true,
      configurable: true,
    })
  }
}

/**
 * Install flow method
 *
 * Flow implementation will wrap the generator function
 * For now, placeholder that wraps in transaction
 */
function installFlow(
  _admin: ObservableObjectAdmin,
  key: PropertyKey,
  // deno-lint-ignore no-explicit-any
  generator: (...args: any[]) => any,
  installTarget: object,
  bound: boolean = false,
): void {
  // TODO: Implement proper flow wrapping
  // For now, treat as action (will need flow.ts implementation)
  let wrappedFlow = transaction(generator)

  // Bind if requested
  if (bound) {
    wrappedFlow = transactionBound(generator)
  }

  // Install wrapped flow on the specified target
  Object.defineProperty(installTarget, key, {
    value: wrappedFlow,
    writable: false,
    enumerable: true,
    configurable: true,
  })
}

/**
 * Walk prototype chain and collect all property descriptors
 *
 * PERF: Single pass through prototype chain
 */
function getPropertyDescriptors(target: object): PropertyInfo[] {
  const descriptors: PropertyInfo[] = []

  let current: object | null = target
  let level = 0

  while (current && current !== Object.prototype) {
    // PERF: getOwnPropertyNames is faster than reflection
    const keys = Object.getOwnPropertyNames(current)

    // PERF: Cache length to avoid repeated property access
    const len = keys.length
    for (let i = 0; i < len; i++) {
      const key = keys[i]

      // Skip special properties
      if (key === "constructor" || key === ($fobx as Any)) continue

      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (!descriptor) continue

      descriptors.push({
        key,
        descriptor,
        prototype: level === 0 ? null : current,
        level,
      })
    }

    current = Object.getPrototypeOf(current)
    level++
  }

  return descriptors
}

/**
 * Process a single property with its annotation
 *
 * PERF: Fast path for common annotations, slow path for edge cases
 */
function processProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  annotationValue: AnnotationValue,
  installTarget: object,
): void {
  // Parse annotation value (string or array)
  let annotation: AnnotationString
  let equalityOptions: EqualityOptions | undefined

  if (Array.isArray(annotationValue)) {
    // Array syntax: [annotation, comparer]
    annotation = annotationValue[0]
    const comparerArg = annotationValue[1]

    // Resolve comparer (handles "structural" and functions)
    const resolvedComparer = resolveComparer(comparerArg)
    equalityOptions = { comparer: resolvedComparer }
  } else {
    annotation = annotationValue as AnnotationString
  }

  // Parse annotation for bound variants
  const isBound = annotation.endsWith(".bound")
  const baseAnnotation = isBound
    ? annotation.slice(0, -6) as AnnotationString
    : annotation

  // Fast path: most common annotations
  switch (baseAnnotation) {
    case "observable":
    case "observable.ref":
    case "observable.shallow":
      return installDataProperty(
        admin,
        key,
        descriptor.value,
        installTarget,
        baseAnnotation,
        equalityOptions,
      )

    case "computed":
      if (!descriptor.get) {
        throw new Error(
          `${String(key)} must be a getter to use "computed" annotation`,
        )
      }
      return installComputedProperty(
        admin,
        key,
        descriptor.get,
        installTarget,
        equalityOptions,
        descriptor.set,
      )

    case "transaction":
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `${String(key)} must be a function to use "transaction" annotation`,
        )
      }
      return installAction(
        admin,
        key,
        descriptor.value,
        installTarget,
        isBound,
      )

    case "flow":
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `${String(key)} must be a generator to use "flow" annotation`,
        )
      }
      return installFlow(
        admin,
        key,
        descriptor.value,
        installTarget,
        isBound,
      )
    case "none":
      return
    default:
      throw new Error(`Unknown annotation: ${annotation}`)
  }
}

/**
 * makeObservable - Explicit opt-in API
 *
 * Only properties listed in annotations become observable
 * Nothing happens to unlisted properties
 *
 * Modifies target in-place. For class instances, prototype members
 * get their descriptors installed on the prototype.
 */
export function makeObservable<T extends object>(
  target: T,
  annotations: AnnotationsMap<T>,
  options?: MakeObservableOptions,
): T {
  // Validation
  if (isObservableObject(target)) {
    throw new Error("Object already observable")
  }
  if (!Object.isExtensible(target)) {
    throw new Error("Cannot make non-extensible object observable")
  }

  // Create admin
  const admin: ObservableObjectAdmin = {
    id: getNextId(),
    name: options?.name || getConstructorName(target),
    target,
    values: new Map(),
  }

  // Install admin on instance
  Object.defineProperty(target, $fobx, {
    value: admin,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  // Get all property descriptors (instance + prototype chain)
  const descriptors = getPropertyDescriptors(target)

  // Process annotated properties
  // PERF: Batch all reactive operations
  startBatch()
  try {
    // PERF: Cache entries to avoid repeated Object.entries calls
    const annotationEntries = Object.entries(annotations)
    const len = annotationEntries.length

    for (let i = 0; i < len; i++) {
      const [key, annotationValue] = annotationEntries[i]

      // Skip explicitly excluded
      if (annotationValue === false) continue

      // Find descriptor for this key
      // PERF: Linear search is fine for typical object sizes (<100 props)
      const found = descriptors.find((d) => d.key === key)

      if (!found) {
        throw new Error(`Property ${String(key)} not found on object`)
      }

      // Determine install target: prototype for prototype properties, instance for own
      const installTarget = found.prototype ?? target

      processProperty(
        admin,
        key,
        found.descriptor,
        annotationValue as AnnotationValue,
        installTarget,
      )
    }
  } finally {
    endBatch()
  }

  return target
}

/**
 * object - Auto-observable API with smart type inference
 *
 * Overloads handle different input types and return the appropriate observable type:
 * - Array → ObservableArray (second param is options only, no annotations)
 * - Map → ObservableMap (second param is options only, no annotations)
 * - Set → ObservableSet (second param is options only, no annotations)
 * - Plain object → Observable object (second param is annotations, third is options)
 *
 * ALL properties become observable by default (unless overridden)
 * Annotations turn OFF deep observability or change behavior
 */

// Overload for typed arrays
export function object<T = any>(
  target: T[],
  options?: ArrayOptions,
): ObservableArray<T>

// Overload for Map - K and V default to any
export function object<K = any, V = any>(
  target: Map<K, V>,
  options?: MapOptions,
): ObservableMap<K, V>

// Overload for Set - T defaults to any
export function object<T = any>(
  target: Set<T>,
  options?: SetOptions,
): ObservableSet<T>

// Overload for plain objects - annotations then options
export function object<T extends object>(
  target: T,
  annotations?: Partial<AnnotationsMap<T>>,
  options?: ObservableOptions,
): T

// Implementation
export function object<T extends object>(
  target: T,
  annotationsOrOptions?: Partial<AnnotationsMap<T>> | ObservableOptions,
  maybeOptions?: ObservableOptions,
): Any {
  // Fast path: already observable
  if (isObservable(target) || isObservableObject(target)) {
    return target
  }

  // Handle collections
  if (Array.isArray(target)) {
    // For arrays, second param is options
    return array(target, annotationsOrOptions as ArrayOptions)
  }
  if (target instanceof Map) {
    // For maps, second param is options
    return map(target, annotationsOrOptions as MapOptions)
  }
  if (target instanceof Set) {
    // For sets, second param is options
    return set(target, annotationsOrOptions as SetOptions)
  }

  // Handle plain objects - need to separate annotations from options
  const annotations = annotationsOrOptions as
    | Partial<AnnotationsMap<T>>
    | undefined
  const options = maybeOptions as ObservableOptions | undefined

  // Determine if this is a plain object or class instance
  const isPlain = isPlainObject(target)

  // Validation: for class instances, check extensibility
  // For plain objects, we create a new object so source extensibility doesn't matter
  if (!isPlain && !Object.isExtensible(target)) {
    throw new Error("Cannot make non-extensible object observable")
  }

  // For plain objects: create a new object (source untouched)
  // For class instances: modify in place
  const observableTarget = isPlain ? ({} as T) : target

  // Create admin
  const admin: ObservableObjectAdmin = {
    id: getNextId(),
    name: options?.name ||
      (isPlain
        ? `ObservableObject@${getNextId()}`
        : getConstructorName(target)),
    target: observableTarget,
    values: new Map(),
  }

  // Install admin on the observable target
  Object.defineProperty(observableTarget, $fobx, {
    value: admin,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  // Get all descriptors from source (we always read from original target)
  const descriptors = getPropertyDescriptors(target)

  // Sort by level descending so we process base class properties first
  // This ensures proper inheritance handling
  descriptors.sort((a, b) => b.level - a.level)

  // Track current inheritance level for class instances
  let currentInheritanceLevel: number | undefined

  // Process properties
  startBatch()
  try {
    // PERF: Cache length for loop optimization
    const len = descriptors.length

    for (let i = 0; i < len; i++) {
      const { key, descriptor, prototype, level } = descriptors[i]

      // Track inheritance level for class instances
      if (!isPlain && currentInheritanceLevel === undefined) {
        currentInheritanceLevel = level
      }

      // Check for explicit override annotation
      const override = annotations?.[key as keyof T]

      if (override === false) {
        // Explicitly excluded - skip
        continue
      }

      // For prototype properties in class instances, check if already annotated
      if (prototype !== null && !isPlain) {
        let annotatedSet = annotatedPrototypes.get(prototype)
        if (annotatedSet?.has(key)) {
          continue // Already annotated by parent class
        }
        if (!annotatedSet) {
          annotatedSet = new Set()
          annotatedPrototypes.set(prototype, annotatedSet)
        }
        annotatedSet.add(key)
      }

      // Determine where to install the descriptor
      // - Plain objects: always on the new observable target
      // - Class instances: prototype properties go on prototype, own go on instance
      let installTarget: object
      if (isPlain) {
        installTarget = observableTarget
      } else {
        // For class instances:
        // - Own properties (prototype === null) -> instance
        // - Prototype properties -> their respective prototype
        installTarget = prototype ?? observableTarget
      }

      if (override !== undefined) {
        // Explicit override provided (can be string or array)
        processProperty(admin, key, descriptor, override, installTarget)

        // For plain objects with "none" annotation, we need to copy the property as-is
        if (isPlain && override === "none") {
          Object.defineProperty(observableTarget, key, descriptor)
        }
      } else {
        // AUTO-INFER annotation (default behavior)
        if (descriptor.get && !descriptor.set) {
          // Getter only → computed
          processProperty(admin, key, descriptor, "computed", installTarget)
        } else if (descriptor.get && descriptor.set) {
          // Getter with setter → computed with setter
          installComputedProperty(
            admin,
            key,
            descriptor.get,
            installTarget,
            undefined,
            descriptor.set,
          )
        } else if (typeof descriptor.value === "function") {
          // Function → transaction
          processProperty(admin, key, descriptor, "transaction", installTarget)
        } else if (!descriptor.get) {
          // Data property → use default annotation ("observable" if not specified)
          const type = options?.defaultAnnotation || "observable"
          processProperty(admin, key, descriptor, type, installTarget)
        }
      }

      // For plain objects, copy the initial value to trigger proper initialization
      // Only for data properties (not functions, not getters)
      // The setter will handle conversion
      if (
        isPlain &&
        descriptor.value !== undefined &&
        typeof descriptor.value !== "function" &&
        !descriptor.get &&
        override !== "none" // Don't copy if already handled by "none" case above
      ) {
        ;(observableTarget as Any)[key] = descriptor.value
      }
    }
  } finally {
    endBatch()
  }

  return observableTarget
}

/**
 * Alias for object() to match MobX naming
 * Also has smart overloads for type inference
 */
export function observable<T = any>(
  target: T[],
  options?: ArrayOptions,
): ObservableArray<T>
export function observable<K = any, V = any>(
  target: Map<K, V>,
  options?: MapOptions,
): ObservableMap<K, V>
export function observable<T = any>(
  target: Set<T>,
  options?: SetOptions,
): ObservableSet<T>
export function observable<T extends object>(
  target: T,
  annotations?: Partial<AnnotationsMap<T>>,
  options?: ObservableOptions,
): T
export function observable(
  target: Any,
  annotationsOrOptions?: Any,
  maybeOptions?: ObservableOptions,
): Any {
  return object(target, annotationsOrOptions, maybeOptions)
}

/**
 * extendObservable - Add observable properties to an existing object
 *
 * Unlike observable(), this ALWAYS modifies the target directly.
 * Used to add new observable properties to an existing observable or non-observable object.
 */
export function extendObservable<T extends object, E extends object>(
  target: T,
  extension: E,
  annotations?: Partial<AnnotationsMap<E>>,
): T & E {
  // Validation
  if (!isPlainObject(extension)) {
    throw new Error(
      "[@fobx/core] 2nd argument to extendObservable must be a plain js object.",
    )
  }

  // Get or create admin on target
  let admin = (target as Any)[$fobx] as ObservableObjectAdmin | undefined

  if (!admin) {
    // Target is not observable yet - create admin
    admin = {
      id: getNextId(),
      name: `ObservableObject@${getNextId()}`,
      target,
      values: new Map(),
    }

    Object.defineProperty(target, $fobx, {
      value: admin,
      writable: false,
      enumerable: false,
      configurable: false,
    })
  }

  // Get descriptors from extension object
  const descriptors = Object.getOwnPropertyDescriptors(extension)

  startBatch()
  try {
    for (const key of Object.keys(descriptors)) {
      if (key === "constructor") continue

      const descriptor = descriptors[key]
      const explicitAnnotation = annotations?.[key as keyof E]

      if (explicitAnnotation === false) continue

      // Infer annotation if not provided
      let annotation: AnnotationValue
      if (explicitAnnotation !== undefined) {
        annotation = explicitAnnotation
      } else if (descriptor.get) {
        annotation = "computed"
      } else if (typeof descriptor.value === "function") {
        annotation = "transaction"
      } else {
        annotation = "observable"
      }

      // Process the property - always install on target (not prototype)
      processProperty(
        admin,
        key,
        descriptor,
        annotation,
        target,
      )

      // Copy initial value for data properties
      if (descriptor.value !== undefined && !descriptor.get) {
        ;(target as Any)[key] = descriptor.value
      }
    }
  } finally {
    endBatch()
  }

  return target as T & E
}
