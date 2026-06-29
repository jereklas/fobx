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
- lifecycle is function-based through `onMount()` and `onCleanup()`

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

## Lifecycle-driven external resources

Use `onMount()` and `onCleanup()` when a component owns a timer, subscription,
or other external resource.

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

Notice that the resource ownership lives next to the JSX instead of on a class
instance.

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

## When to use lifecycle hooks

Reach for `onMount()` and `onCleanup()` when:

- a component owns a timer, subscription, or DOM observer
- you need setup only after the component's nodes exist
- teardown must follow disposal automatically

For ordinary UI changes, keep using observables plus reactive functions inside
otherwise static JSX.
