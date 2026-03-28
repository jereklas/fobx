/**
 * Observable Objects — descriptor-based implementation.
 *
 * - observable(plainObject) -> creates NEW object, source untouched (unless inPlace: true)
 * - observable(classInstance) -> modifies instance, prototype descriptors for inherited members
 * - makeObservable() -> explicit opt-in, modifies target
 *
 * Both makeObservable and observable accept a single options object
 * that may include an `annotations` key.
 *
 * Options:
 *   inPlace (observable only) — mutate the source plain object instead of creating a copy
 *   ownPropertiesOnly — install all descriptors on the instance, never on prototypes
 */

import {
  $fobx,
  type Any,
  type EqualityChecker,
  type EqualityComparison,
  getNextId,
  setActionThrew,
} from "../state/global.ts"
import { resolveComparer } from "../state/instance.ts"
import { type ObservableBox, observableBox } from "./observableBox.ts"
import { type Computed, computed } from "./computed.ts"
import { endBatch, startBatch, transaction } from "../transactions/batch.ts"
import { flow } from "../reactions/flow.ts"
import { runWithoutTracking } from "../reactions/tracking.ts"
import {
  type ArrayOptions,
  type ObservableArray,
  observableArray,
  setProcessValue,
} from "./observableArray.ts"
import {
  type MapOptions,
  type ObservableMap,
  observableMap,
  setMapProcessValue,
} from "./observableMap.ts"
import {
  type ObservableSet,
  observableSet,
  type SetOptions,
  setSetProcessValue,
} from "./observableSet.ts"
import {
  isObservable,
  isObservableObject,
  isPlainObject,
} from "../utils/utils.ts"

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
 * Annotation value — can be string, array with options, or false to exclude
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
export interface MakeObservableOptions<T extends object = object> {
  name?: string
  annotations?: AnnotationsMap<T>
  /**
   * When true, all descriptors (including inherited ones) are installed directly
   * on the target instance rather than on the prototype. Default: false.
   */
  ownPropertiesOnly?: boolean
}

/**
 * Options for observable
 */
