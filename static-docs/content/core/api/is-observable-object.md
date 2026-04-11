---
title: isObservableObject
description: Check whether a value is an observable object.
navTitle: isObservableObject
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableObject()` returns `true` for objects created by `observable()` or
passed through `makeObservable()`.

## Signature

```ts
function isObservableObject(value: unknown): boolean
```

## Basic usage

```ts
import { isObservableObject, observable } from "@fobx/core"

const store = observable({ count: 0 })

isObservableObject(store) // true
isObservableObject({}) // false
```

## What it checks

This predicate matches observable objects only. It does not match boxed values,
computeds, or observable collections.

## Related API

Use [`observable()`](/core/api/observable/) or
[`makeObservable()`](/core/api/make-observable/) to create observable objects.
