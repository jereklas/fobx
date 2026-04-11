---
title: isObservableSet
description: Check whether a value is an observable set.
navTitle: isObservableSet
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableSet()` returns `true` when the value is an observable set.

## Signature

```ts
function isObservableSet(value: unknown): boolean
```

## Basic usage

```ts
import { isObservableSet, observableSet } from "@fobx/core"

isObservableSet(observableSet()) // true
isObservableSet(new Set()) // false
```

## Related API

Use [`observableSet()`](/core/api/observable-set/) to create one, or
[`isObservableCollection()`](/core/api/is-observable-collection/) to match any
observable array, map, or set.
