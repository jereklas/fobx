// deno-lint-ignore-file no-explicit-any
/**
 * mapArray — Efficient reactive list mapping for observable arrays.
 *
 * Maps items from an observable array to DOM nodes, reusing nodes for items
 * that haven't changed. This is the key primitive for rendering collections
 * without re-creating the entire list on every change.
 */

import { autorun } from "@fobx/core"
import { deleteObserver, effect, recycleReaction } from "@fobx/core/internals"
import type { Dispose } from "@fobx/core/internals"
import { createScope, enterScope, exitScope, onDispose } from "./reactive.ts"

// ─── Scope & Cache Entry Pools ───────────────────────────────────────────────

const _scopePool: any[][] = []

function _getScope(): any[] {
  return _scopePool.length > 0 ? _scopePool.pop()! : []
}

export interface MappedList {
  /** The container DocumentFragment (or the nodes themselves). */
  nodes: Node[]
  /** Dispose the mapping reaction and all child bindings. */
  dispose: Dispose
}

/**
 * Reactively map an iterable (typically an observable array) to DOM nodes.
 *
 * @param items - A function returning the current array of items.
 * @param mapFn - A function mapping each item to a DOM node.
 * @param keyFn - Optional key extractor. Defaults to identity.
 * @returns A MappedList with a live array of nodes.
 *
 * @example
 * ```ts
 * import { array } from "@fobx/core"
 * import { mapArray, ul, li } from "@fobx/dom"
 *
 * const items = array(["Apple", "Banana", "Cherry"])
 * const { nodes } = mapArray(
 *   () => items,
 *   (item) => li(null, item)
 * )
 * ```
 */
export function mapArray<T>(
  items: () => Iterable<T>,
  mapFn: (item: T, index: number) => Node,
  keyFn: (item: T) => any = (item) => item,
): MappedList {
  const nodes: Node[] = []
  let cache = new Map<any, { node: Node; item: T; dispose: Dispose }>()

  const d = autorun(() => {
    const list = [...items()]
    const newCache = new Map<any, { node: Node; item: T; dispose: Dispose }>()
    const newNodes: Node[] = []

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const key = keyFn(item)

      const existing = cache.get(key)
      if (existing && existing.item === item) {
        // Reuse existing node
        newCache.set(key, existing)
        newNodes.push(existing.node)
      } else {
        // Create new node
        if (existing) {
          // Key exists but item changed — dispose old node
          existing.dispose()
        }
        const [node, scopeDispose] = createScope(() => mapFn(item, i))
        newCache.set(key, { node, item, dispose: scopeDispose })
        newNodes.push(node)
      }
    }

    // Dispose removed entries
    for (const [key, entry] of cache) {
      if (!newCache.has(key)) {
        entry.dispose()
      }
    }

    cache = newCache

    // Update live nodes array
    nodes.length = 0
    for (let i = 0; i < newNodes.length; i++) {
      nodes.push(newNodes[i])
    }
  })

  return {
    nodes,
    dispose: () => {
      d()
      for (const entry of cache.values()) {
        entry.dispose()
      }
      cache.clear()
      nodes.length = 0
    },
  }
}

/**
 * Mount a mapped list into a parent element reactively.
 * Efficiently patches the parent's children as the source array changes.
 *
 * Uses keyed reconciliation: on each update it builds the new key order,
 * reuses existing DOM nodes for matching keys, creates new nodes for new keys,
 * disposes removed nodes, and performs minimal DOM moves to reorder.
 *
 * For initial creation (empty → N items), uses a DocumentFragment for
 * a single batch insertion.
 *
 * @param parent - The parent element to mount into.
 * @param items - A function returning the current array of items.
 * @param mapFn - A function mapping each item to a DOM node.
 * @param keyFn - Optional key extractor.
 * @returns A dispose function to tear down the mapping.
 */
