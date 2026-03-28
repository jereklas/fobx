// deno-lint-ignore-file no-explicit-any
/**
 * render — Mount a component or element tree into a DOM container.
 */

import { dispose as disposeNode } from "@fobx/dom"

/**
 * Render a component or element into a container.
 *
 * @param element - A DOM node, DocumentFragment, or array of nodes.
 * @param container - The DOM element to render into.
 * @param options - Optional: { clear: true } to remove existing children first.
 * @returns The container element.
 *
 * @example
 * ```tsx
 * render(<App />, document.getElementById("root")!)
 * ```
 */
export function render(
  element: any,
  container: HTMLElement,
  options: { clear?: boolean } = { clear: true },
): HTMLElement {
  if (options.clear) {
    // Dispose and remove all existing children
    let child = container.firstChild
    while (child) {
      const next = child.nextSibling
      disposeNode(child)
      container.removeChild(child)
      child = next
    }
  }

  if (element == null) return container

  if (Array.isArray(element)) {
    for (const node of element) {
      if (node instanceof Node) container.appendChild(node)
    }
  } else if (element instanceof Node) {
    container.appendChild(element)
  }

  return container
}

/**
 * Unmount and dispose everything inside a container.
 */
export function unmount(container: HTMLElement): void {
  let child = container.firstChild
  while (child) {
    const next = child.nextSibling
    disposeNode(child)
    container.removeChild(child)
    child = next
  }
}
