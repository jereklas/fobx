// deno-lint-ignore-file no-explicit-any
/**
 * Reactive binding utilities — the core engine of @fobx/dom.
 *
 * Attaches autoruns to DOM elements so reactive expressions (functions)
 * are automatically tracked and their DOM side-effects are surgically updated.
 *
 * ## Disposal Model
 *
 * Two complementary mechanisms exist:
 *
 * 1. **Node-based (`onDispose` / `dispose`)** — attaches disposers to DOM
 *    nodes via a WeakMap.  `dispose(node)` recursively walks descendants.
 *    This is the general-purpose approach used by standalone elements.
 *
 * 2. **Scope-based (`createScope` / `onCleanup`)** — collects all disposers
 *    created during a factory function into a flat array.  No tree walk
 *    needed; just iterate and call.  Used by `mountList` for O(1)-per-entry
 *    teardown instead of a recursive DOM walk.
 *
 * When a scope is active (`_currentScope !== null`), helpers like
 * `bindAttribute`, event-handler registration, and `mountReactiveChild`
 * push their disposers into the scope **instead of** the node WeakMap.
 * This avoids both the WeakMap overhead and the recursive walk.
 */

import { autorun, effect } from "../v2/index.ts"
import type { Dispose } from "../v2/global.ts"
import { setActiveScope } from "../v2/global.ts"

// ─── Disposal Scope ──────────────────────────────────────────────────────────

let _currentScope: Dispose[] | null = null

/**
 * Run `fn` inside a disposal scope.  Every `onDispose` / `onCleanup` call
 * made during `fn` (including nested element creation) is collected into a
 * flat array.  Returns `[result, disposeFn]`.
 *
 * The returned `disposeFn` calls every collected disposer in order, then
 * clears the list.  This is far cheaper than a recursive DOM tree walk.
 */
export function createScope<T>(fn: () => T): [T, Dispose] {
  const scope: Dispose[] = []
  const prev = _currentScope
  _currentScope = scope
  try {
    const result = fn()
    return [result, () => {
      for (let i = 0; i < scope.length; i++) scope[i]()
      scope.length = 0
    }]
  } finally {
    _currentScope = prev
  }
}

/**
 * Low-level scope management for performance-critical paths.
 * Sets a new scope as active and returns the previous one.
 * Must be paired with `exitScope(prev)`.
 */
export function enterScope(scope: Dispose[]): Dispose[] | null {
  const prev = _currentScope
  _currentScope = scope
  setActiveScope(scope)
  return prev
}

/**
 * Restore the scope saved by `enterScope`.
 */
export function exitScope(prev: Dispose[] | null): void {
  _currentScope = prev
  setActiveScope(prev)
}

/**
 * Register a disposer with the current scope (if any).
 * Returns `true` if a scope captured this disposer, `false` otherwise.
 */
export function onCleanup(disposer: Dispose): boolean {
  if (_currentScope) {
    _currentScope.push(disposer)
    return true
  }
  return false
}

// ─── Disposer Storage ────────────────────────────────────────────────────────

const _disposers = new WeakMap<Node, Dispose[]>()

/** Get or create the disposer list for a node. */
function getDisposers(node: Node): Dispose[] {
  let list = _disposers.get(node)
  if (!list) {
    list = []
    _disposers.set(node, list)
  }
  return list
}

/**
 * Attach a disposer to a node (cleaned up when `dispose(node)` is called).
 *
 * If a disposal scope is active, the disposer is pushed into the scope
 * instead of the node's WeakMap list (scope-based disposal is preferred
 * when available because it avoids recursive tree walks).
 */
export function onDispose(node: Node, disposer: Dispose): void {
  if (!onCleanup(disposer)) {
    getDisposers(node).push(disposer)
  }
}

/**
 * Dispose all reactive bindings on a node and its descendants.
 * Call this when removing elements from the DOM to prevent leaks.
 *
 * NOTE: When a disposal scope is used (e.g. inside `mountList`), nodes
 * will have no entries in the WeakMap — the scope owns the disposers.
 * This function still works as a fallback for non-scoped usage.
 */
export function dispose(node: Node): void {
  const list = _disposers.get(node)
  if (list) {
    for (let i = 0; i < list.length; i++) list[i]()
    list.length = 0
    _disposers.delete(node)
  }
  // Recurse into children
  let child = node.firstChild
  while (child) {
    dispose(child)
    child = child.nextSibling
  }
}

// ─── Reactive Attribute Binding ──────────────────────────────────────────────

/**
 * Bind a reactive function to an element attribute.
 * Sets up an autorun that updates the attribute whenever dependencies change.
 */
export function bindAttribute(
  el: HTMLElement,
  key: string,
  fn: () => any,
): void {
  const d = effect(() => {
    setAttribute(el, key, fn())
  })
  onDispose(el, d)
}

