---
title: isObservableBox
description: Check whether a value is an observableBox.
navTitle: isObservableBox
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isObservableBox()` returns `true` when the value is an `observableBox()`.

## Signature

```ts
function isObservableBox(value: unknown): boolean
```

## Basic usage

```ts
import { computed, isObservableBox, observableBox } from "@fobx/core"

isObservableBox(observableBox(1)) // true
isObservableBox(computed(() => 1)) // false
```

## Related API

Use [`isObservable()`](/core/api/is-observable/) for a broader check that also
matches computeds and observable collections.
