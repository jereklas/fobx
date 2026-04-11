---
title: isComputed
description: Check whether a value or object property is a computed.
navTitle: isComputed
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isComputed()` returns `true` for standalone `computed()` values. When you pass
`prop`, it checks whether that property on an observable object is a computed
getter.

## Signature

```ts
function isComputed(value: unknown, prop?: PropertyKey): boolean
```

## Basic usage

```ts
import { computed, isComputed, observable } from "@fobx/core"

isComputed(computed(() => 42)) // true

const store = observable({
  count: 0,
  get doubled() {
    return this.count * 2
  },
})

isComputed(store, "doubled") // true
```

## Related API

Use [`computed()`](/core/api/computed/) to create computed values and
[`isObservable()`](/core/api/is-observable/) for a broader reactive-value check.
