---
title: isFlow
description: Check whether a function was wrapped by flow().
navTitle: isFlow
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isFlow()` returns `true` when the function was wrapped by `flow()`.

## Signature

```ts
function isFlow(value: unknown): boolean
```

## Basic usage

```ts
import { flow, isFlow } from "@fobx/core"

const fn = flow(function* () {})

isFlow(fn) // true
isFlow(function* () {}) // false
```

## Related API

Use [`flow()`](/core/api/flow/) to create async generator-based actions.
