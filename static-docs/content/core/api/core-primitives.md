---
title: Core Primitives
description: box, computed, autorun, reaction, and when — the fundamental reactive building blocks.
navSection: Core/API
navOrder: 1
---

## `box(initialValue, options?)`

```ts
box<T>(initialValue: T, options?: BoxOptions): ObservableBox<T>

interface ObservableBox<T> {
  get(): T
  set(value: T): void
}

interface BoxOptions {
  name?: string
  comparer?: "default" | "structural" | ((a: T, b: T) => boolean)
}
```

A **box** is the simplest reactive primitive: a single observable value with
explicit `get()` and `set()` methods. It is the foundation that all other
primitives build on.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const count = fobx.box(0)

console.log(count.get()) // 0
count.set(1)
console.log(count.get()) // 1
```

### Reactions update when the box changes

```ts
import * as fobx from "@fobx/core"

const count = fobx.box(0)
const log: number[] = []

const stop = fobx.autorun(() => {
  log.push(count.get())
})
// log: [0]

count.set(1) // log: [0, 1]
count.set(1) // no reaction — value didn't change
count.set(2) // log: [0, 1, 2]

stop()
if (log.length !== 3) throw new Error("expected 3 entries")
```

### Custom comparer

By default, boxes use reference equality (`===`). Use a custom comparer to
prevent reactions when the value is "equal" by your own definition:

```ts
import * as fobx from "@fobx/core"

const point = fobx.box(
  { x: 0, y: 0 },
  { comparer: (a, b) => a.x === b.x && a.y === b.y },
)

let runs = 0
const stop = fobx.autorun(() => { point.get(); runs++ })
// runs = 1

point.set({ x: 0, y: 0 }) // structurally same — comparer returns true — no reaction
if (runs !== 1) throw new Error("expected comparer to suppress reaction")

point.set({ x: 1, y: 0 }) // changed — reaction runs
if (runs !== 2) throw new Error("expected reaction after real change")

stop()
```

### Structural comparison

If you configure a structural comparer, you can use `"structural"` as the
comparer option:

```ts
import * as fobx from "@fobx/core"

// Configure once at application startup
fobx.configure({
  comparer: {
    structural: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  },
})

const settings = fobx.box({ theme: "dark" }, { comparer: "structural" })

let runs = 0
const stop = fobx.autorun(() => { settings.get(); runs++ })

settings.set({ theme: "dark" })  // same structure — no reaction
if (runs !== 1) throw new Error("expected structural comparer to suppress")

settings.set({ theme: "light" }) // changed
if (runs !== 2) throw new Error("expected reaction after structural change")

stop()
```

---

## `computed(fn, options?)`

```ts
computed<T>(fn: () => T, options?: ComputedOptions<T>): Computed<T>

interface Computed<T> {
  get(): T
  set(value: T): void  // only if options.set is provided
  dispose(): void
}

interface ComputedOptions<T> {
  name?: string
  comparer?: "default" | "structural" | ((a: T, b: T) => boolean)
  set?: (value: T) => void
  bind?: unknown
}
```

A **computed** derives a value from other observables. It caches the result and
only recomputes when a dependency changes. Computeds act as an optimization
layer — they prevent unnecessary re-runs of reactions downstream.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const width = fobx.box(5)
const height = fobx.box(3)

const area = fobx.computed(() => width.get() * height.get())

const stop = fobx.autorun(() => console.log(`Area: ${area.get()}`))
// Logs: "Area: 15"

width.set(10)
// Logs: "Area: 30"

stop()
```

### Computed as a cache

A computed only notifies downstream reactions when its output actually changes.
This means an expensive computation can sit between state and UI without
causing unnecessary re-renders:

