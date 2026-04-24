---
title: "@fobx/jsx"
description: JSX rendering for FobX with real DOM nodes and fine-grained updates.
navTitle: Introduction
navSection: ["@fobx/jsx"]
navOrder: 0
navSectionOrder: 6
navSectionExpanded: true
---

`@fobx/jsx` adds a JSX authoring layer on top of `@fobx/dom`. It keeps the same
fine-grained update model: JSX produces real DOM nodes immediately, and reactive
bindings update only the exact attribute, text node, or DOM range that depends
on changed state.

## What you get

| Export                   | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| JSX runtime / `h()`      | Turn JSX into real DOM nodes                                    |
| `Fragment`               | Group sibling nodes without a wrapper element                   |
| `For`                    | Keyed list rendering with fallback support and reactive indexes |
| `render()` / `unmount()` | Mount and tear down trees in a container                        |
| `Component`              | Optional class-component API with lifecycle hooks               |
| `dispose()`              | Manual cleanup for standalone subtrees                          |

## Quick example

```tsx
import { observableArray, observableBox } from "@fobx/core"
import { For, render } from "@fobx/jsx"

const count = observableBox(0)
const todos = observableArray(["Buy milk", "Write docs"])

const App = () => (
  <div class="app-shell">
    <button onClick={() => count.set(count.get() + 1)}>
      Count: {() => count.get()}
    </button>

    <ul>
      <For each={todos} fallback={<li>No todos</li>}>
        {(todo) => <li>{todo}</li>}
      </For>
    </ul>
  </div>
)

render(<App />, document.getElementById("root")!)
```

## Mental model

If you know SolidJS, the best mental model is:

- JSX is syntax sugar over real-node creation.
- Function props and function children are the reactive boundaries.
- Event listeners are attached once, not rebound reactively.
- `<For>` provides explicit keyed reconciliation for collections.
- Class components are an imperative wrapper around the same DOM ownership
  model, not a separate component diffing system.

## When to use it

Use `@fobx/jsx` when you want FobX's fine-grained reactivity but prefer JSX for
authoring structure. It is a good fit for:

- framework-free apps that still want JSX ergonomics
- widget libraries that should not ship a virtual DOM
- teams already comfortable with Solid-style reactive expressions

## Next steps

- [Installation](/jsx/installation/) — configure the JSX transform
- [Overview](/jsx/overview/) — learn components, reactivity, lists, and
  lifecycle
- [Class Components](/jsx/class-components/) — lifecycle timing, `update()`, and
  multi-root behavior
- [Comparison Guide](/jsx/comparison/) — map common SolidJS and React instincts
  to the fobx runtime
- [Recipes](/jsx/recipes/) — practical patterns for conditional UI, inputs,
  refs, and class-component APIs
- [API Reference](/jsx/api-reference/) — public API behavior and signatures
