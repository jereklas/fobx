---
title: Objects and Annotations
description: Make entire objects reactive with observable() and makeObservable().
navSection: Core/API
navOrder: 2
---

While `box` gives you a single reactive value, `observable` and `makeObservable`
let you make an **entire object** reactive in one call. Getters become
computeds, functions become transactions, and data properties become observable
boxes — all with property-access syntax rather than explicit `.get()`/`.set()`.

---

## `observable(target, options?)`

```ts
observable(
  target: object | array | Map | Set,
  options?: ObservableOptions
): typeof target

interface ObservableOptions<T extends object = object> {
  name?: string
  defaultAnnotation?: AnnotationString   // default: "observable"
  annotations?: Partial<AnnotationsMap<T>>
  inPlace?: boolean                       // plain objects only; default: false
  ownPropertiesOnly?: boolean             // default: false
}
```

`observable` is the auto-annotation API. It inspects the target object and
applies sensible defaults to each member:

| Member type | Default annotation |
|---|---|
| Data property | `observable` (deep) |
| Getter | `computed` |
| Function | `transaction` |

### Plain objects — new reference by default

By default, `observable` creates a **new** object; the original is not mutated:

```ts
import * as fobx from "@fobx/core"

const original = { count: 0 }
const obs = fobx.observable(original)

// obs is a different object:
if (obs === original) throw new Error("should be a new reference")

// but it behaves reactively:
const log: number[] = []
const stop = fobx.autorun(() => log.push(obs.count))
// log: [0]

obs.count++
// log: [0, 1]

stop()
if (log.length !== 2) throw new Error("expected 2 entries")
```

### `inPlace: true` — mutate source

Pass `inPlace: true` to make the source object itself observable:

```ts
import * as fobx from "@fobx/core"

const state = { count: 0, label: "hello" }
const obs = fobx.observable(state, { inPlace: true })

if (obs !== state) throw new Error("inPlace should return the same reference")
if (!fobx.isObservableObject(state)) throw new Error("state should be observable")

state.count = 5
if (state.count !== 5) throw new Error("should be 5")
```

### Class instances — always mutated in place

For class instances, `observable` always mutates in place:

```ts
import * as fobx from "@fobx/core"

class Counter {
  count = 0
  label = "counter"

  get doubled() {
    return this.count * 2
  }

  increment() {
    this.count++
  }
}

const counter = fobx.observable(new Counter())

const log: number[] = []
const stop = fobx.autorun(() => log.push(counter.doubled))
// log: [0]

counter.increment() // wrapped as a transaction
// log: [0, 2]

stop()
if (log.length !== 2) throw new Error("expected 2 entries")
if (log[1] !== 2) throw new Error("expected doubled to be 2")
```

### Overriding annotations

Use `annotations` to override specific members:

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable(
  {
    id: "abc-123",       // constant identifier
    name: "Widget",      // mutable
    tags: ["a", "b"],   // mutable collection
  },
  {
    annotations: {
      id: "none",             // not reactive — it never changes
      tags: "observable.shallow", // array is observable but items are not
    },
  },
)

if (fobx.isObservable(model, "id")) throw new Error("id should not be observable")
if (!fobx.isObservableArray(model.tags)) throw new Error("tags should be observable array")
```

### Changing the default annotation

By default, unannotated data properties are made deeply observable. You can
change this by passing `defaultAnnotation`:

```ts
import * as fobx from "@fobx/core"

// All data properties default to ref-observable (no deep conversion)
const model = fobx.observable(
  { id: "abc-123", name: "Widget", count: 0 },
  { defaultAnnotation: "observable.ref" },
)
```

This only affects **data properties** whose annotation is not already specified
via `annotations`. Getters and functions still follow their own inference rules
(`computed` and `transaction` respectively).

A common use-case is `"observable.ref"` — useful when values are primitives or
objects you own and don't want recursively proxied — or `"observable.shallow"`
for collections whose items should stay plain.

### Collections via `observable`

Passing an array, Map, or Set delegates to the collection constructors:

```ts
import * as fobx from "@fobx/core"

const arr = fobx.observable([1, 2, 3])
const map = fobx.observable(new Map([["a", 1]]))
const set = fobx.observable(new Set(["x"]))

