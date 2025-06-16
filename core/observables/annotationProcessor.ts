import {
  $fobx,
  type Any,
  type ComparisonType,
  type EqualityChecker,
} from "../state/global.ts"
import {
  isAction,
  isFlow,
  isGenerator,
  isMap,
  isObject,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  isPlainObject,
  isSet,
} from "../utils/predicates.ts"
import {
  type AnnotationConfig,
  type AnnotationsMap,
  type BaseAnnotation,
  createAutoObservableObject,
  type IObservableObjectAdmin,
  type ObservableObject,
} from "./observableObject.ts"
import { ObservableMap } from "./observableMap.ts"
import { ObservableSet } from "./observableSet.ts"
import { type IObservable, observableBox } from "./observableBox.ts"
import { action } from "../transactions/action.ts"
import { flow } from "../transactions/flow.ts"

import {
  getPropertyDescriptions,
  identityFunction,
  preventGlobalThis,
} from "./helpers.ts"
import { createObservableArray } from "./observableArray.ts"
import { createComputedValue } from "../reactions/computed.ts"
import { isObservable } from "../core.ts"

const annotatedPrototypes = new WeakMap<Any, Set<string>>()

type AnnotationHandler = (
  options: {
    key: string
    descriptor: PropertyDescriptor
    source: object
    target: ObservableObject
    prototype: object | null
    annotation: ParsedAnnotation
  },
) => void

/**
 * Annotates a target (observable) object with properties from a source object based on a set of annotations.
 * @param source The source object to copy properties from.
 * @param target The target object to annotate.
 * @param annotations A map of annotations to apply.
 * @param options Options for the annotation process.
 */
export function annotateObject(
  source: Any,
  target: ObservableObject,
  annotations: AnnotationsMap<Any, Any>,
  options: {
    shallowRef?: boolean
    inferAnnotations: boolean
  },
) {
  // Remove prototype chain from annotations so Object prototype properties aren't problematic
  annotations = Object.create(
    null,
    Object.getOwnPropertyDescriptors(annotations),
  )
  const mode = options.inferAnnotations ? "implicit" : "explicit"
  const objectType = isPlainObject(source) ? "plain" : "class"

  let inheritanceLevel: number | undefined = undefined

  // process the descriptors based on inheritance depth
  getPropertyDescriptions(source, objectType).sort((a, b) => b.level - a.level)
    .forEach(
      ({ key, prototype, level, descriptor }) => {
        let annotatedProps = annotatedPrototypes.get(prototype)
        if (annotatedProps?.has(key)) {
          return
        }

        // This inheritanceLevel is used to track which prototype constructor we're in
        if (inheritanceLevel === undefined) {
          inheritanceLevel = level
        }
        if (prototype && !annotatedProps) {
          annotatedProps = new Set<string>()
          annotatedPrototypes.set(prototype, annotatedProps)
        }

        const annotation = parseAnnotation(annotations, key, {
          shallowRef: options.shallowRef,
          mode,
          descriptor,
        })

        const handler = annotationHandlers[annotation.type]
        if (!handler) {
          throw new Error(
            `[@fobx/core] "${annotation.type}" is not a valid annotation.`,
          )
        }

        if (level === inheritanceLevel) {
          // If we're in the constructor where annotations are defined and a user explicitly annotated, or if
          // it's an implicit annotation for a prototype function mark the property as annotated
          if (
            annotation.userDefined ||
            (descriptor.value && typeof descriptor.value === "function")
          ) {
            annotatedProps?.add(key)
          }
          handler({ key, descriptor, source, target, prototype, annotation })
        } else if (level === 0 && !annotatedProps?.has(key)) {
          handler({ key, descriptor, source, target, prototype, annotation })
        }
      },
    )
}

/**
 * Helper function to validate the function type for action/flow annotations
 */
export const validateFunctionType = (
  value: Any,
  key: PropertyKey,
  isFlow: boolean,
): void => {
  if (value === undefined) {
    throw new Error(
      `[@fobx/core] "${String(key)}" was marked as ${
        isFlow ? "a flow" : "an action"
      } but is not a ${isFlow ? "generator " : ""}function.`,
    )
  }

  const isValid = isFlow ? isGenerator(value) : typeof value === "function"
  if (!isValid) {
    throw new Error(
      `[@fobx/core] "${String(key)}" was marked as ${
        isFlow ? "a flow" : "an action"
      } but is not a ${isFlow ? "generator " : ""}function.`,
    )
  }
}

const noneAnnotationHandler: AnnotationHandler = (options) => {
  const { target, key, prototype, descriptor } = options

  // Otherwise, we need to add the property to the target object
  Object.defineProperty(prototype || target, key, descriptor)
}

