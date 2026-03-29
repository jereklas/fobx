---
title: Migrating to 0.11
description: Step-by-step guide for upgrading from @fobx/core 0.10.x to 0.11.0.
navSection: Guides
navOrder: 1
---

This guide covers every breaking change between `@fobx/core` **0.10.2** and
**0.11.0** and shows what to change in your code.

## `.value` replaced by `.get()` / `.set()`

`observableBox` and `computed` both used a `.value` property accessor in 0.10.2.
In 0.11.0 they switch to explicit `.get()` and `.set()` methods.

### observableBox

```ts
// 0.10.x
const count = observableBox(0)
console.log(count.value) // read
count.value = 1 // write

// 0.11.0
const count = observableBox(0)
console.log(count.get()) // read
count.set(1) // write
```

### computed

```ts
// 0.10.x
const doubled = computed(() => count.value * 2)
console.log(doubled.value)

// 0.11.0
const doubled = computed(() => count.get() * 2)
console.log(doubled.get())
```

Search your project for `.value` on box and computed variables to find every
call site that needs updating.

## `computed()` setter moved to options

In 0.10.2, the setter was a second positional argument. In 0.11.0, pass it as
the `set` property in the options object:

```ts
// 0.10.x
const doubled = computed(
  () => count.value * 2,
  (v) => {
    count.value = v / 2
  },
)

// 0.11.0
const doubled = computed(() => count.get() * 2, {
  set: (v) => {
    count.set(v / 2)
  },
})
```

The `thisArg` option has been renamed to `bind`, and the `equals` shorthand was
removed — use `comparer` instead.

## `makeObservable()` signature change

The second argument is now an options object instead of a bare annotations map:

```ts
// 0.10.x
makeObservable(this, {
  count: "observable",
  doubled: "computed",
  increment: "action",
})

// 0.11.0
makeObservable(this, {
  annotations: {
    count: "observable",
    doubled: "computed",
    increment: "transaction", // see annotation renames below
  },
})
```

The options object also accepts `name` and `ownPropertiesOnly`.

## `observable()` signature change for objects

When calling `observable()` on a plain object or class instance, annotations and
options are merged into a single options object:

```ts
// 0.10.x
observable(obj, { count: "observable" }, { shallowRef: true })

// 0.11.0
observable(obj, {
  annotations: { count: "observable" },
  defaultAnnotation: "observable.ref", // replaces shallowRef
})
```

The `shallow` and `shallowRef` object-level options have been removed. Use
`"observable.shallow"` or `"observable.ref"` annotations on individual
properties instead.

`observable()` still accepts arrays, maps, and sets — that behaviour is
unchanged from 0.10.2.

## Annotation string renames

Wherever you use annotation strings in `makeObservable` or `observable`, rename
the action-related annotations:

| 0.10.x           | 0.11.0                |
| ---------------- | --------------------- |
| `"action"`       | `"transaction"`       |
| `"action.bound"` | `"transaction.bound"` |

All other annotation strings (`"observable"`, `"observable.ref"`,
`"observable.shallow"`, `"computed"`, `"flow"`, `"flow.bound"`, `"none"`) remain
unchanged.

## Renamed exports

| 0.10.x            | 0.11.0                 | Notes                                          |
| ----------------- | ---------------------- | ---------------------------------------------- |
| `action(fn)`      | `transaction(fn)`      | Wraps `fn` so every call runs in a transaction |
| `runInAction(fn)` | `runInTransaction(fn)` | Executes `fn` inside a one-off transaction     |
| `isAction(fn)`    | `isTransaction(fn)`    | Predicate for wrapped functions                |

### Before (0.10.x)

```ts
import { action, isAction, observableBox, runInAction } from "@fobx/core"

const count = observableBox(0)

const increment = action(() => {
  count.value += 1
})
isAction(increment) // true

runInAction(() => {
  count.value = 10
})
```

### After (0.11.0)

