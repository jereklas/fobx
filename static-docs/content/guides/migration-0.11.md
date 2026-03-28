---
title: Migrating to 0.11
description: Step-by-step guide for upgrading from @fobx/core 0.10.x to 0.11.0.
navSection: Guides
navOrder: 1
---

This guide covers every breaking change between `@fobx/core` **0.10.2** and
**0.11.0** and shows what to change in your code.

## ObservableBox: `.value` replaced by `.get()` / `.set()`

In 0.10.2 you read and wrote an `observableBox` through the `.value` property.
In 0.11.0 this changes to explicit `.get()` and `.set()` methods:

```ts
// 0.10.x
import { observableBox } from "@fobx/core"
const count = observableBox(0)
console.log(count.value) // read
count.value = 1 // write

// 0.11.0
import { observableBox } from "@fobx/core"
const count = observableBox(0)
console.log(count.get()) // read
count.set(1) // write
```

This affects every call site that touches an `observableBox`. A quick way to
find them is to search your project for `.value` on any box variable.

## Renamed exports

| 0.10.x            | 0.11.0                 | Notes                                          |
| ----------------- | ---------------------- | ---------------------------------------------- |
| `action(fn)`      | `transaction(fn)`      | Wraps `fn` so every call runs in a transaction |
| `runInAction(fn)` | `runInTransaction(fn)` | Executes `fn` inside a one-off transaction     |
| `isAction(fn)`    | `isTransaction(fn)`    | Predicate for wrapped functions                |

### Before (0.10.x)

```ts
import { action, isAction, runInAction } from "@fobx/core"

const increment = action((count) => {
  count.value += 1
})
isAction(increment) // true

runInAction(() => {
  count.value = 10
})
```

### After (0.11.0)

```ts
import { isTransaction, runInTransaction, transaction } from "@fobx/core"

const increment = transaction((count) => {
  count.set(count.get() + 1)
})
isTransaction(increment) // true

runInTransaction(() => {
  count.set(10)
})
```

## Removed exports

The following exports have been removed entirely.

| Removed export                    | Replacement                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| `extendObservable(target, props)` | Use `observable(target)` or `makeObservable(target, annotations)` |
| `Reaction` / `ReactionAdmin`      | No public replacement — these were internal classes               |
| `getGlobalState()`                | No public replacement — internal debugging only                   |
| `$fobx`                           | Moved to `@fobx/core/internals` (see below)                       |

## `observable()` no longer wraps collections directly

In 0.10.2, `observable()` could accept a raw `Array`, `Map`, or `Set` and return
a reactive wrapper. In 0.11.0, use the dedicated factory functions instead:

```ts
// 0.10.x
import { observable } from "@fobx/core"
const list = observable([1, 2, 3])
const lookup = observable(new Map([["a", 1]]))
const tags = observable(new Set(["x"]))

// 0.11.0
import { observableArray, observableMap, observableSet } from "@fobx/core"
const list = observableArray([1, 2, 3])
const lookup = observableMap(new Map([["a", 1]]))
const tags = observableSet(new Set(["x"]))
```

`observable(plainObject)` and `observable(classInstance)` still work as before.

## New exports

### `createSelector`

O(1) reactive selection helper. Given a signal that returns the "selected" key,
`createSelector` returns a function `isSelected(key)` that is true for exactly
one key at a time. Only the previously-selected and newly-selected items are
notified on change:

```ts
import { autorun, createSelector, observableBox } from "@fobx/core"

const selectedId = observableBox(1)
const isSelected = createSelector(() => selectedId.get())

autorun(() => {
  console.log("item 2 selected:", isSelected(2))
})

selectedId.set(2) // only items 1 and 2 react
```

### `runWithoutTracking`

Executes a function while suppressing dependency tracking — reads inside the
callback are **not** registered as dependencies of the enclosing reaction or
computed:

```ts
import { autorun, observableBox, runWithoutTracking } from "@fobx/core"

const a = observableBox(1)
const b = observableBox(2)

autorun(() => {
  // changes to `a` re-trigger this autorun
  console.log(a.get())
  // changes to `b` do NOT re-trigger it
  runWithoutTracking(() => b.get())
})
```

### Additional predicates

New type-checking predicates added in 0.11.0:

- `isObservableBox(value)` — true for values created by `observableBox()`
- `isObservableCollection(value)` — true for observable arrays, maps, and sets
- `isPlainObject(value)` — true for plain `{}` objects (no custom prototype)
- `isTransaction(fn)` — true for functions wrapped with `transaction()`

## New `@fobx/core/internals` entry point

Low-level primitives used by framework integration packages (`@fobx/react`,
`@fobx/dom`, etc.) have been moved to a dedicated entry point. **Application
code should not import from `@fobx/core/internals`** — these APIs are considered
unstable and may change between minor releases.

| Export                                  | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `createTracker`                         | Lightweight dependency tracker for framework bindings |
| `startBatch` / `endBatch`               | Manual batch boundary control                         |
| `effect`                                | Autorun variant used internally by framework packages |
| `subscribe`                             | Low-level observable subscription                     |
| `$fobx`                                 | Internal administration symbol                        |
| `deleteObserver`                        | Remove an observer from a reactive node               |
| `setActiveScope`                        | Disposal scope management for `@fobx/dom`             |
| `recycleReaction`                       | Reaction pool management for `@fobx/dom`              |
| `Tracker`, `Dispose`, `ObservableAdmin` | Associated types                                      |

If you were using `$fobx` from the main entry point, update your import:

```ts
// 0.10.x
import { $fobx } from "@fobx/core"

// 0.11.0
import { $fobx } from "@fobx/core/internals"
```

## Quick-reference cheatsheet

```diff
  import { observableBox } from "@fobx/core"
  const count = observableBox(0)

- count.value
+ count.get()

- count.value = 1
+ count.set(1)

- import { action, isAction, runInAction } from "@fobx/core"
+ import { isTransaction, runInTransaction, transaction } from "@fobx/core"

- const inc = action(() => { count.value += 1 })
+ const inc = transaction(() => { count.set(count.get() + 1) })

- runInAction(() => { count.value = 10 })
+ runInTransaction(() => { count.set(10) })

- import { observable } from "@fobx/core"
- const list = observable([1, 2, 3])
+ import { observableArray } from "@fobx/core"
+ const list = observableArray([1, 2, 3])

- import { extendObservable } from "@fobx/core"
+ import { observable } from "@fobx/core" // or makeObservable

- import { $fobx } from "@fobx/core"
+ import { $fobx } from "@fobx/core/internals"
```