if (!fobx.isObservableArray(arr)) throw new Error("should be observable array")
if (!fobx.isObservableMap(map)) throw new Error("should be observable map")
if (!fobx.isObservableSet(set)) throw new Error("should be observable set")
```

---

## `makeObservable(target, options)`

```ts
makeObservable(
  target: object,
  options: MakeObservableOptions
): typeof target

interface MakeObservableOptions<T extends object = object> {
  name?: string
  annotations: AnnotationsMap<T>  // explicit member-by-member annotations
  ownPropertiesOnly?: boolean
}
```

`makeObservable` is the **explicit** annotation API. Only members listed in
`annotations` are transformed. Use this when you need precise control, or when
auto-inference would annotate something incorrectly.

### Usage in a class constructor

```ts
import * as fobx from "@fobx/core"

class TodoList {
  todos: string[] = []
  filter: "all" | "done" | "pending" = "all"

  get pendingCount() {
    return this.todos.filter((t) => t.startsWith("[ ]")).length
  }

  addTodo(text: string) {
    this.todos.push(text)
  }

  setFilter(f: typeof this.filter) {
    this.filter = f
  }

  constructor() {
    fobx.makeObservable(this, {
      annotations: {
        todos: "observable",
        filter: "observable",
        pendingCount: "computed",
        addTodo: "transaction",
        setFilter: "transaction",
      },
    })
  }
}

const list = new TodoList()

const counts: number[] = []
const stop = fobx.autorun(() => counts.push(list.pendingCount))
// counts: [0]

list.addTodo("[ ] Learn FobX")
list.addTodo("[x] Install FobX")
// counts: [0, 1, 1] — pendingCount changed on first add, not second

stop()
if (counts[1] !== 1) throw new Error("expected 1 pending")
```

### Selective annotation

Unlike `observable`, `makeObservable` only processes listed members:

```ts
import * as fobx from "@fobx/core"

const obj = { tracked: 1, notTracked: 2 }
fobx.makeObservable(obj, {
  annotations: { tracked: "observable" },
})

if (!fobx.isObservable(obj, "tracked")) throw new Error("tracked should be observable")
if (fobx.isObservable(obj, "notTracked")) throw new Error("notTracked should NOT be observable")
```

---

## Annotation reference

### `"observable"` (deep)

The default annotation for data properties. Assigned values are automatically
converted to their observable counterparts:

- Plain objects → observable object
- Arrays → `ObservableArray`
- Maps → `ObservableMap`
- Sets → `ObservableSet`
- Functions → wrapped as `transaction`
- Primitives and class instances → stored as-is (only the box tracks reassignment)

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable({ nested: { x: 1 } })

// nested object is also made observable
if (!fobx.isObservableObject(model.nested)) {
  throw new Error("deep observable should convert nested objects")
}
```

### `"observable.ref"`

Tracks **reassignment only**. The assigned value is stored as-is — it is never
auto-converted to an observable:

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable(
  { data: { x: 1 } },
  { annotations: { data: "observable.ref" } },
)

// The nested object is NOT made observable
if (fobx.isObservableObject(model.data)) {
  throw new Error("ref should not deep-convert nested objects")
}

let runs = 0
const stop = fobx.autorun(() => { model.data; runs++ })

model.data.x = 2   // does NOT trigger (inner mutation, not tracked)
if (runs !== 1) throw new Error("inner mutation should not trigger")

model.data = { x: 3 } // DOES trigger (reassignment)
if (runs !== 2) throw new Error("reassignment should trigger")

stop()
```

### `"observable.shallow"`

Like `"observable.ref"` but for collections. The collection itself is made
observable, but its contents are not deep-converted:

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable(
  { items: [{ id: 1 }, { id: 2 }] },
  { annotations: { items: "observable.shallow" } },
)

// The array is observable:
if (!fobx.isObservableArray(model.items)) {
  throw new Error("shallow array should be observable")
}

// But its items are NOT:
if (fobx.isObservableObject(model.items[0])) {
  throw new Error("shallow items should not be made observable")
}
```

### `"computed"`

Marks a getter as a computed value. Automatically inferred for getters by
`observable`.

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable({
  first: "John",
  last: "Doe",
  get fullName() {
    return `${this.first} ${this.last}`
  },
})

const names: string[] = []
const stop = fobx.autorun(() => names.push(model.fullName))

model.first = "Jane"