```ts
import {
  isTransaction,
  observableBox,
  runInTransaction,
  transaction,
} from "@fobx/core"

const count = observableBox(0)

const increment = transaction(() => {
  count.set(count.get() + 1)
})
isTransaction(increment) // true

runInTransaction(() => {
  count.set(10)
})
```

## `autorun` and `reaction` callback arguments

In 0.10.2, callbacks received a `Reaction` object with `.track()` and
`.dispose()` methods. In 0.11.0, callbacks receive a plain `dispose` function.

### autorun

```ts
// 0.10.x
autorun((reaction) => {
  if (shouldStop.value) reaction.dispose()
})

// 0.11.0
autorun((dispose) => {
  if (shouldStop.get()) dispose()
})
```

### reaction

```ts
// 0.10.x
reaction(
  (rxn) => data.value,
  (current, previous, rxn) => {
    if (current > 10) rxn.dispose()
  },
)

// 0.11.0
reaction(
  (dispose) => data.get(),
  (current, previous, dispose) => {
    if (current > 10) dispose()
  },
)
```

## Removed exports

The following exports have been removed entirely.

| Removed export                    | Replacement                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| `extendObservable(target, props)` | Use `observable(target)` or `makeObservable(target, { annotations })` |
| `Reaction` / `ReactionAdmin`      | See `effect` and `createTracker` in `@fobx/core/internals`            |
| `getGlobalState()`                | No public replacement — internal debugging only                       |
| `$fobx`                           | Moved to `@fobx/core/internals` (see below)                           |
| `startAction()` / `endAction()`   | `startBatch()` / `endBatch()` in `@fobx/core/internals`               |

## New exports

### `observableArray`, `observableMap`, `observableSet`

Standalone factory functions for reactive collections. In 0.10.2 these were
internal — you could only create them via `observable()`. Now they are available
as first-class public exports:

```ts
import { observableArray, observableMap, observableSet } from "@fobx/core"

const list = observableArray([1, 2, 3])
const lookup = observableMap(new Map([["a", 1]]))
const tags = observableSet(new Set(["x"]))
```

`observable()` still works for collections too — these factories give you
explicit control and clearer intent.

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

If you were using `$fobx` or `startAction`/`endAction` from the main entry
point, update your imports:

```ts
// 0.10.x
import { $fobx } from "@fobx/core"

// 0.11.0
import { $fobx } from "@fobx/core/internals"
```

```ts
// 0.10.x
import { endAction, startAction } from "@fobx/core" // or deep import

// 0.11.0
import { endBatch, startBatch } from "@fobx/core/internals"
```

## Quick-reference cheatsheet

```diff
  import { observableBox } from "@fobx/core"
  const count = observableBox(0)

- count.value
+ count.get()

- count.value = 1
+ count.set(1)

- const doubled = computed(() => count.value * 2)
- doubled.value
+ const doubled = computed(() => count.get() * 2)
+ doubled.get()

- computed(() => x.value, (v) => { x.value = v })
+ computed(() => x.get(), { set: (v) => { x.set(v) } })

- makeObservable(this, { count: "observable", inc: "action" })
+ makeObservable(this, { annotations: { count: "observable", inc: "transaction" } })

- import { action, isAction, runInAction } from "@fobx/core"
+ import { isTransaction, runInTransaction, transaction } from "@fobx/core"

- const inc = action(() => { count.value += 1 })
+ const inc = transaction(() => { count.set(count.get() + 1) })

- runInAction(() => { count.value = 10 })
+ runInTransaction(() => { count.set(10) })

- autorun((reaction) => { reaction.dispose() })
+ autorun((dispose) => { dispose() })

- import { extendObservable } from "@fobx/core"
+ import { observable } from "@fobx/core" // or makeObservable

- import { $fobx } from "@fobx/core"
+ import { $fobx } from "@fobx/core/internals"

- import { startAction, endAction } from "@fobx/core"
+ import { startBatch, endBatch } from "@fobx/core/internals"
```
