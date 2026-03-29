---
title: autorun
description: Run a side-effect immediately and re-run it whenever its dependencies change.
navTitle: autorun
navSection: ["@fobx/core", "API"]
navOrder: 3
---

`autorun` runs a function immediately, tracks every observable it reads, and
re-runs the function whenever any of those observables change.

## Signature

```ts
function autorun(
  fn: (dispose: Dispose) => void,
  options?: AutorunOptions,
): Dispose

type Dispose = () => void

interface AutorunOptions {
  name?: string
}
```

## Parameters

| Parameter      | Type                | Description                                                  |
| -------------- | ------------------- | ------------------------------------------------------------ |
| `fn`           | `(dispose) => void` | The side-effect function. Receives its own dispose callback. |
| `options.name` | `string`            | Debug name (defaults to `Autorun@<id>`)                      |

**Returns** a `Dispose` function. Call it to stop the autorun permanently.

## Basic usage

```ts
import { autorun, observableBox } from "@fobx/core"

const name = observableBox("Alice")

const stop = autorun(() => {
  console.log("Hello,", name.get())
})
// prints: Hello, Alice

name.set("Bob")
// prints: Hello, Bob

stop() // autorun is disposed

name.set("Charlie")
// nothing — autorun is no longer active
```

## Self-disposing

The function receives its own `dispose` callback, useful for one-shot patterns:

```ts
const value = observableBox(0)

autorun((dispose) => {
  const v = value.get()
  if (v >= 10) {
    console.log("threshold reached:", v)
    dispose() // stop watching
  }
})
```

## Dependency tracking

Dependencies are rebuilt on every run. Only observables read during the
**synchronous** execution of `fn` are tracked:

```ts
const flag = observableBox(false)
const a = observableBox("A")
const b = observableBox("B")

const stop = autorun(() => {
  // Only the branch that runs is tracked
  console.log(flag.get() ? b.get() : a.get())
})

// flag=false → tracked: {flag, a}
b.set("B2") // no re-run (b is not tracked)

flag.set(true)
// flag=true → tracked: {flag, b}
a.set("A2") // no re-run (a is no longer tracked)

stop()
```

## Restrictions

`autorun` throws if you pass a transaction-wrapped function:

```ts
import { autorun, transaction } from "@fobx/core"

const action = transaction(() => {})
autorun(action) // throws — cannot track inside a transaction
```

## When to use

| Use case                                      | Recommended                       |
| --------------------------------------------- | --------------------------------- |
| Log or sync state to external system          | `autorun`                         |
| React only when a specific expression changes | [`reaction`](/core/api/reaction/) |
| Wait for a condition, then run once           | [`when`](/core/api/when/)         |
