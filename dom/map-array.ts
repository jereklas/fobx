// deno-lint-ignore-file no-explicit-any
/**
 * mapArray — Efficient reactive list mapping for observable arrays.
 */

import { autorun, runWithoutTracking } from "@fobx/core"
import { effect } from "@fobx/core/internals"
import type { Dispose } from "@fobx/core/internals"
import {
  createScope,
  disposeScopeEntries,
  enterScope,
  exitScope,
  onDispose,
  rethrowCleanupErrors,
} from "./reactive.ts"
import { isMountedNode, mountSubtree } from "./mount.ts"

const _scopePool: any[][] = []

type MaybeNode = Node | Node[] | null

function _getScope(): any[] {
  return _scopePool.length > 0 ? _scopePool.pop()! : []
}

interface CacheEntry<T> {
  nodes: Node[]
  item: T
  index: number
  dispose: Dispose
}

interface MountedCacheEntry<T> {
  nodes: Node[]
  item: T
  index: number
  scope: Dispose[]
}

function _normalizeNodes(node: MaybeNode): Node[] {
  if (node == null) {
    return [document.createComment("fobx-empty")]
  }
  if (Array.isArray(node)) {
    return node.length > 0 ? node : [document.createComment("fobx-empty")]
  }
  if (node instanceof DocumentFragment) {
    const nodes = Array.from(node.childNodes)
    return nodes.length > 0 ? nodes : [document.createComment("fobx-empty")]
  }
  return [node]
}

function _pushEntry<T>(cache: Map<any, T[]>, key: any, entry: T): void {
  const bucket = cache.get(key)
  if (bucket) {
    bucket.push(entry)
  } else {
    cache.set(key, [entry])
  }
}

function _takeEntry<T extends { item: unknown }>(
  cache: Map<any, T[]>,
  key: any,
  item: unknown,
): T | undefined {
  const bucket = cache.get(key)
  if (!bucket || bucket.length === 0) return undefined

  const matchIndex = bucket.findIndex((entry) => entry.item === item)
  if (matchIndex === -1) return undefined

  const [entry] = bucket.splice(matchIndex, 1)
  if (bucket.length === 0) {
    cache.delete(key)
  }

  return entry
}

function _createCacheEntry<T>(
  item: T,
  index: number,
  mapFn: (item: T, index: number) => MaybeNode,
): CacheEntry<T> {
  const [mapped, dispose] = createScope(() =>
    runWithoutTracking(() => mapFn(item, index))
  )
  return {
    nodes: _normalizeNodes(mapped),
    item,
    index,
    dispose,
  }
}

function _createMountedEntry<T>(
  item: T,
  index: number,
  mapFn: (item: T, index: number) => MaybeNode,
): MountedCacheEntry<T> {
  const scope = _getScope()
  const prev = enterScope(scope)
  try {
    const mapped = runWithoutTracking(() => mapFn(item, index))
    return {
      nodes: _normalizeNodes(mapped),
      item,
      index,
      scope,
    }
  } finally {
    exitScope(prev)
  }
}

function _removeNodes(nodes: Node[]): void {
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].parentNode?.removeChild(nodes[i])
  }
}

function _disposeCacheEntryList<T>(
  entries: CacheEntry<T>[],
  errors: unknown[],
): void {
  for (let i = 0; i < entries.length; i++) {
    try {
      entries[i].dispose()
    } catch (error) {
      errors.push(error)
    }
  }
}

function _disposeCacheEntries<T>(
  cache: Map<any, CacheEntry<T>[]>,
  errors?: unknown[],
): void {
  const cleanupErrors = errors ?? []

  for (const entries of cache.values()) {
    _disposeCacheEntryList(entries, cleanupErrors)
  }

  if (!errors) {
    rethrowCleanupErrors(cleanupErrors)
  }
}

function _disposeMountedEntryList<T>(
  entries: MountedCacheEntry<T>[],
  removeNodes: boolean,
  errors: unknown[],
): void {
  for (let i = 0; i < entries.length; i++) {
    if (removeNodes) {
      _removeNodes(entries[i].nodes)
    }

    try {
      _disposeScope(entries[i].scope)
    } catch (error) {
      errors.push(error)
    }
  }
}

function _disposeMountedEntries<T>(
  cache: Map<any, MountedCacheEntry<T>[]>,
  removeNodes: boolean,
  errors?: unknown[],
): void {
  const cleanupErrors = errors ?? []

  for (const entries of cache.values()) {
    _disposeMountedEntryList(entries, removeNodes, cleanupErrors)
  }

  if (!errors) {
    rethrowCleanupErrors(cleanupErrors)
  }
}

export interface MappedList {
  nodes: Node[]
  dispose: Dispose
}

export function mapArray<T>(
  items: () => Iterable<T>,
  mapFn: (item: T, index: number) => MaybeNode,
  keyFn: (item: T) => any = (item) => item,
): MappedList {
  const nodes: Node[] = []
  let cache = new Map<any, CacheEntry<T>[]>()

  const d = autorun(() => {
    const list = [...items()]
    const newCache = new Map<any, CacheEntry<T>[]>()
    const newNodes: Node[] = []
    const staleEntries: CacheEntry<T>[] = []

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const key = keyFn(item)

      const existing = _takeEntry(cache, key, item)
      if (existing && existing.index === i) {
        _pushEntry(newCache, key, existing)
        for (let j = 0; j < existing.nodes.length; j++) {
          newNodes.push(existing.nodes[j])
        }
        continue
      }

      if (existing) {
        staleEntries.push(existing)
      }

      const entry = _createCacheEntry(item, i, mapFn)
      _pushEntry(newCache, key, entry)
      for (let j = 0; j < entry.nodes.length; j++) {
        newNodes.push(entry.nodes[j])
      }
    }

    const errors: unknown[] = []
    _disposeCacheEntries(cache, errors)
    _disposeCacheEntryList(staleEntries, errors)
    rethrowCleanupErrors(errors)
    cache = newCache

    nodes.length = 0
    for (let i = 0; i < newNodes.length; i++) {
      nodes.push(newNodes[i])
    }
  })

  return {
    nodes,
    dispose: () => {
      d()
      _disposeCacheEntries(cache)
      cache.clear()
      nodes.length = 0
    },
  }
}

