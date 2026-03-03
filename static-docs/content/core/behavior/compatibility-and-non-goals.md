---
title: Compatibility and Non-goals
description: How FobX differs from MobX and what it intentionally does not support.
navSection: Core/Behavior
navOrder: 2
---

FobX is heavily inspired by MobX and borrows many of its core ideas. If you have
used MobX before, most concepts will feel familiar. This page documents the
specific differences so you know what to expect.

---

## Renamed APIs

The most significant naming difference is that FobX uses **`transaction`** where
MobX uses `action`, and **`runInTransaction`** where MobX uses `runInAction`.

| MobX | FobX |
|------|------|
| `action(fn)` | `transaction(fn)` |
| `action.bound` | `transaction.bound` |
| `runInAction(fn)` | `runInTransaction(fn)` |
| `observable.box(v)` | `box(v)` |
| `observable.array(v)` | `array(v)` |
| `observable.map(v)` | `map(v)` |
| `observable.set(v)` | `set(v)` |

The semantics are identical — only the names changed to reflect FobX’s framing
of mutations as transactional operations.

---

## No top-level `flow` / `flowResult` export

FobX does not export a standalone `flow` function or `flowResult`. The `flow`
and `flow.bound` strings are accepted as **annotation values** in
`makeObservable` and `observable`, but they wrap the generator function
invocation in a transaction rather than managing the full iterator lifecycle
the way MobX’s `flow` does.

For async state mutations, the recommended pattern is:

```ts
import * as fobx from "@fobx/core"

const store = fobx.observable({
  data: null as string | null,
  status: "idle" as "idle" | "loading" | "done" | "error",

  // Use runInTransaction in async handlers to batch updates
  async fetchData(url: string) {
    fobx.runInTransaction(() => {
      this.status = "loading"
      this.data = null
    })
    try {
      const result = await Promise.resolve(`data from ${url}`)
      fobx.runInTransaction(() => {
        this.data = result
        this.status = "done"
      })
    } catch {
      fobx.runInTransaction(() => {
        this.status = "error"
      })
    }
  },
})
```

---

## No `observe` / `intercept` API

FobX does not expose low-level `observe` or `intercept` hooks. These MobX
primitive APIs allowed intercepting individual property changes at the
administration level. FobX intentionally omits them to keep the surface area
small. Use `reaction` with a specific expression for observation needs.

---

## Collection construction

In FobX, `observable([])`, `observable(new Map())`, and `observable(new Set())`
route to the collection constructors rather than throwing a type error. MobX
has similar behavior but its collection APIs are accessed differently.

FobX collections are constructed directly:

```ts
import * as fobx from "@fobx/core"

const arr = fobx.array([1, 2, 3])         // ObservableArray
const map = fobx.map([["a", 1]])          // ObservableMap
const set = fobx.set(["x", "y"])          // ObservableSet

// Also works via observable():
const arr2 = fobx.observable([1, 2, 3])   // same as array()
const map2 = fobx.observable(new Map([["a", 1]]))  // same as map()
const set2 = fobx.observable(new Set(["x", "y"]))  // same as set()

if (!fobx.isObservableArray(arr)) throw new Error("should be observable array")
if (!fobx.isObservableMap(map2)) throw new Error("should be observable map")
```

---

## `ownPropertiesOnly` option

FobX adds an `ownPropertiesOnly` option to `observable` and `makeObservable`.
When `true`, all descriptors (including those from prototypes) are installed
directly on the instance rather than on the prototype chain. This can be useful
in environments that do not support prototype mutation.

---

## `inPlace` option for plain objects

FobX adds an `inPlace` option to `observable`. By default, `observable({...})`
returns a **new** object; the source is not mutated. Pass `inPlace: true` to
mutate the source object directly:

```ts
import * as fobx from "@fobx/core"

const source = { x: 1, y: 2 }
const obs = fobx.observable(source, { inPlace: true })

// source and obs are the same object
if (obs !== source) throw new Error("expected same reference with inPlace")
if (!fobx.isObservableObject(source)) throw new Error("source should be observable")
```

---

## `makeObservable` accepts re-entrant calls

FobX’s `makeObservable` supports being called more than once on the same object.
Subsequent calls can add new annotations. MobX 6 throws on re-entrant
`makeObservable` calls.

---

## `$fobx` symbol

FobX attaches reactive administration data to objects and collections via the
`$fobx` symbol. This is exported for advanced / tooling use. Application code
should prefer the predicate helpers (`isObservable`, `isObservableObject`, etc.)
rather than reading the admin directly.

---

## What FobX deliberately omits

- No decorators support (annotation strings only via `makeObservable`).
- No `extendObservable`.
- No `trace` / spy event listeners.
- No `toJS` utility (use spread, `Array.from`, or `new Map()` to convert).
- No `computed.struct` annotation shorthand (use tuple form
  `["computed", myComparer]` with a structural comparer).
- No MobX-React / MobX-Preact adapter in core (separate packages).
