import { onDispose } from "@fobx/dom"
import { isMountedNode, observeMountedNodes } from "@fobx/dom/mount"

type LifecycleCallback = () => void

interface LifecycleOwner {
  mountCallbacks: LifecycleCallback[]
  cleanupCallbacks: LifecycleCallback[]
  mounted: boolean
  mountScheduled: boolean
  disposed: boolean
}

let currentOwner: LifecycleOwner | null = null
const nodeOwners = new WeakMap<Node, LifecycleOwner[]>()

observeMountedNodes((node) => {
  const owners = nodeOwners.get(node)
  if (!owners) return

  for (let i = 0; i < owners.length; i++) {
    queueMountCallbacks(owners[i])
  }
})

export function onMount(callback: LifecycleCallback): void {
  const owner = getCurrentOwner("onMount")
  if (owner.disposed) return

  if (owner.mounted) {
    queueMountedCallback(owner, callback)
    return
  }

  owner.mountCallbacks.push(callback)
}

export function onCleanup(callback: LifecycleCallback): void {
  getCurrentOwner("onCleanup").cleanupCallbacks.push(callback)
}

export function withLifecycleOwner<T>(render: () => T): [T, LifecycleOwner] {
  const owner: LifecycleOwner = {
    mountCallbacks: [],
    cleanupCallbacks: [],
    mounted: false,
    mountScheduled: false,
    disposed: false,
  }
  const previousOwner = currentOwner
  currentOwner = owner

  try {
    return [render(), owner]
  } finally {
    currentOwner = previousOwner
  }
}

export function ownerHasLifecycle(owner: LifecycleOwner): boolean {
  return owner.mountCallbacks.length > 0 || owner.cleanupCallbacks.length > 0
}

export function attachLifecycle(owner: LifecycleOwner, nodes: Node[]): void {
  if (nodes.length === 0) return

  const disposeOwner = () => {
    if (owner.disposed) return
    owner.disposed = true
    runCallbacks(owner, owner.cleanupCallbacks, true)
  }

  for (let i = 0; i < nodes.length; i++) {
    registerNodeOwner(nodes[i], owner)
    onDispose(nodes[i], disposeOwner)
  }

  for (let i = 0; i < nodes.length; i++) {
    if (isMountedNode(nodes[i])) {
      queueMountCallbacks(owner)
      break
    }
  }
}

export function createLifecycleMarker(owner: LifecycleOwner): Comment {
  const marker = document.createComment("fobx-lifecycle")
  attachLifecycle(owner, [marker])
  return marker
}

function runCallbacks(
  owner: LifecycleOwner,
  callbacks: LifecycleCallback[],
  reverse = false,
): void {
  if (callbacks.length === 0) return

  const pending = callbacks.splice(0)
  if (reverse) {
    pending.reverse()
  }
  const errors: unknown[] = []

  for (let i = 0; i < pending.length; i++) {
    const previousOwner = currentOwner
    currentOwner = owner

    try {
      pending[i]()
    } catch (error) {
      errors.push(error)
    } finally {
      currentOwner = previousOwner
    }
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "[@fobx/jsx] Multiple lifecycle callbacks failed.",
    )
  }
}

function getCurrentOwner(apiName: string): LifecycleOwner {
  if (currentOwner) return currentOwner

  throw new Error(
    `[@fobx/jsx] ${apiName}() can only be used while rendering a function component.`,
  )
}

function registerNodeOwner(node: Node, owner: LifecycleOwner): void {
  const owners = nodeOwners.get(node)
  if (!owners) {
    nodeOwners.set(node, [owner])
    return
  }

  if (!owners.includes(owner)) {
    owners.push(owner)
  }
}

function queueMountCallbacks(owner: LifecycleOwner): void {
  if (owner.disposed || owner.mounted || owner.mountScheduled) return

  owner.mountScheduled = true
  queueMicrotask(() => {
    owner.mountScheduled = false
    if (owner.disposed || owner.mounted) return
    owner.mounted = true
    runCallbacks(owner, owner.mountCallbacks)
  })
}

function queueMountedCallback(
  owner: LifecycleOwner,
  callback: LifecycleCallback,
): void {
  queueMicrotask(() => {
    if (owner.disposed) return
    runCallback(owner, callback)
  })
}

function runCallback(owner: LifecycleOwner, callback: LifecycleCallback): void {
  const previousOwner = currentOwner
  currentOwner = owner

  try {
    callback()
  } finally {
    currentOwner = previousOwner
  }
}