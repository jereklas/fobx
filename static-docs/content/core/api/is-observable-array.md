---
title: isObservableArray
description: Check whether a value is an observable array.
navTitle: isObservableArray
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableArray()` returns `true` when the value is an observable array.

## Signature

```ts
function isObservableArray(value: unknown): boolean
```

## Basic usage

```ts
import { isObservableArray, observableArray } from "@fobx/core"

isObservableArray(observableArray([1, 2])) // true
isObservableArray([1, 2]) // false
```

## Related API

Use [`observableArray()`](/core/api/observable-array/) to create one, or
[`isObservableCollection()`](/core/api/is-observable-collection/) to match any
observable array, map, or set.