export function mountList<T>(
  parent: Node,
  items: () => Iterable<T>,
  mapFn: (item: T, index: number) => MaybeNode,
  keyFn: (item: T) => any = (item) => item,
): Dispose {
  const startMarker = document.createComment("")
  const endMarker = document.createComment("")
  parent.appendChild(startMarker)
  parent.appendChild(endMarker)
  if (isMountedNode(parent)) {
    mountSubtree(startMarker)
    mountSubtree(endMarker)
  }

  return mountListRange(startMarker, endMarker, items, mapFn, keyFn)
}

export function mountListRange<T>(
  startMarker: Comment,
  endMarker: Comment,
  items: () => Iterable<T>,
  mapFn: (item: T, index: number) => MaybeNode,
  keyFn: (item: T) => any = (item) => item,
): Dispose {
  let cache = new Map<any, MountedCacheEntry<T>[]>()
  let currentKeys: any[] = []

  const d = effect(() => {
    const parent = startMarker.parentNode
    if (!parent || endMarker.parentNode !== parent) {
      return
    }

    const rawItems = items()
    const list: ArrayLike<T> & Iterable<T> = Array.isArray(rawItems)
      ? rawItems
      : [...rawItems]
    const newLen = (list as any).length as number
    const oldLen = currentKeys.length

    if (newLen === 0) {
      if (oldLen > 0) {
        while (
          startMarker.nextSibling && startMarker.nextSibling !== endMarker
        ) {
          parent.removeChild(startMarker.nextSibling)
        }
        _disposeMountedEntries(cache, false)
        cache.clear()
        currentKeys = []
      }
      return
    }

    if (oldLen === 0 && newLen > 0) {
      const frag = document.createDocumentFragment()
      const newKeys = new Array(newLen)
      for (let i = 0; i < newLen; i++) {
        const item = list[i]
        const key = keyFn(item)
        newKeys[i] = key
        const entry = _createMountedEntry(item, i, mapFn)
        _pushEntry(cache, key, entry)
        for (let j = 0; j < entry.nodes.length; j++) {
          frag.appendChild(entry.nodes[j])
        }
      }
      parent.insertBefore(frag, endMarker)
      mountEntryNodes(parent, cache)
      currentKeys = newKeys
      return
    }

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
        const frag = document.createDocumentFragment()
        for (let i = oldLen; i < newLen; i++) {
          const item = list[i]
          const key = keyFn(item)
          newKeys[i] = key
          const entry = _createMountedEntry(item, i, mapFn)
          _pushEntry(cache, key, entry)
          for (let j = 0; j < entry.nodes.length; j++) {
            frag.appendChild(entry.nodes[j])
          }
        }
        parent.insertBefore(frag, endMarker)
        mountEntryNodes(parent, cache)
        currentKeys = newKeys
        return
      }
    }

    const newKeys: any[] = new Array(newLen)
    const newEntries: MountedCacheEntry<T>[] = new Array(newLen)
    const newCache = new Map<any, MountedCacheEntry<T>[]>()
    const staleEntries: MountedCacheEntry<T>[] = []

    for (let i = 0; i < newLen; i++) {
      const item = list[i]
      const key = keyFn(item)
      newKeys[i] = key

      const existing = _takeEntry(cache, key, item)
      if (existing && existing.index === i) {
        _pushEntry(newCache, key, existing)
        newEntries[i] = existing
        continue
      }

      if (existing) {
        staleEntries.push(existing)
      }

      const entry = _createMountedEntry(item, i, mapFn)
      _pushEntry(newCache, key, entry)
      newEntries[i] = entry
    }

    const errors: unknown[] = []
    if (cache.size > 0) {
      _disposeMountedEntries(cache, true, errors)
    }
    if (staleEntries.length > 0) {
      _disposeMountedEntryList(staleEntries, true, errors)
    }
    rethrowCleanupErrors(errors)

    let cursor: Node = endMarker
    for (let i = newLen - 1; i >= 0; i--) {
      const entry = newEntries[i]
      for (let j = entry.nodes.length - 1; j >= 0; j--) {
        const node = entry.nodes[j]
        if (node.nextSibling !== cursor || node.parentNode !== parent) {
          parent.insertBefore(node, cursor)
          if (isMountedNode(parent)) {
            mountSubtree(node)
          }
        }
        cursor = node
      }
    }

    cache = newCache
    currentKeys = newKeys
  })

  let disposed = false
  const disposeList = () => {
    if (disposed) return
    disposed = true
    d()
    _disposeMountedEntries(cache, false)
    cache.clear()
    currentKeys.length = 0
  }

  onDispose(startMarker, disposeList)

  return disposeList
}

function _disposeScope(scope: Dispose[]): void {
  try {
    disposeScopeEntries(scope)
  } finally {
    _scopePool.push(scope)
  }
}

function mountEntryNodes<T>(
  parent: Node,
  cache: Map<any, MountedCacheEntry<T>[]>,
): void {
  if (!isMountedNode(parent)) return

  for (const entries of cache.values()) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries[i].nodes.length; j++) {
        mountSubtree(entries[i].nodes[j])
      }
    }
  }
}
