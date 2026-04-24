---
title: Class Components
navTitle: Class Components
navSection: ["@fobx/jsx"]
navOrder: 3
---

`@fobx/jsx` treats class components as an optional escape hatch for imperative
flows, lifecycle hooks, and explicit root replacement.

They are not a second rendering engine. They still render real DOM nodes, and
the most important reactive work still happens through function props and
function children inside `render()`.

## Mental model

When you render a class component:

1. fobx constructs the class with `props`.
2. It calls `render()` immediately.
3. The returned root node or nodes are tracked as the component's current DOM.
4. `didMount()` runs on the next microtask after those nodes exist.

That means class components are best thought of as a thin lifecycle wrapper
around normal fobx DOM ownership.

## Minimal example

```tsx
import { observableBox } from "@fobx/core"
import { Component } from "@fobx/jsx"

class Counter extends Component<{ initial: number }> {
  count = observableBox(this.props.initial)

  override render() {
    return (
      <button onClick={() => this.count.set(this.count.get() + 1)}>
        Count: {() => this.count.get()}
      </button>
    )
  }
}
```

In that example, the component instance owns the observable, but the DOM still
updates through the reactive child `() => this.count.get()` instead of through
`update()`.

## `props`

`props` are assigned in the constructor and then kept on the instance.

```tsx
class Greeting extends Component<{ name: string }> {
  override render() {
    return <h1>Hello, {this.props.name}</h1>
  }
}
```

Unlike React-style components, there is no separate prop diffing system and no
automatic rerender when you assign new props. If you change `this.props`, call
`update()` yourself.

```tsx
instance.props = { name: "fobx" }
instance.update()
```

If a value should update surgically over time, prefer an observable field and a
reactive expression inside `render()`.

## What `render()` may return

`render()` may return:

- a single node
- an array of nodes
- a `DocumentFragment`
- `null`

That means multi-root components are valid.

```tsx
class Pair extends Component<{ label: string }> {
  override render() {
    return (
      <>
        <span>{this.props.label}</span>
        <span>{this.props.label.toUpperCase()}</span>
      </>
    )
  }
}
```

fobx normalizes those outputs into the concrete child nodes that the component
instance owns.

## Lifecycle timing

Available hooks:

- `didMount()`
- `willUpdate()`
- `didUpdate()`
- `didUnmount()`

Lifecycle order:

1. `render()` runs during construction-time rendering.
2. `didMount()` runs on the next microtask after the initial nodes are created.
3. `willUpdate()` runs immediately before `update()` performs root replacement.
4. `render()` runs again inside `update()`.
5. `didUpdate()` runs after the new roots are attached.
6. `didUnmount()` runs when the tracked root nodes are disposed or removed.

Example:

```tsx
class Timer extends Component<{ initial: number }> {
  count = observableBox(this.props.initial)
  interval?: number

  override didMount() {
    this.interval = setInterval(() => {
      this.count.set(this.count.get() + 1)
    }, 1000)
  }

  override didUnmount() {
    clearInterval(this.interval)
  }

  override render() {
    return <div>Elapsed: {() => this.count.get()}s</div>
  }
}
```

## How `update()` works

`update()` is a full root replacement.

It does **not** diff the previous render result. Instead it:

1. calls `willUpdate()`
2. renders fresh root node or nodes
3. inserts the new roots before the old ones
4. disposes and removes old roots
5. tracks the new roots
6. calls `didUpdate()`

This is the key thing to keep in mind: `update()` is coarse-grained, while the
reactive expressions you place inside `render()` are fine-grained.

## Best practice

Use class components for:

- imperative setup and teardown
- owning observables on an instance
- exposing methods through `ref`
- explicit rerender boundaries when you really want them

Do not use `update()` for every little change if a reactive text binding,
reactive prop, or `<For>` can do the work more precisely.

## `ref` behavior

For class components, `ref` receives the component instance, not a DOM element.

```tsx
let timer: Timer | null = null

render(
  <Timer
    initial={0}
    ref={(instance) => {
      timer = instance
    }}
  />,
  root,
)
```

That makes class components the right choice when you want to expose instance
methods to parent code.

## Disposal model

`didUnmount()` is tied to DOM disposal, not just container unmount.

If a parent removes or disposes the component's root nodes, the component is
considered unmounted and its cleanup runs. This keeps lifecycle teardown aligned
with the same disposal model used throughout `@fobx/dom`.

## Recommended pattern

The most effective pattern is usually:

1. put long-lived state on the instance with `@fobx/core` observables
2. read that state through reactive expressions in `render()`
3. reserve `update()` for actual structural rerenders
4. use `didMount()` and `didUnmount()` for external resources

That keeps class components aligned with the rest of fobx instead of turning
them into a second, less efficient update path.

For concrete ref, lifecycle, and instance-method examples, see
[Recipes](/jsx/recipes/).
