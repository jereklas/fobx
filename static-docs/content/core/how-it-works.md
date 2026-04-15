---
title: How It Works
description: Deep dive into dependency tracking, batching, computed caching, and the reactivity model.
navTitle: How It Works
navSection: ["@fobx/core"]
navOrder: 3
---

This guide explains how FobX works internally. Understanding these mechanics
helps you write more predictable reactive code and debug subtle behaviors.

---

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
```

### Epoch-based duplicate detection

Within a single tracking pass, FobX stamps each observable admin with the
current epoch when it is first tracked. If the same observable is read again
during the same pass, the stamp matches and the duplicate is skipped in O(1).
This means you can freely read the same observable multiple times in a reaction
without incurring extra subscription overhead.

### Tracking is synchronous only

FobX only tracks observables read during the **synchronous** portion of a
tracked function. Reads inside `setTimeout`, promise callbacks, or other
asynchronous continuations are NOT tracked:

```ts
const value = fobx.observableBox(1)

fobx.autorun(() => {
  const v = value.get() // tracked

  setTimeout(() => {
    value.get() // NOT tracked — async boundary
  }, 100)
})
```

This is why `flow()` exists — it wraps each synchronous segment between `yield`
points in a transaction so state mutations are properly batched.

---

## The transaction batch

Every state mutation should happen inside a **transaction**. Transactions
provide two guarantees:

1. **Batching**: Reactions and computed invalidations accumulate during the
   transaction. Reactions only run after the outermost transaction ends.
2. **Untracked reads**: Reads inside a transaction body do not add dependencies
   to an enclosing reaction.

### Why batching matters

Without batching, reactions would run after every individual observable write,
potentially seeing inconsistent intermediate state:

```ts
const x = fobx.observableBox(0)
const y = fobx.observableBox(0)

const seen: string[] = []
const stop = fobx.autorun(() => {
  seen.push(`(${x.get()},${y.get()})`)
})
// seen: ["(0,0)"]

fobx.runInTransaction(() => {
  x.set(3) // deferred
  y.set(4) // deferred
})
// seen: ["(0,0)", "(3,4)"] — never sees "(3,0)"

stop()
```

### Nested transactions

Transactions nest cleanly. Only the outermost transaction triggers the flush:

```ts
const a = fobx.observableBox(0)

fobx.runInTransaction(() => { // outer batch
  fobx.runInTransaction(() => { // inner batch
    a.set(1) // pending...
  }) // inner end — still pending
  a.set(2) // still pending...
}) // outer end — reactions run once
```

### The scheduling cycle

Under the hood, the transaction system works as follows:

1. `startTransaction()` increments a global transaction depth counter.
2. During the transaction, mutations mark dependent reactions as STALE and push
   them into a pending queue.
3. `endTransaction()` decrements the counter. When it reaches 0, the pending
   queue is drained.
4. Pending reactions are resolved in iterations: STALE reactions run
   immediately; POSSIBLY_STALE reactions (downstream of computeds) wait for
   their upstream computeds to resolve first.
5. If a cycle runs for more than 100 iterations, FobX logs an error and breaks
   to prevent infinite loops.

### Reaction state machine

Each reactive node has a state:

| State            | Meaning                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `UP_TO_DATE`     | Value is current. No work needed.                                           |
| `POSSIBLY_STALE` | An upstream computed might have changed. Check dependencies before running. |
| `STALE`          | A direct dependency changed. Must re-run.                                   |

When a box changes, direct dependents are marked STALE. When a computed is
invalidated, its dependents are marked POSSIBLY_STALE — they wait to see if the
computed's output actually changes before running.

---

## Computed value lifecycle

Computeds have two modes depending on whether they are being observed:

### Suspended (unobserved)

When a computed has no observers (no autorun/reaction reading it), it operates
in **pure function mode**:

- Outside an active batch, it does not cache its value.
- Outside an active batch, each `get()` call recomputes from scratch.
- It holds no subscriptions to its own dependencies.

This prevents memory leaks from computeds that are read once and abandoned.

```ts
const a = fobx.observableBox(1)
let computeCount = 0

const doubled = fobx.computed(() => {
  computeCount++
  return a.get() * 2
})

// No observers — each get() is a fresh computation
doubled.get() // computeCount = 1
doubled.get() // computeCount = 2 (no cache!)
```

### Active (observed)

When a computed is observed by at least one reaction, it activates **cached
mode**:

- It subscribes to its dependencies.
- `get()` returns the cached value without recomputing.
- It recomputes only when a dependency changes.
- When it loses all observers, it suspends again.

```ts
const a = fobx.observableBox(1)
let computeCount = 0

