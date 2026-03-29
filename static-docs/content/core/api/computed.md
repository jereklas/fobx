---
title: computed
description: Derive a cached value from other observables that updates automatically.
navTitle: computed
navSection: ["@fobx/core", "API"]
navOrder: 2
---

`computed` creates a derived value that is automatically recalculated when its
dependencies change. When observed, the result is cached and only recomputed
when needed.

## Signature

```ts
function computed<T>(
  fn: () => T,
  options?: ComputedOptions<T>,
): Computed<T>

interface Computed<T> {
  get(): T
  set(value: T): void // only if options.set is provided
  dispose(): void
}

interface ComputedOptions<T> {
  name?: string
  comparer?: EqualityComparison
  set?: (value: T) => void
  bind?: unknown
}
```

## Parameters

| Parameter          | Type                 | Description                                          |
| ------------------ | -------------------- | ---------------------------------------------------- |
| `fn`               | `() => T`            | Derivation function. Must be pure — no side effects. |
| `options.name`     | `string`             | Debug name (defaults to `Computed@<id>`)             |
| `options.comparer` | `EqualityComparison` | How to check if recomputed value differs from cached |
| `options.set`      | `(value: T) => void` | Optional setter (e.g. for two-way bindings)          |
| `options.bind`     | `unknown`            | `this` context for the derivation function           |

## Basic usage

```ts
import { autorun, computed, observableBox } from "@fobx/core"

const price = observableBox(10)
const quantity = observableBox(3)

const total = computed(() => price.get() * quantity.get())

const stop = autorun(() => {
  console.log("total:", total.get())
})
// prints: total: 30

price.set(20)
// prints: total: 60

stop()
```

## Caching behavior

A computed has two modes:

### Unobserved (suspended)

When no reaction is observing the computed, each `get()` call recomputes from
scratch outside an active batch. The computed holds no subscriptions and uses no
long-lived cache.

```ts
const a = observableBox(1)
let runs = 0
const doubled = computed(() => {
  runs++
  return a.get() * 2
})

doubled.get() // runs = 1
doubled.get() // runs = 2 — no cache
```

### Observed (active)

When at least one reaction observes the computed, it activates caching:

```ts
const a = observableBox(1)
let runs = 0
const doubled = computed(() => {
  runs++
  return a.get() * 2
})

const stop = autorun(() => doubled.get())
// runs = 1 (initial)

doubled.get() // still 1 — served from cache
a.set(2) // runs = 2 — recomputed because dependency changed

stop()
// computed suspends: cache discarded
```

## Firewall effect

If a computed recomputes but produces the **same** output (according to its
comparer), downstream reactions are **not** re-run:

```ts
const x = observableBox(3)
const isPositive = computed(() => x.get() > 0)

let effectRuns = 0
const stop = autorun(() => {
  effectRuns++
  isPositive.get()
})
// effectRuns = 1

x.set(5) // isPositive still true → effectRuns stays 1
x.set(-1) // isPositive now false → effectRuns = 2

stop()
```

## Custom comparer

The `"structural"` comparer requires a one-time `configure()` call at app
startup to provide the equality function:

```ts
import { configure } from "@fobx/core"
import { equals } from "fast-equals"

configure({ comparer: { structural: equals } })
```

Then use it on a computed:

```ts
const coords = observableBox({ x: 0, y: 0 })

const rounded = computed(
  () => ({
    x: Math.round(coords.get().x),
    y: Math.round(coords.get().y),
  }),
  { comparer: "structural" },
)
```

## Custom setter

The `set` option lets you define write-back logic. This is rarely needed — most
computeds are read-only derivations. Use sparingly for cases like unit
conversions:

```ts
const celsius = observableBox(0)

const fahrenheit = computed(
  () => celsius.get() * 9 / 5 + 32,
  { set: (f) => celsius.set((f - 32) * 5 / 9) },
)

fahrenheit.set(212)
console.log(celsius.get()) // 100
```

## Dispose

Call `dispose()` to drop the computed's current upstream subscriptions and
return it to an unobserved state:

```ts
const c = computed(() => heavy.get())
// ... later ...
c.dispose()
```

The computed itself still works after disposal. A later `get()` will recompute
from scratch and re-establish dependencies if it becomes observed again.
