// deno-lint-ignore-file no-explicit-any
/**
 * Reactive binding utilities — the core engine of @fobx/dom.
 *
 * Attaches fine-grained reactive effects to DOM elements so reactive
 * expressions (functions) are automatically tracked and their DOM side-effects
 * are surgically updated.
 *
 * ## Disposal Model
 *
 * Two complementary mechanisms exist:
 *
 * 1. **Node-based (`onDispose` / `dispose`)** — attaches disposers to DOM
 *    nodes via a WeakMap. `dispose(node)` recursively walks descendants.
 *    This is the general-purpose approach used by standalone elements.
 *
 * 2. **Scope-based (`createScope` / `onCleanup`)** — collects all disposers
 *    created during a factory function into a flat array. No tree walk
 *    needed; just iterate and call. Used by `mountList` for O(1)-per-entry
 *    teardown instead of a recursive DOM walk.
 *
 * When a scope is active (`_currentScope !== null`), helpers like
 * `bindAttribute`, event-handler registration, and `mountReactiveChild`
 * push their disposers into the scope **instead of** the node WeakMap.
 * This avoids both the WeakMap overhead and the recursive walk.
 */

import {
  deleteObserver,
  effect,
  recycleReaction,
  setActiveScope,
} from "@fobx/core/internals"
import type { Dispose } from "@fobx/core/internals"
import { isMountedNode, mountSubtree } from "./mount.ts"

let _currentScope: Dispose[] | null = null

export function createScope<T>(fn: () => T): [T, Dispose] {
  const scope: Dispose[] = []
  const prev = _currentScope
  _currentScope = scope
  setActiveScope(scope)
  try {
    const result = fn()
    return [result, () => disposeScopeEntries(scope)]
  } finally {
    _currentScope = prev
    setActiveScope(prev)
  }
}

export function enterScope(scope: Dispose[]): Dispose[] | null {
  const prev = _currentScope
  _currentScope = scope
  setActiveScope(scope)
  return prev
}

export function exitScope(prev: Dispose[] | null): void {
  _currentScope = prev
  setActiveScope(prev)
}

export function onCleanup(disposer: Dispose): boolean {
  if (_currentScope) {
    _currentScope.push(disposer)
    return true
  }
  return false
}

const _disposers = new WeakMap<Node, Dispose[]>()

function getDisposers(node: Node): Dispose[] {
  let list = _disposers.get(node)
  if (!list) {
    list = []
    _disposers.set(node, list)
  }
  return list
}

export function onDispose(node: Node, disposer: Dispose): void {
  if (!onCleanup(disposer)) {
    getDisposers(node).push(disposer)
  }
}

export function dispose(node: Node): void {
  const errors: unknown[] = []
  const list = _disposers.get(node)
  if (list) {
    try {
      for (let i = 0; i < list.length; i++) {
        try {
          list[i]()
        } catch (error) {
          errors.push(error)
        }
      }
    } finally {
      list.length = 0
      _disposers.delete(node)
    }
  }

  let child = node.firstChild
  while (child) {
    const next = child.nextSibling
    try {
      dispose(child)
    } catch (error) {
      errors.push(error)
    }
    child = next
  }

  rethrowCleanupErrors(errors)
}

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

const _styleObjectProps = new WeakMap<HTMLElement, Set<string>>()
const _styleMode = new WeakMap<HTMLElement, "string" | "object">()
const _baseClasses = new WeakMap<HTMLElement, string>()
const _classListTokens = new WeakMap<HTMLElement, Set<string>>()
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"

export function setAttribute(el: HTMLElement, key: string, value: any): void {
  if (key.startsWith("prop:")) {
    setProperty(el, key.slice(5), value)
  } else if (key.startsWith("attr:")) {
    setDOMAttribute(el, key.slice(5), value)
  } else if (key.startsWith("bool:")) {
    setBooleanAttribute(el, key.slice(5), value)
  } else if (key === "class" || key === "className") {
    setClassName(el, value)
  } else if (key === "classList") {
    setClassList(el, value)
  } else if (key === "style") {
    setStyle(el, value)
  } else if (key === "value" && "value" in el) {
    ;(el as any).value = value == null ? "" : value
  } else if (key === "checked" && "checked" in el) {
    ;(el as any).checked = value
  } else if (key === "disabled" && "disabled" in el) {
    ;(el as any).disabled = value
  } else if (key === "selected" && "selected" in el) {
    ;(el as any).selected = value
  } else if (key === "htmlFor") {
    if (value === false || value == null) {
      el.removeAttribute("for")
    } else {
      el.setAttribute("for", String(value))
    }
  } else if (key === "innerHTML") {
    el.innerHTML = value === false || value == null ? "" : String(value)
  } else if (key === "textContent") {
    el.textContent = value === false || value == null ? "" : String(value)
  } else if (value === false || value == null) {
    el.removeAttribute(key)
  } else if (value === true) {
    el.setAttribute(key, "")
  } else {
    el.setAttribute(key, String(value))
  }
}