stop()
if (names.length !== 2) throw new Error("expected 2 names")
if (names[1] !== "Jane Doe") throw new Error("wrong name")
```

### `["computed", comparer]` — computed with custom comparer

Use tuple form to attach a comparer to a computed annotation:

```ts
import * as fobx from "@fobx/core"

fobx.configure({
  comparer: { structural: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
})

const model = fobx.observable(
  {
    items: [1, 2, 3],
    get sortedItems() {
      return [...this.items].sort((a, b) => a - b)
    },
  },
  { annotations: { sortedItems: ["computed", "structural"] } },
)

let runs = 0
const stop = fobx.autorun(() => { model.sortedItems; runs++ })
// runs = 1

// Pushing a new item that doesn't change the sorted output would still
// rerun because the array content changed — with structural comparer
// the reaction won't run again if output is structurally the same
stop()
```

### `"transaction"`

Wraps a function so that all mutations inside it are batched. Automatically
inferred for plain functions by `observable`.

```ts
import * as fobx from "@fobx/core"

const counter = fobx.observable({
  value: 0,
  step: 1,

  incrementBy(n: number) {
    this.value += n  // wrapped in transaction — batched
  },
})

const log: number[] = []
const stop = fobx.autorun(() => log.push(counter.value))

counter.incrementBy(5)
if (log[log.length - 1] !== 5) throw new Error("expected 5")

stop()
```

### `"transaction.bound"`

Same as `"transaction"` but also binds `this`. Useful when passing the method
as a callback:

```ts
import * as fobx from "@fobx/core"

const counter = fobx.makeObservable(
  { value: 0, increment() { this.value++ } },
  { annotations: { value: "observable", increment: "transaction.bound" } },
)

const { increment } = counter // destructure — `this` is still bound

const log: number[] = []
const stop = fobx.autorun(() => log.push(counter.value))

increment() // works correctly even though detached
if (log[log.length - 1] !== 1) throw new Error("expected 1")

stop()
```

### `"none"`

Explicitly excludes a property from being made observable:

```ts
import * as fobx from "@fobx/core"

const model = fobx.observable(
  { id: "abc", name: "Widget" },
  { annotations: { id: "none" } },
)

if (fobx.isObservable(model, "id")) throw new Error("id should not be observable")
if (!fobx.isObservable(model, "name")) throw new Error("name should be observable")
```

### `"flow"` and `"flow.bound"` annotations

These annotation strings are accepted and wrap the generator **function** in a
transaction. They are accepted for compatibility, but they do **not** manage
the generator iterator lifecycle — calling the method returns a generator
iterator without auto-advancing it. For async state mutations use
`runInTransaction` inside async handlers instead (see
[Compatibility and Non-goals](/core/behavior/compatibility-and-non-goals/)).

You can verify the wrapping is in place with `isTransaction`:

```ts
import * as fobx from "@fobx/core"

const store = fobx.makeObservable(
  {
    status: "idle" as string,
    *loadData() {
      this.status = "loading"
    },
  },
  { annotations: { status: "observable", loadData: "flow" } },
)

// The method is wrapped as a transaction:
if (!fobx.isTransaction(store.loadData)) {
  throw new Error("flow-annotated method should be a transaction wrapper")
}
```

---

## Writable computed on objects

Define both a getter and a setter for the same property; FobX will install it
as a writable computed:

```ts
import * as fobx from "@fobx/core"

const thermometer = fobx.observable({
  _celsius: 20,
  get temperature() {
    return this._celsius
  },
  set temperature(c: number) {
    this._celsius = c
  },
})

if (!fobx.isComputed(thermometer, "temperature")) {
  throw new Error("temperature should be a computed")
}

thermometer.temperature = 100
if (thermometer.temperature !== 100) throw new Error("setter should work")
```

---

## Error cases

Certain annotation mismatches throw at annotation time:

```ts
import * as fobx from "@fobx/core"

// computed on a non-getter throws
let threw = false
try {
  fobx.makeObservable(
    { x: 1 },
    { annotations: { x: "computed" } },
  )
} catch {
  threw = true
}
if (!threw) throw new Error("computed on non-getter should throw")

// transaction on a non-function throws
let threw2 = false
try {
  fobx.makeObservable(
    { x: 1 },
    { annotations: { x: "transaction" } },
  )
} catch {
  threw2 = true
}
if (!threw2) throw new Error("transaction on non-function should throw")
```
