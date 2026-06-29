type MountedNodeObserver = (node: Node) => void

const mountedNodes = new WeakSet<Node>()
const mountedNodeObservers = new Set<MountedNodeObserver>()

export function observeMountedNodes(observer: MountedNodeObserver): () => void {
  mountedNodeObservers.add(observer)
  return () => {
    mountedNodeObservers.delete(observer)
  }
}

export function isMountedNode(node: Node): boolean {
  return mountedNodes.has(node)
}

export function mountSubtree(node: Node): void {
  visitMountedNode(node)
}

function visitMountedNode(node: Node): void {
  if (!mountedNodes.has(node)) {
    mountedNodes.add(node)
    for (const observer of mountedNodeObservers) {
      observer(node)
    }
  }

  let child = node.firstChild
  while (child) {
    visitMountedNode(child)
    child = child.nextSibling
  }
}