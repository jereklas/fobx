---
title: Collections
description: Reactive arrays, maps, and sets.
navSection: Core/API
navOrder: 3
---

FobX provides reactive wrappers for the three JavaScript collection types. Each
one tracks read and write operations so reactions and computeds automatically
update when the collection changes.

---

## `observableArray(initialValue?, options?)`

```ts
observableArray<T>(initialValue?: T[], options?: ArrayOptions): ObservableArray<T>

interface ArrayOptions {
  name?: string
  shallow?: boolean           // if true, items are not deep-converted
  comparer?: EqualityComparison
}

interface ObservableArray<T> extends Array<T> {
  replace(newArray: T[]): T[]
  remove(item: T): number
  clear(): T[]
  toJSON(): T[]
}
```

An `ObservableArray` is backed by a JavaScript `Proxy`. It supports the complete
`Array` interface plus a few extra utility methods.

### Basic usage

```ts
import * as fobx from "@fobx/core"

const fruits = fobx.observableArray(["apple", "banana"])

const log: string[] = []
const stop = fobx.autorun(() => {
  log.push(fruits.join(", "))
})
// log: ["apple, banana"]

fruits.push("cherry")
// log: ["apple, banana", "apple, banana, cherry"]

stop()
if (log.length !== 2) throw new Error("expected 2 log entries")
```

### Length is reactive

```ts
import * as fobx from "@fobx/core"

const items = fobx.observableArray([1, 2, 3])
const sizes: number[] = []

const stop = fobx.reaction(
  () => items.length,
  (n) => sizes.push(n),
)

items.push(4) // sizes: [4]
items.push(5) // sizes: [4, 5]
items.splice(0, 2) // sizes: [4, 5, 3]

stop()
if (sizes.length !== 3) throw new Error("expected 3")
```

### Index access tracks the whole array

Accessing any element via `items[i]` tracks the **whole array admin**, not an
individual slot. This means any mutation to the array (any index) will
re-trigger a reaction that read any element by index:

```ts
import * as fobx from "@fobx/core"

const items = fobx.observableArray(["a", "b", "c"])
const log: string[] = []

// Reading items[1] subscribes to the whole array
const stop = fobx.autorun(() => log.push(items[1]))
// log: ["b"]

items[0] = "z" // reaction runs — whole-array tracking
items[1] = "y" // reaction runs
items[2] = "x" // reaction runs

stop()
if (log.length !== 4) {
  throw new Error("expected 4 entries (initial + 3 mutations)")
}
if (log[2] !== "y") throw new Error("expected y after items[1] change")
```

> **Tip:** For fine-grained per-slot tracking, use an `observableMap` keyed by
> index, or wrap each item in an `observableBox`.

### Mutation methods

All standard mutating methods are supported (`push`, `pop`, `shift`, `unshift`,
`splice`, `sort`, `reverse`), plus:

```ts
import * as fobx from "@fobx/core"

const numbers = fobx.observableArray([3, 1, 4, 1, 5, 9])

// replace() swaps entire contents
const removed = numbers.replace([1, 2, 3])
if (numbers.length !== 3) throw new Error("expected 3")

// remove() finds and removes first occurrence, returns index (-1 if not found)
const idx = numbers.remove(2) // removes the 2, returns index 1
if (idx !== 1) throw new Error("expected index 1")
if (numbers.length !== 2) throw new Error("expected 2")

// clear() removes all elements
const cleared = numbers.clear()
if (numbers.length !== 0) throw new Error("expected empty")
```

### Shallow arrays

By default, objects pushed into an observable array are deep-converted to
observables. Pass `shallow: true` to keep items as plain values:

```ts
import * as fobx from "@fobx/core"

const deep = fobx.observableArray([{ x: 1 }])
const shallow = fobx.observableArray([{ x: 1 }], { shallow: true })

// Deep array converts items:
if (!fobx.isObservableObject(deep[0])) {
  throw new Error("deep array should convert items")
}

// Shallow array keeps items as-is:
if (fobx.isObservableObject(shallow[0])) {
  throw new Error("shallow array should NOT convert items")
}
```

### `toJSON()`

Converts back to a plain JavaScript array (shallow copy):

```ts
import * as fobx from "@fobx/core"

const obs = fobx.observableArray([1, 2, 3])
const plain = obs.toJSON()

if (fobx.isObservableArray(plain)) {
  throw new Error("toJSON should return plain array")
}
if (plain.length !== 3) throw new Error("expected 3 items")
```

---

## `observableMap(entries?, options?)`

```ts
observableMap<K, V>(entries?: Iterable<[K, V]>, options?: MapOptions): ObservableMap<K, V>

interface MapOptions {
  name?: string
  shallow?: boolean
  comparer?: EqualityComparison
}

interface ObservableMap<K, V> extends Map<K, V> {
  replace(entries: Iterable<[K, V]> | Record<string, V>): void
  merge(entries: Iterable<[K, V]> | Record<string, V>): void
  toJSON(): [K, V][]
}
```

### Basic usage

```ts
import * as fobx from "@fobx/core"

const scores = fobx.observableMap([["alice", 100], ["bob", 85]])

const log: string[] = []
const stop = fobx.autorun(() => {
  log.push(`alice: ${scores.get("alice")}`)
})
// log: ["alice: 100"]

scores.set("alice", 110)
// log: ["alice: 100", "alice: 110"]

scores.set("bob", 90) // does NOT trigger (alice not affected)

stop()
if (log.length !== 2) throw new Error("expected 2")
```

### Key-level tracking

`get(key)` and `has(key)` track at the key level. Changing a different key does
not re-run a reaction that only reads one key:

