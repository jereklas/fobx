export function normalizeRenderedNodes(
  rendered: Node | Node[] | null,
): Node[] {
  const nodes: Node[] = []
  collectRenderedNodes(rendered, nodes)
  return nodes
}

function collectRenderedNodes(
  rendered: Node | Node[] | null,
  nodes: Node[],
): void {
  if (rendered == null) return

  if (Array.isArray(rendered)) {
    for (let i = 0; i < rendered.length; i++) {
      collectRenderedNodes(rendered[i], nodes)
    }
    return
  }

  if (rendered instanceof DocumentFragment) {
    const children = Array.from(rendered.childNodes)
    for (let i = 0; i < children.length; i++) {
      nodes.push(children[i])
    }
    return
  }

  nodes.push(rendered)
}