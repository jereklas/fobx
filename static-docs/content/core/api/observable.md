---
title: observable / makeObservable
description: Make plain objects and class instances reactive.
navTitle: observable / makeObservable
navSection: ["@fobx/core", "API"]
navOrder: 6
---

`observable()` and `makeObservable()` turn objects into reactive objects whose
property reads are tracked and property writes trigger reactions.

---

## `observable()`

Creates a reactive object from a plain object or class instance. Annotations are
auto-inferred when not provided.

For arrays, maps, and sets, `observable()` delegates to
[`observableArray`](/core/api/observable-array/),
[`observableMap`](/core/api/observable-map/), and
[`observableSet`](/core/api/observable-set/).

### Signature

```ts
function observable<T extends object>(
  target: T,
  options?: ObservableOptions<T>,
): T

interface ObservableOptions<T extends object> {
  name?: string
  defaultAnnotation?: AnnotationString
  annotations?: Partial<AnnotationsMap<T>>
  inPlace?: boolean
  ownPropertiesOnly?: boolean
}
```

### Basic usage

```ts
import { autorun, observable } from "@fobx/core"

const store = observable({
  count: 0,
  items: ["a", "b"],
  get total() {
    return this.items.length
  },
  increment() {
    this.count++
  },
})

autorun(() => console.log(store.count))
// prints: 0

store.increment()
// prints: 1
```

### How inference works

When no annotations are provided, `observable()` infers them:

| Property kind            | Inferred annotation   |
| ------------------------ | --------------------- |
| Own data property        | `"observable"` (deep) |
| Getter accessor          | `"computed"`          |
| Function value           | `"transaction"`       |
| Generator function value | `"flow"`              |

### Options

| Option              | Type               | Default        | Description                                          |
| ------------------- | ------------------ | -------------- | ---------------------------------------------------- |
| `name`              | `string`           | (generated)    | Debug name                                           |
| `annotations`       | `AnnotationsMap`   | (inferred)     | Override annotations for specific properties         |
| `defaultAnnotation` | `AnnotationString` | `"observable"` | Default for data properties                          |
| `inPlace`           | `boolean`          | `false`        | Mutate the source object instead of copying          |
| `ownPropertiesOnly` | `boolean`          | `false`        | Install all descriptors on instance (skip prototype) |

If you explicitly set `defaultAnnotation` to a data annotation (`"observable"`,
`"observable.ref"`, `"observable.shallow"`, or `"none"`), that override still
applies to own fields, including function-valued callback properties stored
directly on the object.

The fix in this area was narrower: it prevents that data default from leaking
onto inherited prototype methods. Class methods and generators still infer to
`"transaction"` or `"flow"` unless you annotate them explicitly.

### `inPlace` mode

By default, `observable()` returns a new observable copy when you pass a plain
object. With `inPlace: true`, the original plain object is mutated. Class
instances are always mutated in place:

```ts
const source = { count: 0 }
const store = observable(source, { inPlace: true })

console.log(source === store) // true — same reference
```

---

## `makeObservable()`

Makes an object reactive using explicit annotations. It is most commonly used in
a class constructor. Unlike `observable()`, it does **not** auto-infer
annotations — you must provide an explicit annotations map.

### Signature

```ts
function makeObservable<T extends object>(
  target: T,
  options?: MakeObservableOptions<T>,
): T

interface MakeObservableOptions<T extends object> {
  name?: string
  annotations?: AnnotationsMap<T>
  ownPropertiesOnly?: boolean
}
```

### Basic usage

```ts
import { autorun, makeObservable } from "@fobx/core"

class TodoStore {
  todos: string[] = []
  get count() {
    return this.todos.length
  }
  addTodo(text: string) {
    this.todos.push(text)
  }

  constructor() {
    makeObservable(this, {
      annotations: {
        todos: "observable",
        count: "computed",
        addTodo: "transaction",
      },
    })
  }
}

const store = new TodoStore()
autorun(() => console.log("count:", store.count))
// prints: count: 0

store.addTodo("Buy milk")
// prints: count: 1
```

### Explicit annotations

Every property you want to be reactive must be listed in the annotations map.
Properties not listed are left untouched — there is no need to mark them:

```ts
class Store {
  id = "fixed" // not listed → not observable
  count = 0
  get doubled() {
    return this.count * 2
  }

  constructor() {
    makeObservable(this, {
      annotations: {
        count: "observable",
        doubled: "computed",
      },
    })
  }
}
```

---

## Annotations reference

| Annotation             | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `"observable"`         | Deep observable — collections and plain objects are recursively converted    |
| `"observable.ref"`     | Reference-only observable — value is stored as-is, no deep conversion        |
| `"observable.shallow"` | Shallow observable — collections track mutations but items are not converted |
| `"computed"`           | Computed derived value                                                       |
| `"transaction"`        | Action — wrapped in a transaction automatically                              |
| `"transaction.bound"`  | Bound action — `this` is bound to the instance                               |
| `"flow"`               | Flow — generator-based async action                                          |
| `"flow.bound"`         | Bound flow                                                                   |
| `"none"`               | Excluded from reactive system                                                |
| `false`                | Skip this property (`observable()` only — overrides auto-inference)          |

### Annotation with custom comparer

Use the array form `[annotation, comparer]` to set a custom equality check. The
`"structural"` comparer requires a one-time `configure()` call at app startup:

```ts
makeObservable(this, {
  annotations: {
    coords: ["observable", "structural"], // structural equality
    total: ["computed", (a, b) => Math.abs(a - b) < 0.01],
  },
})
```

---

## Inheritance

`makeObservable()` supports class inheritance. Each class in the chain calls
`makeObservable(this)` with its own annotations:

```ts
class Base {
  value = 0
  constructor() {
    makeObservable(this, {
      annotations: { value: "observable" },
    })
  }
}

class Derived extends Base {
  extra = ""
  constructor() {
    super()
    makeObservable(this, {
      annotations: { extra: "observable" },
    })
  }
}
```

Prototype members are annotated once per prototype and reused across instances.

When multiple constructors in the same chain annotate the same instance, base
class explicit annotations stay authoritative by property name. A subclass can
add new reactive members, but it cannot reinterpret a base key from `"computed"`
to `"none"`, or from `"none"` to `"transaction"`, unless the base class itself
left that key unclaimed.

This applies to both `makeObservable(this)` and `observable(this)` on class
instances, which is what keeps hooks like `ViewModel.update()` plain even when a
subclass later calls `observable(this)`.

---

## `observable()` vs `makeObservable()`

| Feature           | `observable()`                                                            | `makeObservable()`                                      |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| Input             | Plain object or class instance                                            | Any non-collection object                               |
| Returns           | New plain-object copy by default; class instances keep the same reference | Same instance                                           |
| Auto-inference    | Yes                                                                       | No — explicit annotations required                      |
| Prototype methods | Supported (class instances)                                               | Supported                                               |
| Inheritance       | Supported (class instances); base explicit annotations stay authoritative | Supported; base explicit annotations stay authoritative |
| `inPlace` option  | Yes                                                                       | N/A (always in-place)                                   |
| Best for          | Simple stores, configuration                                              | Classes or objects with explicit annotations            |
