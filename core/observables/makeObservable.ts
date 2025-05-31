import { ObservableSet } from "./observableSet.ts"
import { ObservableMap } from "./observableMap.ts"
import { createObservableArray } from "./observableArray.ts"
import {
  $fobx,
  type Any,
  type ComparisonType,
  type EqualityChecker,
} from "../state/global.ts"
import { type IObservable, observableBox } from "./observableBox.ts"
import {
  type ComputedOptions,
  createComputedValue,
} from "../reactions/computed.ts"
import { action } from "../transactions/action.ts"
import { flow } from "../transactions/flow.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  isPlainObject,
  isSet,
} from "../utils/predicates.ts"
import {
  addObservableAdministration,
  type Annotation,
  type IObservableObjectAdmin,
} from "./observableObject.ts"
import {
  createEqualityOptions,
  createObservableValue,
  getPropertyDescriptors,
  getType,
  identityFunction,
  preventGlobalThis,
} from "./utils/common.ts"

// Explicit annotations extend the existing annotations
export type ExplicitAnnotation = Omit<Annotation, "none"> | "observable.shallow"

export type ExplicitAnnotationConfig =
  | ExplicitAnnotation
  | [ExplicitAnnotation, EqualityChecker | ComparisonType]

export type ExplicitAnnotationMap<T extends object> = {
  [K in keyof T]?: ExplicitAnnotationConfig
}

const explicitAnnotations = new WeakMap<Any, Set<PropertyKey>>()

/**
 * makeObservable creates an observable object with explicit annotations for each property.
 * Unlike createAutoObservableObject, properties are shallow by default and need to be explicitly
 * marked as deep using "observable.deep" annotation.
 *
 * @param source The object to make observable
 * @param annotations Map of property names to annotations
 * @returns The observable object
 */
export function makeObservable<T extends object>(
  source: T,
  annotations: ExplicitAnnotationMap<T>,
): T {
  const type = getType(source)
  if (type !== "object") {
    throw new Error(
      `[@fobx/core] Cannot make an observable object out of type "${type}"`,
    )
  }
  const isPlainObj = isPlainObject(source)

  if (isPlainObj && isObservableObject(source)) {
    return source
  }

  // Create or get the observable object
  const observableObject = isObservableObject(source)
    ? source
    : (isPlainObj ? {} : source)
  if (!isObservableObject(observableObject)) {
    addObservableAdministration(observableObject)
  }

  annotateExplicitObject(observableObject, source, {
    addToPrototype: !isPlainObj,
    annotations,
  })

  return observableObject as T
}

/**
 * Creates an appropriate observable box for a collection type with shallow flag
 */
const createShallowObservableCollection = (
  value: Any,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  if (Array.isArray(value)) {
    const array = isObservableArray(value)
      ? value
      : createObservableArray(value, { shallow: true })
    return observableBox(array, {
      valueTransform: (v) => {
        if (!isObservableArray(v)) {
          return createObservableArray(v, { shallow: true })
        }
        return v
      },
      ...equalityOptions,
    })
  } else if (isMap(value)) {
    const map = isObservableMap(value)
      ? value
      : new ObservableMap(value.entries(), { shallow: true })
    return observableBox(map, {
      valueTransform: (v) => {
        if (!isObservableMap(v)) {
          return new ObservableMap(v.entries(), { shallow: true })
        }
        return v
      },
      ...equalityOptions,
    })
  } else if (isSet(value)) {
    const set = isObservableSet(value)
      ? value
      : new ObservableSet(value, { shallow: true })
    return observableBox(set, {
      valueTransform: (v) => {
        if (!isObservableSet(v)) {
          return new ObservableSet(v, { shallow: true })
        }
        return v
      },
      ...equalityOptions,
    })
  } else {
    // For non-collections, just use a regular observable box
    return observableBox(value, equalityOptions)
  }
}

