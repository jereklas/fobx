/**
 * DOM test environment setup using happy-dom.
 * Call `setupDom()` at the top of each test file to initialize the DOM.
 */

// @ts-ignore - npm import
import { Window } from "npm:happy-dom"

// Keys that React needs from the browser environment.
// We copy these from happy-dom's Window into globalThis.
// Note: we intentionally skip event-related globals (Event, CustomEvent, etc.)
// since Deno already provides those natively — overwriting them causes errors
// in Deno's own cleanup phase (dispatchBeforeUnloadEvent).
const DOM_GLOBALS_NEEDED = [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "self",
  "HTMLElement",
  "SVGElement",
  "Element",
  "Node",
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "Text",
  "Comment",
  "DocumentFragment",
  "CSSStyleSheet",
  "ShadowRoot",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
]

// Globals that should NOT be removed on cleanup.
// Keep Node/Element etc. because child test files might need them,
// and keep event globals because Deno's cleanup uses them.
const KEEP_ON_CLEANUP = new Set([
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "HTMLElement",
  "SVGElement",
  "Element",
  "Node",
  "Text",
  "Comment",
  "DocumentFragment",
])

let happyWindow: InstanceType<typeof Window> | null = null

export function setupDom(): { cleanup: () => void } {
  happyWindow = new Window({
    url: "http://localhost/",
  }) as unknown as InstanceType<typeof Window>

  // Copy happy-dom's globals to globalThis so React/ReactDOM can find them
  // deno-lint-ignore no-explicit-any
  const w = happyWindow as any
  for (const key of DOM_GLOBALS_NEEDED) {
    if (w[key] !== undefined) {
      try {
        // deno-lint-ignore no-explicit-any
        ;(globalThis as any)[key] = w[key]
      } catch {
        // Some globals may not be overridable — ignore
      }
    }
  }

  return {
    cleanup: () => {
      // deno-lint-ignore no-explicit-any
      const g = globalThis as any
      for (const key of DOM_GLOBALS_NEEDED) {
        if (KEEP_ON_CLEANUP.has(key)) continue // keep; Deno cleanup needs these
        try {
          delete g[key]
        } catch {
          // ignore non-configurable globals
        }
      }
      happyWindow = null
    },
  }
}
