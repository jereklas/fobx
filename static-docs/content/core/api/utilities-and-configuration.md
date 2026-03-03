---
title: Utilities and Configuration
description: configure() and reactive introspection predicates.
navSection: Core/API
navOrder: 5
---

## `configure(options)`

```ts
configure(options: ConfigureOptions): void

interface ConfigureOptions {
  enforceActions?: boolean
  comparer?: {
    structural?: (a: unknown, b: unknown) => boolean
  }
  onReactionError?: (error: unknown, reaction: ReactionAdmin) => void
}
```

`configure` sets global runtime options. Call it once during application
startup, before creating any observables.

### `comparer.structural`

Before using `"structural"` as a comparer option on any box, computed, or
observable annotation, you must provide a structural equality function:

```ts
import * as fobx from "@fobx/core"

// Using a custom deep-equals function (in practice use fast-equals, lodash, etc.)
fobx.configure({
  comparer: {
    structural: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  },
})

const point = fobx.box({ x: 1, y: 2 }, { comparer: "structural" })

let runs = 0
const stop = fobx.autorun(() => { point.get(); runs++ })

point.set({ x: 1, y: 2 }) // structurally equal — no reaction
if (runs !== 1) throw new Error("structural equality should suppress reaction")

point.set({ x: 3, y: 4 }) // different — reaction runs
if (runs !== 2) throw new Error("expected reaction after change")

stop()
```

Attempting to use `"structural"` without setting the comparer first throws:

```ts
import * as fobx from "@fobx/core"

// (Do not configure structural comparer here)
// Trying to use "structural" without configuring will throw:
let threw = false
try {
  // Reset to no structural comparer for this test
  fobx.configure({ comparer: { structural: undefined as unknown as () => boolean } })
  fobx.box({ x: 1 }, { comparer: "structural" })
} catch {
  threw = true
}
// Note: after configure() sets structural to undefined-ish,
// creating a structural box throws
// (In practice: just always configure before use)
```

### `onReactionError`

Receives errors thrown by reactions and observed computed evaluations. This is
your global error boundary for reactive code:

```ts
import * as fobx from "@fobx/core"

const errors: Error[] = []

fobx.configure({
  onReactionError: (err) => errors.push(err as Error),
})

const value = fobx.box(0)
const stop = fobx.autorun(() => {
  if (value.get() === 1) throw new Error("reaction error")
})

value.set(1) // reaction throws, caught by onReactionError
if (errors.length !== 1) throw new Error("expected 1 error")
if (errors[0].message !== "reaction error") throw new Error("wrong error")

value.set(2) // reaction recovers and runs normally
if (errors.length !== 1) throw new Error("no new error expected")

stop()
// Note: configure({ onReactionError: undefined }) is a no-op in the current
// implementation — the handler cannot be cleared once set at runtime.
// Per-process isolation (e.g. in tests) is the recommended pattern.
```

### `enforceActions`

When `true` (the default), FobX tracks whether mutations occur inside
transactions. Currently stored in the runtime config and accessible to
consumers, but the enforcement check is not yet strictly applied at the
observable level for all mutation paths.

---

## Introspection predicates

All predicates return `false` (rather than throwing) for non-reactive values,
making them safe to use in generic code.

### `isObservable(value, property?)`

Determines whether a value, or a specific property of an object, is being
tracked as an observable.

```ts
import * as fobx from "@fobx/core"

const obj = fobx.observable({ x: 1, y: 2 })
const plain = { x: 1 }

if (!fobx.isObservable(obj, "x")) throw new Error("x should be observable")
if (!fobx.isObservable(obj, "y")) throw new Error("y should be observable")
if (fobx.isObservable(plain, "x")) throw new Error("plain prop should not be observable")
```

### `isObservableObject(value)`

Returns `true` if `value` is an object that was processed by `observable` or
`makeObservable`:

```ts
import * as fobx from "@fobx/core"

const obs = fobx.observable({ a: 1 })
const plain = { a: 1 }

if (!fobx.isObservableObject(obs)) throw new Error("expected observable object")
if (fobx.isObservableObject(plain)) throw new Error("plain object should return false")
```

### `isObservableArray(value)`

```ts
import * as fobx from "@fobx/core"

const obs = fobx.array([1, 2, 3])
const plain = [1, 2, 3]

if (!fobx.isObservableArray(obs)) throw new Error("expected observable array")
if (fobx.isObservableArray(plain)) throw new Error("plain array should return false")
```

### `isObservableMap(value)`

