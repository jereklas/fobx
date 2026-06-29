import type { Children } from "./types.ts"

type RecreateFactory = () => unknown

const _recreateFactories = new WeakMap<object, RecreateFactory>()

export function registerRecreateFactory<T>(
  value: T,
  factory: () => T,
): T {
  if (isRecreatableContainer(value)) {
    _recreateFactories.set(value, factory as RecreateFactory)
  }
  return value
}

export function recreateValue<T>(value: T): T {
  if (!isRecreatableContainer(value)) {
    return value
  }

  const factory = _recreateFactories.get(value)
  if (factory) {
    return factory() as T
  }

  if (Array.isArray(value)) {
    const next = new Array(value.length)
    for (let i = 0; i < value.length; i++) {
      next[i] = recreateValue(value[i])
    }
    return next as T
  }

  if (value instanceof Node) {
    return value.cloneNode(true) as T
  }

  return value
}

export function recreateChildren(children: readonly unknown[]): Children[] {
  const next = new Array<Children>(children.length)
  for (let i = 0; i < children.length; i++) {
    next[i] = recreateValue(children[i]) as Children
  }
  return next
}

function isRecreatableContainer(value: unknown): value is object {
  return (typeof value === "object" && value !== null) ||
    typeof value === "function"
}
