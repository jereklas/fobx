---
title: Comparison Guide
navTitle: Comparison Guide
navSection: ["@fobx/jsx"]
navOrder: 5
---

This page maps common SolidJS and React instincts to the `@fobx/jsx` runtime.

The goal is not to claim full framework parity. It is to show how to think in
fobx terms when you already know another JSX system.

## At a glance

`@fobx/jsx` is closer to SolidJS than to React in its update model.

- JSX creates real DOM nodes immediately.
- Function props and function children are the reactive boundaries.
- `<For>` is an explicit keyed list primitive.
- There is no virtual DOM diff for normal updates.

At the same time, `@fobx/jsx` does include an optional class-component API,
which gives it an imperative escape hatch that feels more familiar to React
developers.

## If you know SolidJS

The closest mental mapping is:

| SolidJS instinct    | fobx equivalent                               |
| ------------------- | --------------------------------------------- |
| `createSignal()`    | `observableBox()` from `@fobx/core`           |
| signal read in JSX  | wrap the read in `() => ...`                  |
| `createMemo()`      | `computed()` from `@fobx/core`                |
| `createEffect()`    | `autorun()` or `reaction()` from `@fobx/core` |
| `<For>`             | `<For>`                                       |
| ternary with `null` | ternary with `null`                           |

### The main similarities

- JSX creates real nodes, not virtual descriptions.
- Reactive expressions are explicit.
- Updates are fine-grained at the attribute, text, and DOM-range level.
- Lists are handled with a dedicated primitive rather than whole-list rerenders.

### The main differences

#### Reactivity lives in `@fobx/core`

In SolidJS, signal and effect primitives are part of the main component story.
In fobx, JSX rendering lives in `@fobx/jsx`, while the reactive primitives live
in `@fobx/core`.

```tsx
import { observableBox } from "@fobx/core"

const count = observableBox(0)

const App = () => <div>{() => count.get()}</div>
```

#### Function boundaries are explicit

If you read an observable directly in JSX without wrapping it in a function, it
is just a one-time read.

```tsx
<div>{count.get()}</div> // one-time read
<div>{() => count.get()}</div> // reactive read
```

That is one of the most important habits to internalize when moving into fobx.

#### No built-in `Show`, `Portal`, or `Suspense`

The current JSX package focuses on the core rendering model. Higher-level
control-flow or boundary helpers are not part of the package today.

Common replacements:

- use ternaries and `null` for conditional rendering
- use `<For>` for keyed lists
- use direct DOM ownership patterns when you need more control

#### Class components exist

SolidJS does not center class components. fobx includes `Component` as an
optional lifecycle-oriented abstraction.

That means if you need:

- imperative setup and teardown
- a stable instance with methods
- explicit `update()` calls

you can use a class component, but it is still running on the same real-DOM,
fine-grained runtime.

See [Class Components](/jsx/class-components/) for the detailed model.

## If you know React

The closest mental mapping is:

| React instinct                      | fobx equivalent                                              |
| ----------------------------------- | ------------------------------------------------------------ |
| rerender component on state change  | update only the reactive expression that read the observable |
| `useState()`                        | `observableBox()` or `observable()` from `@fobx/core`        |
| component render drives all updates | reactive subexpressions drive most updates                   |
| `ReactDOM.render()` style mounting  | `render()` from `@fobx/jsx`                                  |
| unmount tree                        | `unmount()` or `dispose()`                                   |

### The biggest differences

#### No virtual DOM rerender loop

In React, state changes normally cause a component function to run again. In
fobx, the preferred path is much narrower: only the reactive prop or reactive
child that read the observable updates.

```tsx
const count = observableBox(0)

const App = () => (
  <div>
    <span>Count: {() => count.get()}</span>
  </div>
)
```

When `count` changes, fobx updates that child range. It does not rerun the
entire component function just to rebuild the same structure.

#### Event handlers are attached once

Passing a function to `onClick` means "this is the listener". It does not mean
"track this value and swap listeners later".

```tsx
<button onClick={() => save()}>Save</button>
```

If the listener itself must change, render a new node.

#### Class components are not React class components

fobx class components are more direct and more explicit.

- `render()` returns actual DOM nodes
- `update()` performs full root replacement
- assigning to `this.props` does not auto-rerender
- lifecycle hooks are tied to DOM ownership and disposal

```tsx
instance.props = { label: "Next" }
instance.update()
```

That makes them useful for imperative integration, but they are not a state
queue or diff-based component model.

#### Hooks are not the JSX runtime API

`@fobx/jsx` does not model its API around hooks. The main reactive primitives
come from `@fobx/core`, and rendering is driven by DOM-bound reactive
expressions.

## Where class components fit in

Class components are best viewed as an optional imperative shell around the same
fine-grained runtime.

Use them when you need:

- lifecycle hooks
- instance methods through `ref`
- owned observables on an instance
- explicit structural rerendering through `update()`

Do not treat them as the default path for ordinary state changes. In most cases,
the best pattern is still to keep observables on the instance and read them
through reactive expressions inside `render()`.

```tsx
class Counter extends Component<{ initial: number }> {
  count = observableBox(this.props.initial)

  override render() {
    return <button>Count: {() => this.count.get()}</button>
  }
}
```

That pattern gives you the lifecycle benefits of a class instance without giving
up fine-grained DOM updates.

## Recommended migration checklist

If you are coming from SolidJS:

1. Move your reactivity imports to `@fobx/core`.
2. Keep explicit reactive function boundaries in JSX.
3. Use `<For>` for keyed lists and ternaries for simple conditional rendering.
4. Reach for class components only when lifecycle or instance methods matter.

If you are coming from React:

1. Stop thinking in terms of rerendering whole components for every change.
2. Put changing values in observables.
3. Read observables through reactive expressions inside otherwise static JSX.
4. Use class components only when you truly need an imperative shell.
