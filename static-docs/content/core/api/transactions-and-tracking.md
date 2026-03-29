---
title: Transactions and Tracking
description: Batch mutations and control dependency tracking.
navSection: Core/API
navOrder: 4
---

FobX requires state mutations to happen inside transactions. A transaction
batches all observable changes and defers reactions until the outermost
transaction ends. This section covers the three APIs for working with
transactions and tracking.

---

## `runInTransaction(fn)`

```ts
runInTransaction<T>(fn: () => T): T
```

Executes `fn` synchronously inside a one-off transaction, then returns its
return value. All reactions triggered by changes inside `fn` are deferred until
`fn` completes.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const a = fobx.observableBox(1)
const b = fobx.observableBox(2)
let runs = 0

const stop = fobx.autorun(() => {
  a.get()
  b.get()
  runs++
})
// runs = 1

// Without runInTransaction, autorun would fire twice (once per set)
fobx.runInTransaction(() => {
  a.set(10) // deferred
  b.set(20) // deferred
})
// reactions run here, once

stop()
if (runs !== 2) throw new Error("expected 2 total runs (initial + 1 batch)")
```

### Return value

```ts
import * as fobx from "@fobx/core"

const counter = fobx.observableBox(0)

const result = fobx.runInTransaction(() => {
  counter.set(42)
  return counter.get() * 2
})

if (result !== 84) throw new Error("runInTransaction should return fn result")
if (counter.get() !== 42) throw new Error("mutation should take effect")
```

### Useful for initializing state

Use `runInTransaction` to set up initial state without triggering multiple
reaction runs:

```ts
import * as fobx from "@fobx/core"

const user = fobx.observable({ name: "", email: "", role: "" })
const events: string[] = []

const stop = fobx.autorun(() => {
  if (user.name) events.push(user.name)
})

fobx.runInTransaction(() => {
  user.name = "Alice"
  user.email = "alice@example.com"
  user.role = "admin"
})
// single reaction run, not three

stop()
if (events.length !== 1) throw new Error("expected 1")
```

---

## `transaction(fn, options?)`

```ts
transaction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { name?: string }
): T
```

`transaction` wraps a function and returns a **new function** that, whenever
called, automatically runs its body inside a transaction. The returned function
has the same signature as `fn`.

The wrapper is tagged with `isTransaction(wrapper) === true`, and its prototype
is set to `fn` so duck-typing against the original still works.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const x = fobx.observableBox(0)
const y = fobx.observableBox(0)

const setPoint = fobx.transaction((nx: number, ny: number) => {
  x.set(nx)
  y.set(ny)
})

const positions: string[] = []
const stop = fobx.autorun(() => {
  positions.push(`(${x.get()},${y.get()})`)
})
// positions: ["(0,0)"]

setPoint(3, 4) // both writes batched — single reaction run
setPoint(1, 2)

stop()
if (positions.length !== 3) throw new Error("expected 3")
if (positions[1] !== "(3,4)") throw new Error("expected (3,4)")
```

### Using transaction for class methods

The most common pattern is to annotate class methods with `transaction` or
`transaction.bound` via `makeObservable`. But you can also wrap methods manually
after construction:

```ts
import * as fobx from "@fobx/core"

const store = fobx.observable({ a: 1, b: 2 })

// Alternatively, wrap a standalone function:
const reset = fobx.transaction(() => {
  store.a = 0
  store.b = 0
})

const log: string[] = []
const stop = fobx.autorun(() => log.push(`${store.a},${store.b}`))
// log: ["1,2"]

reset()
// log: ["1,2", "0,0"]

stop()
if (log[1] !== "0,0") throw new Error("expected 0,0 after reset")
```

### `isTransaction(fn)`

The `isTransaction` predicate returns `true` for functions wrapped with
`transaction`:

```ts
import * as fobx from "@fobx/core"

const plain = () => {}
const wrapped = fobx.transaction(plain)

if (fobx.isTransaction(plain)) {
  throw new Error("plain should not be a transaction")
}
if (!fobx.isTransaction(wrapped)) {
  throw new Error("wrapped should be a transaction")
}
```

### Transactions are untracked

Reads inside a transaction body do **not** add dependencies to any enclosing
reaction or computed. This is intentional — mutations should not create
dependencies:

```ts
import * as fobx from "@fobx/core"

const source = fobx.observableBox(1)
const target = fobx.observableBox(0)
let runs = 0

const copy = fobx.transaction(() => {
  target.set(source.get()) // reads source, but NOT tracked
})

const stop = fobx.autorun(() => {
  copy() // calls transaction, which reads source untracked
  runs++
})
// runs = 1

source.set(99) // does NOT re-trigger autorun (source untracked inside transaction)
if (runs !== 1) throw new Error("transaction reads should not be tracked")

stop()
```

---

## `runWithoutTracking(fn)`

```ts
runWithoutTracking<T>(fn: () => T): T
```

Runs `fn` while temporarily disabling dependency tracking, then restores the
previous tracking context. Any observable reads inside `fn` are **not
registered** as dependencies of the current reaction or computed.

This is useful when you need to read an observable for its value but you do not
want changes to that observable to re-trigger the current reaction.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const trigger = fobx.observableBox(0)
const untracked = fobx.observableBox(100)
let runs = 0

const stop = fobx.autorun(() => {
  trigger.get() // tracked
  // We want to READ untracked without subscribing to it:
  const value = fobx.runWithoutTracking(() => untracked.get())
  runs++
  void value
})
// runs = 1

untracked.set(999) // does NOT cause re-run — read was untracked
if (runs !== 1) throw new Error("untracked read should not subscribe")

trigger.set(1) // DOES cause re-run — trigger is tracked
if (runs !== 2) throw new Error("tracked read should subscribe")

stop()
```

### Reading analytics without subscribing

A practical use case is reading a value only for logging or analytics, where you
do not want a reaction to re-run just because the analytics-related state
changed:

```ts
import * as fobx from "@fobx/core"

const items = fobx.observableArray([1, 2, 3])
const userId = fobx.observableBox("user-123") // changes often, but we only read it for logging

let renderCount = 0

const stop = fobx.autorun(() => {
  renderCount++
  const count = items.length // tracked: re-run when items change

  fobx.runWithoutTracking(() => {
    // read userId for logging, but don't subscribe to it
    const uid = userId.get()
    void `User ${uid} sees ${count} items`
  })
})

userId.set("user-456") // does NOT re-run (userId is untracked)
if (renderCount !== 1) throw new Error("expected 1 render")

items.push(4) // DOES re-run (items is tracked)
if (renderCount !== 2) throw new Error("expected 2 renders")

stop()
```

### Difference between `runWithoutTracking` and `transaction`

|                                      | `runWithoutTracking`     | `transaction`          |
| ------------------------------------ | ------------------------ | ---------------------- |
| Purpose                              | Read without subscribing | Batch writes           |
| Batches notifications                | No                       | Yes                    |
| Reads inside contribute dependencies | No                       | No                     |
| Returns value                        | Yes                      | Yes (wraps a function) |

Both suppress dependency tracking for reads, but `transaction` also batches
notifications from writes.
