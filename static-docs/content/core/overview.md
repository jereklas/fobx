---
title: "Overview: A 5-Minute Tour"
navTitle: A 5-Minute Tour
navSection: ["@fobx/core"]
navOrder: 2
---

This page gives you a quick tour of everything `@fobx/core` offers. Each section
links to the full API docs for deeper reading.

---

## Observable values

The simplest reactive primitive is a **box** — a single observable value:

```ts
import * as fobx from "@fobx/core"

const count = fobx.observableBox(0)
count.get() // 0
count.set(1)
count.get() // 1
```

→ [observableBox API](/core/api/observable-box/)

---

## Observable objects

`observable()` makes an entire object reactive in one call. Data properties
become observable, getters become computeds, and functions become transactions.
It works with both plain objects and class instances:

```ts
const store = fobx.observable({
  count: 0,
  get doubled() {
    return this.count * 2
  },
  increment() {
    this.count++
  },
})

store.count // 0 (observable read)
store.doubled // 0 (computed getter)
store.increment() // mutations batched in a transaction
store.doubled // 2 (recomputed)
```

For class instances where you need explicit control over which members are
reactive, use `makeObservable` with an annotations map:

```ts
class Counter {
  count = 0
  get doubled() {
    return this.count * 2
  }
  increment() {
    this.count++
  }

  constructor() {
    fobx.makeObservable(this, {
      annotations: {
        count: "observable",
        doubled: "computed",
        increment: "transaction",
      },
    })
  }
}
```

> **Note:** `observable()` auto-infers annotations. `makeObservable()` requires
> an explicit annotations map — it does not auto-infer.

→ [observable / makeObservable API](/core/api/observable/)

---

## Collections

Reactive arrays, maps, and sets with full standard API support:

```ts
const items = fobx.observableArray(["a", "b"])
const scores = fobx.observableMap([["alice", 100]])
const tags = fobx.observableSet(["typescript", "reactive"])

items.push("c") // triggers reactions observing the array
scores.set("bob", 85) // triggers reactions reading this key
tags.add("state") // triggers reactions observing the set
```

→ [observableArray](/core/api/observable-array/) ·
[observableMap](/core/api/observable-map/) ·
[observableSet](/core/api/observable-set/)

---

## Computed values

Derived state that caches while observed and only recomputes when dependencies
change:

```ts
const price = fobx.observableBox(10)
const qty = fobx.observableBox(3)

const total = fobx.computed(() => price.get() * qty.get())
// total.get() = 30
// Cached when observed by a reaction; recomputes only when price or qty changes.
// If the recomputed value is the same (per its comparer), downstream reactions
// are NOT notified — computeds act as firewalls.
```

→ [computed API](/core/api/computed/)

---

## Reactions

### autorun — run immediately, re-run on changes

```ts
const stop = fobx.autorun(() => {
  console.log(`Count: ${store.count}`)
})
// Logs immediately, then whenever store.count changes

stop() // dispose when done
```

→ [autorun API](/core/api/autorun/)

### reaction — two-phase: track expression, run effect on change

```ts
const stop = fobx.reaction(
  () => store.count, // tracked expression
  (value, prev) => { // effect (runs only when expression output changes)
    console.log(`${prev} → ${value}`)
  },
)
```

→ [reaction API](/core/api/reaction/)

### when — one-shot conditional reaction

```ts
// Effect form
fobx.when(
  () => store.count > 10,
  () => console.log("Count exceeded 10!"),
)

// Promise form
await fobx.when(() => store.count > 10)
```

→ [when API](/core/api/when/)

---

## Transactions

Batch mutations so reactions fire only once after all changes are applied:

```ts
const a = fobx.observableBox(0)
const b = fobx.observableBox(0)

// Immediate execution — runs the body and returns its result
fobx.runInTransaction(() => {
  a.set(1)
  b.set(2)
}) // reactions fire ONCE here, not twice

// Higher-order function — wraps a function for repeated use
const reset = fobx.transaction(() => {
  a.set(0)
  b.set(0)
})
reset() // each call is automatically batched
```

→ [Transactions API](/core/api/transactions/)

---

## Async with `flow`

`flow` wraps a generator function so each synchronous segment between `yield`
points runs inside a transaction. Use `yield` in place of `await`:

```ts
const fetchData = fobx.flow(function* (url: string) {
  store.status = "loading"
  const data = yield fetch(url).then((r) => r.json())
  store.data = data
  store.status = "done"
})

await fetchData("/api/items")
```

→ [flow API](/core/api/flow/)

---

## Efficient selection with createSelector

O(1) reactive selection for "one of many" patterns when you use the default
equality check. Only the previously-selected and newly-selected items are
notified:

```ts
const selectedId = fobx.observableBox(1)
const isSelected = fobx.createSelector(() => selectedId.get())

// In each row: isSelected(row.id) — reactive, O(1) with the default comparer
selectedId.set(5) // only rows 1 and 5 react, not all rows
```

→ [createSelector API](/core/api/create-selector/)

---

## Tracking control

Suppress dependency tracking when reading a value you don't want to subscribe
to:

```ts
fobx.autorun(() => {
  const tracked = count.get() // tracked — changes re-run autorun
  const untracked = fobx.runWithoutTracking(() => other.get()) // NOT tracked
})
```

→ [runWithoutTracking API](/core/api/run-without-tracking/)

---

## Configuration & introspection

```ts
fobx.configure({
  comparer: { structural: deepEqual },
  onReactionError: (err) => logError(err),
})

fobx.isObservable(obj, "prop") // true/false
fobx.isComputed(obj, "getter") // true/false
fobx.isTransaction(fn) // true/false
```

→ [configure](/core/api/configure/) ·
[Type predicates](/core/api/type-predicates/)

---

## Annotations at a glance

| Annotation             | Applied to       | Behavior                                                   |
| ---------------------- | ---------------- | ---------------------------------------------------------- |
| `"observable"`         | Data property    | Deep observable — nested objects/collections are converted |
| `"observable.ref"`     | Data property    | Tracks reassignment only — value stored as-is              |
| `"observable.shallow"` | Data property    | Collection is observable, items are not deep-converted     |
| `"computed"`           | Getter           | Cached derived value                                       |
| `"transaction"`        | Method           | Batched mutation — reactions deferred                      |
| `"transaction.bound"`  | Method           | Same + `this` is bound                                     |
| `"flow"`               | Generator method | Async flow — each segment is a transaction                 |
| `"flow.bound"`         | Generator method | Same + `this` is bound                                     |
| `"none"`               | Any              | Excluded from reactivity                                   |

→ [Full annotation reference](/core/api/observable/)
