---
title: Migrating to 0.11.x
description: Guide for upgrading from @fobx/core 0.10.x to 0.11.x.
navTitle: Migrating to 0.11.x
navSection: ["@fobx/core"]
navOrder: 4
---

This guide covers the verified public API changes between the published
`@fobx/core@0.10.2` package and **0.11.x**.

The biggest breaks are:

| 0.10.2                                      | 0.11.x                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| Raw annotation map arguments                | Single options object with `annotations`                   |
| `.value` on boxes and computeds             | `get()` / `set()`                                          |
| `action()` / `runInAction()` / `isAction()` | `transaction()` / `runInTransaction()` / `isTransaction()` |
| `equals` option name                        | `comparer`                                                 |
| `Reaction` callback objects                 | `dispose` callbacks                                        |
| `extendObservable()`                        | Removed                                                    |

---

## `observable()` and `makeObservable()` now use an `annotations` option

In `0.10.2`, `observable()` and `makeObservable()` accepted raw annotation maps
as positional arguments:

```ts
import { makeObservable, observable } from "@fobx/core"

const store = observable(
  {
    count: 0,
    increment() {
      this.count++
    },
  },
  {
    count: "observable",
    increment: "action",
  },
)

class Counter {
  count = 0

  constructor() {
    makeObservable(this, {
      count: "observable",
      increment: "action",
    })
  }

  increment() {
    this.count++
  }
}
```

In `0.11.x`, both APIs take a single options object, and annotations live under
`annotations`:

```ts
import { makeObservable, observable } from "@fobx/core"

const store = observable(
  {
    count: 0,
    increment() {
      this.count++
    },
  },
  {
    annotations: {
      count: "observable",
      increment: "transaction",
    },
  },
)

class Counter {
  count = 0

  constructor() {
    makeObservable(this, {
      annotations: {
        count: "observable",
        increment: "transaction",
      },
    })
  }

  increment() {
    this.count++
  }
}
```

The signature change is:

| 0.10.2                                    | 0.11.x                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `observable(obj, annotations?, options?)` | `observable(obj, { annotations, ...options })` |
| `makeObservable(obj, annotations)`        | `makeObservable(obj, { annotations })`         |

### Annotation names that changed

If your old annotation map used action annotations, rename them too:

| 0.10.2 annotation | 0.11.x annotation     |
| ----------------- | --------------------- |
| `"action"`        | `"transaction"`       |
| `"action.bound"`  | `"transaction.bound"` |

Other annotation names remain the same: `"observable"`, `"observable.ref"`,
`"observable.shallow"`, `"computed"`, `"flow"`, `"flow.bound"`, and `"none"`.

### Old `shallowRef` / `shallow` object options are gone

`0.10.2` supported object-level `shallowRef` and deprecated `shallow` options:

```ts
observable(obj, undefined, { shallowRef: true })
```

In `0.11.x`, use `defaultAnnotation: "observable.ref"` for the same global
"reference-only by default" behavior, or use per-property annotations:

```ts
observable(obj, {
  defaultAnnotation: "observable.ref",
})
```

That still applies to own function-valued fields too, so callback-style
properties stored directly on the object are kept by reference.

The regression fix here was only about class prototype methods: it prevents
`defaultAnnotation` from reinterpreting inherited methods, which still infer to
transactions or flows unless you annotate them explicitly.

If only some properties should be reference-only or shallow, move that intent
into `annotations`.

---

## `observableBox` and `computed` no longer use `.value`

In `0.10.2`, boxed values and computed values were read and written through
`.value`:

```ts
import { computed, observableBox } from "@fobx/core"

const count = observableBox(1)
count.value = count.value + 1

const doubled = computed(
  () => count.value * 2,
  (next) => {
    count.value = next / 2
  },
)

console.log(doubled.value)
```

In `0.11.x`, use `get()` and `set()` explicitly:

```ts
import { computed, observableBox } from "@fobx/core"

const count = observableBox(1)
count.set(count.get() + 1)

const doubled = computed(
  () => count.get() * 2,
  {
    set: (next) => {
      count.set(next / 2)
    },
  },
)

console.log(doubled.get())
```

This affects both reads and writes:

| 0.10.2                       | 0.11.x                    |
| ---------------------------- | ------------------------- |
| `box.value`                  | `box.get()`               |
| `box.value = next`           | `box.set(next)`           |
| `computedValue.value`        | `computedValue.get()`     |
| `computedValue.value = next` | `computedValue.set(next)` |

Two related API changes come with that shift:

1. `computed(getFn, setFn?, options?)` became
   `computed(getFn, { set, ...options })`.
2. `computed(..., { thisArg })` became `computed(..., { bind })`.

Also note that `observableBox()` now expects an explicit initial value. If you
previously relied on `observableBox()` with no argument, pass `undefined`
explicitly and type it:

```ts
const maybeName = observableBox<string | undefined>(undefined)
```

---

## `action` APIs were renamed to `transaction`

The 0.10.2 action helpers and action annotation names were renamed:

