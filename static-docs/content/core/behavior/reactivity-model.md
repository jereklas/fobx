---
title: Reactivity Model
description: How tracking, batching, and propagation work inside FobX.
navSection: Core/Behavior
navOrder: 1
---

This guide explains how FobX works internally. Understanding these mechanics
helps you write more predictable reactive code and debug subtle behaviors.

## Dependency tracking

FobX uses a **push-pull** reactivity model. When a reaction or computed runs, it
enters a _tracking context_. Every observable `get()` that happens inside that
context registers the observable as a dependency of the currently-running node.

When any dependency changes (via `set()` or a collection mutation), FobX marks
the dependent nodes as stale and schedules them to re-run at the end of the
current transaction batch.

### Dependencies are rebuilt every run

Dependency edges are **not** incremental — they are rebuilt completely on each
execution. This means:

- Conditional reads are handled naturally: if a branch is not taken, its
  observables are not tracked.
- There is no "stale subscription" problem from previous runs.

```ts
import * as fobx from "@fobx/core"

const flag = fobx.observableBox(false)
const a = fobx.observableBox("value-a")
const b = fobx.observableBox("value-b")

let log: string[] = []
const stop = fobx.autorun(() => {
  log.push(flag.get() ? b.get() : a.get())
})

// flag=false: tracked = {flag, a}
a.set("new-a") // re-runs: a is tracked
b.set("new-b") // does NOT re-run: b is not tracked yet

flag.set(true) // re-runs: flag changed
// flag=true: tracked = {flag, b}

a.set("another-a") // does NOT re-run: a is no longer tracked
b.set("another-b") // re-runs: b is now tracked

stop()
// log: ["value-a", "new-a", "new-b", "another-b"]
if (log.length !== 4) throw new Error("unexpected log length")
```

### Tracking is synchronous only

FobX only tracks observables read during the **synchronous** portion of a
tracked function. Reads inside `setTimeout`, promise callbacks, or other
asynchronous continuations are NOT tracked:

```ts
import * as fobx from "@fobx/core"

const value = fobx.observableBox(1)
let syncRuns = 0
let asyncRead = 0

const stop = fobx.autorun(() => {
  syncRuns++
  // This read IS tracked
  const v = value.get()

  // Async reads are NOT tracked:
  Promise.resolve().then(() => {
    asyncRead = value.get() // not a tracked read
  })

  return v
})

value.set(2) // causes one re-run (syncRuns becomes 2)
stop()

if (syncRuns !== 2) throw new Error("expected 2 sync runs")
```

---

## The transaction batch

Every state mutation must happen inside a **transaction** (called via
`runInTransaction`, `transaction()`, or the methods on observable objects).
Transactions provide two guarantees:

1. **Batching**: Reactions and computed invalidations accumulate during the
   transaction. Reactions only run after the outermost transaction ends.
2. **Untrackeability**: Reads inside a transaction body do not add dependencies
   to an enclosing reaction.

### Why batching matters

Without batching, reactions would run after every individual observable write,
potentially seeing inconsistent intermediate state:

```ts
import * as fobx from "@fobx/core"

const x = fobx.observableBox(0)
const y = fobx.observableBox(0)

const seen: string[] = []
const stop = fobx.autorun(() => {
  seen.push(`(${x.get()},${y.get()})`)
})
// seen: ["(0,0)"]

// In a transaction, both writes are batched — only ONE reaction run
fobx.runInTransaction(() => {
  x.set(3)
  y.set(4)
})
// seen: ["(0,0)", "(3,4)"] — never sees "(3,0)" or "(0,4)"

stop()
if (seen.length !== 2) throw new Error("expected exactly 2 reaction runs")
if (seen[1] !== "(3,4)") throw new Error("expected (3,4)")
```

### Nested transactions

Transactions nest cleanly. Only the outermost transaction triggers the flush:

```ts
import * as fobx from "@fobx/core"

const a = fobx.observableBox(0)
let runs = 0
const stop = fobx.autorun(() => {
  a.get()
  runs++
})
// runs = 1

fobx.runInTransaction(() => { // outer batch
  fobx.runInTransaction(() => { // inner batch
    a.set(1) // pending...
  }) // inner end — still pending (outer open)
  a.set(2) // still pending...
}) // outer end — flush! reactions run once

// runs = 2 (not 3)
stop()
if (runs !== 2) throw new Error("expected 2 runs")
```

---

## Computed value lifecycle

Computeds have two modes depending on whether they are being observed:

### Suspended (unobserved)

When a computed has no observers (no autorun/reaction is reading it), it
operates in **pure function mode**:

- It does not cache its value.
- Each `get()` call recomputes from scratch.
- It holds no subscriptions to its own dependencies.

This prevents memory leaks from computeds that are read once and abandoned.