/**
 * Set an attribute/property on an element (static, non-reactive).
 */
export function setAttribute(el: HTMLElement, key: string, value: any): void {
  if (key === "class" || key === "className") {
    el.className = value ?? ""
  } else if (key === "style") {
    if (typeof value === "string") {
      el.style.cssText = value
    } else if (value && typeof value === "object") {
      setStyleObject(el, value)
    }
  } else if (key === "value" && "value" in el) {
    ;(el as any).value = value
  } else if (key === "checked" && "checked" in el) {
    ;(el as any).checked = value
  } else if (key === "disabled" && "disabled" in el) {
    ;(el as any).disabled = value
  } else if (key === "selected" && "selected" in el) {
    ;(el as any).selected = value
  } else if (key === "htmlFor") {
    el.setAttribute("for", value)
  } else if (key === "innerHTML") {
    el.innerHTML = value
  } else if (key === "textContent") {
    el.textContent = value
  } else if (value === false || value == null) {
    el.removeAttribute(key)
  } else if (value === true) {
    el.setAttribute(key, "")
  } else {
    el.setAttribute(key, String(value))
  }
}

function setStyleObject(el: HTMLElement, styles: Record<string, any>): void {
  // Reset inline styles, then apply the object
  el.style.cssText = ""
  for (const k of Object.keys(styles)) {
    const prop = k.includes("-")
      ? k
      : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    el.style.setProperty(prop, String(styles[k]))
  }
}

// ─── Reactive Children ───────────────────────────────────────────────────────

/**
 * Append a child to a parent, handling all child types.
 * Returns the appended node (or null for empty children).
 */
export function appendChildNode(parent: Node, child: any): Node | null {
  if (child == null || typeof child === "boolean") return null

  if (child instanceof Node) {
    parent.appendChild(child)
    return child
  }

  if (typeof child === "string" || typeof child === "number") {
    const text = document.createTextNode(String(child))
    parent.appendChild(text)
    return text
  }

  if (typeof child === "function") {
    return mountReactiveChild(parent, child)
  }

  if (Array.isArray(child)) {
    for (let i = 0; i < child.length; i++) {
      appendChildNode(parent, child[i])
    }
    return null
  }

  // Fallback: coerce to string
  const text = document.createTextNode(String(child))
  parent.appendChild(text)
  return text
}

/**
 * Mount a reactive child expression.
 * For the common case of simple text/number values, optimizes to a single
 * Text node update (no comment markers needed).
 */
function mountReactiveChild(parent: Node, fn: () => any): Node {
  // Fast path: probe the function to see if it returns a simple value
  // Most reactive children are text expressions (e.g. () => row.label.get())
  // We can optimize these to a single Text node with direct textContent updates
  const textNode = document.createTextNode("")
  parent.appendChild(textNode)

  let isSimple = true
  let currentNodes: Node[] = []
  let sMarker: Node | null = null
  let eMarker: Node | null = null

  const d = effect(() => {
    const result = fn()

    if (isSimple) {
      // Check if result is a simple primitive (string, number, null, boolean)
      if (result == null || typeof result === "boolean") {
        textNode.textContent = ""
        return
      }
      if (typeof result === "string" || typeof result === "number") {
        textNode.textContent = String(result)
        return
      }
      // Result is complex (Node, Array) — switch to full mode
      isSimple = false
      sMarker = document.createComment("fobx-start")
      eMarker = document.createComment("fobx-end")
      parent.replaceChild(sMarker, textNode)
      parent.insertBefore(eMarker, sMarker.nextSibling)
      // Insert the complex result
      insertResult(parent, eMarker, result, currentNodes)
      return
    }

    // Complex mode (fallback — rare)
    for (const node of currentNodes) dispose(node)
    while (sMarker!.nextSibling && sMarker!.nextSibling !== eMarker) {
      sMarker!.nextSibling.remove()
    }
    currentNodes = []
    insertResult(parent, eMarker!, result, currentNodes)
  })

  onDispose(isSimple ? textNode : sMarker!, d)
  return isSimple ? textNode : sMarker!
}

/**
 * Insert a result value before a reference node, collecting created nodes.
 */
function insertResult(
  parent: Node,
  before: Node,
  value: any,
  nodes: Node[],
): void {
  if (value == null || typeof value === "boolean") return

  if (value instanceof Node) {
    parent.insertBefore(value, before)
    nodes.push(value)
    return
  }

  if (typeof value === "string" || typeof value === "number") {
    const text = document.createTextNode(String(value))
    parent.insertBefore(text, before)
    nodes.push(text)
    return
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      insertResult(parent, before, value[i], nodes)
    }
    return
  }

  // Fallback
  const text = document.createTextNode(String(value))
  parent.insertBefore(text, before)
  nodes.push(text)
}
