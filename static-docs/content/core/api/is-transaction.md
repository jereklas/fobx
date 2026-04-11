---
title: isTransaction
description: Check whether a function was wrapped by transaction().
navTitle: isTransaction
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isTransaction()` returns `true` when the function was wrapped by
`transaction()`. It does not tell you whether code is currently executing
inside a transaction.

## Signature

```ts
function isTransaction(value: unknown): boolean
```

## Basic usage

```ts
import { isTransaction, transaction } from "@fobx/core"

const action = transaction(() => {})

isTransaction(action) // true
isTransaction(() => {}) // false
```

## Related API

Use [`transaction()`](/core/api/transaction/) to create reusable batched
actions, or [`runInTransaction()`](/core/api/run-in-transaction/) for immediate
one-off batching.
