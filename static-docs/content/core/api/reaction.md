---
title: reaction
description: Watch a specific expression and run an effect when its value changes.
navTitle: reaction
navSection: ["@fobx/core", "API", "Reactions"]
navOrder: 1
navSectionOrders: [1, 5, 2]
navSectionCollapsible: false
---

`reaction` is a two-phase reaction: a **tracked expression** that produces a
value, and an **effect** that runs (untracked) whenever that value changes.

## Signature

```ts
interface ReactionEffectContext {
  dispose(): void
  hasPrevious: boolean
}

function reaction<T>(
  expression: (dispose: Dispose) => T,
  effect: (
    value: T,
    previousValue: T | undefined,
    context: ReactionEffectContext,
  ) => void,
  options?: ReactionOptions<T>,
): Dispose

interface ReactionOptions<T> {
  name?: string
  fireImmediately?: boolean
  comparer?: EqualityComparison
}
```

## Parameters

| Parameter                 | Type                              | Description                                                              |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `expression`              | `(dispose) => T`                  | Tracked function — its return value is compared across runs              |
| `effect`                  | `(value, prev, context) => void`  | Side-effect — runs untracked when the expression value changes           |
| `options.name`            | `string`                          | Debug name                                                               |
| `options.fireImmediately` | `boolean`                         | Run the effect once immediately with the initial value (default `false`) |
| `options.comparer`        | `EqualityComparison`              | Custom equality check for the expression result                          |

The effect `context` includes:

| Field         | Type      | Description                                                |
| ------------- | --------- | ---------------------------------------------------------- |
| `dispose`     | `Dispose` | Stops this reaction                                        |
| `hasPrevious` | `boolean` | `false` only on the first `fireImmediately` callback run   |

When `fireImmediately` is `true`, the first callback receives `undefined` as
`previousValue` and `context.hasPrevious === false`.

**Returns** a `Dispose` function.

## Basic usage

```ts
import { observableBox, reaction } from "@fobx/core"

const temperature = observableBox(20)

const stop = reaction(
  () => temperature.get(),
  (current, previous) => {
    console.log(`Temperature changed from ${previous} to ${current}`)
  },
)

temperature.set(25)
// prints: Temperature changed from 20 to 25

temperature.set(25)
// nothing — same value

stop()
```

## Fire immediately

```ts
const stop = reaction(
  () => temperature.get(),
  (current) => {
    console.log("temperature:", current)
  },
  { fireImmediately: true },
)
// prints: temperature: 20 (immediately)
```

On that first `fireImmediately` run, `previousValue` is `undefined` and
`context.hasPrevious` is `false`.

## Custom comparer

Use a custom comparer to control when the effect fires. The `"structural"`
comparer requires a one-time `configure()` call at app startup:

```ts
import { configure } from "@fobx/core"
configure({ comparer: { structural: myDeepEqual } })
```

```ts
const coords = observableBox({ x: 0, y: 0 })

const stop = reaction(
  () => coords.get(),
  (value) => console.log("moved to", value),
  { comparer: "structural" },
)

coords.set({ x: 0, y: 0 }) // no effect — structurally equal
coords.set({ x: 1, y: 0 }) // effect fires
stop()
```

## Expression vs effect tracking

Only the **expression** function is tracked. The effect runs outside the
tracking context, so observable reads inside the effect do not create
dependencies:

```ts
const a = observableBox(1)
const b = observableBox(2)

const stop = reaction(
  () => a.get(), // only a is tracked
  () => {
    console.log(b.get()) // b is read but NOT tracked
  },
)

b.set(99) // does NOT trigger the reaction
a.set(2) // triggers the reaction → prints 99

stop()
```

## Collection change detection

When the expression returns an observable collection, `reaction` compares by
internal change count rather than reference. This means mutations to the
collection are detected:

```ts
import { observableMap, reaction } from "@fobx/core"

const m = observableMap<string, number>()

const stop = reaction(
  () => m,
  () => console.log("map changed, size:", m.size),
)

m.set("a", 1) // prints: map changed, size: 1
m.set("b", 2) // prints: map changed, size: 2

stop()
```

## Self-disposing

The expression receives a `dispose` callback, and the effect receives it on the
context object:

```ts
const stop = reaction(
  (dispose) => {
    const v = temperature.get()
    if (v > 100) dispose() // stop if temperature exceeds 100
    return v
  },
  (value, _previousValue, { dispose }) => {
    if (value < 0) dispose()
    console.log("temp:", value)
  },
)
```

## When to use

| Use case                          | Recommended                     |
| --------------------------------- | ------------------------------- |
| React to a specific derived value | `reaction`                      |
| Run side-effects on any read      | [`autorun`](/core/api/autorun/) |
| Wait for a boolean condition      | [`when`](/core/api/when/)       |
