# @fobx/jsx

`@fobx/jsx` is a JSX authoring layer on top of `@fobx/dom` and `@fobx/core`.

**No virtual DOM. No reconciler. Real DOM nodes with fine-grained reactive updates.**

JSX compiles to direct DOM creation. When a prop or child is a function, fobx
tracks the observable reads inside that function and updates only the affected
attribute, text node, or child range.

## Setup

### Modern JSX Transform

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@fobx/jsx"
  }
}
```

### Classic JSX Transform

```tsx
/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h } from "@fobx/jsx"
```

## Quick Start

```tsx
import { observableBox } from "@fobx/core"
import { render } from "@fobx/jsx"

const count = observableBox(0)

const App = () => (
  <div class="counter">
    <span>Count: {() => count.get()}</span>
    <button onClick={() => count.set(count.get() + 1)}>+</button>
  </div>
)

render(<App />, document.getElementById("root")!)
```

## Functional Components

Components are plain functions that receive props and return nodes, fragments,
arrays of nodes, or `null`.

```tsx
interface GreetingProps {
  name: string
}

const Greeting = (props: GreetingProps) => <h1>Hello, {props.name}!</h1>
```

Children are available on `props.children`.

```tsx
const Card = (props: { title: string; children?: unknown }) => (
  <div class="card">
    <h2>{props.title}</h2>
    <div class="body">{props.children}</div>
  </div>
)
```

## Reactive Props and Children

Wrap a prop or child in a function to make that binding reactive.

```tsx
import { observableBox } from "@fobx/core"

const active = observableBox(false)
const name = observableBox("World")

const Greeting = () => (
  <div class={() => active.get() ? "active" : ""}>
    Hello, {() => name.get()}!
  </div>
)
```

`classList`, `style`, `prop:`, `attr:`, `bool:`, `textContent`, and `innerHTML`
work the same way they do in `@fobx/dom`, including SVG namespace-aware
creation for known SVG tags.

Event handlers are different: `onClick` and `on:*` are attached once and are not
reactive accessors. If the handler itself must change, render a new element.

```tsx
<button onClick={() => console.log("clicked")}>Click</button>
<div on:MyEvent={(event) => console.log(event.type)} />
<button onClick={[handleSelect, "todo-1"]}>Select</button>
```

In tuple form, pass `[handler, data]`. fobx pre-binds the second value and then
calls `handler(data, event)` when the event fires.

## Lifecycle Hooks

Lifecycle is function-based.

- `onMount(fn)` runs once after the component is actually mounted into the rendered DOM tree.
- `onCleanup(fn)` runs when the component's root nodes are disposed or unmounted.

```tsx
import { observableBox } from "@fobx/core"
import { onCleanup, onMount } from "@fobx/jsx"

const Timer = () => {
  const count = observableBox(0)
  let interval: number | undefined

  onMount(() => {
    interval = setInterval(() => {
      count.set(count.get() + 1)
    }, 1000)
  })

  onCleanup(() => {
    clearInterval(interval)
  })

  return <div>Elapsed: {() => count.get()}s</div>
}
```

Lifecycle is owned by the rendered nodes, not by a class instance. That keeps
setup and teardown close to the JSX that owns the DOM.

## Collections

For small lists, a reactive child can be enough.

```tsx
<ul>
  {() => todos.get().map((todo) => <li>{todo}</li>)}
</ul>
```

For keyed reconciliation, use `mountList()` or `mapArray()` from `@fobx/dom`
(both are re-exported by `@fobx/jsx`) or use `<For>`.

```tsx
import { observableArray } from "@fobx/core"
import { For } from "@fobx/jsx"

const todos = observableArray(["Buy milk", "Write code"])

<ul>
  <For each={todos} fallback={<li>No todos</li>}>
    {(todo, index) => <li>{index()}: {todo}</li>}
  </For>
</ul>
```

`<For>` accepts either `each={items}` or `each={() => items}`. It exposes a
reactive `index()` accessor and does not inject a wrapper element into the DOM.

Fallback content is disposed when the list becomes non-empty and recreated if it
needs to be shown again later.

## Fragment

Use `<>...</>` to group sibling nodes without adding a wrapper element.

```tsx
const Header = () => (
  <>
    <h1>Title</h1>
    <p>Subtitle</p>
  </>
)
```

## render, unmount, and dispose

```tsx
import { dispose, render, unmount } from "@fobx/jsx"

render(<App />, document.getElementById("root")!)
unmount(document.getElementById("root")!)

const node = <div>{() => count.get()}</div>
dispose(node)
```

`render()` mounts into a container. `unmount()` disposes everything inside that
container. `dispose(node)` is for standalone subtrees you remove manually.

## Rendering Notes

`@fobx/jsx` uses fine-grained DOM ownership. Lifecycle setup and teardown live
in `onMount()` and `onCleanup()`, and conditional rendering is typically
written with ternaries and `null`.

## How It Works

1. JSX compiles to `h()` calls.
2. Intrinsic elements are created through `@fobx/dom`.
3. Function props and function children become fine-grained reactive bindings.
4. Function components can register `onMount()` and `onCleanup()` during render.
5. `<For>` and `mountList()` use keyed reconciliation instead of whole-list
   replacement.
6. `runInTransaction()` batches multiple observable mutations into one DOM
   update pass.
