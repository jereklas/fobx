// deno-lint-ignore-file no-explicit-any
/**
 * Component base class for @fobx/jsx.
 *
 * Provides lifecycle hooks and an update() mechanism that leverages
 * @fobx/dom's reactive system. This is optional — functional
 * components are the primary pattern.
 *
 * @example
 * ```tsx
 * class Counter extends Component<{initial: number}> {
 *   count = box(this.props.initial)
 *
 *   render() {
 *     return (
 *       <div>
 *         <span>{() => this.count.get()}</span>
 *         <button onClick={() => this.count.set(this.count.get() + 1)}>+</button>
 *       </div>
 *     )
 *   }
 * }
 * ```
 */

import { dispose } from "@fobx/dom"

export abstract class Component<P = any> {
  props: P

  constructor(props: P) {
    this.props = props
  }

  /** Render the component. Must return a DOM Node. */
  abstract render(): Node | Node[] | null

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Called after the component's DOM is first inserted. */
  didMount(): void {}

  /** Called before the component re-renders via update(). */
  willUpdate(): void {}

  /** Called after the component re-renders via update(). */
  didUpdate(): void {}

  /** Called when the component is removed from the DOM. */
  didUnmount(): void {}

  // ── Internal ───────────────────────────────────────────────────────────

  /** The root DOM nodes produced by the last render(). */
  _elements: Node[] = []

  /**
   * Force a full re-render. Replaces old DOM nodes with fresh ones.
   * Prefer using reactive expressions inside render() instead.
   */
  update(): void {
    this.willUpdate()
    const oldElements = [...this._elements]
    const parent = oldElements[0]?.parentNode

    if (!parent) {
      throw new Error(
        "[@fobx/jsx] Component.update(): no parent node found. The component must be mounted in the DOM.",
      )
    }

    // Render new content
    const newContent = this.render()
    const newElements: Node[] = Array.isArray(newContent)
      ? newContent
      : newContent
      ? [newContent]
      : []

    // Insert new nodes before the first old node
    const insertBefore = oldElements[0]
    for (const node of newElements) {
      parent.insertBefore(node, insertBefore)
    }

    // Remove and dispose old nodes
    for (const node of oldElements) {
      if (!newElements.includes(node)) {
        dispose(node)
        node.parentNode?.removeChild(node)
      }
    }

    this._elements = newElements
    this.didUpdate()
  }
}
