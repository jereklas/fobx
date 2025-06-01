import { $fobx, getGlobalState, type IFobxAdmin } from "../../state/global.ts"
import type { IObservable } from "../observableBox.ts"
import type { ComputedWithAdmin } from "../../reactions/computed.ts"
import type { ObservableBoxWithAdmin } from "../observableBox.ts"

const globalState = /* @__PURE__ */ getGlobalState()

/**
 * Helper function to define a property with getter/setter that accesses an observable value
 */
export const defineObservableProperty = (
  target: object,
  key: PropertyKey,
  box: IObservable,
  enumerable = true,
  configurable = true,
) => {
  Object.defineProperty(target, key, {
    get: () => box.value,
    set: (v) => {
      box.value = v
    },
    enumerable,
    configurable,
  })
}

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
 * Determine the appropriate annotation type for a property when none is specified
 */
export const inferAnnotationType = (desc: PropertyDescriptor): string => {
  if ("value" in desc) {
    if (typeof desc.value === "function") {
      return isFlow(desc.value) || isGenerator(desc.value) ? "flow" : "action"
    }
    return "observable"
  }
  return "computed"
}

/**
 * Adds administration object to an object to make it observable
 */
export function addObservableAdministration<T extends object>(
  obj: T,
  adminName: string = `ObservableObject@${globalState.getNextId()}`,
) {
  if (!Object.isExtensible(obj)) return

  const adm: IFobxAdmin & { values: Map<PropertyKey, IObservable> } = {
    name: adminName,
    values: new Map<PropertyKey, IObservable>(),
  }
  Object.defineProperty(obj, $fobx, { value: adm })
}

/**
 * Handle a property marked with "none" annotation or one that needs to be reset
 */
export const handleNoneOrResetAnnotation = (
  observableObject: object,
  key: PropertyKey,
  desc: PropertyDescriptor,
  admin: IFobxAdmin & { values: Map<PropertyKey, IObservable> },
  options: {
    addToPrototype: boolean
    proto: unknown
  },
): boolean => {
  const { addToPrototype, proto } = options

  const val = admin.values.get(key)
  if (val) {
    admin.values.delete(key)
    if ("dispose" in val) {
      const computed = val as ComputedWithAdmin
      computed.dispose()
      const { getter, setter } = computed[$fobx]
      Object.defineProperty(observableObject, key, {
        get: getter,
        set: setter,
        enumerable: true,
        configurable: true,
      })
    } else {
      const box = val as ObservableBoxWithAdmin
      Object.defineProperty(observableObject, key, {
        value: box[$fobx].value,
        enumerable: true,
        configurable: true,
      })
    }
  } else if (
    (typeof desc.value === "function" || isObject(desc.value)) &&
    $fobx in desc.value
  ) {
    if (isAction(desc.value) || isFlow(desc.value)) {
      Object.defineProperty(
        addToPrototype ? proto : observableObject,
        key,
        {
          value: Object.getPrototypeOf(desc.value),
          enumerable: true,
          configurable: false,
          writable: true,
        },
      )
      return true // Indicates we've handled this case and can break from the calling context
    }
    // deno-lint-ignore no-process-global
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `key: ${String(key)} was marked as "none" but is currently annotated`,
      )
    }
  } else if (!addToPrototype) {
    Object.defineProperty(observableObject, key, desc)
  }

  markPropertyAsAnnotated(key, addToPrototype ? proto : observableObject)

  return false
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

// Import these from other modules - will fix imports at the end
import { markPropertyAsAnnotated } from "./annotations.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isObject,
} from "../../utils/predicates.ts"