```ts
import * as fobx from "@fobx/core"

const obs = fobx.map([["a", 1]])
const plain = new Map([["a", 1]])

if (!fobx.isObservableMap(obs)) throw new Error("expected observable map")
if (fobx.isObservableMap(plain)) throw new Error("plain map should return false")
```

### `isObservableSet(value)`

```ts
import * as fobx from "@fobx/core"

const obs = fobx.set([1, 2, 3])
const plain = new Set([1, 2, 3])

if (!fobx.isObservableSet(obs)) throw new Error("expected observable set")
if (fobx.isObservableSet(plain)) throw new Error("plain set should return false")
```

### `isObservableBox(value)`

```ts
import * as fobx from "@fobx/core"

const obs = fobx.box(42)

if (!fobx.isObservableBox(obs)) throw new Error("expected observable box")
if (fobx.isObservableBox(42)) throw new Error("primitive should return false")
```

### `isObservableCollection(value)`

Returns `true` for observable arrays, maps, or sets:

```ts
import * as fobx from "@fobx/core"

const arr = fobx.array([1])
const map = fobx.map([["a", 1]])
const set = fobx.set([1])
const box = fobx.box(1)

if (!fobx.isObservableCollection(arr)) throw new Error("array should be collection")
if (!fobx.isObservableCollection(map)) throw new Error("map should be collection")
if (!fobx.isObservableCollection(set)) throw new Error("set should be collection")
if (fobx.isObservableCollection(box)) throw new Error("box should NOT be collection")
```

### `isComputed(value, property?)`

Returns `true` if the value is a `Computed` instance, or if the specified
property on an observable object is backed by a computed:

```ts
import * as fobx from "@fobx/core"

const c = fobx.computed(() => 42)
if (!fobx.isComputed(c)) throw new Error("standalone computed")

const obj = fobx.observable({
  x: 1,
  get doubled() { return this.x * 2 },
})
if (!fobx.isComputed(obj, "doubled")) throw new Error("object getter should be computed")
if (fobx.isComputed(obj, "x")) throw new Error("data prop is not computed")
```

### `isPlainObject(value)`

Returns `true` if `value` is a plain object (created via `{}` or
`Object.create(null)`):

```ts
import * as fobx from "@fobx/core"

if (!fobx.isPlainObject({})) throw new Error("{} should be plain")
if (!fobx.isPlainObject(Object.create(null))) throw new Error("null-proto should be plain")
if (fobx.isPlainObject([])) throw new Error("array should not be plain")
if (fobx.isPlainObject(new Map())) throw new Error("Map should not be plain")
if (fobx.isPlainObject(42)) throw new Error("number should not be plain")
```

### `isTransaction(value)`

Returns `true` if `value` was created by `transaction(fn)`:

```ts
import * as fobx from "@fobx/core"

const plain = () => {}
const wrapped = fobx.transaction(plain)

if (fobx.isTransaction(plain)) throw new Error("plain function is not a transaction")
if (!fobx.isTransaction(wrapped)) throw new Error("wrapped should be a transaction")
```

---

## Exported types

FobX exports runtime-facing TypeScript types for all primitives and options:

**Primitives and options**
- `BoxOptions`, `ObservableBox`
- `Computed`, `ComputedOptions`
- `AutorunOptions`
- `ReactionOptions`
- `WhenOptions`, `WhenPromise`
- `Dispose`

**Collections and options**
- `ArrayOptions`, `ObservableArray`
- `MapOptions`, `ObservableMap`
- `SetOptions`, `ObservableSet`

**Object model**
- `AnnotationsMap`, `AnnotationString`, `AnnotationValue`
- `MakeObservableOptions`, `ObservableOptions`, `ObservableObjectAdmin`

**Runtime and config**
- `ConfigureOptions`
- `EqualityChecker`, `EqualityComparison`
- `FobxAdmin`, `ObservableAdmin`, `ReactionAdmin`, `ComputedAdmin`

## `$fobx` symbol

The `$fobx` symbol is exported for advanced tooling. It is the key under which
FobX attaches administration data to reactive objects and collections.

Application code should prefer the predicate helpers above rather than
accessing the admin directly:

```ts
import * as fobx from "@fobx/core"
import { $fobx } from "@fobx/core"

const b = fobx.box(42)

// Predicate (preferred):
if (!fobx.isObservableBox(b)) throw new Error("should be observable box")

// Direct admin access (advanced/internal):
const admin = b[$fobx]
if (admin.value !== 42) throw new Error("admin should hold value")
```
