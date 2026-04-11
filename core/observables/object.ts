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

export interface ObservableObjectAdmin {
  id: number
  name: string
  target: object
  values: Map<PropertyKey, ObservableBox<Any> | Computed<Any>>
  processedPrototypes: WeakSet<object>
  lockedKeys: Set<PropertyKey>
}

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

export type AnnotationValue =
  | AnnotationString
  | [AnnotationString, EqualityComparison]
  | false

export type AnnotationsMap<T extends object> = {
  [K in keyof T]?: AnnotationValue
}

export interface MakeObservableOptions<T extends object = object> {
  name?: string
  annotations?: AnnotationsMap<T>
  /**
   * When true, all descriptors (including inherited ones) are installed directly
   * on the target instance rather than on the prototype. Default: false.
   */
  ownPropertiesOnly?: boolean
}

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

interface EqualityOptions {
  comparer?: EqualityChecker
}

interface PropertyInfo {
  key: PropertyKey
  descriptor: PropertyDescriptor
  prototype: object | null
  level: number
}

type ResolvedAnnotation =
  | {
    type: "data"
    annotation: "observable" | "observable.ref" | "observable.shallow"
    equalityOptions?: EqualityOptions
  }
  | {
    type: "computed"
    equalityOptions?: EqualityOptions
  }
  | {
    type: "action"
    bound: boolean
  }
  | {
    type: "flow"
    bound: boolean
  }
  | {
    type: "none"
  }

interface PrototypeAnnotationRecord {
  descriptor: PropertyDescriptor
  annotation: AnnotationValue
}

const annotatedPrototypes = new WeakMap<
  object,
  Map<PropertyKey, PrototypeAnnotationRecord>
>()

const prototypeStorageKeys = new WeakMap<object, Map<PropertyKey, symbol>>()

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

function processValue<T>(value: T, shallow: boolean): T {
  if (shallow) return value
  if (value === null || typeof value !== "object") return value
  if (isObservable(value) || isObservableObject(value)) return value
  return convertToObservable(value) as T
}

setProcessValue(processValue)
setMapProcessValue(processValue)
setSetProcessValue(processValue)

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

function getOrCreatePrototypeStorageKey(
  prototype: object,
  key: PropertyKey,
): symbol {
  let storageMap = prototypeStorageKeys.get(prototype)

  if (!storageMap) {
    storageMap = new Map()
    prototypeStorageKeys.set(prototype, storageMap)
  }

  const existing = storageMap.get(key)

  if (existing) return existing

  const storageKey = Symbol(`fobx.prototype.${String(key)}`)
  storageMap.set(key, storageKey)
  return storageKey
}

function getOrCreatePrototypeObservableValue<
  T extends ObservableBox<Any> | Computed<Any>,
>(
  target: Any,
  storageKey: symbol,
  createValue: (instanceAdmin: ObservableObjectAdmin) => T,
): T {
  const instanceAdmin = target[$fobx] as ObservableObjectAdmin
  const existing = instanceAdmin.values.get(storageKey) as T | undefined

  if (existing) {
    return existing
  }

  const value = createValue(instanceAdmin)
  instanceAdmin.values.set(storageKey, value)
  return value
}

function installTrackedAccessor<
  T extends ObservableBox<Any> | Computed<Any>,
>(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  installTarget: object,
  value: T,
  storageKey: symbol | undefined,
  createSharedValue:
    | ((instanceAdmin: ObservableObjectAdmin, target: Any) => T)
    | undefined,
  normalizeInput: (value: Any) => Any = (value) => value,
): void {
  if (storageKey !== undefined) {
    admin.values.set(storageKey, value)
  }
  admin.values.set(key, value)

  const getValue = storageKey === undefined
    ? (target: Any) => {
      const instanceAdmin = target[$fobx] as ObservableObjectAdmin
      return instanceAdmin.values.get(key) as T
    }
    : (target: Any) => {
      return getOrCreatePrototypeObservableValue(
        target,
        storageKey,
        (instanceAdmin) => createSharedValue!(instanceAdmin, target),
      )
    }

  Object.defineProperty(installTarget, key, {
    get() {
      return getValue(this).get()
    },
    set(v) {
      getValue(this).set(normalizeInput(v))
    },
    enumerable: true,
    configurable: true,
  })
}

function installDataProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  initialValue: Any,
  installTarget: object,
  annotation: "observable" | "observable.ref" | "observable.shallow",
  equalityOptions?: EqualityOptions,
  prototypeStorageKey?: symbol,
): void {
  const storageKey = prototypeStorageKey
  const comparerForCollections = equalityOptions?.comparer as
    | EqualityComparison
    | undefined

  function convertStoredValue(value: Any): Any {
    if (annotation === "observable") {
      return convertToObservable(value, comparerForCollections)
    }

    if (annotation === "observable.shallow") {
      if (Array.isArray(value)) {
        return observableArray(value, { shallow: true })
      }
      if (value instanceof Map) {
        return observableMap(value, { shallow: true })
      }
      if (value instanceof Set) {
        return observableSet(value, { shallow: true })
      }
    }

    return value
  }

  function createBox(name: string, value: Any): ObservableBox<Any> {
    return observableBox(convertStoredValue(value), {
      name: `${name}.${String(key)}`,
      comparer: equalityOptions?.comparer,
    })
  }

  installTrackedAccessor(
    admin,
    key,
    installTarget,
    createBox(admin.name, initialValue),
    storageKey,
    storageKey === undefined
      ? undefined
      : (instanceAdmin) => createBox(instanceAdmin.name, initialValue),
    convertStoredValue,
  )
}

function installComputedProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  getter: () => Any,
  installTarget: object,
  equalityOptions?: EqualityOptions,
  setter?: (value: Any) => void,
  prototypeStorageKey?: symbol,
): void {
  const storageKey = prototypeStorageKey

  function createComputedValue(name: string, target: object): Computed<Any> {
    return computed(getter.bind(target), {
      name: `${name}.${String(key)}`,
      comparer: equalityOptions?.comparer,
      set: setter ? setter.bind(target) : undefined,
    })
  }

  installTrackedAccessor(
    admin,
    key,
    installTarget,
    createComputedValue(admin.name, admin.target),
    storageKey,
    storageKey === undefined
      ? undefined
      : (instanceAdmin, target) =>
        createComputedValue(instanceAdmin.name, target),
  )
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

function rememberAnnotatedPrototypeMeta(
  prototype: object,
  key: PropertyKey,
  meta: PrototypeAnnotationRecord,
): void {
  let annotatedMap = annotatedPrototypes.get(prototype)

  if (!annotatedMap) {
    annotatedMap = new Map()
    annotatedPrototypes.set(prototype, annotatedMap)
  }

  annotatedMap.set(key, meta)
}

function installAnnotatedProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  annotationValue: AnnotationValue,
  installTarget: object,
  prototype?: object | null,
  prototypeStorageKey?: symbol,
): void {
  const resolved = resolveAnnotation(key, descriptor, annotationValue)
  const storageKey = prototypeStorageKey ?? (
    installTarget !== admin.target && prototype != null &&
      (resolved.type === "data" || resolved.type === "computed")
      ? getOrCreatePrototypeStorageKey(prototype, key)
      : undefined
  )

  switch (resolved.type) {
    case "data":
      installDataProperty(
        admin,
        key,
        descriptor.value,
        installTarget,
        resolved.annotation,
        resolved.equalityOptions,
        storageKey,
      )
      return

    case "computed":
      installComputedProperty(
        admin,
        key,
        descriptor.get as () => Any,
        installTarget,
        resolved.equalityOptions,
        descriptor.set,
        storageKey,
      )
      return

    case "action":
      installAction(
        admin,
        key,
        descriptor.value,
        installTarget,
        resolved.bound,
      )
      return

    case "flow":
      installFlow(key, descriptor.value, installTarget, resolved.bound)
      return

    case "none":
      return
  }
}

