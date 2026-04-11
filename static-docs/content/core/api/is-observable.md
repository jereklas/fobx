---
title: isObservable
description: Check whether a value or object property is a FobX observable.
navTitle: isObservable
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservable()` returns `true` for boxed values, computeds, and observable
collections. When you pass `prop`, it checks whether that property on an
observable object is reactive.

## Signature

```ts
function isObservable(value: unknown, prop?: PropertyKey): boolean
```

## Basic usage

```ts
import { computed, isObservable, observable, observableBox } from "@fobx/core"

isObservable(observableBox(1)) // true
isObservable(computed(() => 1)) // true
isObservable(observable({ count: 0 })) // false
isObservable(observable({ count: 0 }), "count") // true
isObservable({ plain: true }) // false
```

## What it checks

- Standalone `observableBox()` values.
- Standalone `computed()` values.
- Observable collections such as arrays, maps, and sets.
- Reactive object members when `prop` is provided.

It does not return `true` for an observable object itself unless you ask about a
specific reactive property.

## Related API

Use [`isComputed()`](/core/api/is-computed/) for computed-only checks and
[`isObservableObject()`](/core/api/is-observable-object/) to detect objects made
reactive with `observable()` or `makeObservable()`.
