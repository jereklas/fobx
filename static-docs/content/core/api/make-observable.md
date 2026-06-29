---
title: makeObservable
description: Make an object reactive using explicit annotations.
navTitle: makeObservable
navSection: ["@fobx/core", "API", "Observables"]
navOrder: 1
navSectionOrders: [1, 5, 1]
navSectionCollapsible: false
---

`makeObservable()` makes an existing object reactive using an explicit
annotations map. It is most commonly used in a class constructor. Unlike
[`observable()`](/core/api/observable/), it does **not** auto-infer annotations.

## Signature

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

## Options

| Option              | Type             | Default     | Description                                            |
| ------------------- | ---------------- | ----------- | ------------------------------------------------------ |
| `name`              | `string`         | (generated) | Debug name                                             |
| `annotations`       | `AnnotationsMap` | required    | Explicit annotations for the members you want reactive |
| `ownPropertiesOnly` | `boolean`        | `false`     | Install all descriptors on instance (skip prototype)   |

## Basic usage

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

## Explicit annotations

Every property you want to be reactive must be listed in the annotations map.
Properties not listed are left untouched:

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

## Inheritance

`makeObservable()` supports class inheritance. Each class in the chain can call
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

## TypeScript `private` fields

TypeScript's `private` keyword is a compile-time-only restriction. Fields marked
`private` are excluded from `keyof T`, which means they do not appear in
`AnnotationsMap<T>` and TypeScript will report an error if you list them in
`annotations`.

The runtime object still carries those fields — the restriction is purely in the
type system. The practical workaround is to suppress the error on the offending
line:

```ts
class Counter {
  private count = 0

  constructor() {
    makeObservable(this, {
      annotations: {
        // @ts-expect-error — TypeScript private is compile-time only;
        // the field exists at runtime and can be annotated safely.
        count: "observable",
      },
    })
  }
}
```

Be aware that `@ts-expect-error` here will **not** catch a rename of the private
field. Because TypeScript never knew about the field in the first place, both a
valid private name and a completely wrong name produce the same "property does
not exist" error — so the directive silently swallows both.

ECMAScript hard-private fields (`#count`) are a different case: they are
genuinely inaccessible from outside the class at runtime, so they cannot be
annotated by `makeObservable` at all.

A future first-class fix is likely to come from **JS decorator support**. The
[TC39 decorator proposal](https://github.com/tc39/proposal-decorators) is
supported by TypeScript 5.0+, esbuild, Babel, and SWC, though support varies
across bundlers and native browser support is still uneven. Decorator-based
annotation operates at the point of class field definition, giving the decorator
direct access to the field regardless of TypeScript access modifiers. Decorators
are on the roadmap for this library and would eliminate this limitation
entirely.

## Related API

Use [`observable()`](/core/api/observable/) when you want annotation inference,
plain-object copy semantics by default, or a shorter setup for simple stores.
