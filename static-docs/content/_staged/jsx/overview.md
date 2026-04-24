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

## Class components

Use `Component` when you need lifecycle hooks or imperative updates.

```tsx
class Counter extends Component<{ label: string }> {
  override render() {
    return <button>{this.props.label}</button>
  }
}
```

Lifecycle hooks:

- `didMount()`
- `willUpdate()`
- `didUpdate()`
- `didUnmount()`

Key behaviors:

- `didMount()` runs on the next microtask after the initial roots are created
- `update()` is a full root replacement, not a surgical diff
- `didUnmount()` is tied to root-node disposal, not just top-level container
  unmount
- `render()` may return a node, an array of nodes, a fragment, or `null`

Prefer reactive expressions inside `render()` for most updates, and use
`update()` when you explicitly want to replace the component's root structure.

If you assign new values to `this.props`, call `update()` yourself. There is no
separate prop diffing system.

```tsx
instance.props = { label: "Next" }
instance.update()
```

See [Class Components](/jsx/class-components/) for the full lifecycle and
multi-root behavior.

## Fragments

Fragments return sibling nodes without a wrapper element.

```tsx
<>
  <h1>Title</h1>
  <p>Body</p>
</>
```

Class components can also return fragments or multiple root nodes.

## Mounting and cleanup

Use `render()` to mount into a container and `unmount()` to dispose everything
inside it.

```tsx
render(<App />, root)
unmount(root)
```

For standalone subtrees you remove manually, call `dispose(node)`.

For concrete patterns like controlled inputs, imperative refs, and class
instance APIs, see [Recipes](/jsx/recipes/).

## Differences from React-style expectations

- there is no virtual DOM
- there is no state setter queue inside components
- event handlers are not rebound reactively
- `Component.update()` replaces root nodes instead of diffing them
- assigning to `this.props` does not automatically trigger a rerender
- `innerHTML` is supported but not sanitized

For a broader SolidJS and React mapping, see
[Comparison Guide](/jsx/comparison/).
