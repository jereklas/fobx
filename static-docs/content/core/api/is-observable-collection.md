---
title: isObservableCollection
description: Check whether a value is an observable array, map, or set.
navTitle: isObservableCollection
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableCollection()` returns `true` for observable arrays, maps, and
sets.

## Signature

```ts
function isObservableCollection(value: unknown): boolean
```

## Basic usage

```ts
import {
  isObservableCollection,
  observableArray,
  observableMap,
  observableSet,
} from "@fobx/core"

isObservableCollection(observableArray()) // true
isObservableCollection(observableMap()) // true
isObservableCollection(observableSet()) // true
isObservableCollection([]) // false
```

## Related API

Use [`isObservableArray()`](/core/api/is-observable-array/),
[`isObservableMap()`](/core/api/is-observable-map/), or
[`isObservableSet()`](/core/api/is-observable-set/) when you need the specific
collection type.
