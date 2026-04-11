---
title: transaction
description: Wrap a function so each call runs inside a transaction.
navTitle: transaction
navSection: ["@fobx/core", "API", "Transactions"]
navOrder: 1
navSectionOrders: [1, 5, 3]
navSectionCollapsible: false
---

`transaction()` is a higher-order function. It wraps a function and returns a
new function whose calls run inside a transaction. Use
[`runInTransaction()`](/core/api/run-in-transaction/) when you want immediate
one-off batching instead.

## Signature

```ts
function transaction<T extends (...args: any[]) => any>(
  fn: T,
  options?: TransactionOptions,
): T

interface TransactionOptions {
  name?: string
}
```

## Parameters

| Parameter      | Type               | Description                                     |
| -------------- | ------------------ | ----------------------------------------------- |
| `fn`           | `(...args) => any` | Function to wrap                                |
| `options.name` | `string`           | Optional debug name for the wrapped transaction |

## Basic usage

```ts
import { observableBox, transaction } from "@fobx/core"

const a = observableBox(0)
const b = observableBox(0)

const reset = transaction(() => {
  a.set(0)
  b.set(0)
})

reset()
```

## Return value and arguments

The wrapper preserves the original call signature, forwards `this` and all
arguments, and returns whatever the original function returns:

```ts
const add = transaction((a: number, b: number) => a + b)

console.log(add(1, 2)) // 3
```

## Nesting and errors

`transaction()` uses the same batching rules as
[`runInTransaction()`](/core/api/run-in-transaction/): nested transactions only
flush once at the outermost boundary, and errors still propagate after pending
reactions are flushed.

## Actions as transactions

Functions annotated as `"transaction"` (or `"transaction.bound"`) in
[`observable()`](/core/api/observable/) or
[`makeObservable()`](/core/api/make-observable/) are automatically wrapped in a
transaction:

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

## Related API

Use [`isTransaction()`](/core/api/is-transaction/) to check whether a function
was wrapped by `transaction()`.

Use [`runInTransaction()`](/core/api/run-in-transaction/) when you want to run
a body immediately instead of creating a reusable wrapper.
