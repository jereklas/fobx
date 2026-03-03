---
title: FobX Core
description: Transparent reactive state management — observables, computeds, and reactions.
navTitle: Introduction
navSection: Core
navOrder: 0
---

## What is FobX?

FobX is a lightweight, transparent reactive programming library. You model your
application state as **observable** values, derive facts from that state using
**computeds**, and react to changes with **reactions**. FobX takes care of
tracking which reactive values each computation depends on and re-running only
what needs to run when state changes.

The mental model is simple:

```
State (observables) → Derived values (computeds) → Side effects (reactions)
                  ↑__________________________|_____________________________|
                              automatic dependency tracking
```

No manual subscriptions. No string event names. No diffing. Dependencies are
discovered automatically as your code runs, and only the precise computations
that depend on changed state are re-run.

---

## The three building blocks

### 1. Observables — reactive state

An observable is any piece of state that FobX tracks. When an observable
changes, everything that read it during its last run is scheduled to re-run.

Create standalone observable boxes:

```ts
import * as fobx from "@fobx/core"

const temperature = fobx.box(22)
console.log(temperature.get()) // 22
temperature.set(30)
console.log(temperature.get()) // 30
```

Make entire objects observable — getters become computeds, functions become
transactions, and data properties become observable values:

```ts
import * as fobx from "@fobx/core"

const weather = fobx.observable({
  city: "Berlin",
  temperatureC: 22,
  get temperatureF() {
    return this.temperatureC * 9 / 5 + 32
  },
  setTemp(c: number) {
    this.temperatureC = c
  },
})

weather.setTemp(0)
console.log(weather.temperatureF) // 32
```

Collections — arrays, maps, and sets — have their own reactive wrappers:

```ts
import * as fobx from "@fobx/core"

const items = fobx.array(["a", "b"])
const scores = fobx.map([["alice", 100]])
const tags = fobx.set(["typescript", "reactive"])
```

### 2. Computeds — derived state

A computed derives a value from other observables and **caches** it. It only
recomputes when an upstream dependency changes and it has at least one observer.

```ts
import * as fobx from "@fobx/core"

const price = fobx.box(10)
const quantity = fobx.box(3)

const total = fobx.computed(() => price.get() * quantity.get())

const stop = fobx.autorun(() => {
  console.log(`Total: $${total.get()}`)
})
// Logs: "Total: $30"

quantity.set(5)
// Logs: "Total: $50" — total recomputed because quantity changed

price.set(10)
// No output — price didn't change, total didn't change

stop()
```

Think of computeds like spreadsheet cells: they always reflect the current
state of their inputs, but they don't recompute unless something they read
actually changed.

### 3. Reactions — side effects

Reactions are functions that run automatically in response to observable state
changes. They are the place for side effects: logging, rendering, writing to
storage, posting to a server.

```ts
import * as fobx from "@fobx/core"

const user = fobx.observable({ name: "Alice", loggedIn: false })

// autorun runs once immediately, then re-runs whenever its dependencies change
const stop = fobx.autorun(() => {
  console.log(`${user.name} is ${user.loggedIn ? "online" : "offline"}`)
})
// Logs: "Alice is offline"

user.loggedIn = true
// Logs: "Alice is online"

stop() // disposer — reaction no longer runs

user.loggedIn = false
// (no output — reaction was stopped)
```

---

## Putting it all together

Here is a small but complete example that shows all three building blocks working together:

```ts
import * as fobx from "@fobx/core"

// 1. Define observable state
const cart = fobx.observable({
  items: fobx.array<{ name: string; price: number }>([]),

  addItem(item: { name: string; price: number }) {
    this.items.push(item)
  },

  removeItem(name: string) {
    const idx = this.items.findIndex((i) => i.name === name)
    if (idx !== -1) this.items.splice(idx, 1)
  },
})

// 2. Derive facts from state — only recomputes when items actually change
const subtotal = fobx.computed(() =>
  cart.items.reduce((sum, item) => sum + item.price, 0)
)

const itemCount = fobx.computed(() => cart.items.length)

// 3. React to changes — runs whenever subtotal or itemCount change
const stopDisplay = fobx.autorun(() => {
  console.log(`Cart: ${itemCount.get()} item(s), $${subtotal.get().toFixed(2)}`)
})
// Logs: "Cart: 0 item(s), $0.00"

// Batch mutations so reactions fire once after all changes
fobx.runInTransaction(() => {
  cart.addItem({ name: "Widget", price: 9.99 })
  cart.addItem({ name: "Gadget", price: 24.99 })
})
// Logs: "Cart: 2 item(s), $34.98" — one update, not two

cart.removeItem("Widget")
// Logs: "Cart: 1 item(s), $24.99"

stopDisplay()
```

