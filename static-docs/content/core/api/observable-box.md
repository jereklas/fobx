---
title: observableBox
description: Create a reactive boxed value that notifies observers when it changes.
navTitle: observableBox
navSection: ["@fobx/core", "API"]
navOrder: 1
---

`observableBox` is the simplest reactive primitive. It holds a single value and
notifies observers whenever that value changes.

## Signature

```ts
function observableBox<T>(
  initialValue: T,
  options?: BoxOptions,
): ObservableBox<T>

interface ObservableBox<T> {
  get(): T
  set(value: T): void
}

interface BoxOptions {
  name?: string
  comparer?: EqualityComparison
}
```

## Parameters

| Parameter          | Type                 | Description                             |
| ------------------ | -------------------- | --------------------------------------- |
| `initialValue`     | `T`                  | The starting value                      |
| `options.name`     | `string`             | Debug name (defaults to `Box@<id>`)     |
| `options.comparer` | `EqualityComparison` | How to determine if a value has changed |

## Basic usage

```ts
import { autorun, observableBox } from "@fobx/core"

const count = observableBox(0)

const stop = autorun(() => {
  console.log("count:", count.get())
})
// prints: count: 0

count.set(1)
// prints: count: 1

count.set(1)
// nothing printed — same value, default comparer blocks

stop()
```

## Custom equality

By default, `observableBox` uses a comparer equivalent to strict equality with
NaN handling. You can override this with the `comparer` option:

```ts
import { observableBox } from "@fobx/core"

// Built-in structural comparer (requires configure() setup)
const a = observableBox({ x: 1 }, { comparer: "structural" })

// Custom comparer function
const epsilon = observableBox(0, {
  comparer: (prev, next) => Math.abs(prev - next) < 0.001,
})

epsilon.set(0.0001) // no change — within threshold
epsilon.set(1) // change — outside threshold
```

### Built-in comparers

| Value               | Behavior                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `"default"`         | Strict identity with NaN handling (the default)                    |
| `"structural"`      | Deep equality — requires `configure({ comparer: { structural } })` |
| `(a, b) => boolean` | Custom function                                                    |

## When to use

Use `observableBox` for standalone reactive values that are not part of an
observable object or class:

- Global configuration flags
- A single selected ID
- A value shared between unrelated parts of your app

For reactive properties on an object, use
[`observable()`](/core/api/observable/) or
[`makeObservable()`](/core/api/observable/) instead.