```ts
import * as fobx from "@fobx/core"

const items = fobx.array([1, 2, 3, 4, 5])

let filterRuns = 0
const evenItems = fobx.computed(() => {
  filterRuns++
  return items.filter((n) => n % 2 === 0)
})

let reactionRuns = 0
const stop = fobx.autorun(() => {
  reactionRuns++
  evenItems.get() // tracks computed output
})
// filterRuns=1, reactionRuns=1

// Adding an odd number: evenItems recomputes, but output is [2,4] both times
items.push(7)
// filterRuns=2, but the output [2,4] is the same...
// Wait — array reference changes (new array) so reactionRuns becomes 2 here
// For value-stable results, use a structural comparer:
stop()
```

Use a structural comparer to suppress reaction updates when the computed output
is structurally identical:

```ts
import * as fobx from "@fobx/core"

fobx.configure({
  comparer: { structural: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
})

const items = fobx.array([1, 2, 3, 4, 5])

const evenItems = fobx.computed(
  () => items.filter((n) => n % 2 === 0),
  { comparer: "structural" },
)

let reactionRuns = 0
const stop = fobx.autorun(() => { reactionRuns++; evenItems.get() })
// reactionRuns=1

items.push(7) // recomputes — [2,4] again — structural comparer suppresses reaction
if (reactionRuns !== 1) throw new Error("structural comparer should prevent re-run")

items.push(8) // recomputes — [2,4,8] — different output — reaction runs
if (reactionRuns !== 2) throw new Error("expected reaction after output change")

stop()
```

### Writable computed

Pass a `set` option to make the computed writable. The setter receives the
value and can update the underlying observable state:

```ts
import * as fobx from "@fobx/core"

const _celsius = fobx.box(0)

const temperature = fobx.computed(
  () => _celsius.get(),
  {
    set: (fahrenheit: number) => {
      _celsius.set((fahrenheit - 32) * 5 / 9)
    },
  },
)

const stop = fobx.autorun(() =>
  console.log(`${temperature.get().toFixed(1)}°C`)
)
// Logs: "0.0°C"

temperature.set(212) // set in Fahrenheit
// Logs: "100.0°C"

stop()
```

### Disposing a computed

Calling `dispose()` on a computed removes it from all its dependencies:

```ts
import * as fobx from "@fobx/core"

const a = fobx.box(1)
const doubled = fobx.computed(() => a.get() * 2)

const stop = fobx.autorun(() => doubled.get())

doubled.dispose() // removes computed from dependency graph
stop()
```

### Rules for computeds

1. **No side effects**: computeds should be pure functions. Do not mutate
   observables inside a computed.
2. **No new observables**: avoid creating observable values inside a computed.
3. **Depend only on observables**: non-reactive values read inside a computed
   will not trigger recomputation when they change.

---

## `autorun(effect, options?)`

```ts
autorun(effect: (dispose: Dispose) => void, options?: AutorunOptions): Dispose

interface AutorunOptions {
  name?: string
}

type Dispose = () => void
```

An **autorun** runs its `effect` function once immediately (unless created
inside a batch), then re-runs automatically whenever any observable it read
during the last run changes.

The return value is a **disposer** function. Always call it when the autorun
is no longer needed.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const name = fobx.box("Alice")
const greeting: string[] = []

const stop = fobx.autorun(() => {
  greeting.push(`Hello, ${name.get()}!`)
})
// greeting: ["Hello, Alice!"]

name.set("Bob")
// greeting: ["Hello, Alice!", "Hello, Bob!"]

stop()
name.set("Carol") // (no effect — autorun is disposed)

if (greeting.length !== 2) throw new Error("expected 2 greetings")
```

### Self-disposal

The `effect` function receives the disposer as its argument, allowing it to
clean itself up based on some condition:

```ts
import * as fobx from "@fobx/core"

const status = fobx.box("loading")
const events: string[] = []

fobx.autorun((stop) => {
  const s = status.get()
  events.push(s)
  if (s === "done" || s === "error") {
    stop() // self-dispose when terminal state reached
  }
})
// events: ["loading"]

status.set("loading") // still same value, no re-run
status.set("done")   // re-runs, then disposes itself
status.set("done")   // autorun is gone, no effect