export function mountList<T>(
  parent: HTMLElement,
  items: () => Iterable<T>,
  mapFn: (item: T, index: number) => Node,
  keyFn: (item: T) => any = (item) => item,
): Dispose {
  const endMarker = document.createComment("")
  parent.appendChild(endMarker)

  let cache = new Map<any, { node: Node; item: T; scope: Dispose[] }>()
  let currentKeys: any[] = []

  const d = effect(() => {
    // Read the items — typically an observable array, avoid spread when possible
    const rawItems = items()
    const list: ArrayLike<T> & Iterable<T> = Array.isArray(rawItems)
      ? rawItems
      : [...rawItems]
    const newLen = (list as any).length as number
    const oldLen = currentKeys.length

    // ── Fast path: clear all ──────────────────────────────────────────────
    if (newLen === 0) {
      if (oldLen > 0) {
        // Remove all DOM nodes before endMarker
        while (endMarker.previousSibling) {
          parent.removeChild(endMarker.previousSibling!)
        }
        // Dispose all entries
        for (const entry of cache.values()) {
          _disposeScope(entry.scope)
        }
        cache.clear()
        currentKeys = []
      }
      return
    }

    // ── Fast path: initial creation (empty → populated) ─────────────────
    // No cache lookups, no newCache/newNodes allocations.
    // Single pass: create + fragment.appendChild for better cache locality.
    if (oldLen === 0 && newLen > 0) {
      const frag = document.createDocumentFragment()
      const newKeys = new Array(newLen)
      for (let i = 0; i < newLen; i++) {
        const item = list[i]
        const key = keyFn(item)
        newKeys[i] = key
        const scope = _getScope()
        const prev = enterScope(scope)
        const node = mapFn(item, i)
        exitScope(prev)
        cache.set(key, { node, item, scope })
        frag.appendChild(node)
      }
      parent.insertBefore(frag, endMarker)
      currentKeys = newKeys
      return
    }

    // ── Fast path: append only (old is exact prefix of new) ──────────────
    if (newLen > oldLen && oldLen > 0) {
      let isAppend = true
      for (let i = 0; i < oldLen; i++) {
        if (keyFn(list[i]) !== currentKeys[i]) {
          isAppend = false
          break
        }
      }
      if (isAppend) {
        const newKeys = new Array(newLen)
        for (let i = 0; i < oldLen; i++) newKeys[i] = currentKeys[i]
        // Only create and insert new items
        const frag = document.createDocumentFragment()
        for (let i = oldLen; i < newLen; i++) {
          const item = list[i]
          const key = keyFn(item)
          newKeys[i] = key
          const scope = _getScope()
          const prev = enterScope(scope)
          const node = mapFn(item, i)
          exitScope(prev)
          cache.set(key, { node, item, scope })
          frag.appendChild(node)
        }
        parent.insertBefore(frag, endMarker)
        currentKeys = newKeys
        return
      }
    }

    const newKeys: any[] = new Array(newLen)
    const newNodes: Node[] = new Array(newLen)
    const newCache = new Map<any, { node: Node; item: T; scope: Dispose[] }>()

    // ── Phase 1: Build new cache + nodes array (reuse or create) ─────────
    for (let i = 0; i < newLen; i++) {
      const item = list[i]
      const key = keyFn(item)
      newKeys[i] = key

      const existing = cache.get(key)
      if (existing && existing.item === item) {
        // Reuse existing node
        newCache.set(key, existing)
        newNodes[i] = existing.node
        cache.delete(key) // Remove from old cache so stale detection is cheap
      } else {
        // Dispose old if key existed with different item
        if (existing) {
          _disposeScope(existing.scope)
          cache.delete(key)
        }
        const scope = _getScope()
        const prev = enterScope(scope)
        const node = mapFn(item, i)
        exitScope(prev)
        newCache.set(key, { node, item, scope })
        newNodes[i] = node
      }
    }

    // ── Phase 2: Dispose remaining old entries (anything left in cache) ──
    if (cache.size > 0) {
      for (const entry of cache.values()) {
        entry.node.parentNode?.removeChild(entry.node)
        _disposeScope(entry.scope)
      }
    }

    // ── Phase 3: Reconcile DOM order (uses flat newNodes array, no Map.get) ──
    if (oldLen === 0) {
      // Fast path: empty → populated — batch insert via fragment
      const frag = document.createDocumentFragment()
      for (let i = 0; i < newLen; i++) {
        frag.appendChild(newNodes[i])
      }
      parent.insertBefore(frag, endMarker)
    } else {
      // General case: minimal moves.
      let cursor: Node = endMarker
      for (let i = newLen - 1; i >= 0; i--) {
        const node = newNodes[i]
        if (node.nextSibling !== cursor || node.parentNode !== parent) {
          parent.insertBefore(node, cursor)
        }
        cursor = node
      }
    }

    cache = newCache
    currentKeys = newKeys
  })

  onDispose(endMarker, d)

  return () => {
    d()
    for (const entry of cache.values()) {
      _disposeScope(entry.scope)
    }
    cache.clear()
    currentKeys.length = 0
  }
}

/** Dispose all entries in a scope array.
 * Entries are either Dispose functions or SubscriptionReaction objects
 * (pushed directly by subscribe when _activeScope is set).
 */
function _disposeScope(scope: Dispose[]): void {
  for (let i = 0; i < scope.length; i++) {
    const entry = scope[i]
    if (typeof entry === "function") {
      entry()
    } else {
      // SubscriptionReaction — has _admin and is a ReactionAdmin
      const r = entry as any
      const admin = r._admin
      deleteObserver(admin, r)
      // Trigger onLoseObserver (e.g. selector per-key cleanup) when admin has no observers
      if (admin.observers === null && admin.onLoseObserver) {
        admin.onLoseObserver(admin)
      }
      recycleReaction(r)
    }
  }
  // Recycle scope array back to pool
  scope.length = 0
  _scopePool.push(scope)
}
