---
title: observableSet
description: Reactive Set with dependency tracking.
navTitle: observableSet
navSection: ["@fobx/core", "API"]
navOrder: 9
---

`observableSet` creates a reactive `Set`. Reactions that iterate or check
membership are tracked and re-run when the set changes.

## Signature

```ts
function observableSet<T = unknown>(
  values?: Iterable<T> | null,
  options?: SetOptions,
): ObservableSet<T>

interface SetOptions {
  name?: string
  shallow?: boolean
}

interface ObservableSet<T> extends Set<T> {
  replace(values: Iterable<T> | T[]): void
  toJSON(): T[]
}
```

## Parameters

| Parameter         | Type                  | Description                                           |
| ----------------- | --------------------- | ----------------------------------------------------- |
| `values`          | `Iterable<T> \| null` | Starting values                                       |
| `options.name`    | `string`              | Debug name                                            |
| `options.shallow` | `boolean`             | If `true`, values are not recursively made observable |

## Basic usage

```ts
import { autorun, observableSet } from "@fobx/core"

const tags = observableSet<string>()

const stop = autorun(() => {
  console.log("tags:", [...tags].join(", ") || "(empty)")
})
// prints: tags: (empty)

tags.add("typescript")
// prints: tags: typescript

tags.add("reactive")
// prints: tags: typescript, reactive

tags.delete("typescript")
// prints: tags: reactive

stop()
```

## Tracking granularity

| Operation                                          | What is tracked                |
| -------------------------------------------------- | ------------------------------ |
| `has(value)`                                       | That specific value            |
| `size`                                             | The whole set (any add/delete) |
| `forEach`, `entries`, `values`, `keys`, `for...of` | The whole set                  |

```ts
const s = observableSet([1, 2, 3])

// This autorun only re-runs when the membership of 1 changes
autorun(() => console.log("has 1:", s.has(1)))

s.add(4) // no re-run
s.delete(1) // re-runs
```

## Standard Set methods

All standard `Set` methods are supported:

- `add(value)`, `has(value)`, `delete(value)`, `clear()`
- `size`
- `forEach(callback)`, `entries()`, `values()`, `keys()`
- `for...of` iteration
- `union(other)`, `intersection(other)`, `difference(other)`
- `symmetricDifference(other)`, `isSubsetOf(other)`
- `isSupersetOf(other)`, `isDisjointFrom(other)`

In deep mode, object values are converted before insertion. That means
membership checks use the stored converted value, not the original object
reference. Use `shallow: true` when you need original-reference `has()` /
`delete()` semantics.

### `replace(values)`

Replaces all values atomically:

```ts
tags.replace(new Set(["new-tag"]))
// Set now contains only "new-tag"
```

### `toJSON()`

Returns an array representation:

```ts
tags.toJSON() // ["new-tag"]
```

## Deep mode (default)

In deep mode, plain objects and arrays added to the set are automatically
converted to observable objects/arrays:

```ts
const deep = observableSet<{ id: number }>()

const obj = { id: 1 }
deep.add(obj)

const stored = Array.from(deep)[0]
console.log(stored === obj) // false
console.log(deep.has(obj)) // false — the stored value was converted
```

## Shallow mode

By default, plain objects added to a set are recursively converted. Use
`shallow: true` to prevent this:

```ts
const shallow = observableSet<{ id: number }>([], { shallow: true })

const obj = { id: 1 }
shallow.add(obj)
// obj is stored as-is
```
