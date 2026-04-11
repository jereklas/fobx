---
title: observableMap
description: Reactive Map with per-key dependency tracking.
navTitle: observableMap
navSection: ["@fobx/core", "API", "Observables"]
navOrder: 1
navSectionOrders: [1, 5, 1]
navSectionCollapsible: false
---

`observableMap` creates a reactive `Map` implementation. It tracks reads at the
individual-key level, so a reaction that reads `map.get("x")` will only re-run
when the value for key `"x"` changes.

## Signature

```ts
function observableMap<K, V>(
  entries?: Map<K, V> | Iterable<readonly [K, V]> | Record<string, V> | null,
  options?: MapOptions,
): ObservableMap<K, V>

interface MapOptions {
  name?: string
  comparer?: EqualityComparison
  shallow?: boolean
}

interface ObservableMap<K, V> extends Map<K, V> {
  replace(
    entries: Iterable<readonly [K, V]> | Record<string, V> | Map<K, V>,
  ): void
  merge(
    entries: Iterable<readonly [K, V]> | Record<string, V> | Map<K, V>,
  ): void
  toJSON(): [K, V][]
}
```

## Parameters

| Parameter          | Type                                          | Description                                           |
| ------------------ | --------------------------------------------- | ----------------------------------------------------- |
| `entries`          | `Map \| Iterable<[K,V]> \| Record<string, V>` | Starting entries                                      |
| `options.name`     | `string`                                      | Debug name                                            |
| `options.comparer` | `EqualityComparison`                          | Equality check for values                             |
| `options.shallow`  | `boolean`                                     | If `true`, values are not recursively made observable |

## Basic usage

```ts
import { autorun, observableMap } from "@fobx/core"

const users = observableMap<string, string>()

const stop = autorun(() => {
  console.log("Alice:", users.get("alice") ?? "unknown")
})
// prints: Alice: unknown

users.set("alice", "Alice Smith")
// prints: Alice: Alice Smith

users.set("bob", "Bob Jones")
// nothing printed — "alice" key didn't change

stop()
```

## Tracking granularity

| Operation                                          | What is tracked                                 |
| -------------------------------------------------- | ----------------------------------------------- |
| `get(key)`                                         | That specific key's value                       |
| `getOrInsert(key, defaultValue)`                   | That specific key's value after any miss insert |
| `getOrInsertComputed(key, callback)`               | That specific key's value after any miss insert |
| `has(key)`                                         | That specific key (including absent keys)       |
| `size`                                             | The keys collection (any add/delete triggers)   |
| `forEach`, `entries`, `values`, `keys`, `for...of` | The entire map                                  |

```ts
const m = observableMap([["a", 1], ["b", 2]])

// This autorun only re-runs when key "a" changes
autorun(() => console.log(m.get("a")))

m.set("b", 99) // no re-run (key "a" unchanged)
m.set("a", 10) // re-runs
```

## Standard Map methods

All standard `Map` methods are supported:

- `get(key)`, `set(key, value)`, `has(key)`, `delete(key)`, `clear()`
- `size`
- `forEach(callback)`, `entries()`, `values()`, `keys()`
- `for...of` iteration
- `Symbol.iterator`

### `getOrInsert(key, defaultValue)`

Returns the existing value for `key`. If the key is missing, it inserts
`defaultValue` first and then returns the stored value through the same tracked
read path as `get(key)`.

In deep mode, the inserted value goes through the same conversion pipeline as
`set()`, so the returned value may be an observable copy rather than the
original input reference.

```ts
const users = observableMap<string, { visits: number }>()

const user = users.getOrInsert("alice", { visits: 1 })
console.log(user === users.get("alice")) // true
```

### `getOrInsertComputed(key, callback)`

Like `getOrInsert`, but computes the default value lazily on misses. The
callback receives the missing key, runs only when that key is absent, and runs
without tracking so reads inside the callback do not create dependencies.

If `callback` is not callable, the method throws a `TypeError`.

```ts
const users = observableMap<string, number>()

const visits = users.getOrInsertComputed("alice", (key) => key.length)
console.log(visits) // 5
```

Because misses perform insertion before the tracked read, calling either method
inside a reaction mutates the map once on the first miss and then tracks the
inserted key exactly like `get(key)`.

### `replace(entries)`

Additional method that replaces all entries atomically. Accepts a `Map`, an
iterable of entries, or a plain object:

```ts
users.replace(new Map([["charlie", "Charlie Brown"]]))
// Map now has only "charlie"
```

### `merge(entries)`

Merges entries into the map. Accepts a `Map`, an iterable of entries, or a plain
object:

```ts
users.merge([["dave", "Dave Lee"]])
// Adds "dave" without removing existing entries
```

### `toJSON()`

Returns an array of entries:

```ts
const plain = users.toJSON()
// [["alice", "Alice Smith"], ["bob", "Bob Jones"]]
```

## Shallow mode

```ts
const shallow = observableMap<string, { x: number }>([], { shallow: true })

const obj = { x: 1 }
shallow.set("item", obj)

// obj is stored as-is, not converted to observable
console.log(shallow.get("item") === obj) // true
```

## Deep mode (default)

In deep mode, plain objects and arrays added as values are automatically
converted to observable objects/arrays. The converted value is a new observable
copy, not the original reference:

```ts
const deep = observableMap<string, { x: number }>()

const obj = { x: 1 }
deep.set("item", obj)
// deep.get("item") is an observable copy of obj, not the same reference
console.log(deep.get("item") === obj) // false
```