function setProperty(el: HTMLElement, key: string, value: any): void {
  ;(el as Record<string, any>)[key] = value
}

function setDOMAttribute(el: HTMLElement, key: string, value: any): void {
  const namespaced = getNamespacedAttribute(key)

  if (value === false || value == null) {
    if (namespaced) {
      el.removeAttributeNS(namespaced.namespaceURI, namespaced.localName)
    } else {
      el.removeAttribute(key)
    }
    return
  }

  if (value === true) {
    if (namespaced) {
      el.setAttributeNS(namespaced.namespaceURI, key, "")
    } else {
      el.setAttribute(key, "")
    }
    return
  }

  if (namespaced) {
    el.setAttributeNS(namespaced.namespaceURI, key, String(value))
    return
  }

  el.setAttribute(key, String(value))
}

function setBooleanAttribute(el: HTMLElement, key: string, value: any): void {
  if (value) {
    el.setAttribute(key, "")
    return
  }

  el.removeAttribute(key)
}

function setClassName(el: HTMLElement, value: any): void {
  const baseClassName = value === false || value == null ? "" : String(value)
  if (baseClassName) {
    _baseClasses.set(el, baseClassName)
  } else {
    _baseClasses.delete(el)
  }
  syncClassName(el)
}

function setClassList(el: HTMLElement, value: any): void {
  if (value == null) {
    _classListTokens.delete(el)
    syncClassName(el)
    return
  }

  const tokens = new Set<string>()
  if (typeof value === "object") {
    const keys = Object.keys(value)
    for (let i = 0; i < keys.length; i++) {
      if (!value[keys[i]]) continue
      const parts = keys[i].trim().split(/\s+/)
      for (let j = 0; j < parts.length; j++) {
        if (parts[j]) tokens.add(parts[j])
      }
    }
  }

  if (tokens.size > 0) {
    _classListTokens.set(el, tokens)
  } else {
    _classListTokens.delete(el)
  }

  syncClassName(el)
}

function syncClassName(el: HTMLElement): void {
  const merged = new Set<string>()

  const baseClassName = _baseClasses.get(el)
  if (baseClassName) {
    const parts = baseClassName.trim().split(/\s+/)
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) merged.add(parts[i])
    }
  }

  const classListTokens = _classListTokens.get(el)
  if (classListTokens) {
    for (const token of classListTokens) {
      merged.add(token)
    }
  }

  if (merged.size === 0) {
    el.removeAttribute("class")
    return
  }

  el.className = Array.from(merged).join(" ")
}

function setStyle(el: HTMLElement, value: any): void {
  if (value == null || value === false) {
    _styleObjectProps.delete(el)
    _styleMode.delete(el)
    el.removeAttribute("style")
    return
  }

  if (typeof value === "string") {
    _styleObjectProps.delete(el)
    _styleMode.set(el, "string")
    el.style.cssText = value
    return
  }

  if (value && typeof value === "object") {
    if (_styleMode.get(el) !== "object") {
      el.style.cssText = ""
    }
    _styleMode.set(el, "object")
    setStyleObject(el, value)
    return
  }

  _styleObjectProps.delete(el)
  _styleMode.set(el, "string")
  el.style.cssText = String(value)
}

function setStyleObject(el: HTMLElement, styles: Record<string, any>): void {
  const previous = _styleObjectProps.get(el)
  const next = new Set<string>()
  const keys = Object.keys(styles)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const prop = normalizeStyleProperty(key)
    const styleValue = styles[key]

    if (styleValue == null) {
      el.style.removeProperty(prop)
      continue
    }

    next.add(prop)
    el.style.setProperty(prop, String(styleValue))
  }

  if (previous) {
    for (const prop of previous) {
      if (!next.has(prop)) {
        el.style.removeProperty(prop)
      }
    }
  }

  if (next.size > 0) {
    _styleObjectProps.set(el, next)
  } else {
    _styleObjectProps.delete(el)
  }
}