const doubled = fobx.computed(() => {
  computeCount++
  return a.get() * 2
})

const stop = fobx.autorun(() => doubled.get())
// computeCount = 1 (initial run)

doubled.get() // still 1 — served from cache
doubled.get() // still 1 — served from cache

a.set(2) // dependency changed
doubled.get() // computeCount = 2 — recomputed

stop()
// Computed suspends: cache cleared, deps removed
doubled.get() // computeCount = 3 — back to pure function mode
```

### Computeds as firewalls

Because computeds cache and only propagate when output changes, they act as
**firewalls** between upstream state and downstream reactions:

```ts
const price = fobx.observableBox(10)
const quantity = fobx.observableBox(3)

let reactionRuns = 0
const total = fobx.computed(() => price.get() * quantity.get())

const stop = fobx.autorun(() => {
  reactionRuns++
  total.get()
})
// reactionRuns = 1

price.set(10) // same value — comparer blocks. reactionRuns still 1
price.set(20) // total changes 30 → 60. reactionRuns = 2

stop()
```

---

## Observer storage

FobX uses a compact observer representation to minimize memory allocation:

- **No observers**: `null` (most common for unseen observables)
- **Single observer**: Direct reference to the reaction (avoids Set overhead)
- **Multiple observers**: Lazily upgraded to `Set<ReactionAdmin>`

This means a box that feeds exactly one autorun uses zero extra allocations for
the observer link.

---

## Collection change signaling

Observable arrays, maps, and sets use a **change counter** in addition to
standard observable notifications. When returned from a `reaction` expression,
collections are compared by change count rather than by reference:

```ts
const m = fobx.observableMap<string, number>()
let runs = 0
const stop = fobx.reaction(() => m, () => runs++)

m.set("a", 1) // runs = 1
m.set("a", 2) // runs = 2
m.delete("a") // runs = 3

stop()
```

### Tracking granularity

| Operation              | What is tracked                           |
| ---------------------- | ----------------------------------------- |
| `array[i]`             | Whole array (any mutation re-triggers)    |
| `array.length`         | Whole array                               |
| `map.get(key)`         | That specific key                         |
| `map.has(key)`         | That specific key (including absent keys) |
| `map.size`             | The keys collection                       |
| `set.has(value)`       | That specific value                       |
| `set.size`             | The whole set                             |
| Iteration (`for...of`) | The whole collection                      |

---

## Global scheduler state

FobX stores its scheduling state on `globalThis` via
`Symbol.for("fobx-scheduler")`. This means **all copies of FobX in the same page
share a single scheduling context**. This is critical for correctness:

- All reactions participate in one batch queue.
- There is exactly one "currently tracking" reaction at a time.
- Epoch counters are shared for deduplication.

This design supports micro-frontend architectures where multiple bundles may
include their own copy of `@fobx/core`.

---

## Error handling

FobX wraps scheduled reaction and computed executions in error boundaries:

- If a reaction throws, the error is caught and passed to
  `configure({ onReactionError })` if set. The reaction remains active and runs
  again on the next change.
- If a **transaction body** throws, the error propagates to the caller.
  Secondary reaction errors in the same cycle are suppressed to avoid noise from
  cascading failures.
- Outside an active batch, an unobserved `computed.get()` runs directly and
  throws to the caller. Inside batching, it is evaluated through the scheduler,
  cached for the rest of that batch, and routed through `onReactionError`.

```ts
const errors: unknown[] = []
fobx.configure({ onReactionError: (err) => errors.push(err) })

const value = fobx.observableBox(0)
const stop = fobx.autorun(() => {
  if (value.get() === 1) throw new Error("boom")
})

value.set(1) // error caught, passed to onReactionError
value.set(2) // reaction recovers and runs normally

stop()
```

---

## Enforced transactions

By default, FobX warns when you mutate an observable that has active observers
outside of a transaction. This helps catch two problems:

1. **Extra reaction runs**: Without batching, each individual mutation triggers
   its own reaction cycle. Observers may see inconsistent intermediate state
   (e.g., `firstName` updated but `lastName` not yet).
2. **Unintentional writes**: A stray assignment in a reaction or render function
   can cause infinite loops or hard-to-trace bugs. Enforcing transactions makes
   the mutation boundary explicit.

```ts
// This triggers a console.warn in development:
store.count = 5 // outside a transaction, but store.count has observers

// Correct:
fobx.runInTransaction(() => {
  store.count = 5
})
```

This behavior can be toggled via `configure({ enforceTransactions: false })`.
