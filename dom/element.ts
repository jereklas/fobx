/**
 * Core element factory — creates a real DOM element with reactive bindings.
 */

import type { Children, Props } from "./types.ts"
import { recreateChildren, registerRecreateFactory } from "./recreate.ts"
import {
  appendChildNode,
  bindAttribute,
  onDispose,
  setAttribute,
} from "./reactive.ts"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const SVG_TAGS = new Set([
  "a",
  "animate",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "set",
  "stop",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "title",
  "tspan",
  "use",
  "view",
])

/**
 * Create a DOM element with props and children.
 *
 * - Props whose values are functions are treated as reactive expressions and
 *   are bound through fine-grained reactive effects (except event handlers).
 * - Children that are functions are treated as reactive children.
 * - Event handlers (props starting with "on") are attached once and are not
 *   rebound reactively. Render a new element if the handler itself must change.
 *
 * @param tag - The HTML tag name (e.g. "div", "span").
 * @param props - Attributes, event handlers, reactive bindings.
 * @param children - Child nodes, strings, or reactive functions.
 * @returns The created HTMLElement with all bindings attached.
 */
export function el(
  tag: string,
  props?: Props | null,
  ...children: Children[]
): HTMLElement {
  const element = createElementForTag(tag)

  // ── Props ────────────────────────────────────────────────────────────────
  if (props) {
    const keys = Object.keys(props)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = props[key]

      // Skip internal props
      if (key === "ref") continue

      const eventBinding = getEventBinding(key, value)
      if (eventBinding) {
        element.addEventListener(
          eventBinding.eventName,
          eventBinding.listener,
          eventBinding.options,
        )
        onDispose(element, () => {
          element.removeEventListener(
            eventBinding.eventName,
            eventBinding.listener,
            eventBinding.options,
          )
        })
        continue
      }

      // Reactive prop (function)
      if (typeof value === "function") {
        bindAttribute(element, key, value as () => unknown)
        continue
      }

      // Static prop
      setAttribute(element, key, value)
    }
  }

  // ── Children ─────────────────────────────────────────────────────────────
  for (let i = 0; i < children.length; i++) {
    appendChildNode(element, children[i])
  }

  if (props?.ref) {
    props.ref(element)
  }

  return registerRecreateFactory(
    element,
    () => el(tag, props ?? null, ...recreateChildren(children)),
  )
}

function createElementForTag(tag: string): HTMLElement {
  if (SVG_TAGS.has(tag)) {
    return document.createElementNS(
      SVG_NAMESPACE,
      tag,
    ) as unknown as HTMLElement
  }

  return document.createElement(tag)
}

interface EventBinding {
  eventName: string
  listener: EventListenerOrEventListenerObject
  options?: AddEventListenerOptions | boolean
}

function getEventBinding(key: string, value: unknown): EventBinding | null {
  if (key.startsWith("on:")) {
    return createEventBinding(key.slice(3), value)
  }

  if (
    key.length > 2 && key[0] === "o" && key[1] === "n" &&
    key.charCodeAt(2) >= 65 && key.charCodeAt(2) <= 90
  ) {
    return createEventBinding(key.slice(2).toLowerCase(), value)
  }

  return null
}

function createEventBinding(
  eventName: string,
  value: unknown,
): EventBinding | null {
  if (value == null || value === false) return null

  if (Array.isArray(value)) {
    const [handler, data] = value
    if (typeof handler !== "function") return null

    const listener: EventListener = (event) => {
      // Tuple form: the bound data is passed first, then the event.
      handler(data, event)
    }
    return { eventName, listener }
  }

  if (typeof value === "function") {
    return { eventName, listener: value as EventListener }
  }

  if (isEventListenerObject(value)) {
    const options = getListenerOptions(value)
    return {
      eventName,
      listener: value,
      options,
    }
  }

  return null
}

function getListenerOptions(
  value: Record<string, unknown>,
): AddEventListenerOptions | undefined {
  let hasOptions = false
  const options: AddEventListenerOptions = {}

  if ("capture" in value) {
    options.capture = Boolean(value.capture)
    hasOptions = true
  }
  if ("once" in value) {
    options.once = Boolean(value.once)
    hasOptions = true
  }
  if ("passive" in value) {
    options.passive = Boolean(value.passive)
    hasOptions = true
  }
  if ("signal" in value && value.signal instanceof AbortSignal) {
    options.signal = value.signal
    hasOptions = true
  }

  return hasOptions ? options : undefined
}

function isEventListenerObject(
  value: unknown,
): value is EventListenerObject & Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    typeof (value as EventListenerObject).handleEvent === "function"
}
