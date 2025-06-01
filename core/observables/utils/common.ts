import type {
  Any,
  ComparisonType,
  EqualityChecker,
} from "../../state/global.ts"
import type { IFobxAdmin } from "../../state/global.ts"
import { type IObservable, observableBox } from "../observableBox.ts"
import { ObservableMap } from "../observableMap.ts"
import { ObservableSet } from "../observableSet.ts"
import { createObservableArray } from "../observableArray.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObject,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableSet,
  isSet,
} from "../../utils/predicates.ts"
import { createAutoObservableObject } from "../observableObject.ts"
import { action } from "../../transactions/action.ts"
import { flow } from "../../transactions/flow.ts"
import { createComputedValue } from "../../reactions/computed.ts"

/**
 * Store for tracking explicitly annotated properties
 */
export const explicitAnnotations = new WeakMap<Any, Set<PropertyKey>>()

/**
 * Gets all property descriptors for an object, including those from its prototype chain
 */
export const getPropertyDescriptors = <T extends object>(obj: T): Map<
  string,
  { owner: unknown; desc: PropertyDescriptor }
> => {
  let curr: object | null = obj
  const descriptorsByName = new Map<
    string,
    { owner: unknown; desc: PropertyDescriptor }
  >()

  do {
    Object.entries(Object.getOwnPropertyDescriptors(curr)).forEach(
      ([key, descriptor]) => {
        if (!descriptorsByName.has(key) && key !== "constructor") {
          descriptorsByName.set(key, { owner: curr, desc: descriptor })
        }
      },
    )
  } while ((curr = Object.getPrototypeOf(curr)) && curr !== Object.prototype)
  return descriptorsByName
}

/**
 * Helper to handle equality checking options properly
 */
export const createEqualityOptions = (
  equalityOption?: EqualityChecker | ComparisonType,
): { equals?: EqualityChecker; comparer?: ComparisonType } => {
  if (!equalityOption) return {}

  if (typeof equalityOption === "function") {
    return { equals: equalityOption as EqualityChecker }
  } else if (equalityOption === "structural" || equalityOption === "default") {
    return { comparer: equalityOption }
  }
  return {}
}

/**
 * Helper function for 'this' binding in methods
 */
export const preventGlobalThis = (
  that: unknown,
) => (that === globalThis ? undefined : that)

/**
 * Helper function for 'this' binding in methods
 */
export const identityFunction = (that: unknown) => that

/**
 * Creates an observable value box with the appropriate transformation based on value type
 * @param value The value to make observable
 * @param shallow When true, creates a shallow observable where only the top level properties are observed
 * @param equalityOptions Options for equality checking
 */
export const createObservable = (
  value: Any,
  shallow = false,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  // Handle collections (Array, Map, Set)
  if (Array.isArray(value)) {
    return createObservableCollection(
      value,
      isObservableArray,
      (v) => createObservableArray(v, { shallow }),
      equalityOptions,
    )
  } else if (isMap(value)) {
    return createObservableCollection(
      value,
      isObservableMap,
      (v) => new ObservableMap(v.entries(), { shallow }),
      equalityOptions,
    )
  } else if (isSet(value)) {
    return createObservableCollection(
      value,
      isObservableSet,
      (v) => new ObservableSet(v, { shallow }),
      equalityOptions,
    )
  } else if (isObject(value) && !isObservable(value) && !shallow) {
    // For deep observation, we need to recursively make objects observable
    const obj = createAutoObservableObject(value as object)
    return observableBox(obj, {
      valueTransform: (v) => {
        if (isObject(v) && !isObservable(v)) {
          return createAutoObservableObject(v as object)
        }
        return v
      },
      ...equalityOptions,
    })
  } else {
    // For non-collections or shallow objects, just use a regular observable box
    return observableBox(value, equalityOptions)
  }
}

/**
 * Helper function to create observable collections with consistent patterns
 */