function restoreAnnotatedPrototypeProperty(
  prototype: object,
  key: PropertyKey,
  meta: PrototypeAnnotationRecord,
): void {
  prototypeStorageKeys.get(prototype)?.delete(key)
  Object.defineProperty(prototype, key, { ...meta.descriptor })
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

function inferAutoAnnotation(
  descriptor: PropertyDescriptor,
  prototype: object | null,
  explicitDefaultAnnotation: AnnotationString | undefined,
  defaultAnnotation: AnnotationString,
): AnnotationString | undefined {
  if (descriptor.get) {
    return "computed"
  }

  if (typeof descriptor.value === "function") {
    const ownFunctionDefaultAnnotation = prototype === null && (
        explicitDefaultAnnotation === "observable" ||
        explicitDefaultAnnotation === "observable.ref" ||
        explicitDefaultAnnotation === "observable.shallow" ||
        explicitDefaultAnnotation === "none"
      )
      ? explicitDefaultAnnotation
      : undefined

    if (ownFunctionDefaultAnnotation) {
      return ownFunctionDefaultAnnotation
    }

    const isAlreadyFlow = (descriptor.value as Any)[$fobx] === "flow"
    const isGenerator = !isAlreadyFlow &&
      descriptor.value.constructor.name === "GeneratorFunction"

    return isAlreadyFlow || isGenerator ? "flow" : "transaction"
  }

  return defaultAnnotation
}

function resolvedAnnotationsEqual(
  left: ResolvedAnnotation,
  right: ResolvedAnnotation,
): boolean {
  if (left.type !== right.type) return false

  switch (left.type) {
    case "data": {
      const other = right as Extract<ResolvedAnnotation, { type: "data" }>
      return left.annotation === other.annotation &&
        left.equalityOptions?.comparer === other.equalityOptions?.comparer
    }

    case "computed": {
      const other = right as Extract<
        ResolvedAnnotation,
        { type: "computed" }
      >
      return left.equalityOptions?.comparer === other.equalityOptions?.comparer
    }

    case "action": {
      const other = right as Extract<
        ResolvedAnnotation,
        { type: "action" }
      >
      return left.bound === other.bound
    }

    case "flow": {
      const other = right as Extract<ResolvedAnnotation, { type: "flow" }>
      return left.bound === other.bound
    }

    case "none":
      return true
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

  const replayPrototypeMeta = (
    key: PropertyKey,
    prototype: object,
    meta: PrototypeAnnotationRecord,
  ) => {
    if (prototype === currentPrototype) {
      markCurrentPrototypeKey(key)
    }

    installAnnotatedProperty(
      admin,
      key,
      meta.descriptor,
      meta.annotation,
      getInstallTarget(target, prototype, ownPropertiesOnly),
      prototype,
    )
  }

  const rememberPrototypeMeta = (
    key: PropertyKey,
    prototype: object,
    meta: PrototypeAnnotationRecord,
  ) => {
    if (prototype === currentPrototype) {
      markCurrentPrototypeKey(key)
    }

    rememberAnnotatedPrototypeMeta(prototype, key, meta)
  }

  const processAutoDescriptor = (
    key: PropertyKey,
    descriptor: PropertyDescriptor,
    prototype: object | null,
  ) => {
    if (prototype !== null) {
      const existingMeta = annotatedPrototypes.get(prototype)?.get(key)
      if (existingMeta) {
        replayPrototypeMeta(key, prototype, existingMeta)
        return
      }
    } else if (admin.values.has(key)) {
      return
    }

    const annotation = inferAutoAnnotation(
      descriptor,
      prototype,
      explicitDefaultAnnotation,
      defaultAnnotation,
    )

    if (annotation === undefined) {
      return
    }

    const meta = processProperty(
      admin,
      key,
      descriptor,
      annotation,
      getInstallTarget(target, prototype, ownPropertiesOnly),
      prototype,
    )

    if (meta && prototype !== null) {
      rememberPrototypeMeta(key, prototype, meta)
    }
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
            replayPrototypeMeta(key, found.prototype, existingMeta)
            continue
          }

          if (existingMeta && canOverrideCurrentPrototypeMeta) {
            if (
              resolvedAnnotationsEqual(
                resolveAnnotation(
                  key,
                  existingMeta.descriptor,
                  existingMeta.annotation,
                ),
                resolveAnnotation(
                  key,
                  existingMeta.descriptor,
                  annotationValue as AnnotationValue,
                ),
              )
            ) {
              replayPrototypeMeta(key, found.prototype, existingMeta)
              continue
            }

            restoreAnnotatedPrototypeProperty(
              found.prototype,
              key,
              existingMeta,
            )
            descriptor = { ...existingMeta.descriptor }
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

            rememberPrototypeMeta(key, found.prototype, {
              descriptor: { ...descriptor },
              annotation: "none",
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
          found.prototype,
        )

        if (found.prototype !== null) {
          rememberPrototypeMeta(key, found.prototype, meta)
        }
      }
    }

    if (!options.explicitOnly) {
      const len = descriptors.length
      const deferredDescriptors: PropertyInfo[] = []

      for (let i = 0; i < len; i++) {
        const descriptorInfo = descriptors[i]
        const { key, prototype } = descriptorInfo

        if (explicitKeys.has(key) || admin.lockedKeys.has(key)) {
          continue
        }

        if (prototype !== null && prototype !== currentPrototype) {
          deferredDescriptors.push(descriptorInfo)
          continue
        }

        processAutoDescriptor(key, descriptorInfo.descriptor, prototype)
      }

      for (let i = 0; i < deferredDescriptors.length; i++) {
        const { key, descriptor, prototype } = deferredDescriptors[i]
        processAutoDescriptor(key, descriptor, prototype)
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
        const inferredAnnotation = inferAutoAnnotation(
          descriptor,
          null,
          options.defaultAnnotation,
          defaultAnnotation,
        )

        if (inferredAnnotation === undefined) {
          continue
        }

        if (inferredAnnotation === "none") {
          Object.defineProperty(target, key, descriptor)
          continue
        }

        processProperty(
          admin,
          key,
          descriptor,
          inferredAnnotation,
          target,
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

function processProperty(
  admin: ObservableObjectAdmin,
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  annotationValue: AnnotationValue,
  installTarget: object,
  prototype?: object | null,
): PrototypeAnnotationRecord {
  installAnnotatedProperty(
    admin,
    key,
    descriptor,
    annotationValue,
    installTarget,
    prototype,
  )

  return {
    descriptor: { ...descriptor },
    annotation: annotationValue,
  }
}

function resolveAnnotation(
  key: PropertyKey,
  descriptor: PropertyDescriptor,
  annotationValue: AnnotationValue,
): ResolvedAnnotation {
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
    case "observable.shallow": {
      if (descriptor.get) {
        throw new Error(
          `[@fobx/core] "${baseAnnotation}" cannot be used on getter/setter properties`,
        )
      }
      return {
        type: "data",
        annotation: baseAnnotation,
        equalityOptions,
      }
    }

    case "computed": {
      if (!descriptor.get) {
        throw new Error(
          `[@fobx/core] ${
            String(key)
          } must be a getter to use "computed" annotation`,
        )
      }
      return {
        type: "computed",
        equalityOptions,
      }
    }

    case "transaction":
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `[@fobx/core] ${
            String(key)
          } must be a function to use "transaction" annotation`,
        )
      }
      return { type: "action", bound: isBound }

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
      return { type: "flow", bound: isBound }

    case "none":
      return { type: "none" }

    default:
      throw new Error(`[@fobx/core] Unknown annotation: ${annotation}`)
  }
}

export function makeObservable<T extends object>(
  target: T,
  options?: MakeObservableOptions<T>,
): T {
  const annotations = options?.annotations ?? {} as AnnotationsMap<T>
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

    if (Array.isArray(target)) {
      return observableArray(target, options as ArrayOptions)
    }
    if (target instanceof Map) {
      return observableMap(target, options as MapOptions)
    }
    if (target instanceof Set) {
      return observableSet(target, options as SetOptions)
    }

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
