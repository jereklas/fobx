---
title: isObservableMap
description: Check whether a value is an observable map.
navTitle: isObservableMap
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableMap()` returns `true` when the value is an observable map.

## Signature

```ts
function isObservableMap(value: unknown): boolean
```

## Basic usage

```ts
import { isObservableMap, observableMap } from "@fobx/core"

isObservableMap(observableMap()) // true
isObservableMap(new Map()) // false
```

## Related API

Use [`observableMap()`](/core/api/observable-map/) to create one, or
[`isObservableCollection()`](/core/api/is-observable-collection/) to match any
observable array, map, or set.
