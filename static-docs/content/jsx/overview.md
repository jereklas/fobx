---
title: Overview
navTitle: Overview
navSection: ["@fobx/jsx"]
navOrder: 2
---

This guide covers the main runtime behaviors of `@fobx/jsx`.

## JSX produces real nodes

`@fobx/jsx` does not build a virtual tree. Intrinsic elements become real DOM
nodes immediately through `@fobx/dom`.

```tsx
const node = <div class="card">Hello</div>
```

Reactive bindings use the same rule as `@fobx/dom`:

- plain value: write once
- function prop: reactive binding
- function child: reactive child range
- event handler: attached once

```tsx
<div class={() => active.get() ? "active" : ""}>
  Count: {() => count.get()}
</div>
```

## Functional components

Functional components are plain functions returning nodes, arrays of nodes, or
`null`.

```tsx
const Greeting = (props: { name: string }) => <h1>Hello, {props.name}</h1>
```

Children are passed through `props.children`.

## `<For>`

`<For>` is the keyed list primitive for JSX. It is marker-based and does not
inject a wrapper element.

```tsx
<ul>
  <For each={todos} fallback={<li>No todos</li>}>
    {(todo, index) => <li data-index={() => String(index())}>{todo}</li>}
  </For>
</ul>
```

Key behaviors:

- accepts `each={items}` or `each={() => items}`
- supports `fallback`
- exposes a reactive `index()` accessor
- keeps fragment or multi-node rows together during moves

## Lifecycle hooks

Use `onMount()` and `onCleanup()` inside a function component when you need
setup and teardown tied to that component's rendered nodes.

```tsx
import { observableBox } from "@fobx/core"
import { onCleanup, onMount } from "@fobx/jsx"

const Clock = () => {
  const now = observableBox(new Date().toLocaleTimeString())
  let timer: number | undefined

  onMount(() => {
    timer = setInterval(() => {
      now.set(new Date().toLocaleTimeString())
    }, 1000)
  })

  onCleanup(() => {
    clearInterval(timer)
  })

  return <div>{() => now.get()}</div>
}
```

Key behaviors:

- `onMount()` runs once after the component is actually mounted into the rendered tree
- `onCleanup()` is tied to root-node disposal, not just top-level container
  unmount
- lifecycle is registered while the function component renders
- components may return a node, an array of nodes, a fragment, or `null`

For values that should update over time, prefer observables plus reactive
functions inside otherwise static JSX.

## Fragments

Fragments return sibling nodes without a wrapper element.

```tsx
<>
  <h1>Title</h1>
  <p>Body</p>
</>
```

## Mounting and cleanup

Use `render()` to mount into a container and `unmount()` to dispose everything
inside it.

```tsx
render(<App />, root)
unmount(root)
```

For standalone subtrees you remove manually, call `dispose(node)`.

For concrete patterns like controlled inputs, imperative refs, and lifecycle
hooks, see [Recipes](/jsx/recipes/).

## Differences from React-style expectations

- there is no virtual DOM
- there is no state setter queue inside components
- there are no class components or instance lifecycle methods
- event handlers are not rebound reactively
- `innerHTML` is supported but not sanitized

For a broader runtime comparison, see
[Comparison Guide](/jsx/comparison/).