```ts
import * as fobx from "@fobx/core"

const m = fobx.observableMap<string, number>()
let runs = 0

const stop = fobx.autorun(() => {
  m.get("target") // tracks only "target"
  runs++
})
// runs = 1

m.set("other", 99) // does NOT trigger ("other" not tracked)
if (runs !== 1) throw new Error("unrelated key should not trigger")

m.set("target", 1) // triggers ("target" is tracked)
if (runs !== 2) throw new Error("tracked key should trigger")

m.set("target", 1) // does NOT trigger (same value)
if (runs !== 2) throw new Error("same value should not trigger")

stop()
```

### `has` tracks absent keys too

```ts
import * as fobx from "@fobx/core"

const m = fobx.observableMap<string, number>()
let runs = 0

const stop = fobx.autorun(() => {
  m.has("x") // tracks "x" even when absent
  runs++
})
// runs = 1 (has returns false)

m.set("x", 1) // x now exists — re-runs
if (runs !== 2) throw new Error("adding tracked key should trigger")

m.delete("x") // x gone again — re-runs
if (runs !== 3) throw new Error("deleting tracked key should trigger")

stop()
```

### Iterating the whole map

Iterating (spread, `forEach`, `for...of`, checking `size`) tracks the entire map
and re-runs on any structural change:

```ts
import * as fobx from "@fobx/core"

const m = fobx.observableMap([["a", 1], ["b", 2]])
let runs = 0

const stop = fobx.autorun(() => {
  for (const [, v] of m) void v // iterates all entries
  runs++
})
// runs = 1

m.set("a", 99) // changes a value — re-run
m.set("c", 3) // adds a new key — re-run
m.delete("b") // removes a key — re-run

stop()
if (runs !== 4) throw new Error("expected 4 runs")
```

### `replace` and `merge`

```ts
import * as fobx from "@fobx/core"

const m = fobx.observableMap([["a", 1], ["b", 2]])

// replace: clears and repopulates atomically
m.replace([["c", 3], ["d", 4]])
if (m.size !== 2) throw new Error("expected 2")
if (m.has("a")) throw new Error("a should be gone")

// merge: adds/updates without clearing
m.merge([["d", 40], ["e", 5]])
if (m.get("d") !== 40) throw new Error("d should be updated")
if (m.get("c") !== 3) throw new Error("c should be preserved")
```

---

## `observableSet(values?, options?)`

```ts
observableSet<T>(values?: Iterable<T>, options?: SetOptions): ObservableSet<T>

interface SetOptions {
  name?: string
  shallow?: boolean
}

interface ObservableSet<T> extends Set<T> {
  replace(values: Iterable<T>): void
  toJSON(): T[]
}
```

### Basic usage

```ts
import * as fobx from "@fobx/core"

const tags = fobx.observableSet(["typescript", "reactive"])

const log: boolean[] = []
const stop = fobx.autorun(() => {
  log.push(tags.has("typescript"))
})
// log: [true]

tags.delete("typescript")
// log: [true, false]

tags.add("typescript")
// log: [true, false, true]

stop()
if (log.length !== 3) throw new Error("expected 3")
```

### Value-level tracking

Like `map.has`, `set.has` tracks at the value level:

```ts
import * as fobx from "@fobx/core"

const s = fobx.observableSet<string>()
let runs = 0

const stop = fobx.autorun(() => {
  s.has("target")
  runs++
})
// runs = 1

s.add("other") // does NOT trigger
if (runs !== 1) throw new Error("unrelated value should not trigger")

s.add("target") // triggers
if (runs !== 2) throw new Error("tracked value should trigger")

stop()
```

### `replace`

```ts
import * as fobx from "@fobx/core"

const s = fobx.observableSet(["a", "b", "c"])
let runs = 0

const stop = fobx.reaction(() => s.size, () => runs++)

s.replace(["x", "y"]) // atomic: all changes in one batch
if (runs !== 1) throw new Error("replace should cause one reaction run")
if (s.size !== 2) throw new Error("expected 2")
if (!s.has("x")) throw new Error("x should be present")
if (s.has("a")) throw new Error("a should be gone")

stop()
```

### `toJSON()`

Converts to a plain array:

```ts
import * as fobx from "@fobx/core"

const s = fobx.observableSet([1, 2, 3])
const plain = s.toJSON()

if (!Array.isArray(plain)) throw new Error("toJSON should return array")
if (plain.length !== 3) throw new Error("expected 3 items")
```

---

## Common patterns

### Reacting to the whole collection

To react whenever _anything_ in a collection changes, return the collection from
the `reaction` expression:

```ts
import * as fobx from "@fobx/core"

const list = fobx.observableArray([1, 2, 3])
let snapshots: number[] = []

const stop = fobx.reaction(
  () => list, // returning the collection itself tracks all changes
  () => snapshots.push(list.length),
)

list.push(4) // fires
list.pop() // fires
list.push(5, 6) // fires

stop()
if (snapshots.length !== 3) throw new Error("expected 3")
```

### Computing a derived value from a collection

```ts
import * as fobx from "@fobx/core"

const prices = fobx.observableMap([["coffee", 3.50], ["tea", 2.00], [
  "juice",
  4.50,
]])

const average = fobx.computed(() => {
  const values = Array.from(prices.values())
  return values.reduce((sum, v) => sum + v, 0) / values.length
})

const log: string[] = []
const stop = fobx.autorun(() => {
  log.push(average.get().toFixed(2))
})
// log: ["3.33"]

prices.set("espresso", 4.00)
// log: ["3.33", "3.50"]

stop()
if (log.length !== 2) throw new Error("expected 2 entries")
```