export interface ObservableOptions<T extends object = object> {
  name?: string
  defaultAnnotation?: AnnotationString
  annotations?: Partial<AnnotationsMap<T>>
  /**
   * When true and the target is a plain object, the source object is mutated
   * in place instead of creating a new reference. Has no effect on class
   * instances (they are always mutated in place). Default: false.
   */
  inPlace?: boolean
  /**
   * When true, all descriptors (including inherited ones) are installed directly
   * on the target instance rather than on the prototype. Default: false.
   */
  ownPropertiesOnly?: boolean
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
 * Metadata stored per-property for prototype-level annotations.
 */
interface AnnotatedPropertyMeta {
  type: "computed" | "data" | "action" | "flow" | "none"
  originalGetter?: () => Any
  originalSetter?: ((value: Any) => void) | undefined
  originalValue?: Any
  annotation?: "observable" | "observable.ref" | "observable.shallow"
  equalityOptions?: EqualityOptions
  prototype?: object | null
}

/**
 * Track which properties have been annotated on each prototype.
 * Prevents double-annotation in inheritance hierarchies.
 */
const annotatedPrototypes = new WeakMap<
  object,
  Map<PropertyKey, AnnotatedPropertyMeta>
>()

// ─── Value Conversion ────────────────────────────────────────────────────────

/**
 * Convert a value to deep observable.
 * Collections are created with shallow: false so their items are recursively converted.
 */
function convertToObservable(
  value: Any,
  comparerOption?: EqualityComparison,
): Any {
  if (isObservable(value) || isObservableObject(value)) return value

  if (Array.isArray(value)) {
    return observableArray(
      value,
      comparerOption ? { comparer: comparerOption } : undefined,
    )
  }
  if (value instanceof Map) {
    return observableMap(
      value,
      comparerOption ? { comparer: comparerOption } : undefined,
    )
  }
  if (value instanceof Set) {
    return observableSet(value)
  }
  if (isPlainObject(value)) {
    return observable(value)
  }
  if (
    typeof value === "object" && value !== null && !Object.isExtensible(value)
  ) {
    console.warn(
      "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
    )
    return value
  }

  return value
}

/**
 * Process a value based on shallow flag.
 * Used by collections (array, map, set) to conditionally convert items.
 */
function processValue<T>(value: T, shallow: boolean): T {
  if (shallow) return value
  if (value === null || typeof value !== "object") return value
  if (isObservable(value) || isObservableObject(value)) return value
  return convertToObservable(value) as T
}

// ─── Wire forward references to collections ──────────────────────────────────
setProcessValue(processValue)
setMapProcessValue(processValue)
setSetProcessValue(processValue)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConstructorName(target: object): string {
  const ctor = target.constructor
  if (ctor && ctor.name && ctor.name !== "Object") {
    return ctor.name
  }
  return `ObservableObject@${getNextId()}`
}

function getTypeString(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (value instanceof Map) return "map"
  if (value instanceof Set) return "set"
  return typeof value
}

// ─── Property Installers ─────────────────────────────────────────────────────

function installDataProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  initialValue: Any,
  installTarget: object,
  annotation: "observable" | "observable.ref" | "observable.shallow",
  equalityOptions?: EqualityOptions,
): void {
  let boxValue = initialValue
  const comparerForCollections = equalityOptions?.comparer as
    | EqualityComparison
    | undefined

  if (annotation === "observable") {
    boxValue = convertToObservable(initialValue, comparerForCollections)
  } else if (annotation === "observable.shallow") {
    if (Array.isArray(initialValue)) {
      boxValue = observableArray(initialValue, { shallow: true })
    } else if (initialValue instanceof Map) {
      boxValue = observableMap(initialValue, { shallow: true })
    } else if (initialValue instanceof Set) {
      boxValue = observableSet(initialValue, { shallow: true })
    }
  }

  const oBox = observableBox(boxValue, {
    name: `${admin.name}.${String(key)}`,
    comparer: equalityOptions?.comparer,
  })

  admin.values.set(key, oBox)

  Object.defineProperty(installTarget, key, {
    get() {
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceBox = instanceAdmin.values.get(key) as ObservableBox<Any>
      return instanceBox.get()
    },
    set(v) {
      const instanceAdmin = this[$fobx] as ObservableObjectAdmin
      const instanceBox = instanceAdmin.values.get(key) as ObservableBox<Any>

      let convertedValue = v
      if (annotation === "observable") {
        convertedValue = convertToObservable(v, comparerForCollections)
      } else if (annotation === "observable.shallow") {
        if (Array.isArray(v)) {
          convertedValue = observableArray(v, { shallow: true })
        } else if (v instanceof Map) {
          convertedValue = observableMap(v, { shallow: true })
        } else if (v instanceof Set) {
          convertedValue = observableSet(v, { shallow: true })
        }
      }

      instanceBox.set(convertedValue)
    },
    enumerable: true,
    configurable: true,
  })
}

function installComputedProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  getter: () => Any,
  installTarget: object,
  equalityOptions?: EqualityOptions,
  setter?: (value: Any) => void,
): void {
  const boundGetter = getter.bind(admin.target)
  const boundSetter = setter ? setter.bind(admin.target) : undefined
  const comp = computed(boundGetter, {
    name: `${admin.name}.${String(key)}`,
    comparer: equalityOptions?.comparer,
    set: boundSetter,
  })

  admin.values.set(key, comp)

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

function installAction(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  method: (...args: Any[]) => Any,
  installTarget: object,
  bound: boolean = false,
): void {
  if (bound) {
    const boundWrapper = function (this: Any, ...args: Any[]) {
      startBatch()
      try {
        return runWithoutTracking(() => method.apply(admin.target, args))
      } catch (e) {
        setActionThrew(true)
        throw e
      } finally {
        endBatch()
        setActionThrew(false)
      }
    }

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
    const wrappedMethod = transaction(method)

    Object.defineProperty(installTarget, key, {
      value: wrappedMethod,
      writable: false,
      enumerable: true,
      configurable: true,
    })
  }
}

function installFlow(
  key: PropertyKey,
  generator: (...args: Any[]) => Any,
  installTarget: object,
  bound: boolean = false,
): void {
  // Already a flow-wrapped function — install it directly without re-wrapping.
  if ((generator as Any)[$fobx] === "flow") {
    Object.defineProperty(installTarget, key, {
      value: generator,
      writable: false,
      enumerable: true,
      configurable: true,
    })
    return
  }

  const wrappedFlow = bound
    ? flow(generator, { getThis: () => installTarget })
    : flow(generator)

  Object.defineProperty(installTarget, key, {
    value: wrappedFlow,
    writable: false,
    enumerable: true,
    configurable: true,
  })
}

// ─── Property Discovery ──────────────────────────────────────────────────────

function getPropertyDescriptors(target: object): PropertyInfo[] {
  const descriptors: PropertyInfo[] = []

  let current: object | null = target
  let level = 0

  while (current && current !== Object.prototype) {
    const keys = Object.getOwnPropertyNames(current)
    const len = keys.length

    for (let i = 0; i < len; i++) {
      const key = keys[i]
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

// ─── Annotation Processing ───────────────────────────────────────────────────

function processProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  annotationValue: AnnotationValue,
  installTarget: object,
): AnnotatedPropertyMeta {
  let annotation: AnnotationString
  let equalityOptions: EqualityOptions | undefined

  if (Array.isArray(annotationValue)) {
    annotation = annotationValue[0]
    const comparerArg = annotationValue[1]
    const resolvedComparer = resolveComparer(comparerArg)
    equalityOptions = { comparer: resolvedComparer }
  } else {
    annotation = annotationValue as AnnotationString
  }

  const isBound = annotation.endsWith(".bound")
  const baseAnnotation = isBound
    ? annotation.slice(0, -6) as AnnotationString
    : annotation

  switch (baseAnnotation) {
    case "observable":
    case "observable.ref":
    case "observable.shallow":
      if (descriptor.get) {
        throw new Error(
          `[@fobx/core] "${baseAnnotation}" cannot be used on getter/setter properties`,
        )
      }
      installDataProperty(
        admin,
        key,
        descriptor.value,
        installTarget,
        baseAnnotation,
        equalityOptions,
      )
      return { type: "data", annotation: baseAnnotation, equalityOptions }

    case "computed":
      if (!descriptor.get) {
        throw new Error(
          `[@fobx/core] ${
            String(key)
          } must be a getter to use "computed" annotation`,
        )
      }
      installComputedProperty(
        admin,
        key,
        descriptor.get,
        installTarget,
        equalityOptions,
        descriptor.set,
      )
      return {
        type: "computed",
        originalGetter: descriptor.get,
        originalSetter: descriptor.set,
        equalityOptions,
      }

    case "transaction":
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `[@fobx/core] ${
            String(key)
          } must be a function to use "transaction" annotation`,
        )
      }
      installAction(admin, key, descriptor.value, installTarget, isBound)
      return { type: "action", originalValue: descriptor.value }

    case "flow":
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `[@fobx/core] ${
            String(key)
          } must be a generator to use "flow" annotation`,
        )
      }
      // Allow already-wrapped flows; only reject plain non-generator functions.
      if (
        (descriptor.value as Any)[$fobx] !== "flow" && (
          descriptor.value.constructor === undefined ||
          descriptor.value.constructor.name !== "GeneratorFunction"
        )
      ) {
        throw new Error(
          `[@fobx/core] "${
            String(key)
          }" was marked as a flow but is not a generator function.`,
        )
      }
      installFlow(key, descriptor.value, installTarget, isBound)
      return { type: "flow", originalValue: descriptor.value }

    case "none":
      return { type: "none" }

    default:
      throw new Error(`[@fobx/core] Unknown annotation: ${annotation}`)
  }
}

// ─── makeObservable ──────────────────────────────────────────────────────────

