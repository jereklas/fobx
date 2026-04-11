---
title: runInTransaction
description: Batch mutations so reactions run only after the outermost transaction ends.
navTitle: runInTransaction
navSection: ["@fobx/core", "API", "Transactions"]
navOrder: 1
navSectionOrders: [1, 5, 3]
navSectionCollapsible: false
---

`runInTransaction()` executes a function immediately inside a transaction.
Reactions only flush after the outermost transaction completes, so observers
never see partially-updated state. For a reusable wrapped function, use
[`transaction()`](/core/api/transaction/).

## Signature

```ts
function runInTransaction<T>(fn: () => T): T
```

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

`runInTransaction()` returns whatever the body returns:

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

- Wrapping a one-off batch of multi-property updates.
- Event handlers that mutate several observables inline.
- Any code path where reactions should only observe a consistent final snapshot.

## Related API

Use [`transaction()`](/core/api/transaction/) when you want a reusable function
wrapper whose every call is automatically batched.
