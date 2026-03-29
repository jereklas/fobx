---
title: Migrating to 0.11.x
description: Guide for upgrading from @fobx/core 0.10.x to 0.11.x.
navTitle: Migrating to 0.11.x
navSection: ["@fobx/core"]
navOrder: 4
---

This guide covers breaking changes when upgrading from `@fobx/core` **0.10.x**
to **0.11.x**.

---

## `observable()` refresher

`observable()` works with both plain objects and class instances:

```ts
import { observable } from "@fobx/core"

const store = observable({
  count: 0,
  items: ["a", "b"],
  get total() {
    return this.items.length
  },
})
```

For plain-object stores, `observable()` auto-infers annotations — data
properties become `"observable"`, getters become `"computed"`, and functions
become `"transaction"`. No annotation map needed.

### What `observable()` does

- Wraps own data properties in an `observableBox`.
- Wraps `get` accessors in a `computed`.
- Wraps function-valued properties as transactions (auto-batched).
- Wraps generator functions as flows.
- For plain objects, returns a new observable copy by default (`inPlace: true`
  keeps the same reference).
- For class instances, mutates the instance in place and installs reactive
  descriptors on the instance and/or prototype.
- Routes arrays, maps, and sets to their collection-specific observable
  implementations.

### Differences from `makeObservable()`

| Feature           | `observable()`                            | `makeObservable()`        |
| ----------------- | ----------------------------------------- | ------------------------- |
| Input             | Plain object or class instance            | Any non-collection object |
| Annotation map    | Optional (auto-inferred)                  | Required                  |
| Prototype methods | Not supported (plain) / Supported (class) | Supported                 |
| Inheritance       | Not supported (plain) / Supported (class) | Supported                 |

---

## `makeObservable()` changes

`makeObservable()` requires an explicit annotations map. It does **not**
auto-infer annotations.

```ts
class Store {
  count = 0
  get doubled() {
    return this.count * 2
  }
  increment() {
    this.count++
  }

  constructor() {
    makeObservable(this, {
      annotations: {
        count: "observable",
        doubled: "computed",
        increment: "transaction",
      },
    })
  }
}
```

### New annotation values

| Annotation             | Meaning                                          |
| ---------------------- | ------------------------------------------------ |
| `"observable"`         | Deep observable (same as before)                 |
| `"observable.ref"`     | Reference-only observable — no deep conversion   |
| `"observable.shallow"` | Shallow observable collection                    |
| `"computed"`           | Computed value                                   |
| `"transaction"`        | Transaction (auto-batched function)              |
| `"transaction.bound"`  | Transaction with bound `this`                    |
| `"flow"`               | Flow (generator-based async)                     |
| `"flow.bound"`         | Flow with bound `this`                           |
| `"none"`               | Skip — do not make this field reactive           |
| `false`                | Skip — override auto-inference in `observable()` |

---

## Collection iteration behavior

Observable arrays, maps, and sets return the **stored** values from iterators
and callback methods. In deep mode, those stored values may themselves be
observable conversions:

```ts
const arr = observableArray([{ name: "a" }])
makeObservable(arr[0]) // hypothetical

for (const item of arr) {
  // item is the converted value stored in the array
}
```

The same change applies to `.forEach()`, `.map()`, `.filter()`, `.find()`,
`.entries()`, `.values()`, and the spread operator on observable collections.

---

## `configure()` changes

### `enforceActions`

The `enforceActions` option now accepts `boolean` values:

```ts
import { configure } from "@fobx/core"

// 0.10.x
configure({ enforceActions: "observed" })

// 0.11.x
configure({ enforceActions: true })
```

### `onReactionError`

New callback for centralized error handling:

```ts
configure({
  onReactionError: (error) => {
    console.error("Reaction error:", error)
  },
})
```

---

## Removed / renamed APIs

| 0.10.x          | 0.11.x                 | Notes                                       |
| --------------- | ---------------------- | ------------------------------------------- |
| `action()`      | `transaction()`        | HOF that wraps a function in a transaction. |
| `runInAction()` | `runInTransaction()`   | Immediate execution form.                   |
| `untracked()`   | `runWithoutTracking()` | Clearer name.                               |
| N/A             | `isTransaction()`      | New predicate.                              |
| N/A             | `isFlow()`             | New predicate.                              |

---

## `observableBox` comparer changes

Box and computed comparers now use the `EqualityComparison` type:

```ts
import { computed, observableBox } from "@fobx/core"

// Built-in comparers
const a = observableBox(0) // default comparer
const b = observableBox(0, { comparer: "structural" }) // structural equality
const c = observableBox(0, { comparer: "default" }) // explicit default

// Custom comparer
const d = observableBox(0, {
  comparer: (prev, next) => Math.abs(prev - next) < 0.01,
})
```

Available built-in comparers: `"default"` (identity + NaN handling),
`"structural"` (requires `configure({ comparer: { structural: fn } })`), or a
custom `(a, b) => boolean` function.

---

## Quick migration checklist

1. Replace `action()` calls with `transaction()`.
2. Replace `runInAction()` calls with `runInTransaction()`.
3. Replace `untracked()` calls with `runWithoutTracking()`.
4. Update `configure({ enforceActions: "observed" })` to
   `configure({ enforceActions: true })`.
5. Review collection iteration code — iterators now yield observable values.
6. Consider using `observable()` for plain-object stores instead of
   `makeObservable()`.
7. If using custom equality functions, verify they match the
   `(prev: T, next: T) => boolean` signature.
