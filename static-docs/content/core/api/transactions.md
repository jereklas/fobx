---
title: Transactions
description: Batch state mutations so reactions run only after all changes complete.
navTitle: Transactions
navSection: ["@fobx/core", "API"]
navOrder: 10
---

Transactions batch multiple observable mutations together. Reactions only run
after the outermost transaction completes, ensuring observers never see
partially-updated state.

## Signature

```ts
function runInTransaction<T>(fn: () => T): T
function transaction<T extends (...args: any[]) => any>(
  fn: T,
  options?: TransactionOptions,
): T
```

`runInTransaction` executes a function immediately inside a transaction and
returns its result.

`transaction` is a **higher-order function** — it wraps a function and returns a
new function. Each call to the returned function runs inside a transaction.

## Basic usage

```ts
import { autorun, observableBox, runInTransaction } from "@fobx/core"

const first = observableBox("Alice")
const last = observableBox("Smith")

let runs = 0
const stop = autorun(() => {
  runs++
  console.log(`${first.get()} ${last.get()}`)
})
// runs = 1, prints: Alice Smith

runInTransaction(() => {
  first.set("Bob") // deferred
  last.set("Jones") // deferred
})
// runs = 2, prints: Bob Jones
// Never sees "Bob Smith"

stop()
```

## Return value

`runInTransaction` returns whatever the body returns:

```ts
const result = runInTransaction(() => {
  x.set(1)
  y.set(2)
  return x.get() + y.get()
})
// result = 3
```

## Nesting

Transactions nest — only the outermost one triggers the reaction flush:

```ts
runInTransaction(() => { // depth 1
  a.set(1)
  runInTransaction(() => { // depth 2
    b.set(2)
  }) // depth 2 ends — still batched
  c.set(3)
}) // depth 1 ends — flush
```

## `transaction()` — wrapping for reuse

`transaction` wraps a function so that every invocation runs inside a
transaction:

```ts
import { observableBox, transaction } from "@fobx/core"

const a = observableBox(0)
const b = observableBox(0)

const reset = transaction(() => {
  a.set(0)
  b.set(0)
})

// Each call is automatically batched:
reset()
```

## Actions as transactions

Functions annotated as `"transaction"` (or `"transaction.bound"`) in
`observable()` / `makeObservable()` are automatically wrapped in a transaction:

```ts
import { makeObservable } from "@fobx/core"

class Store {
  x = 0
  y = 0

  move(dx: number, dy: number) {
    this.x += dx // batched
    this.y += dy // batched
  }

  constructor() {
    makeObservable(this, {
      annotations: {
        x: "observable",
        y: "observable",
        move: "transaction",
      },
    })
  }
}
```

## `isTransaction()`

Check whether a function was wrapped by `transaction()`:

```ts
import { isTransaction, transaction } from "@fobx/core"

const reset = transaction(() => {})

console.log(isTransaction(reset)) // true
console.log(isTransaction(() => {})) // false
```

FobX does not currently expose a public "am I inside a transaction right now?"
predicate.

## Error handling

If the transaction body throws, the error propagates to the caller. Pending
reactions from mutations that occurred before the error are still flushed:

```ts
try {
  runInTransaction(() => {
    x.set(1) // mutation registers
    throw new Error("oops")
  })
} catch (e) {
  // x.set(1) was committed; reactions already ran
}
```

## When to use

- Wrapping multi-property updates to prevent intermediate renders.
- Event handlers that modify multiple observables.
- Any code path where you want reactions to see a consistent snapshot.

Prefer `"transaction"` annotations on class methods over explicit
`runInTransaction()` calls — they compose better and are less error-prone.
