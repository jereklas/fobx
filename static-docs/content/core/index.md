---
title: "@fobx/core"
description: Transparent reactive state management — observables, computeds, and reactions.
navTitle: Introduction
navSection: ["@fobx/core"]
navOrder: 0
navSectionOrder: 1
navSectionExpanded: true
---

## What is @fobx/core?

`@fobx/core` is a lightweight, transparent reactive programming library. You
model your application state as **observable** values, derive facts from that
state using **computeds**, and react to changes with **reactions**. FobX takes
care of tracking which reactive values each computation depends on and
re-running only what needs to run when state changes.

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

```ts
import * as fobx from "@fobx/core"

// A single reactive value
const temperature = fobx.observableBox(22)
temperature.get() // 22
temperature.set(30)

// An entire reactive object
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
```

### 2. Computeds — derived state

A computed derives a value from other observables. While observed, it caches its
result and only recomputes when an upstream dependency changes. When unobserved,
each `get()` recomputes outside an active batch.

```ts
const price = fobx.observableBox(10)
const quantity = fobx.observableBox(3)
const total = fobx.computed(() => price.get() * quantity.get())

fobx.autorun(() => console.log(`Total: $${total.get()}`))
// Logs: "Total: $30"

quantity.set(5)
// Logs: "Total: $50" — total recomputed because quantity changed
```

### 3. Reactions — side effects

Reactions are functions that run automatically in response to observable state
changes.

```ts
const user = fobx.observable({ name: "Alice", loggedIn: false })

const stop = fobx.autorun(() => {
  console.log(`${user.name} is ${user.loggedIn ? "online" : "offline"}`)
})
// Logs: "Alice is offline"

user.loggedIn = true
// Logs: "Alice is online"

stop() // clean up — reaction no longer runs
```

---

## Core design principles

- **Transparent**: Read and write state with normal property access — no special
  syntax or wrappers needed for object properties.
- **Deterministic**: Reactions always see a consistent snapshot of state.
  Batched transactions prevent reactions from observing intermediate values.
- **Minimal**: Small, focused API surface. No decorators, no magic strings, no
  runtime transpilation.
- **Framework-agnostic**: `@fobx/core` works with any UI framework or without
  one. Separate packages provide bindings for React, etc.

---

## What to read next

- [Installation](/core/installation/) — add `@fobx/core` to your project
- [Overview](/core/overview/) — a 5-minute tour of every feature
- [Patterns & Anti-Patterns](/core/best-practices/patterns-and-antipatterns/) —
  practical guidance on what to lean into and what to avoid
- [How It Works](/core/how-it-works/) — deep dive on tracking, batching, and
  computed caching
- [Performance](/core/performance/) — benchmark-based performance comparison
  against MobX
- API Reference — browse one page per public function in the API section