const annotateExplicitObject = <T extends object, E extends object>(
  observableObject: T,
  source: E,
  options: {
    addToPrototype: boolean
    annotations: ExplicitAnnotationMap<E>
  },
): void => {
  if (!isObservableObject(observableObject)) {
    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[@fobx/core] Attempted to make a non-extensible object observable, which is not possible.",
        observableObject,
      )
    }
    return
  }

  const { addToPrototype } = options
  const admin = (observableObject as Any)[$fobx] as IObservableObjectAdmin
  const annotatedKeys = admin.values

  getPropertyDescriptors(source).forEach(
    (value: { owner: unknown; desc: PropertyDescriptor }, key: string) => {
      const { desc, owner: proto } = value

      // Skip properties that don't exist in the annotations map
      const annotationConfig =
        options.annotations[key as keyof typeof options.annotations]
      if (!annotationConfig) return

      // Parse annotation config to get annotation and equality options
      let annotation: ExplicitAnnotation
      let equalityOption: EqualityChecker | ComparisonType | undefined

      if (Array.isArray(annotationConfig)) {
        ;[annotation, equalityOption] = annotationConfig
      } else {
        annotation = annotationConfig
      }

      const equalityOptions = createEqualityOptions(equalityOption)
      const isExplicitlyAnnotated = true

      switch (annotation) {
        case "observable":
        case "observable.shallow": {
          if (desc.get || desc.set) {
            throw new Error(
              `[@fobx/core] "${annotation}" cannot be used on getter/setter properties`,
            )
          }
          if (explicitAnnotations.get(observableObject)?.has(key) === true) {
            break
          }
          if (annotatedKeys.has(key)) break

          const value = source[key as keyof typeof source]
          const isShallow = annotation === "observable.shallow"

          // Handle shallow collections differently
          const box =
            isShallow && (Array.isArray(value) || isMap(value) || isSet(value))
              ? createShallowObservableCollection(value, equalityOptions)
              : createObservableValue(value, isShallow, equalityOptions)

          admin.values.set(key, box)
          Object.defineProperty(observableObject, key, {
            get: () => box.value,
            set: (v) => {
              box.value = v
            },
            enumerable: true,
            configurable: true,
          })
          break
        }
        case "computed": {
          if (!desc || !desc.get) {
            throw new Error(
              `[@fobx/core] "${key}" property was marked as computed but object has no getter.`,
            )
          }
          if (explicitAnnotations.get(observableObject)?.has(key) === true) {
            break
          }
          if (annotatedKeys.has(key)) break

          const computedOptions: ComputedOptions = {
            thisArg: observableObject,
            ...equalityOptions,
          }

          const computed = createComputedValue(
            desc.get,
            desc.set,
            computedOptions,
          )
          admin.values.set(key, computed)
          Object.defineProperty(observableObject, key, {
            get: () => computed.value,
            set: (v) => {
              computed.value = v
            },
            enumerable: true,
            configurable: true,
          })
          break
        }
        case "action":
        case "action.bound": {
          if (desc.value === undefined || typeof desc.value !== "function") {
            throw new Error(
              `[@fobx/core] "${key}" was marked as an action but it is not a function.`,
            )
          }
          // someone used action() directly and assigned it as a instance member of class
          if (addToPrototype && isAction(desc.value)) break
          if (
            explicitAnnotations.get(addToPrototype ? proto : observableObject)
              ?.has(key) === true
          ) break

          Object.defineProperty(
            addToPrototype ? proto : observableObject,
            key,
            {
              value: action(desc.value, {
                name: key,
                getThis: annotation === "action.bound"
                  ? () => observableObject
                  : addToPrototype
                  ? preventGlobalThis
                  : identityFunction,
              }),
              enumerable: true,
              configurable: false,
              writable: true,
            },
          )
          break
        }
        case "flow":
        case "flow.bound": {
          if (desc.value === undefined || !isGenerator(desc.value)) {
            throw new Error(
              `[@fobx/core] "${key}" was marked as a flow but is not a generator function.`,
            )
          }
          if (
            explicitAnnotations.get(addToPrototype ? proto : observableObject)
              ?.has(key) === true
          ) break
          // someone used flow() directly and assigned it as a instance member of class
          if (addToPrototype && isFlow(desc.value)) break

          Object.defineProperty(
            addToPrototype ? proto : observableObject,
            key,
            {
              value: flow(desc.value, {
                name: key,
                getThis: annotation === "flow.bound"
                  ? () => observableObject
                  : addToPrototype
                  ? preventGlobalThis
                  : identityFunction,
              }),
              enumerable: true,
              configurable: false,
              writable: true,
            },
          )
          break
        }
        default: {
          throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`)
        }
      }

      if (isExplicitlyAnnotated) {
        const p = explicitAnnotations.get(proto)
        if (!p) {
          explicitAnnotations.set(proto, new Set([key]))
        } else {
          p.add(key)
        }
      }
    },
  )
}
