---
title: isPlainObject
description: Check whether a value is a plain object.
navTitle: isPlainObject
navSection: ["@fobx/core", "API", "Predicates"]
navOrder: 1
navSectionOrders: [1, 5, 4]
navSectionCollapsible: false
---

`isPlainObject()` returns `true` for plain objects whose prototype is
`Object.prototype` or `null`.

## Signature

```ts
function isPlainObject(value: unknown): boolean
```

## Basic usage

```ts
import { isPlainObject } from "@fobx/core"

isPlainObject({}) // true
isPlainObject({ a: 1 }) // true
isPlainObject(Object.create(null)) // true
isPlainObject(new Map()) // false
isPlainObject(null) // false
```

## What it excludes

This check excludes arrays, maps, sets, dates, regexps, and class instances.

## Related API

FobX uses plain-object detection when deciding how to convert values in the
observable object and collection APIs.