```ts
import * as fobx from "@fobx/core"

const a = fobx.observableBox(1)
let computeCount = 0

const doubled = fobx.computed(() => {
  computeCount++
  return a.get() * 2
})

// No observers — each get() is a fresh computation
const v1 = doubled.get() // computeCount = 1
const v2 = doubled.get() // computeCount = 2 (no cache!)

if (v1 !== 2 || v2 !== 2) throw new Error("wrong value")
if (computeCount !== 2) throw new Error("expected 2 computes (unobserved mode)")
```

### Active (observed)

When a computed is observed by at least one reaction or another computed, it
activates **cached mode**:

- It subscribes to its dependencies.
- After the initial run, `get()` returns the cached value without recomputing.
- It recomputes only when a dependency changes.
- When it loses all observers, it suspends again (value cleared, deps removed).

```ts
import * as fobx from "@fobx/core"

const a = fobx.observableBox(1)
let computeCount = 0

const doubled = fobx.computed(() => {
  computeCount++
  return a.get() * 2
})

// Observe it via autorun — activates the computed
const stop = fobx.autorun(() => doubled.get())
// computeCount = 1 (initial run)

doubled.get() // computeCount still 1 — served from cache
doubled.get() // computeCount still 1 — served from cache

a.set(2) // dependency changed, computed invalidated
doubled.get() // computeCount = 2 — recomputed
doubled.get() // computeCount still 2 — served from cache again

stop()
// Computed suspends: cache cleared, deps removed
doubled.get() // computeCount = 3 — back to pure function mode

if (computeCount !== 3) throw new Error("expected 3 computations total")
```

### Computed as an optimization layer

Because computeds cache their result and only propagate if the output actually
changed, they act as **firewalls** between upstream state and downstream
reactions:

```ts
import * as fobx from "@fobx/core"

const price = fobx.observableBox(10)
const quantity = fobx.observableBox(3)

let reactionRuns = 0
let computeRuns = 0

const total = fobx.computed(() => {
  computeRuns++
  return price.get() * quantity.get()
})

const stop = fobx.autorun(() => {
  reactionRuns++
  total.get() // reaction only depends on total, not price/quantity directly
})
// reactionRuns=1, computeRuns=1

// Changing price triggers total to recompute
price.set(10) // price didn't change — comparer blocks propagation
// reactionRuns=1 (unchanged), computeRuns=1 (unchanged)

price.set(20)
// Order: price changes → total invalidated → total recomputes → total changed
// → reaction re-runs
// reactionRuns=2, computeRuns=2

stop()
if (reactionRuns !== 2) throw new Error("wrong reaction run count")
if (computeRuns !== 2) throw new Error("wrong compute run count")
```

---

## Collection change signaling

Observable arrays, maps, and sets use a **change counter** in addition to the
standard observable mechanism. When returned from a `reaction` expression,
collections are compared by change count rather than by reference:

```ts
import * as fobx from "@fobx/core"

const m = fobx.observableMap<string, number>()
let runs = 0
const stop = fobx.reaction(() => m, () => runs++)

m.set("a", 1)
m.set("a", 2)
m.delete("a")

stop()
if (runs !== 3) throw new Error("expected 3 reaction runs for 3 map changes")
```

Within a tracked context, individual collection operations track at different
granularities depending on the collection type:

- `array[i]` — tracks the **whole array** (any mutation re-triggers).
- `array.length` — tracks the length observable.
- `map.get(key)` / `map.has(key)` — tracks that specific key.
- `set.has(value)` — tracks that specific value.
- `map.size` / `set.size` — tracks the size observable.
- Iteration (`for...of`, spread, `forEach`) on any collection — tracks the whole
  collection.

---

## Error handling

FobX wraps scheduled reaction and computed executions in error boundaries:

- If a reaction throws, the error is caught and passed to
  `configure({ onReactionError })` if set, then logged in development.
- The reaction remains active and will run again on the next change.
- If the **transaction body** throws, the error is re-thrown to the caller.
  Secondary reaction errors in the same cycle are suppressed (logged in dev) to
  avoid noise from cascading failures.
- An unobserved `computed.get()` runs directly and throws to the caller.

```ts
import * as fobx from "@fobx/core"

const errors: unknown[] = []
fobx.configure({
  onReactionError: (err) => errors.push(err),
})

const value = fobx.observableBox(0)
const stop = fobx.autorun(() => {
  if (value.get() === 1) throw new Error("boom")
})

value.set(1) // error caught, passed to onReactionError
value.set(2) // reaction recovers and runs normally

stop()
if (errors.length !== 1) throw new Error("expected 1 error")
if ((errors[0] as Error).message !== "boom") throw new Error("wrong error")

// Note: configure({ onReactionError: undefined }) is a no-op in the current
// implementation. The handler persists for the lifetime of the runtime.
```
