---
title: Comparison Guide
navTitle: Comparison Guide
navSection: ["@fobx/jsx"]
navOrder: 5
---

This page maps common React expectations to the `@fobx/jsx` runtime.

The goal is not to claim full framework parity. It is to show how to think in
fobx terms when you already know another JSX system.

## At a glance

`@fobx/jsx` updates DOM more narrowly than a full component rerender model.

- JSX creates real DOM nodes immediately.
- Function props and function children are the reactive boundaries.
- `<For>` is an explicit keyed list primitive.
- There is no virtual DOM diff for normal updates.

Setup and teardown are registered with `onMount()` and `onCleanup()` inside
function components instead of class lifecycle methods.

### The main similarities

- JSX creates real nodes, not virtual descriptions.
- Reactive expressions are explicit.
- Updates are fine-grained at the attribute, text, and DOM-range level.
- Lists are handled with a dedicated primitive rather than whole-list rerenders.

### The main differences

#### Reactivity lives in `@fobx/core`

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

#### No built-in control-flow or boundary helpers

The current JSX package focuses on the core rendering model. Higher-level
control-flow or boundary helpers are not part of the package today.

Common replacements:

- use ternaries and `null` for conditional rendering
- use `<For>` for keyed lists
- use direct DOM ownership patterns when you need more control

#### Lifecycle hooks stay inside function components

Lifecycle is function-based instead of class-based.

```tsx
const Timer = () => {
  onMount(() => console.log("mounted"))
  onCleanup(() => console.log("disposed"))
  return <div>Ready</div>
}
```

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

#### No class-component lifecycle layer

fobx does not expose a class-component API here. Setup and teardown stay inside
function components through `onMount()` and `onCleanup()`, and ongoing UI
updates are still driven by observables plus reactive JSX bindings.

#### Hooks are not the JSX runtime API

`@fobx/jsx` does not model its API around hooks. The main reactive primitives
come from `@fobx/core`, and rendering is driven by DOM-bound reactive
expressions.

## Where lifecycle fits in

The intended pattern is:

- keep render logic in function components
- keep changing values in observables from `@fobx/core`
- use `onMount()` and `onCleanup()` only for setup and teardown
- let reactive JSX bindings handle ongoing UI updates

## Recommended migration checklist

If you are coming from React:

1. Stop thinking in terms of rerendering whole components for every change.
2. Put changing values in observables.
3. Read observables through reactive expressions inside otherwise static JSX.
4. Use `onMount()` and `onCleanup()` instead of looking for class lifecycle methods.
