---
title: when
description: Wait for a reactive condition, then run once or resolve a promise.
navTitle: when
navSection: ["@fobx/core", "API", "Reactions"]
navOrder: 1
navSectionOrders: [1, 5, 2]
navSectionCollapsible: false
---

`when` observes a predicate and fires once when it becomes `true`, then disposes
itself. It has two forms: callback-based and promise-based.

## Signature

```ts
// Callback form — returns Dispose
function when(
  predicate: () => boolean,
  effect: () => void,
  options?: WhenOptions,
): Dispose

// Promise form — returns cancellable promise
function when(
  predicate: () => boolean,
  options?: WhenOptions,
): WhenPromise

type WhenPromise = Promise<void> & { cancel: () => void }

interface WhenOptions {
  name?: string
  timeout?: number
  onError?: (error: Error) => void
  signal?: AbortSignal
}
```

## Parameters

| Parameter         | Type              | Description                                                  |
| ----------------- | ----------------- | ------------------------------------------------------------ |
| `predicate`       | `() => boolean`   | Tracked function — checked on every dependency change        |
| `effect`          | `() => void`      | Runs once when predicate returns `true` (callback form only) |
| `options.name`    | `string`          | Debug name                                                   |
| `options.timeout` | `number`          | Milliseconds before auto-dispose with error                  |
| `options.onError` | `(error) => void` | Error handler (callback form only)                           |
| `options.signal`  | `AbortSignal`     | Aborts the when reaction when signaled                       |

## Callback form

```ts
import { observableBox, when } from "@fobx/core"

const ready = observableBox(false)

const dispose = when(
  () => ready.get(),
  () => console.log("Ready!"),
)

ready.set(true)
// prints: Ready!
// when is automatically disposed
```

If the predicate is already `true` on the first run, the effect fires
synchronously:

```ts
const flag = observableBox(true)

when(
  () => flag.get(),
  () => console.log("immediate"),
)
// prints: immediate (synchronously)
```

## Promise form

Omit the effect to get a promise that resolves when the predicate becomes true:

```ts
const loading = observableBox(true)

const waitForData = when(() => !loading.get())

loading.set(false)
await waitForData
console.log("data loaded")
```

### Cancel

The returned promise has a `cancel()` method:

```ts
const promise = when(() => data.get() !== null)

// Later, if no longer needed:
promise.cancel() // rejects with "When reaction was canceled"
```

## Timeout

```ts
when(
  () => ready.get(),
  () => console.log("ready"),
  {
    timeout: 5000,
    onError: (err) => console.error(err.message),
    // prints: "When reaction timed out" after 5 seconds
  },
)
```

For the promise form, a timeout rejects the promise.

## AbortSignal

```ts
const controller = new AbortController()

const promise = when(
  () => done.get(),
  { signal: controller.signal },
)

controller.abort() // rejects with "When reaction was aborted"
```

## When to use

| Use case                                 | Recommended                                                          |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Fire once when condition is met          | `when` (callback)                                                    |
| Await a reactive condition in async code | `when` (promise)                                                     |
| React continuously to changes            | [`autorun`](/core/api/autorun/) or [`reaction`](/core/api/reaction/) |
