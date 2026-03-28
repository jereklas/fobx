// deno-lint-ignore-file no-explicit-any
/**
 * `<For>` — Reactive list component for @fobx/jsx.
 *
 * Renders a list of items with efficient keyed reconciliation (insertions,
 * removals, and reorders are minimal DOM operations — no full replacement).
 *
 * Under the hood it delegates to `mountList` from @fobx/dom, so the end
 * user never needs to interact with that primitive directly.
 *
 * ## Usage
 *
 * ```tsx
 * import { For } from "@fobx/jsx"
 * import { array } from "@fobx/core"
 *
 * const todos = array([
 *   { id: 1, text: "Buy milk" },
 *   { id: 2, text: "Walk dog" },
 * ])
 *
 * function TodoList() {
 *   return (
 *     <ul>
 *       <For each={() => todos} key={(t) => t.id}>
 *         {(todo) => <li>{todo.text}</li>}
 *       </For>
 *     </ul>
 *   )
 * }
 * ```
 *
 * ### Props
 *
 * | Prop       | Type                               | Description                                         |
 * | ---------- | ---------------------------------- | --------------------------------------------------- |
 * | `each`     | `() => Iterable<T>`                | Reactive accessor returning the source collection.  |
 * | `key`      | `(item: T) => any`                 | Optional key extractor (defaults to identity).      |
 * | `children` | `(item: T, index: number) => Node` | Render callback — the single child of `<For>`.      |
 */

import { mountList } from "@fobx/dom"
import { onDispose } from "@fobx/dom"

/** Props accepted by the `<For>` component. */
export interface ForProps<T> {
  /** Reactive accessor returning the iterable to map. */
  each: () => Iterable<T>
  /** Optional key extractor.  Defaults to identity (`item => item`). */
  key?: (item: T) => any
  /**
   * Render callback.  Passed as the JSX child:
   *
   * ```tsx
   * <For each={...}>{(item) => <li>{item.name}</li>}</For>
   * ```
   */
  children: ((item: T, index: number) => Node) | [
    (item: T, index: number) => Node,
  ]
}

/**
 * `<For>` — render a reactive list with keyed reconciliation.
 *
 * Creates a transparent wrapper (`display: contents`) so it does not
 * interfere with parent layout, then mounts the reconciled list inside it.
 */
export function For<T>(props: ForProps<T>): HTMLElement {
  const mapFn: (item: T, index: number) => Node =
    typeof props.children === "function" ? props.children : props.children[0]

  const wrapper = document.createElement("div")
  wrapper.style.display = "contents"

  const dispose = mountList(
    wrapper,
    props.each,
    mapFn,
    props.key ?? ((item: T) => item as any),
  )

  // Ensure cleanup when the wrapper is disposed
  onDispose(wrapper, dispose)

  return wrapper
}
