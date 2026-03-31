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
  getConvertedValue,
  rememberConvertedValue,
  withConversionContext,
} from "./conversionContext.ts"
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
  processedPrototypes: WeakSet<object>
  lockedKeys: Set<PropertyKey>
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
  return withConversionContext(() => {
    if (isObservable(value) || isObservableObject(value)) return value

    if (typeof value === "object" && value !== null) {
      const cachedValue = getConvertedValue<Any>(value)
      if (cachedValue !== undefined) return cachedValue
    }

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
  })
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
  // TODO: Revisit whether reassigned function/flow members should preserve their
  // original annotation semantics or remain direct reference replacements.
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
      writable: true,
      enumerable: true,
      configurable: true,
    })
  } else {
    const wrappedMethod = transaction(method)

    Object.defineProperty(installTarget, key, {
      value: wrappedMethod,
      writable: true,
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
  // TODO: Revisit whether reassigned function/flow members should preserve their
  // original annotation semantics or remain direct reference replacements.

  // Already a flow-wrapped function — install it directly without re-wrapping.
  if ((generator as Any)[$fobx] === "flow") {
    Object.defineProperty(installTarget, key, {
      value: generator,
      writable: true,
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
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

// ─── Property Discovery ──────────────────────────────────────────────────────

function getPropertyDescriptors(target: object): PropertyInfo[] {
  const descriptors: PropertyInfo[] = []
  const seenKeys = new Set<PropertyKey>()

  let current: object | null = target
  let level = 0

  while (current && current !== Object.prototype) {
    const keys = Object.getOwnPropertyNames(current)
    const len = keys.length

    for (let i = 0; i < len; i++) {
      const key = keys[i]
      if (key === "constructor" || key === ($fobx as Any)) continue
      if (seenKeys.has(key)) continue

      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (!descriptor) continue

      seenKeys.add(key)

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

function selectAuthoritativePrototype<T extends object>(
  source: T,
  admin: ObservableObjectAdmin,
  descriptors: PropertyInfo[],
  annotations?: Partial<AnnotationsMap<T>>,
): object | null {
  if (annotations) {
    const annotationKeys = Object.keys(annotations).filter((key) => {
      return (annotations as Any)[key] !== false
    })

    if (annotationKeys.length > 0) {
      const prototypes: object[] = []
      let current = Object.getPrototypeOf(source)

      while (current && current !== Object.prototype) {
        prototypes.push(current)
        current = Object.getPrototypeOf(current)
      }

      for (let i = prototypes.length - 1; i >= 0; i--) {
        const prototype = prototypes[i]
        if (admin.processedPrototypes.has(prototype)) continue

        for (let j = 0; j < annotationKeys.length; j++) {
          if (Object.getOwnPropertyDescriptor(prototype, annotationKeys[j])) {
            return prototype
          }
        }
      }
    }
  }

  const len = descriptors.length
  for (let i = 0; i < len; i++) {
    const prototype = descriptors[i].prototype
    if (prototype !== null && !admin.processedPrototypes.has(prototype)) {
      return prototype
    }
  }

  return null
}

function getOrCreateAnnotatedPrototypeMap(
  prototype: object,
): Map<PropertyKey, AnnotatedPropertyMeta> {
  let annotatedMap = annotatedPrototypes.get(prototype)

  if (!annotatedMap) {
    annotatedMap = new Map()
    annotatedPrototypes.set(prototype, annotatedMap)
  }

  return annotatedMap
}

function rememberAnnotatedPrototypeMeta(
  prototype: object,
  key: PropertyKey,
  meta: AnnotatedPropertyMeta,
): void {
  meta.prototype = prototype
  getOrCreateAnnotatedPrototypeMap(prototype).set(key, meta)
}

function applyAnnotatedPrototypeMeta(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  meta: AnnotatedPropertyMeta,
): void {
  if (meta.type === "computed" && meta.originalGetter) {
    const boundGetter = meta.originalGetter.bind(admin.target)
    const boundSetter = meta.originalSetter
      ? meta.originalSetter.bind(admin.target)
      : undefined
    const comp = computed(boundGetter, {
      name: `${admin.name}.${String(key)}`,
      comparer: meta.equalityOptions?.comparer,
      set: boundSetter,
    })
    admin.values.set(key, comp)
    return
  }

  if (meta.type === "data" && meta.annotation) {
    const initialValue = descriptor.value
    let boxValue = initialValue
    const comparer = meta.equalityOptions?.comparer as
      | EqualityComparison
      | undefined

    if (meta.annotation === "observable") {
      boxValue = convertToObservable(initialValue, comparer)
    } else if (meta.annotation === "observable.shallow") {
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
      comparer: meta.equalityOptions?.comparer,
    })
    admin.values.set(key, oBox)
  }
}

function restoreAnnotatedPrototypeProperty(
  prototype: object,
  key: PropertyKey,
  meta: AnnotatedPropertyMeta,
): void {
  if (meta.type === "computed" && meta.originalGetter) {
    Object.defineProperty(prototype, key, {
      get: meta.originalGetter,
      set: meta.originalSetter,
      enumerable: true,
      configurable: true,
    })
    return
  }

  if ((meta.type === "action" || meta.type === "flow") && meta.originalValue) {
    Object.defineProperty(prototype, key, {
      value: meta.originalValue,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }
}

function resolveAnnotatedPrototypeDescriptor(
  descriptor: PropertyDescriptor,
  meta: AnnotatedPropertyMeta,
): PropertyDescriptor {
  if (meta.type === "computed" && meta.originalGetter) {
    return {
      get: meta.originalGetter,
      set: meta.originalSetter,
      enumerable: descriptor.enumerable ?? true,
      configurable: descriptor.configurable ?? true,
    }
  }

  if (
    (meta.type === "action" || meta.type === "flow") &&
    meta.originalValue !== undefined
  ) {
    return {
      value: meta.originalValue,
      writable: true,
      enumerable: descriptor.enumerable ?? true,
      configurable: descriptor.configurable ?? true,
    }
  }

  return descriptor
}

function isDataDescriptor(descriptor: PropertyDescriptor): boolean {
  return descriptor.value !== undefined &&
    typeof descriptor.value !== "function" && !descriptor.get
}

function getInstallTarget(
  target: object,
  prototype: object | null,
  ownPropertiesOnly: boolean,
): object {
  return ownPropertiesOnly ? target : (prototype ?? target)
}

function autoInferProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  installTarget: object,
  explicitDefaultAnnotation: AnnotationString | undefined,
  defaultAnnotation: AnnotationString,
): AnnotatedPropertyMeta | undefined {
  if (descriptor.get && !descriptor.set) {
    return processProperty(
      admin,
      key,
      descriptor,
      "computed",
      installTarget,
    )
  }

  if (descriptor.get && descriptor.set) {
    installComputedProperty(
      admin,
      key,
      descriptor.get,
      installTarget,
      undefined,
      descriptor.set,
    )
    return {
      type: "computed",
      originalGetter: descriptor.get,
      originalSetter: descriptor.set,
    }
  }

  if (typeof descriptor.value === "function") {
    // When `defaultAnnotation` opts for reference storage (observable*) or
    // to skip the property ("none"), respect that intent for functions too.
    // Without this, `observable({cb: fn}, {defaultAnnotation:"observable.ref"})`
    // would wrap the callback in a transaction instead of storing it by reference.
    const explicitDefault = explicitDefaultAnnotation
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

    return processProperty(
      admin,
      key,
      descriptor,
      effectiveAnnotation,
      installTarget,
    )
  }

  if (!descriptor.get) {
    return processProperty(
      admin,
      key,
      descriptor,
      defaultAnnotation,
      installTarget,
    )
  }
}

function resolveExplicitAnnotationDescriptor(
  source: object,
  descriptors: PropertyInfo[],
  currentPrototype: object | null,
  key: PropertyKey,
): PropertyInfo | undefined {
  const ownDescriptor = Object.getOwnPropertyDescriptor(source, key)
  if (ownDescriptor) {
    return {
      key,
      descriptor: ownDescriptor,
      prototype: null,
      level: 0,
    }
  }

  if (currentPrototype !== null) {
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(
      currentPrototype,
      key,
    )
    if (prototypeDescriptor) {
      return {
        key,
        descriptor: prototypeDescriptor,
        prototype: currentPrototype,
        level: 1,
      }
    }
  }

  return descriptors.find((descriptorInfo) => descriptorInfo.key === key)
}

interface AnnotationApplyOptions<T extends object> {
  annotations?: Partial<AnnotationsMap<T>>
  ownPropertiesOnly?: boolean
  defaultAnnotation?: AnnotationString
  explicitOnly: boolean
}

function applyClassAnnotations<T extends object>(
  source: T,
  target: T,
  admin: ObservableObjectAdmin,
  options: AnnotationApplyOptions<T>,
): void {
  const descriptors = getPropertyDescriptors(source)
  descriptors.sort((a, b) => b.level - a.level)

  const annotations = options.annotations
  const ownPropertiesOnly = !!options.ownPropertiesOnly
  const explicitDefaultAnnotation = options.defaultAnnotation
  const defaultAnnotation = explicitDefaultAnnotation || "observable"
  const currentPrototype = selectAuthoritativePrototype(
    source,
    admin,
    descriptors,
    annotations,
  )
  const explicitKeys = new Set<PropertyKey>()
  const touchedPrototypeKeys = new Set<PropertyKey>()
  let touchedCurrentPrototype = false

  const markCurrentPrototypeKey = (key: PropertyKey) => {
    touchedCurrentPrototype = true
    touchedPrototypeKeys.add(key)
  }

  startBatch()
  try {
    if (annotations) {
      const annotationEntries = Object.entries(annotations)
      const annotationLen = annotationEntries.length

      for (let i = 0; i < annotationLen; i++) {
        const [key, annotationValue] = annotationEntries[i]
        explicitKeys.add(key)

        if (annotationValue === false || admin.lockedKeys.has(key)) {
          continue
        }

        const found = resolveExplicitAnnotationDescriptor(
          source,
          descriptors,
          currentPrototype,
          key,
        )
        if (!found) continue

        if (
          found.prototype !== null &&
          found.prototype !== currentPrototype
        ) {
          continue
        }

        const explicitAnnotation = Array.isArray(annotationValue)
          ? annotationValue[0]
          : annotationValue
        let descriptor = found.descriptor

        if (found.prototype !== null) {
          const existingMeta = annotatedPrototypes.get(found.prototype)?.get(
            key,
          )
          const canOverrideCurrentPrototypeMeta = found.prototype ===
              currentPrototype && !admin.lockedKeys.has(key)

          if (existingMeta && !canOverrideCurrentPrototypeMeta) {
            markCurrentPrototypeKey(key)
            applyAnnotatedPrototypeMeta(
              admin,
              key,
              descriptor,
              existingMeta,
            )
            continue
          }

          if (existingMeta && canOverrideCurrentPrototypeMeta) {
            descriptor = resolveAnnotatedPrototypeDescriptor(
              descriptor,
              existingMeta,
            )
          }
        } else if (admin.values.has(key)) {
          if (explicitAnnotation !== "none") continue

          admin.values.delete(key)
          Object.defineProperty(target, key, descriptor)
          continue
        }

        if (explicitAnnotation === "none") {
          admin.values.delete(key)

          if (found.prototype !== null) {
            const existingMeta = annotatedPrototypes.get(found.prototype)?.get(
              key,
            )
            if (existingMeta) {
              restoreAnnotatedPrototypeProperty(
                found.prototype,
                key,
                existingMeta,
              )
            }

            markCurrentPrototypeKey(key)
            rememberAnnotatedPrototypeMeta(found.prototype, key, {
              type: "none",
            })
          } else {
            Object.defineProperty(target, key, descriptor)
          }

          continue
        }

        const meta = processProperty(
          admin,
          key,
          descriptor,
          annotationValue as AnnotationValue,
          getInstallTarget(target, found.prototype, ownPropertiesOnly),
        )

        if (found.prototype !== null) {
          markCurrentPrototypeKey(key)
          rememberAnnotatedPrototypeMeta(found.prototype, key, meta)
        }
      }
    }

    if (!options.explicitOnly) {
      const len = descriptors.length

      for (let i = 0; i < len; i++) {
        const { key, descriptor, prototype } = descriptors[i]

        if (explicitKeys.has(key) || admin.lockedKeys.has(key)) {
          continue
        }

        if (prototype !== null && prototype !== currentPrototype) {
          continue
        }

        if (prototype !== null) {
          const existingMeta = annotatedPrototypes.get(prototype)?.get(key)
          if (existingMeta) {
            markCurrentPrototypeKey(key)
            applyAnnotatedPrototypeMeta(admin, key, descriptor, existingMeta)
            continue
          }
        } else if (admin.values.has(key)) {
          continue
        }

        const meta = autoInferProperty(
          admin,
          key,
          descriptor,
          getInstallTarget(target, prototype, ownPropertiesOnly),
          explicitDefaultAnnotation,
          defaultAnnotation,
        )

        if (meta && prototype !== null) {
          markCurrentPrototypeKey(key)
          rememberAnnotatedPrototypeMeta(prototype, key, meta)
        }
      }

      for (let i = 0; i < len; i++) {
        const { key, descriptor, prototype } = descriptors[i]

        if (
          prototype === null ||
          prototype === currentPrototype ||
          explicitKeys.has(key) ||
          admin.lockedKeys.has(key)
        ) {
          continue
        }

        const existingMeta = annotatedPrototypes.get(prototype)?.get(key)
        if (existingMeta) {
          applyAnnotatedPrototypeMeta(admin, key, descriptor, existingMeta)
          continue
        }

        const meta = autoInferProperty(
          admin,
          key,
          descriptor,
          getInstallTarget(target, prototype, ownPropertiesOnly),
          explicitDefaultAnnotation,
          defaultAnnotation,
        )

        if (meta) {
          rememberAnnotatedPrototypeMeta(prototype, key, meta)
        }
      }
    }
  } finally {
    endBatch()
  }

  if (currentPrototype !== null && touchedCurrentPrototype) {
    admin.processedPrototypes.add(currentPrototype)
    for (const key of touchedPrototypeKeys) {
      admin.lockedKeys.add(key)
    }
  }
}

function applyPlainObjectAnnotations<T extends object>(
  source: T,
  target: T,
  admin: ObservableObjectAdmin,
  options: AnnotationApplyOptions<T>,
): void {
  const descriptors = getPropertyDescriptors(source)
  const annotations = options.annotations
  const defaultAnnotation = options.defaultAnnotation || "observable"

  startBatch()
  try {
    const len = descriptors.length

    for (let i = 0; i < len; i++) {
      const { key, descriptor } = descriptors[i]
      const annotationValue = annotations?.[key as keyof T]

      if (annotationValue === false) continue

      const explicitAnnotation = Array.isArray(annotationValue)
        ? annotationValue[0]
        : annotationValue

      if (explicitAnnotation === "none") {
        admin.values.delete(key)
        Object.defineProperty(target, key, descriptor)
        continue
      }

      if (admin.values.has(key)) {
        continue
      }

      if (annotationValue !== undefined) {
        processProperty(admin, key, descriptor, annotationValue, target)
      } else if (!options.explicitOnly) {
        autoInferProperty(
          admin,
          key,
          descriptor,
          target,
          options.defaultAnnotation,
          defaultAnnotation,
        )
      } else {
        continue
      }

      if (isDataDescriptor(descriptor)) {
        ;(target as Any)[key] = descriptor.value
      }
    }
  } finally {
    endBatch()
  }
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
    if (isPlainObject(target)) {
      applyPlainObjectAnnotations(target, target, admin, {
        annotations,
        explicitOnly: true,
      })
    } else {
      applyClassAnnotations(target, target, admin, {
        annotations,
        ownPropertiesOnly: !!options?.ownPropertiesOnly,
        explicitOnly: true,
      })
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
    processedPrototypes: new WeakSet(),
    lockedKeys: new Set(),
  }

  Object.defineProperty(target, $fobx, {
    value: admin,
    writable: false,
    enumerable: false,
    configurable: false,
  })

  if (isPlainObject(target)) {
    applyPlainObjectAnnotations(target, target, admin, {
      annotations,
      explicitOnly: true,
    })
  } else {
    applyClassAnnotations(target, target, admin, {
      annotations,
      ownPropertiesOnly: !!options?.ownPropertiesOnly,
      explicitOnly: true,
    })
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
  return withConversionContext(() => {
    // Fast path: already observable
    if (isObservable(target) || isObservableObject(target)) {
      if (isObservableObject(target)) {
        const admin = (target as Any)[$fobx] as ObservableObjectAdmin
        const objOptions = options as ObservableOptions<T> | undefined

        if (isPlainObject(target)) {
          applyPlainObjectAnnotations(target, target, admin, {
            annotations: objOptions?.annotations,
            defaultAnnotation: objOptions?.defaultAnnotation,
            explicitOnly: false,
          })
        } else {
          applyClassAnnotations(target, target, admin, {
            annotations: objOptions?.annotations,
            ownPropertiesOnly: !!objOptions?.ownPropertiesOnly,
            defaultAnnotation: objOptions?.defaultAnnotation,
            explicitOnly: false,
          })
        }
      }
      return target
    }

    if (target != null && typeof target === "object") {
      const cachedValue = getConvertedValue<Any>(target)
      if (cachedValue !== undefined) return cachedValue
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

    const isPlain = isPlainObject(target)
    const inPlace = !!(objOptions as ObservableOptions<T> | undefined)?.inPlace

    if (!isPlain && !Object.isExtensible(target)) {
      throw new Error(
        "[@fobx/core] Cannot make non-extensible object observable",
      )
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
      processedPrototypes: new WeakSet(),
      lockedKeys: new Set(),
    }

    Object.defineProperty(observableTarget, $fobx, {
      value: admin,
      writable: false,
      enumerable: false,
      configurable: false,
    })

    rememberConvertedValue(target, observableTarget)

    if (isPlain) {
      applyPlainObjectAnnotations(target, observableTarget, admin, {
        annotations: objOptions?.annotations,
        defaultAnnotation: objOptions?.defaultAnnotation,
        explicitOnly: false,
      })
    } else {
      applyClassAnnotations(target, observableTarget, admin, {
        annotations: objOptions?.annotations,
        ownPropertiesOnly: !!objOptions?.ownPropertiesOnly,
        defaultAnnotation: objOptions?.defaultAnnotation,
        explicitOnly: false,
      })
    }

    return observableTarget
  })
}