---

## Transactions — batching mutations

FobX requires you to wrap state mutations in a **transaction**. Transactions
batch all changes and only schedule reactions after the outermost transaction
completes. This prevents reactions from seeing intermediate, half-updated state.

Use `runInTransaction` to execute a block once in a batch:

```ts
import * as fobx from "@fobx/core"

const firstName = fobx.box("Alice")
const lastName = fobx.box("Smith")

fobx.autorun(() => {
  console.log(`Name: ${firstName.get()} ${lastName.get()}`)
})
// Logs: "Name: Alice Smith"

fobx.runInTransaction(() => {
  firstName.set("Bob")   // reaction not yet triggered
  lastName.set("Jones")  // reaction not yet triggered
})
// Logs: "Name: Bob Jones" — one output, never "Bob Smith"
```

Use `transaction` to wrap a **function** permanently as a transaction:

```ts
import * as fobx from "@fobx/core"

const x = fobx.box(0)
const y = fobx.box(0)

// Every call to movePoint is automatically wrapped in a transaction
const movePoint = fobx.transaction((nx: number, ny: number) => {
  x.set(nx)
  y.set(ny)
})

fobx.autorun(() => console.log(`Point: (${x.get()}, ${y.get()})`))
// Logs: "Point: (0, 0)"

movePoint(3, 4)
// Logs: "Point: (3, 4)" — one reaction run, not two
```

> **FobX vs MobX terminology**: FobX uses `transaction`/`runInTransaction`
> where MobX uses `action`/`runInAction`. The semantics are the same — batched,
> untracked state mutation — but FobX's naming foregrounds the transactional
> guarantee. See [Compatibility and Non-goals](/core/behavior/compatibility-and-non-goals/)
> for a full list of differences.

---

## How dependency tracking works

Every time a reaction (`autorun`, `reaction`, `when`) or computed runs, FobX
records every observable **read** during that run. These become the node's
current dependencies. When any dependency changes, the node is scheduled to
re-run.

Dependencies are rebuilt **every run**. If your code branches on observable
values and conditionally reads different observables, the tracked set precisely
reflects only the reads from the most recent execution:

```ts
import * as fobx from "@fobx/core"

const showDetails = fobx.box(false)
const summary = fobx.box("Loading...")
const details = fobx.box("Full content here")

const stop = fobx.autorun(() => {
  if (showDetails.get()) {
    console.log("Details:", details.get())
  } else {
    console.log("Summary:", summary.get())
  }
})
// Logs: "Summary: Loading..."
// Tracked: { showDetails, summary }

summary.set("Ready")
// Logs: "Summary: Ready" — summary IS tracked
// Tracked: { showDetails, summary }

showDetails.set(true)
// Logs: "Details: Full content here" — showDetails changed
// Tracked: { showDetails, details }  ← summary is no longer tracked!

summary.set("Updated")
// (no output) — summary is no longer a dependency

details.set("New detail content")
// Logs: "Details: New detail content" — details IS tracked now

stop()
```

This dynamic dependency tracking means you pay only for what you actually use.

---

## Disposing reactions

Every reaction returns a **disposer function**. Always call it when the reaction
is no longer needed — otherwise it may hold references and keep running forever.

```ts
import * as fobx from "@fobx/core"

const count = fobx.box(0)

const stop = fobx.autorun(() => {
  console.log("count:", count.get())
})
// Logs: "count: 0"

count.set(1) // Logs: "count: 1"

stop() // ← clean up

count.set(2) // (no output — reaction is disposed)
```

---

## What to read next

- [Core Primitives](/core/api/core-primitives/) — `box`, `computed`, `autorun`,
  `reaction`, `when`
- [Objects and Annotations](/core/api/objects-and-annotations/) — `observable`,
  `makeObservable`, annotation reference
- [Collections](/core/api/collections/) — `array`, `map`, `set`
- [Transactions and Tracking](/core/api/transactions-and-tracking/) —
  `transaction`, `runInTransaction`, `withoutTracking`
- [Utilities and Configuration](/core/api/utilities-and-configuration/) —
  `configure`, inspection predicates
- [Reactivity Model](/core/behavior/reactivity-model/) — deep dive into how
  tracking, batching, and computed caching work internally
- [Compatibility and Non-goals](/core/behavior/compatibility-and-non-goals/)