const observableAnnotationHandler: AnnotationHandler = (options) => {
  const { target, key, descriptor } = options
  if (isObservable(target, key)) return
  if (descriptor.get || descriptor.set) {
    throw new Error(
      `[@fobx/core] "observable${
        options.annotation.variant ? `.${options.annotation.variant}` : ""
      }" cannot be used on getter/setter properties`,
    )
  }

  const { variant, comparer, equals } = options.annotation
  const equalityOptions = {
    comparer,
    equals,
  }

  const admin = target[$fobx] as IObservableObjectAdmin
  const { value } = descriptor

  let box: IObservable
  if (variant === "ref") {
    box = observableBox(value, equalityOptions)
  } else {
    const shallow = variant === "shallow"

    const valueTransform = (v: Any) => {
      if (Array.isArray(v)) {
        return isObservableArray(v) ? v : createObservableArray(v, { shallow })
      } else if (isMap(v)) {
        return isObservableMap(v)
          ? v
          : new ObservableMap(v.entries(), { shallow })
      } else if (isSet(v)) {
        return isObservableSet(v) ? v : new ObservableSet(v, { shallow })
      } else if (isObject(v)) {
        return isObservableObject(v) || isObservable(v)
          ? v
          : createAutoObservableObject(v, {}, { shallowRef: shallow })
      } else {
        return v
      }
    }

    box = observableBox(
      shallow && isObject(value) && !Array.isArray(value) && !isMap(value) &&
        !isSet(value)
        ? value
        : valueTransform(value),
      {
        valueTransform,
        ...equalityOptions,
      },
    )
  }

  admin.values.set(key, box)
  Object.defineProperty(target, key, {
    get: () => box.value,
    set: (v) => {
      box.value = v
    },
    enumerable: true,
    configurable: true,
  })
}

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

const computedAnnotationHandler: AnnotationHandler = (options) => {
  const { target, key, descriptor } = options
  if (isObservable(target, key)) return
  if (!descriptor || !descriptor.get) {
    throw new Error(
      `[@fobx/core] "${
        String(key)
      }" property was marked as computed but object has no getter.`,
    )
  }

  const { comparer, equals } = options.annotation
  const computed = createComputedValue(descriptor.get, descriptor.set, {
    thisArg: target,
    comparer,
    equals,
  })

  const admin = target[$fobx] as IObservableObjectAdmin
  admin.values.set(key, computed)
  // TODO: handle prototype case?
  Object.defineProperty(target, key, {
    get: () => computed.value,
    set: (v) => computed.value = v,
    enumerable: true,
    configurable: true,
  })
}

const actionFlowAnnotationHandler: AnnotationHandler = (options) => {
  const { target, key, descriptor, annotation, prototype } = options
  validateFunctionType(descriptor.value, key, annotation.type === "flow")

  const isWrapped = isFlow(descriptor.value) || isAction(descriptor.value)

  let wrappedFn: Any
  if (isWrapped) {
    wrappedFn = descriptor.value
  } else {
    const fn = annotation.type === "flow" ? flow : action
    // @ts-expect-error: TypeScript doesn't recognize the overloads correctly
    wrappedFn = fn(descriptor.value, {
      name: String(key),
      getThis: annotation.variant === "bound"
        ? () => target
        : prototype
        ? preventGlobalThis
        : identityFunction,
    })
  }

  Object.defineProperty(prototype || target, key, {
    value: wrappedFn,
    enumerable: true,
    configurable: false,
    writable: true,
  })
}

const annotationHandlers: Record<BaseAnnotation, AnnotationHandler> = {
  "none": noneAnnotationHandler,
  "action": actionFlowAnnotationHandler,
  "computed": computedAnnotationHandler,
  "observable": observableAnnotationHandler,
  "flow": actionFlowAnnotationHandler,
}

type ParsedAnnotation = {
  type: BaseAnnotation
  userDefined: boolean
  variant?: "bound" | "shallow" | "ref"
  comparer?: ComparisonType
  equals?: EqualityChecker
}

function parseAnnotation(
  annotations: AnnotationsMap<Any, Any>,
  key: string,
  options: {
    shallowRef: boolean | undefined
    descriptor: PropertyDescriptor
    mode: "implicit" | "explicit"
  },
): ParsedAnnotation {
  const { descriptor, mode } = options
  let annotation = annotations[key] as AnnotationConfig | undefined
  const userDefined = !!annotation
  if (!annotation && mode === "explicit") return { type: "none", userDefined }

  if (!annotation && mode === "implicit") {
    annotation = inferAnnotation(descriptor)
  }

  const parseType = (annotationType: string = "") => {
    let [type, variant] = annotationType.split(".")

    // if an object was created with options shallowRef: true, mark every observable
    // as ref unless the user had explicitly specified a different variant
    if (!variant && type === "observable" && options.shallowRef) {
      variant = "ref"
    }
    return [type, variant] as [
      BaseAnnotation,
      "bound" | "shallow" | "ref" | undefined,
    ]
  }

  if (Array.isArray(annotation)) {
    const [type, variant] = parseType(annotation[0])
    if (typeof annotation[1] === "function") {
      return { type, variant, equals: annotation[1], userDefined }
    } else {
      return { type, variant, comparer: annotation[1], userDefined }
    }
  } else {
    const [type, variant] = parseType(annotation)
    return { type, variant, userDefined }
  }
}

function inferAnnotation(descriptor: PropertyDescriptor) {
  if ("value" in descriptor) {
    if (typeof descriptor.value === "function") {
      return isFlow(descriptor.value) || isGenerator(descriptor.value)
        ? "flow"
        : "action"
    }
    return "observable"
  }
  return "computed"
}