export function makeObservable<T extends object>(
  target: T,
  options?: MakeObservableOptions<T>,
): T {
  const annotations = options?.annotations ?? {} as AnnotationsMap<T>
  // Type validation
  if (
    target == null ||
    typeof target === "string" ||
    typeof target === "number" ||
    typeof target === "boolean" ||
    typeof target === "symbol" ||
    typeof target === "bigint" ||
    typeof target === "undefined" ||
    typeof target === "function" ||
    Array.isArray(target) ||
    target instanceof Map ||
    target instanceof Set
  ) {
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${
        getTypeString(target)
      }"`,
    )
  }

  // Re-entrant call: already observable
  if (isObservableObject(target)) {
    const admin = (target as Any)[$fobx] as ObservableObjectAdmin
    const descriptors = getPropertyDescriptors(target)

    startBatch()
    try {
      const annotationEntries = Object.entries(annotations)
      const len = annotationEntries.length

      for (let i = 0; i < len; i++) {
        const [key, annotationValue] = annotationEntries[i]
        if (annotationValue === false) continue
        if (admin.values.has(key)) continue

        const found = descriptors.find((d) => d.key === key)
        if (!found) {
          throw new Error(
            `[@fobx/core] Property ${String(key)} not found on object`,
          )
        }

        const installTarget = options?.ownPropertiesOnly
          ? target
          : (found.prototype ?? target)
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

  if (!Object.isExtensible(target)) {
    if (isPlainObject(target)) {
      const newTarget = {} as T
      const ownKeys = Object.getOwnPropertyNames(target)
      for (const key of ownKeys) {
        const desc = Object.getOwnPropertyDescriptor(target, key)
        if (desc) Object.defineProperty(newTarget, key, desc)
      }
      return makeObservable(newTarget, options)
    }
    console.warn(
      "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
    )
    return target
  }

  // Create admin
  const admin: ObservableObjectAdmin = {
    id: getNextId(),
    name: options?.name || getConstructorName(target),
    target,
    values: new Map(),
  }

  Object.defineProperty(target, $fobx, {
    value: admin,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  const descriptors = getPropertyDescriptors(target)

  startBatch()
  try {
    const annotationEntries = Object.entries(annotations)
    const len = annotationEntries.length

    for (let i = 0; i < len; i++) {
      const [key, annotationValue] = annotationEntries[i]
      if (annotationValue === false) continue

      const found = descriptors.find((d) => d.key === key)
      if (!found) {
        throw new Error(
          `[@fobx/core] Property ${String(key)} not found on object`,
        )
      }

      const installTarget = options?.ownPropertiesOnly
        ? target
        : (found.prototype ?? target)
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

// ─── observable ──────────────────────────────────────────────────────────────

export function observable<T = Any>(
  target: T[],
  options?: ArrayOptions,
): ObservableArray<T>
export function observable<K = Any, V = Any>(
  target: Map<K, V>,
  options?: MapOptions,
): ObservableMap<K, V>
export function observable<T = Any>(
  target: Set<T>,
  options?: SetOptions,
): ObservableSet<T>
export function observable<T extends object>(
  target: T,
  options?: ObservableOptions<T>,
): T
export function observable<T extends object>(
  target: T,
  options?: ObservableOptions<T> | ArrayOptions | MapOptions | SetOptions,
): Any {
  // Fast path: already observable
  if (isObservable(target) || isObservableObject(target)) {
    if (isObservableObject(target)) {
      const admin = (target as Any)[$fobx] as ObservableObjectAdmin
      const objOptions = options as ObservableOptions<T> | undefined
      const annotations = objOptions?.annotations
      const defaultAnnotation = objOptions?.defaultAnnotation || "observable"

      startBatch()
      try {
        const ownKeys = Object.getOwnPropertyNames(target)
        for (let i = 0; i < ownKeys.length; i++) {
          const key = ownKeys[i]
          if (key === "constructor" || key === ($fobx as Any)) continue
          if (admin.values.has(key)) continue

          const descriptor = Object.getOwnPropertyDescriptor(target, key)
          if (!descriptor) continue

          const annotationVal = (annotations as Any)?.[key] ?? defaultAnnotation
          if (annotationVal === "none") continue

          processProperty(admin, key, descriptor, annotationVal, target)
        }

        if (annotations) {
          for (const key of Object.keys(annotations)) {
            const annotationVal = (annotations as Any)[key]
            if (annotationVal === "none") {
              admin.values.delete(key)

              let proto = Object.getPrototypeOf(target)
              while (proto && proto !== Object.prototype) {
                const annotatedMap = annotatedPrototypes.get(proto)
                if (annotatedMap?.has(key)) {
                  const meta = annotatedMap.get(key)!
                  if (meta.type === "computed" && meta.originalGetter) {
                    Object.defineProperty(proto, key, {
                      get: meta.originalGetter,
                      set: meta.originalSetter,
                      enumerable: true,
                      configurable: true,
                    })
                  } else if (
                    (meta.type === "action" || meta.type === "flow") &&
                    meta.originalValue
                  ) {
                    Object.defineProperty(proto, key, {
                      value: meta.originalValue,
                      writable: true,
                      enumerable: true,
                      configurable: true,
                    })
                  }
                  annotatedMap.set(key, { type: "none" })
                  break
                }
                proto = Object.getPrototypeOf(proto)
              }
            }
          }
        }
      } finally {
        endBatch()
      }
    }
    return target
  }

  // Handle collections
  if (Array.isArray(target)) {
    return observableArray(target, options as ArrayOptions)
  }
  if (target instanceof Map) {
    return observableMap(target, options as MapOptions)
  }
  if (target instanceof Set) {
    return observableSet(target, options as SetOptions)
  }

  // Type validation
  if (target == null || typeof target !== "object") {
    const typeStr = getTypeString(target)
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${typeStr}"`,
    )
  }

  const objOptions = options as ObservableOptions<T> | undefined
  const annotations = objOptions?.annotations

  const isPlain = isPlainObject(target)
  const inPlace = !!(objOptions as ObservableOptions<T> | undefined)?.inPlace
  const ownPropertiesOnly = !!(objOptions as ObservableOptions<T> | undefined)
    ?.ownPropertiesOnly

  if (!isPlain && !Object.isExtensible(target)) {
    throw new Error("[@fobx/core] Cannot make non-extensible object observable")
  }

  if (isPlain && inPlace && !Object.isExtensible(target)) {
    throw new Error(
      "[@fobx/core] Cannot use inPlace on a non-extensible (frozen/sealed) object",
    )
  }

  const observableTarget = isPlain && !inPlace ? ({} as T) : target

  const id = getNextId()
  const admin: ObservableObjectAdmin = {
    id,
    name: objOptions?.name ||
      (isPlain ? `ObservableObject@${id}` : getConstructorName(target)),
    target: observableTarget,
    values: new Map(),
  }

  Object.defineProperty(observableTarget, $fobx, {
    value: admin,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  const descriptors = getPropertyDescriptors(target)
  descriptors.sort((a, b) => b.level - a.level)

  startBatch()
  try {
    const len = descriptors.length

    for (let i = 0; i < len; i++) {
      const { key, descriptor, prototype, level: _level } = descriptors[i]

      const override = annotations?.[key as keyof T]

      if (override === false) continue

      // For prototype properties in class instances, check if already annotated
      if (prototype !== null && !isPlain) {
        let annotatedMap = annotatedPrototypes.get(prototype)
        if (annotatedMap?.has(key)) {
          const meta = annotatedMap.get(key)!
          if (meta.type === "computed" && meta.originalGetter) {
            const boundGetter = meta.originalGetter.bind(observableTarget)
            const boundSetter = meta.originalSetter
              ? meta.originalSetter.bind(observableTarget)
              : undefined
            const comp = computed(boundGetter, {
              name: `${admin.name}.${String(key)}`,
              comparer: meta.equalityOptions?.comparer,
              set: boundSetter,
            })
            admin.values.set(key, comp)
          } else if (meta.type === "data" && meta.annotation) {
            const initialValue = descriptor.value
            let boxValue = initialValue
            if (meta.annotation === "observable") {
              boxValue = convertToObservable(
                initialValue,
                meta.equalityOptions?.comparer as EqualityComparison,
              )
            }
            const oBox = observableBox(boxValue, {
              name: `${admin.name}.${String(key)}`,
              comparer: meta.equalityOptions?.comparer,
            })
            admin.values.set(key, oBox)
          }
          continue
        }
        if (!annotatedMap) {
          annotatedMap = new Map()
          annotatedPrototypes.set(prototype, annotatedMap)
        }
      }

      let installTarget: object
      if (isPlain || ownPropertiesOnly) {
        installTarget = observableTarget
      } else {
        installTarget = prototype ?? observableTarget
      }

      if (override !== undefined) {
        const meta = processProperty(
          admin,
          key,
          descriptor,
          override,
          installTarget,
        )

        if (prototype !== null && !isPlain) {
          let annotatedMap = annotatedPrototypes.get(prototype)
          if (!annotatedMap) {
            annotatedMap = new Map()
            annotatedPrototypes.set(prototype, annotatedMap)
          }
          meta.prototype = prototype
          annotatedMap.set(key, meta)
        }

        if (isPlain && override === "none") {
          Object.defineProperty(observableTarget, key, descriptor)
        }
      } else {
        // AUTO-INFER annotation
        let meta: AnnotatedPropertyMeta | undefined
        if (descriptor.get && !descriptor.set) {
          meta = processProperty(
            admin,
            key,
            descriptor,
            "computed",
            installTarget,
          )
        } else if (descriptor.get && descriptor.set) {
          installComputedProperty(
            admin,
            key,
            descriptor.get,
            installTarget,
            undefined,
            descriptor.set,
          )
          meta = {
            type: "computed",
            originalGetter: descriptor.get,
            originalSetter: descriptor.set,
          }
        } else if (typeof descriptor.value === "function") {
          // When `defaultAnnotation` opts for reference storage (observable*) or
          // to skip the property ("none"), respect that intent for functions too.
          // Without this, `observable({cb: fn}, {defaultAnnotation:"observable.ref"})`
          // would wrap the callback in a transaction instead of storing it by reference.
          const explicitDefault = objOptions?.defaultAnnotation
          const isObservableDefault = explicitDefault &&
            (explicitDefault === "observable" ||
              explicitDefault === "observable.ref" ||
              explicitDefault === "observable.shallow" ||
              explicitDefault === "none")
          const isAlreadyFlow = !isObservableDefault &&
            (descriptor.value as Any)[$fobx] === "flow"
          const isGenerator = !isObservableDefault && !isAlreadyFlow &&
            descriptor.value.constructor.name === "GeneratorFunction"
          const effectiveAnnotation = isObservableDefault
            ? explicitDefault
            : isAlreadyFlow || isGenerator
            ? "flow"
            : "transaction"
          meta = processProperty(
            admin,
            key,
            descriptor,
            effectiveAnnotation,
            installTarget,
          )
        } else if (!descriptor.get) {
          const type = objOptions?.defaultAnnotation || "observable"
          meta = processProperty(admin, key, descriptor, type, installTarget)
        }

        if (meta && prototype !== null && !isPlain) {
          let annotatedMap = annotatedPrototypes.get(prototype)
          if (!annotatedMap) {
            annotatedMap = new Map()
            annotatedPrototypes.set(prototype, annotatedMap)
          }
          meta.prototype = prototype
          annotatedMap.set(key, meta)
        }
      }

      // For plain objects, copy the initial value via setter to trigger conversion
      if (
        isPlain &&
        descriptor.value !== undefined &&
        typeof descriptor.value !== "function" &&
        !descriptor.get &&
        override !== "none"
      ) {
        ;(observableTarget as Any)[key] = descriptor.value
      }
    }
  } finally {
    endBatch()
  }

  return observableTarget
}
