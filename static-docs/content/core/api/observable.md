---
title: observable
description: Make plain objects and class instances reactive with inferred annotations.
navTitle: observable
navSection: ["@fobx/core", "API", "Observables"]
navOrder: 1
navSectionOrders: [1, 5, 1]
navSectionCollapsible: false
---

`observable()` turns plain objects and class instances into reactive objects
whose property reads are tracked and property writes trigger reactions. For an
existing instance with an explicit annotations map, use
[`makeObservable()`](/core/api/make-observable/).

## Signature

Creates a reactive object from a plain object or class instance. Annotations are
auto-inferred when not provided.

For arrays, maps, and sets, `observable()` delegates to
[`observableArray`](/core/api/observable-array/),
[`observableMap`](/core/api/observable-map/), and
[`observableSet`](/core/api/observable-set/).

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

## Basic usage

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

## How inference works

When no annotations are provided, `observable()` infers them:

| Property kind            | Inferred annotation   |
| ------------------------ | --------------------- |
| Own data property        | `"observable"` (deep) |
| Getter accessor          | `"computed"`          |
| Function value           | `"transaction"`       |
| Generator function value | `"flow"`              |

## Options

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

## `inPlace` mode

By default, `observable()` returns a new observable copy when you pass a plain
object. With `inPlace: true`, the original plain object is mutated. Class
instances are always mutated in place:

```ts
const source = { count: 0 }
const store = observable(source, { inPlace: true })

console.log(source === store) // true — same reference
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
| `false`                | Skip this property (`observable()` only — overrides auto-inference)          |

### Annotation with custom comparer

Use the array form `[annotation, comparer]` to set a custom equality check. The
`"structural"` comparer requires a one-time `configure()` call at app startup:

```ts
const store = observable(
  {
    coords: { x: 0, y: 0 },
    get total() {
      return this.coords.x + this.coords.y
    },
  },
  {
    annotations: {
      coords: ["observable", "structural"],
      total: ["computed", (a, b) => Math.abs(a - b) < 0.01],
    },
  },
})
```

## Inheritance

`observable()` supports class inheritance. Base class explicit annotations stay
authoritative by property name when a subclass later calls `observable(this)` or
`makeObservable(this)`:

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
class Store {
  private count = 0

  constructor() {
    observable(this, {
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
annotated by `observable` at all.

A future first-class fix is likely to come from **JS decorator support**. The
[TC39 decorator proposal](https://github.com/tc39/proposal-decorators) is
supported by TypeScript 5.0+, esbuild, Babel, and SWC, though support varies
across bundlers and native browser support is still uneven. Decorator-based
annotation operates at the point of class field definition, giving the decorator
direct access to the field regardless of TypeScript access modifiers. Decorators
are on the roadmap for this library and would eliminate this limitation
entirely.

## Related API

Use [`makeObservable()`](/core/api/make-observable/) when you want an explicit
annotations map instead of inference. It keeps the same instance reference and
is usually the better fit for class constructors with carefully curated reactive
members.