function normalizeStyleProperty(key: string): string {
  if (key.startsWith("--") || key.includes("-")) return key
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function getNamespacedAttribute(
  key: string,
): { namespaceURI: string; localName: string } | null {
  const separatorIndex = key.indexOf(":")
  if (separatorIndex <= 0) return null

  const prefix = key.slice(0, separatorIndex)
  const localName = key.slice(separatorIndex + 1)

  if (!localName) return null

  if (prefix === "xlink") {
    return { namespaceURI: XLINK_NAMESPACE, localName }
  }

  if (prefix === "xml") {
    return { namespaceURI: XML_NAMESPACE, localName }
  }

  return null
}

export function appendChildNode(parent: Node, child: any): Node | null {
  if (child == null || typeof child === "boolean") return null

  if (child instanceof Node) {
    if (child instanceof DocumentFragment) {
      const fragmentNodes = Array.from(child.childNodes)
      parent.appendChild(child)
      mountInsertedNodes(parent, fragmentNodes)
      return child
    }

    parent.appendChild(child)
    mountInsertedNode(parent, child)
    return child
  }

  if (typeof child === "string" || typeof child === "number") {
    const text = document.createTextNode(String(child))
    parent.appendChild(text)
    mountInsertedNode(parent, text)
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

  const text = document.createTextNode(String(child))
  parent.appendChild(text)
  mountInsertedNode(parent, text)
  return text
}

function mountReactiveChild(parent: Node, fn: () => any): Node {
  const sMarker = document.createComment("fobx-start")
  const eMarker = document.createComment("fobx-end")
  let textNode: Text | null = document.createTextNode("")
  parent.appendChild(sMarker)
  parent.appendChild(textNode)
  parent.appendChild(eMarker)

  let isSimple = true
  let currentNodes: Node[] = []

  const d = effect(() => {
    const result = fn()

    if (
      result == null || typeof result === "boolean" ||
      typeof result === "string" ||
      typeof result === "number"
    ) {
      const nextText = result == null || typeof result === "boolean"
        ? ""
        : String(result)

      if (isSimple && textNode && textNode.parentNode === parent) {
        textNode.textContent = nextText
        return
      }

      clearInsertedNodes(currentNodes)
      currentNodes = []
      textNode = document.createTextNode(nextText)
      parent.insertBefore(textNode, eMarker)
      isSimple = true
      return
    }

    if (isSimple) {
      if (textNode) {
        textNode.remove()
      }
      textNode = null
      isSimple = false
    } else {
      clearInsertedNodes(currentNodes)
      currentNodes = []
    }

    insertResult(parent, eMarker, result, currentNodes)
  })

  onDispose(sMarker, d)
  return sMarker
}

function clearInsertedNodes(nodes: Node[]): void {
  const errors: unknown[] = []
  for (let i = 0; i < nodes.length; i++) {
    try {
      dispose(nodes[i])
    } catch (error) {
      errors.push(error)
    }
    nodes[i].parentNode?.removeChild(nodes[i])
  }

  rethrowCleanupErrors(errors)
}

function insertResult(
  parent: Node,
  before: Node,
  value: any,
  nodes: Node[],
): void {
  if (value == null || typeof value === "boolean") return

  if (value instanceof DocumentFragment) {
    const fragmentNodes = Array.from(value.childNodes)
    parent.insertBefore(value, before)
    for (let i = 0; i < fragmentNodes.length; i++) {
      nodes.push(fragmentNodes[i])
    }
    mountInsertedNodes(parent, fragmentNodes)
    return
  }

  if (value instanceof Node) {
    parent.insertBefore(value, before)
    nodes.push(value)
    mountInsertedNode(parent, value)
    return
  }

  if (typeof value === "string" || typeof value === "number") {
    const text = document.createTextNode(String(value))
    parent.insertBefore(text, before)
    nodes.push(text)
    mountInsertedNode(parent, text)
    return
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      insertResult(parent, before, value[i], nodes)
    }
    return
  }

  const text = document.createTextNode(String(value))
  parent.insertBefore(text, before)
  nodes.push(text)
  mountInsertedNode(parent, text)
}

function mountInsertedNode(parent: Node, node: Node): void {
  if (!isMountedNode(parent)) return
  mountSubtree(node)
}

function mountInsertedNodes(parent: Node, nodes: readonly Node[]): void {
  if (!isMountedNode(parent)) return

  for (let i = 0; i < nodes.length; i++) {
    mountSubtree(nodes[i])
  }
}

export function disposeScopeEntries(scope: Dispose[]): void {
  const errors: unknown[] = []

  try {
    for (let i = 0; i < scope.length; i++) {
      const entry = scope[i] as any

      try {
        if (typeof entry === "function") {
          entry()
          continue
        }

        const admin = entry._admin
        deleteObserver(admin, entry)
        if (admin.observers === null && admin.onLoseObserver) {
          admin.onLoseObserver(admin)
        }
        recycleReaction(entry)
      } catch (error) {
        errors.push(error)
      }
    }
  } finally {
    scope.length = 0
  }

  rethrowCleanupErrors(errors)
}

export function rethrowCleanupErrors(errors: unknown[]): void {
  if (errors.length === 0) return
  if (errors.length === 1) {
    throw errors[0]
  }

  throw new AggregateError(
    errors,
    "[@fobx/dom] Multiple cleanup errors occurred.",
  )
}
