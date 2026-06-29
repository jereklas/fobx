/**
 * `<For>` — Reactive list component for @fobx/jsx.
 */

import { autorun, observableBox, runInTransaction } from "@fobx/core"
import {
  appendChildNode,
  dispose as disposeNode,
  mountListRange,
  onDispose,
} from "@fobx/dom"
import { recreateValue } from "@fobx/dom/recreate"

type IndexAccessor = () => number
type ForEach<T> =
  | Iterable<T>
  | null
  | undefined
  | false
  | (() => Iterable<T> | null | undefined | false)

interface ForEntry<T> {
  item: T
  key: unknown
  index: ReturnType<typeof observableBox<number>>
  readIndex: IndexAccessor
}

export interface ForProps<T> {
  each: ForEach<T>
  key?: (item: T) => unknown
  fallback?: unknown
  children: (item: T, index: IndexAccessor) => Node | Node[] | null
}

export function For<T>(props: ForProps<T>): DocumentFragment {
  const mapFn = resolveMapFn(props.children)

  const fragment = document.createDocumentFragment()
  const ownerMarker = document.createComment("fobx-for")
  const fallbackStart = document.createComment("fobx-for-fallback-start")
  const fallbackEnd = document.createComment("fobx-for-fallback-end")
  const listStart = document.createComment("fobx-for-list-start")
  const listEnd = document.createComment("fobx-for-list-end")
  fragment.append(ownerMarker, fallbackStart, fallbackEnd, listStart, listEnd)

  let cache = new Map<unknown, ForEntry<T>[]>()
  const entries = observableBox<ForEntry<T>[]>([])
  const isEmpty = observableBox(true)
  let fallbackNodes: Node[] = []
  let fallbackHasMounted = false
  let fallbackVisible = false

  const syncEntries = autorun(() => {
    const list = normalizeItems(resolveEach(props.each))
    const nextCache = new Map<unknown, ForEntry<T>[]>()
    const nextEntries = new Array<ForEntry<T>>(list.length)

    runInTransaction(() => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i]
        const key = props.key ? props.key(item) : item
        const existing = takeEntry(cache, key, item)

        if (existing) {
          existing.index.set(i)
          pushEntry(nextCache, key, existing)
          nextEntries[i] = existing
          continue
        }

        const index = observableBox(i)
        const entry: ForEntry<T> = {
          item,
          key,
          index,
          readIndex: () => index.get(),
        }
        pushEntry(nextCache, key, entry)
        nextEntries[i] = entry
      }

      cache = nextCache
      entries.set(nextEntries)
      isEmpty.set(nextEntries.length === 0)
    })
  })

  const syncFallback = autorun(() => {
    const shouldShow = isEmpty.get() && props.fallback != null
    if (shouldShow === fallbackVisible) return

    if (shouldShow) {
      fallbackNodes = realizeNodes(
        fallbackHasMounted ? recreateValue(props.fallback) : props.fallback,
      )
      const parent = fallbackEnd.parentNode
      if (!parent) return
      for (let i = 0; i < fallbackNodes.length; i++) {
        parent.insertBefore(fallbackNodes[i], fallbackEnd)
      }
      fallbackHasMounted = true
      fallbackVisible = true
      return
    }

    disposeFallbackNodes(fallbackNodes)
    fallbackNodes = []
    fallbackVisible = false
  })

  const disposeList = mountListRange(
    listStart,
    listEnd,
    () => entries.get(),
    (entry) => mapFn(entry.item, entry.readIndex),
    (entry) => entry.key,
  )

  onDispose(ownerMarker, syncEntries)
  onDispose(ownerMarker, syncFallback)
  onDispose(ownerMarker, disposeList)
  onDispose(ownerMarker, () => {
    disposeFallbackNodes(fallbackNodes)
    fallbackVisible = false
    fallbackNodes.length = 0
  })

  return fragment
}

function resolveEach<T>(
  each: ForEach<T>,
): Iterable<T> | null | undefined | false {
  return typeof each === "function"
    ? (each as () => Iterable<T> | null | undefined | false)()
    : each
}

function resolveMapFn<T>(
  value: ForProps<T>["children"] | [ForProps<T>["children"]],
): ForProps<T>["children"] {
  return Array.isArray(value) ? value[0] : value
}

function normalizeItems<T>(
  value: Iterable<T> | null | undefined | false,
): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [...value]
}

function pushEntry<T>(
  cache: Map<unknown, ForEntry<T>[]>,
  key: unknown,
  entry: ForEntry<T>,
): void {
  const bucket = cache.get(key)
  if (bucket) {
    bucket.push(entry)
  } else {
    cache.set(key, [entry])
  }
}

function takeEntry<T>(
  cache: Map<unknown, ForEntry<T>[]>,
  key: unknown,
  item: T,
): ForEntry<T> | undefined {
  const bucket = cache.get(key)
  if (!bucket || bucket.length === 0) return undefined

  const index = bucket.findIndex((entry) => entry.item === item)
  if (index === -1) return undefined

  const [entry] = bucket.splice(index, 1)
  if (bucket.length === 0) {
    cache.delete(key)
  }

  return entry
}

function realizeNodes(value: unknown): Node[] {
  const frag = document.createDocumentFragment()
  appendChildNode(frag, value)
  return Array.from(frag.childNodes)
}

function disposeFallbackNodes(nodes: Node[]): void {
  const errors: unknown[] = []

  for (let i = 0; i < nodes.length; i++) {
    try {
      disposeNode(nodes[i])
    } catch (error) {
      errors.push(error)
    }

    nodes[i].parentNode?.removeChild(nodes[i])
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "[@fobx/jsx] Multiple fallback cleanup errors occurred.",
    )
  }
}