const createObservableCollection = <T, O>(
  value: T,
  isObservableCheck: (val: Any) => boolean,
  createObservable: (val: Any) => O,
  equalityOptions: { equals?: EqualityChecker; comparer?: ComparisonType } = {},
): IObservable => {
  const collection = isObservableCheck(value) ? value : createObservable(value)

  return observableBox(collection, {
    valueTransform: (v) => {
      if (!isObservableCheck(v)) {
        return createObservable(v)
      }
      return v
    },
    ...equalityOptions,
  })
}

/**
 * Determines the type of an object for error messages
 */
export const getType = (obj: unknown): string => {
  if (typeof obj === "object") {
    if (obj === null) return "null"
    if (Array.isArray(obj)) return "array"
    if (isMap(obj)) return "map"
    if (isSet(obj)) return "set"
    return "object"
  }
  return typeof obj
}

/**
 * Common annotation handling function that processes different annotation types
 * Extracted from the duplicate logic in observableObject.ts and makeObservable.ts
 */
export const annotateProperty = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  annotation: string,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    addToPrototype: boolean
    proto: unknown
    shallow?: boolean
    equalityOptions?: { equals?: EqualityChecker; comparer?: ComparisonType }
    skipIfAlreadyAnnotated?: boolean
  },
) => {
  const { addToPrototype, proto, equalityOptions = {} } = options
  const shallow = options.shallow ?? false

  // Skip if already annotated (if needed)
  if (options.skipIfAlreadyAnnotated) {
    if (
      explicitAnnotations.get(options.addToPrototype ? proto : observableObject)
        ?.has(key)
    ) {
      return
    }
    // Skip if already in the admin values
    if (admin.values.has(key)) {
      return
    }
  }

  switch (annotation) {
    case "observable":
    case "observable.shallow": {
      if (desc.get || desc.set) {
        throw new Error(
          `[@fobx/core] "${annotation}" cannot be used on getter/setter properties`,
        )
      }

      const value = (desc as Any).value
      // Use either the explicit shallow from annotation or the passed option
      const isShallow = annotation === "observable.shallow" || shallow

      // Create observable using our unified function
      const box = createObservable(value, isShallow, equalityOptions)

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
          `[@fobx/core] "${
            String(key)
          }" property was marked as computed but object has no getter.`,
        )
      }

      const computed = createComputedValue(desc.get, desc.set, {
        thisArg: observableObject,
        ...equalityOptions,
      })

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
          `[@fobx/core] "${
            String(key)
          }" was marked as an action but it is not a function.`,
        )
      }

      // Skip if already an action
      if (addToPrototype && isAction(desc.value)) break

      Object.defineProperty(addToPrototype ? proto : observableObject, key, {
        value: action(desc.value, {
          name: String(key),
          getThis: annotation === "action.bound"
            ? () => observableObject
            : addToPrototype
            ? preventGlobalThis
            : identityFunction,
        }),
        enumerable: true,
        configurable: false,
        writable: true,
      })
      break
    }
    case "flow":
    case "flow.bound": {
      if (desc.value === undefined || !isGenerator(desc.value)) {
        throw new Error(
          `[@fobx/core] "${
            String(key)
          }" was marked as a flow but is not a generator function.`,
        )
      }

      // Skip if already a flow
      if (addToPrototype && isFlow(desc.value)) break

      Object.defineProperty(addToPrototype ? proto : observableObject, key, {
        value: flow(desc.value, {
          name: String(key),
          getThis: annotation === "flow.bound"
            ? () => observableObject
            : addToPrototype
            ? preventGlobalThis
            : identityFunction,
        }),
        enumerable: true,
        configurable: false,
        writable: true,
      })
      break
    }
    default: {
      if (annotation !== "none") {
        throw Error(`[@fobx/core] "${annotation}" is not a valid annotation.`)
      }
    }
  }

  // Track explicitly annotated properties
  const target = addToPrototype ? proto : observableObject
  let annotations = explicitAnnotations.get(target)
  if (!annotations) {
    annotations = new Set<PropertyKey>([key])
    explicitAnnotations.set(target, annotations)
  } else {
    annotations.add(key)
  }
}
