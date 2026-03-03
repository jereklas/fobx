// deno-lint-ignore-file no-explicit-any
/**
 * Core element factory — creates a real DOM element with reactive bindings.
 */

import type { Children, Props } from "./types.ts"
import {
  appendChildNode,
  bindAttribute,
  onDispose,
  setAttribute,
} from "./reactive.ts"

/**
 * Create a DOM element with props and children.
 *
 * - Props whose values are functions are treated as reactive expressions
 *   and are wrapped in autoruns (except event handlers).
 * - Children that are functions are treated as reactive children.
 * - Event handlers (props starting with "on") are attached directly.
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
  const element = document.createElement(tag)

  // ── Props ────────────────────────────────────────────────────────────────
  if (props) {
    const keys = Object.keys(props)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = props[key]

      // Skip internal props
      if (key === "ref") continue

      // Event handlers: onXxx
      if (
        key.length > 2 && key[0] === "o" && key[1] === "n" &&
        key.charCodeAt(2) >= 65 && key.charCodeAt(2) <= 90
      ) {
        const eventName = key.slice(2).toLowerCase()
        element.addEventListener(eventName, value)
        // Store for cleanup
        onDispose(element, () => element.removeEventListener(eventName, value))
        continue
      }

      // Reactive prop (function)
      if (typeof value === "function") {
        bindAttribute(element, key, value)
        continue
      }

      // Static prop
      setAttribute(element, key, value)
    }

    // Ref callback — called with the element
    if (props.ref) {
      props.ref(element)
    }
  }

  // ── Children ─────────────────────────────────────────────────────────────
  for (let i = 0; i < children.length; i++) {
    appendChildNode(element, children[i])
  }

  return element
}
