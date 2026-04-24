---
title: Recipes
navTitle: Recipes
navSection: ["@fobx/jsx"]
navOrder: 6
---

This page collects practical `@fobx/jsx` patterns you are likely to reach for in
everyday code.

The examples intentionally focus on how fobx wants you to think:

- state lives in `@fobx/core`
- JSX structure is usually static
- reactive expressions update the precise DOM binding that read the state
- class components are for lifecycle and imperative APIs, not routine state
  churn

## Conditional rendering

The standard pattern is a ternary or `null` inside a reactive child.

```tsx
import { observableBox } from "@fobx/core"

const isOpen = observableBox(false)

const Panel = () => (
  <section>
    <button onClick={() => isOpen.set(!isOpen.get())}>Toggle</button>
    {() => isOpen.get() ? <div class="panel">Details</div> : null}
  </section>
)
```

Use this when the whole child range should appear or disappear.

## Conditional text and attributes

When only one attribute or text node should react, keep the structure static and
make the binding reactive.

```tsx
const active = observableBox(false)

const Status = () => (
  <div class={() => active.get() ? "status active" : "status"}>
    {() =>
      active.get() ? "Online" : "Offline"}
  </div>
)
```

That is cheaper and clearer than rebuilding the whole subtree.

## Controlled input

Keep the current value in an observable and bind the DOM property reactively.

```tsx
import { observableBox } from "@fobx/core"

const name = observableBox("")

const NameField = () => (
  <label>
    Name
    <input
      value={() => name.get()}
      onInput={(event) => {
        const target = event.target as HTMLInputElement | null
        name.set(target?.value ?? "")
      }}
    />
  </label>
)
```

This pattern works the same way for `checked`, `selected`, and other DOM-backed
properties.

## Keyed list rendering

Use `<For>` when you want DOM reuse and stable keyed reconciliation.

```tsx
import { observableArray } from "@fobx/core"
import { For } from "@fobx/jsx"

const todos = observableArray([
  { id: 1, label: "Buy milk" },
  { id: 2, label: "Write docs" },
])

const TodoList = () => (
  <ul>
    <For each={todos} key={(todo) => todo.id} fallback={<li>No todos</li>}>
      {(todo, index) => <li data-index={() => String(index())}>{todo.label}
      </li>}
    </For>
  </ul>
)
```

Use a plain reactive child when you only need simple mapping and wrapper-free
reuse is not important.

## Imperative DOM refs

For intrinsic elements, `ref` receives the DOM element.

```tsx
let inputEl: HTMLInputElement | null = null

const SearchBox = () => (
  <div>
    <input
      ref={(el) => {
        inputEl = el as HTMLInputElement
      }}
    />
    <button onClick={() => inputEl?.focus()}>Focus</button>
  </div>
)
```

Use this when you need direct access to focus, measure, scroll, or call other
native DOM APIs.

## Class component instance refs

For class components, `ref` receives the component instance instead of a DOM
node.

```tsx
import { observableBox } from "@fobx/core"
import { Component } from "@fobx/jsx"

class Counter extends Component<{ initial: number }> {
  count = observableBox(this.props.initial)

  increment() {
    this.count.set(this.count.get() + 1)
  }

  override render() {
    return <div>Count: {() => this.count.get()}</div>
  }
}

let counter: Counter | null = null

const App = () => (
  <>
    <Counter
      initial={0}
      ref={(instance) => {
        counter = instance
      }}
    />
    <button onClick={() => counter?.increment()}>Increment externally</button>
  </>
)
```

This is one of the strongest reasons to use a class component in fobx.

## Lifecycle-driven external resources

Class components are a good fit when you need setup and teardown around a
subscription, timer, or external object.

```tsx
class Clock extends Component {
  now = observableBox(new Date().toLocaleTimeString())
  timer?: number

  override didMount() {
    this.timer = setInterval(() => {
      this.now.set(new Date().toLocaleTimeString())
    }, 1000)
  }

  override didUnmount() {
    clearInterval(this.timer)
  }

  override render() {
    return <div>{() => this.now.get()}</div>
  }
}
```

Notice that the interval changes the observable, while the DOM still updates
through a fine-grained reactive child.

## Structural rerender with `update()`

Reach for `update()` only when the component's root structure itself should be
replaced.

```tsx
class Badge extends Component<{ label: string; emphasized: boolean }> {
  override render() {
    return this.props.emphasized
      ? <strong>{this.props.label}</strong>
      : <span>{this.props.label}</span>
  }
}

badge.props = { label: "Updated", emphasized: true }
badge.update()
```

For ordinary text, attribute, and list changes, prefer observables plus reactive
expressions inside `render()`.

## Mixing static structure with reactive bindings

One of the best default styles in fobx is static outer structure with reactive
inner bindings.

```tsx
const first = observableBox("Ada")
const last = observableBox("Lovelace")

const Profile = () => (
  <article class="profile-card">
    <h1>{() => `${first.get()} ${last.get()}`}</h1>
    <p>Inventor of the first algorithm intended for a machine.</p>
  </article>
)
```

That style keeps components easy to read while still getting precise updates.

## When to choose a class component

Use a function component when:

- you only need structure plus reactive bindings
- no instance methods are needed
- no lifecycle hooks are needed

Use a class component when:

- you need `didMount()` / `didUnmount()`
- you want to expose instance methods through `ref`
- you want a stable imperative object that owns observables
- you explicitly need root replacement through `update()`

For the full class-component model, see
[Class Components](/jsx/class-components/).