| 0.10.2            | 0.11.x                 |
| ----------------- | ---------------------- |
| `action(fn)`      | `transaction(fn)`      |
| `runInAction(fn)` | `runInTransaction(fn)` |
| `isAction(fn)`    | `isTransaction(fn)`    |
| `"action"`        | `"transaction"`        |
| `"action.bound"`  | `"transaction.bound"`  |

Example:

```ts
// 0.10.2
const save = action(() => {
  store.count++
})

runInAction(() => {
  store.count++
})
```

```ts
// 0.11.x
const save = transaction(() => {
  store.count++
})

runInTransaction(() => {
  store.count++
})
```

If you used `action(fn, { getThis })`, there is no matching `transaction()`
option in `0.11.x`. Bind manually before wrapping, or use the
`"transaction.bound"` annotation on class methods.

---

## `autorun()` and `reaction()` callback parameters changed

In `0.10.2`, these APIs passed `Reaction` objects into your callbacks. In the
current API, `autorun()` still passes a `dispose` function, while `reaction()`
passes `dispose` on a small context object.

### `autorun()`

```ts
// 0.10.2
autorun((reaction) => {
  if (done.value) reaction.dispose()
})

// 0.11.x
autorun((dispose) => {
  if (done.get()) dispose()
})
```

### `reaction()`

```ts
// 0.10.2
reaction(
  (reaction) => source.value,
  (value, previous, reaction) => {
    if (value > 10) reaction.dispose()
  },
)

// 0.11.x
reaction(
  (dispose) => source.get(),
  (value, previous, { dispose, hasPrevious }) => {
    if (!hasPrevious) {
      console.log("first run")
    }
    if (value > 10) dispose()
  },
)
```

For `reaction(..., { fireImmediately: true })`, the first callback now matches
the older `previousValue` surface behavior while still exposing the corner case
explicitly:

| Current callback state | Meaning |
| ---------------------- | ------- |
| `previousValue === undefined` and `hasPrevious === false` | First immediate run — no previous value existed yet |
| `previousValue === undefined` and `hasPrevious === true` | The real previous value was actually `undefined` |

If your code needs to distinguish those cases, check `hasPrevious` rather than
comparing against a sentinel.

---

## Option names changed from `equals` to `comparer`

`0.10.2` accepted `equals` in several places. In `0.11.x`, use `comparer`
instead.

This affects:

1. `observableBox(..., { equals })`
2. `computed(..., { equals })`
3. `reaction(..., { equals })`

Before:

```ts
const count = observableBox(0, {
  equals: (prev, next) => Math.abs(prev - next) < 0.01,
})
```

After:

```ts
const count = observableBox(0, {
  comparer: (prev, next) => Math.abs(prev - next) < 0.01,
})
```

`ComparisonType` also became `EqualityComparison` in the public types.

One box-specific option was removed entirely: `valueTransform`. If you relied on
that in `0.10.2`, transform the value before calling `observableBox()` or before
calling `set()`.

---

## Removed public exports

These names were public in `0.10.2` but are not part of the `0.11.x` top-level
API:

1. `extendObservable`
2. `Reaction`
3. `ReactionAdmin`
4. `getGlobalState`

### `extendObservable()`

`extendObservable()` has no direct replacement in `0.11.x`.

The intended migration is to define the observable shape up front and then call
`observable()` or `makeObservable()` once, instead of dynamically extending an
already-created observable object.

### Removed reaction internals

If you imported `Reaction` or `ReactionAdmin`, migrate away from those internal
types and use the public dispose functions returned by `autorun()`,
`reaction()`, and `when()`.

### Removed global internals

If you imported `getGlobalState()`, there is no public `0.11.x` replacement.
That API is no longer part of the supported surface.

---

## `configure()` transaction warning key was renamed

The transaction-warning boolean now uses `enforceTransactions`:

```ts
configure({
  enforceTransactions: true,
  comparer: { structural: myDeepEqual },
  onReactionError: (error, reaction) => {
    console.error(error, reaction)
  },
})
```

If your `0.10.2` code used `boolean` `enforceActions`, rename that key to
`enforceTransactions`. `comparer.structural` and `onReactionError` do not need
changes.

---

## Quick migration checklist

1. Wrap old annotation maps in `annotations: { ... }`.
2. Rename `"action"` to `"transaction"` and `"action.bound"` to
   `"transaction.bound"`.
3. Replace `.value` reads and writes with `get()` and `set()`.
4. Move computed setters into `computed(fn, { set })`.
5. Replace `thisArg` with `bind` in `computed()` options.
6. Replace `action()`, `runInAction()`, and `isAction()` with their
   `transaction` equivalents.
7. Replace `equals:` with `comparer:`.
8. Replace object-level `shallowRef` / `shallow` usage with
   `defaultAnnotation: "observable.ref"` or explicit annotations.
9. Update `autorun()` and `reaction()` callbacks to use `dispose` instead of
   `Reaction` objects.
10. Remove imports of `extendObservable`, `Reaction`, `ReactionAdmin`, and
    `getGlobalState`.
