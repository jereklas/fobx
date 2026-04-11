---
title: observableArray
description: Reactive array that implements the full Array API with dependency tracking.
navTitle: observableArray
navSection: ["@fobx/core", "API", "Observables"]
navOrder: 1
navSectionOrders: [1, 5, 1]
navSectionCollapsible: false
---

`observableArray` creates a reactive array. It implements the standard `Array`
interface via a `Proxy`, so reads are tracked and mutations trigger reactions.

## Signature

```ts
function observableArray<T>(
  initialValue?: T[],
  options?: ArrayOptions,
): ObservableArray<T>

interface ArrayOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean
}

interface ObservableArray<T> extends Array<T> {
  replace(newArray: T[]): T[]
  remove(item: T): number
  clear(): T[]
  toJSON(): T[]
}
```

## Parameters

| Parameter          | Type                 | Description                                             |
| ------------------ | -------------------- | ------------------------------------------------------- |
| `initialValue`     | `T[]`                | Starting elements (default: empty)                      |
| `options.name`     | `string`             | Debug name                                              |
| `options.comparer` | `EqualityComparison` | Equality check for element values                       |
| `options.shallow`  | `boolean`            | If `true`, elements are not recursively made observable |

## Basic usage

```ts
import { autorun, observableArray } from "@fobx/core"

const items = observableArray(["a", "b", "c"])

const stop = autorun(() => {
  console.log("items:", items.join(", "))
})
// prints: items: a, b, c

items.push("d")
// prints: items: a, b, c, d

items[0] = "A"
// prints: items: A, b, c, d

items.splice(1, 1)
// prints: items: A, c, d

stop()
```

## Tracked operations

Any read that touches the array content creates a dependency:

- Index access: `arr[i]`
- `length`
- Iteration: `for...of`, spread, `Array.from()`
- Methods: `map`, `filter`, `find`, `findIndex`, `some`, `every`, `reduce`,
  `includes`, `indexOf`, `lastIndexOf`, `join`, `slice`, `flat`, `flatMap`,
  `at`, `entries`, `values`, `keys`, `forEach`, `toString`

## Mutating operations

These trigger notification to observers:

- `push`, `pop`, `shift`, `unshift`
- `splice`, `sort`, `reverse`
- `fill`, `copyWithin`
- `arr[i] = value` (index assignment)
- `arr.length = n` (truncation)

## Shallow mode

By default, plain objects and collections added to the array are recursively
converted to observables. Use `shallow: true` to prevent this:

```ts
const shallow = observableArray<{ x: number }>([], { shallow: true })

const obj = { x: 1 }
shallow.push(obj)

// obj is NOT wrapped — it's stored as-is
console.log(shallow[0] === obj) // true
```

## Deep mode (default)

In deep mode, plain objects and arrays added to the array are automatically
converted to observable objects/arrays. The converted value is a new observable
copy, not the original reference:

```ts
const deep = observableArray<{ x: number }>([])

const obj = { x: 1 }
deep.push(obj)
// deep[0] is an observable copy of obj, not the same reference
console.log(deep[0] === obj) // false
```

## Inside observable objects

When you assign an array to a property on an `observable()` object with the
`"observable"` annotation (default), the array is automatically wrapped in
`observableArray`:

```ts
import { observable } from "@fobx/core"

const store = observable({
  items: [1, 2, 3],
})

// store.items is now an observableArray
store.items.push(4) // triggers reactions
```

The same applies to class instances using `makeObservable()` with an explicit
`"observable"` annotation on the array property.