if (events.length !== 2) throw new Error("expected 2 events")
if (events[1] !== "done") throw new Error("expected done")
```

### Autorun vs reaction

- Use **autorun** when you want to track ALL observables accessed in your
  function and run on first invocation.
- Use **reaction** when you want to control which observables trigger the
  effect and skip the initial run.

### Autorun cannot wrap a transaction

Passing a `transaction()`-wrapped function as the effect throws an error,
because a transaction would prevent FobX from tracking dependencies:

```ts
import * as fobx from "@fobx/core"

const wrapped = fobx.transaction(() => {})

let threw = false
try {
  fobx.autorun(wrapped)
} catch {
  threw = true
}

if (!threw) throw new Error("should have thrown")
```

### Autorun created inside a batch

If `autorun` is called inside a `runInTransaction`, the initial run is deferred
until the batch ends rather than running immediately:

```ts
import * as fobx from "@fobx/core"

const value = fobx.box(0)
const log: number[] = []
let stop: () => void

fobx.runInTransaction(() => {
  stop = fobx.autorun(() => log.push(value.get()))
  value.set(42) // change inside the same batch
})
// All changes batched. autorun runs once after transaction ends.

stop!()
if (log.length !== 1) throw new Error("expected 1 run")
if (log[0] !== 42) throw new Error("expected 42")
```

---

## `reaction(expression, effect, options?)`

```ts
reaction<T>(
  expression: (dispose: Dispose) => T,
  effect: (value: T, previousValue: T | undefined, dispose: Dispose) => void,
  options?: ReactionOptions<T>
): Dispose

interface ReactionOptions<T> {
  name?: string
  fireImmediately?: boolean
  comparer?: "default" | "structural" | ((a: T, b: T) => boolean)
}
```

A **reaction** is a two-phase reaction: the `expression` is tracked and returns
a value; if that value changes, `effect` runs with the new and previous values.
The effect itself is **not** tracked — only the expression is.

The return value is a **disposer**. Always call it when done.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const user = fobx.observable({ name: "Alice", age: 30 })
const events: string[] = []

const stop = fobx.reaction(
  () => user.name, // tracked: only re-runs effect when name changes
  (name, prevName) => {
    events.push(`${prevName} → ${name}`)
  },
)
// No initial run (unlike autorun)

user.age = 31    // effect does NOT run — age is not in the expression
user.name = "Bob" // effect runs: "Alice → Bob"
user.name = "Bob" // no effect — value didn't change
user.name = "Carol" // effect runs: "Bob → Carol"

stop()
if (events.length !== 2) throw new Error("expected 2 events")
if (events[0] !== "Alice → Bob") throw new Error("wrong first event")
```

### fireImmediately

Set `fireImmediately: true` to also run the effect once on creation (like
`autorun`):

```ts
import * as fobx from "@fobx/core"

const count = fobx.box(5)
const log: number[] = []

const stop = fobx.reaction(
  () => count.get(),
  (n) => log.push(n),
  { fireImmediately: true },
)
// log: [5] — immediate run

count.set(10)
// log: [5, 10]

stop()
if (log.length !== 2) throw new Error("expected 2 log entries")
```

### Tracking observable collections

When the expression returns an **observable collection** (array, map, or set),
FobX compares by change count rather than reference, so the effect re-runs
on every structural change:

```ts
import * as fobx from "@fobx/core"

const list = fobx.array([1, 2, 3])
let runs = 0

const stop = fobx.reaction(
  () => list,
  () => runs++,
)

list.push(4)     // runs = 1
list.push(5)     // runs = 2
list.splice(0, 1) // runs = 3

stop()
if (runs !== 3) throw new Error("expected 3 runs")
```

### Previous value

The effect receives both the new value and the previous value. On the very
first call (even with `fireImmediately`), the previous value is `undefined`:

```ts
import * as fobx from "@fobx/core"

const score = fobx.box(0)
const deltas: number[] = []

const stop = fobx.reaction(
  () => score.get(),
  (next, prev) => {
    if (prev !== undefined) {
      deltas.push(next - prev)
    }
  },
)

score.set(5)   // delta = 5 - 0 = 5
score.set(3)   // delta = 3 - 5 = -2
score.set(10)  // delta = 10 - 3 = 7

stop()
if (deltas.length !== 3) throw new Error("expected 3 deltas")
if (deltas[0] !== 5) throw new Error("wrong first delta")
if (deltas[1] !== -2) throw new Error("wrong second delta")
```

### When to use reaction vs autorun

Prefer `reaction` when:

- You want to declaratively specify which state triggers the effect (the
  `expression`), keeping the effect lightweight.
- You want access to both the new and previous value.
- You want to skip the initial run.

Prefer `autorun` when the effect itself is simple and you want it to track
everything it reads.

---

## `when(predicate, effect?, options?)`

```ts
// Effect form — runs effect once when predicate becomes true, then disposes
when(predicate: () => boolean, effect: () => void, options?: WhenOptions): Dispose

// Promise form — resolves when predicate becomes true
when(predicate: () => boolean, options?: WhenOptions): WhenPromise

interface WhenOptions {
  name?: string
  timeout?: number          // milliseconds before timeout error
  onError?: (err: Error) => void  // effect form only
  signal?: AbortSignal      // promise form only
}

type WhenPromise = Promise<void> & { cancel(): void }
```

A **when** is a one-shot reaction. It watches a predicate and, as soon as it
becomes `true`, runs the effect (or resolves the promise) and disposes itself.

### Effect form

```ts
import * as fobx from "@fobx/core"

const isReady = fobx.box(false)
const log: string[] = []

const stop = fobx.when(
  () => isReady.get(),
  () => log.push("ready!"),
)

isReady.set(true)  // fires effect, then disposes
isReady.set(false) // no effect — when is already disposed
isReady.set(true)  // no effect

if (log.length !== 1) throw new Error("expected exactly 1 fire")
if (log[0] !== "ready!") throw new Error("wrong message")
```

### Predicate must be true first

If the predicate is already `true` when `when` is created, the effect runs
immediately on the initial check:

```ts
import * as fobx from "@fobx/core"

const flag = fobx.box(true) // already true
let fired = false

fobx.when(() => flag.get(), () => { fired = true })

if (!fired) throw new Error("when should fire immediately if predicate is already true")
```

### Promise form with async/await

Omit the `effect` argument to get a cancellable `Promise`:

```ts
import * as fobx from "@fobx/core"

const loaded = fobx.box(false)

async function waitForLoad() {
  await fobx.when(() => loaded.get())
  console.log("loaded!")
}

// Simulate async load
const promise = waitForLoad()
loaded.set(true) // resolves the when promise
await promise    // logs: "loaded!"
```

### Timeout

Both forms support a `timeout` option (milliseconds). If the predicate does not
become true in time, the when throws/rejects with a timeout error:

```ts
import * as fobx from "@fobx/core"

// Effect form with onError
const errors: string[] = []
fobx.when(
  () => false, // never true
  () => {},
  {
    timeout: 1,
    onError: (err) => errors.push(err.message),
  },
)

// Give the timeout time to fire
await new Promise((resolve) => setTimeout(resolve, 20))
if (errors.length !== 1) throw new Error("expected timeout error")
```

### AbortSignal (promise form)

Cancel a promise-form `when` using an `AbortSignal`:

```ts
import * as fobx from "@fobx/core"

const controller = new AbortController()
const pending = fobx.when(() => false, { signal: controller.signal })

controller.abort()

let caught = false
try {
  await pending
} catch {
  caught = true
}

if (!caught) throw new Error("aborting should reject the when promise")
```

### Manual cancel (promise form)

The returned `WhenPromise` also has a `.cancel()` method:

```ts
import * as fobx from "@fobx/core"

const pending = fobx.when(() => false)
pending.cancel()

let caught = false
try {
  await pending
} catch {
  caught = true
}

if (!caught) throw new Error("cancel should reject the when promise")
```
