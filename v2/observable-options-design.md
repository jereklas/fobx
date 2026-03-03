# Observable Options Design Notes

## Current Behavior Summary

### `observable(target, options?)`

| Target type    | Creates new ref? | Installs on prototype? | Notes |
|----------------|------------------|------------------------|-------|
| Plain object   | **Yes**          | N/A                    | Source object is untouched |
| Class instance | **No**           | Yes (inherited members)| Mutates instance in place  |
| Array/Map/Set  | Yes (wrapper)    | N/A                    | Returns observable collection |

**Quirk:** `observable(this)` inside a class constructor already performs in-place
mutation — it *has* to, since the caller holds a reference to `this` and expects
it to become observable. This means `observable` has an implicit behavioral split:
plain objects get a fresh copy while class instances are mutated in place. This is
generally the desired behavior (you typically don't want a class constructor to
silently return a different object), but it's worth being explicit about.

### `makeObservable(target, options?)`

Always mutates `target` in place. For class instances with prototype-defined
methods/getters, descriptors are installed on the **prototype** so they are shared
across all instances of the class.

---

## Proposed New Options

### `observable` → `inPlace?: boolean` (default: `false`)

When `true`, modify the source plain object directly instead of creating a new
reference. This is only meaningful for plain objects — class instances are already
mutated in place regardless of this flag.

```ts
const source = { x: 1, y: 2 }

// default: new reference
const obs = observable(source)
obs !== source // true, source is untouched

// inPlace: same reference
const obs2 = observable(source, { inPlace: true })
obs2 === source // true, source is now observable
```

**Constraints / edge cases:**
- Frozen/sealed objects with `inPlace: true` → must throw (can't define `$fobx`
  or redefine property descriptors on a non-extensible object).
- TypeScript return type stays `T` either way, so no typing impact.
- When `inPlace: true`, the function still processes all auto-inferred annotations
  and installs getters/setters on the object itself.

**Relationship to `extendObservable`:** With `inPlace: true`, the main use case
for `extendObservable` (making an existing plain object observable without creating
a new reference) is covered. `extendObservable` still adds *new* properties from a
separate extension object, which `inPlace` doesn't do — so `extendObservable` may
still be useful for merging, but less essential.

---

### `makeObservable` → `ownPropertiesOnly?: boolean` (default: `false`)

`makeObservable` already operates in place — it never creates a new reference.
The meaningful choice for `makeObservable` is **where** to install descriptors for
inherited (prototype) members.

When `false` (default): methods and getters defined on a prototype are annotated on
the prototype itself. This means the annotation is shared across all instances of
the class, which is efficient but has the side-effect that one `makeObservable` call
in a constructor transforms the prototype for every future instance too.

When `true`: all descriptors are installed directly on the instance, never touching
the prototype. This isolates the instance from prototype pollution and is useful
when:
- You only want a single instance to be observable
- You're working with a class you don't control
- You want to avoid the shared-prototype side-effect

```ts
class Foo {
  x = 1
  get doubled() { return this.x * 2 }
  inc() { this.x++ }
}

// default: inc and doubled are annotated on Foo.prototype
makeObservable(new Foo(), { annotations: { x: "observable", doubled: "computed", inc: "transaction" } })

// ownPropertiesOnly: everything installed on the instance, prototype untouched
makeObservable(new Foo(), {
  annotations: { x: "observable", doubled: "computed", inc: "transaction" },
  ownPropertiesOnly: true,
})
```

**Naming alternatives considered:**
- `skipPrototype` — clear but negative phrasing
- `instanceOnly` — slightly ambiguous (could mean "only works on instances")
- `ownPropertiesOnly` — precise: everything becomes an own property ✓

---

## Decisions (Resolved)

1. **`inPlace` on class instances** — silently ignored. It's already in-place.

2. **`ownPropertiesOnly` on `observable`** — yes, accepted on both `observable`
   and `makeObservable`. When `observable` is called on a class instance with
   `ownPropertiesOnly: true`, all descriptors go on the instance, not the prototype.

3. **`extendObservable` removed.** The replacement pattern is:
   ```ts
   // Old:
   extendObservable(target, { newProp: value })
   
   // New:
   target.newProp = value
   makeObservable(target, { annotations: { newProp: "observable" } })
   ```
   For constructor-function patterns (old MobX style), assign properties on `this`
   and then call `makeObservable(this, { annotations: {...} })`.

   For getters, use `Object.defineProperty(this, key, { get() {...}, ... })` before
   the `makeObservable` call.

## Behavioral Matrix (final)

| Function        | Target         | Option              | Creates new ref? | Prototype touched? |
|-----------------|----------------|---------------------|------------------|--------------------|
| `observable`    | Plain object   | *(default)*         | Yes              | N/A                |
| `observable`    | Plain object   | `inPlace: true`     | **No**           | N/A                |
| `observable`    | Class instance | *(any)*             | No               | Yes (inherited)    |
| `observable`    | Class instance | `ownPropertiesOnly` | No               | **No**             |
| `makeObservable`| Any object     | *(default)*         | No               | Yes (inherited)    |
| `makeObservable`| Any object     | `ownPropertiesOnly` | No               | **No**             |
