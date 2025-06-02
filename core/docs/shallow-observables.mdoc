# Shallow Observables in FobX

This document explains the different approaches to shallow observables in FobX:

1. Using `observable({}, {}, { shallowRef: true })`
2. Using `observable({}, { prop: "observable.shallow" })` or
   `makeObservable({}, { prop: "observable.shallow" })`
3. Using `observable({}, { prop: "observable.ref" })` or
   `makeObservable({}, { prop: "observable.ref" })`

> **Note**: The `shallow: true` option has been deprecated and will be removed
> in a future version. Please use `shallowRef: true` instead, which provides the
> same functionality.

## The Three Implementations

### 1. Using `observable()` with `{ shallowRef: true }` option

```ts
const obj = observable(someObject, {}, { shallowRef: true })

// Deprecated - don't use:
// const obj = observable(someObject, {}, { shallow: true })
```

This implementation keeps the original references for all properties of the
object. It makes the properties observable (so changes to the properties
themselves will be tracked), but the properties' values maintain their original
non-observable references.

For collections (Arrays, Maps, Sets), this means:

- The collection itself is stored in an observable box
- The collection is NOT converted to an
  ObservableArray/ObservableMap/ObservableSet
- Changes to the collection (adding/removing items) will NOT trigger reactions
- Only replacing the entire collection will trigger reactions

### 2. Using `observable.shallow` annotation

```ts
// With observable()
observable(obj, { prop: "observable.shallow" })

// Or with makeObservable()
makeObservable(obj, { prop: "observable.shallow" })
```

This implementation:

- Makes the property observable
- If the property is a collection (Array, Map, Set), it turns it into an
  ObservableArray/ObservableMap/ObservableSet with `{ shallow: true }`
- Changes to the collection (adding/removing items) WILL trigger reactions
- The items inside the collection maintain their original references (not made
  observable)

### 3. Using `observable.ref` annotation

```ts
// With observable()
observable(obj, { prop: "observable.ref" })

// Or with makeObservable()
makeObservable(obj, { prop: "observable.ref" })
```


This implementation:

- Makes the property observable
- Maintains the original references for property values (like
  `{ shallowRef: true }`)
- For collections (Arrays, Maps, Sets), it behaves like `{ shallowRef: true }`
  option:
  - The collection is NOT converted to an
    ObservableArray/ObservableMap/ObservableSet
  - Changes to the collection (adding/removing items) will NOT trigger reactions
  - Only replacing the entire collection will trigger reactions

## Why Three Different Implementations?

### React Props Use Case

The `observable({}, {}, { shallowRef: true })` implementation and
`observable.ref` annotation were created specifically to handle React props. In
React components, we want to:

1. Observe when props change
2. Maintain the original object references for each prop value to preserve
   identity and prevent unnecessary renders
3. Avoid making the props' values themselves observable, as they come from
   parent components and shouldn't be mutated

Making collections like arrays non-observable is important in this case because
we want to preserve reference equality and avoid adding reactivity to data that
should be treated as immutable in React.

### Collection-Level Reactivity

The `observable.shallow` annotation approach is useful when:

1. You want to track changes to collections (additions, deletions)
2. But don't want to make the items within those collections observable
3. This provides a good balance between reactivity and performance

This is particularly useful for collections where you care about their
composition changing, but the items themselves might be complex objects that you
don't want to make deeply observable.

## Implementation Details

In the codebase:

1. For `observable({}, {}, { shallowRef: true })`:
   - Implementation uses `observableBox(value, equalityOptions)` for all values
   - Values are wrapped directly in an observable box without transformation

2. For `observable.shallow` annotation (both with `observable()` and
   `makeObservable()`):
   - Collections are first converted to their observable variants with
     `{ shallow: true }`
   - Then these observable collections are wrapped in an observable box
   - This preserves collection-specific reactivity while keeping collection
     items non-observable

3. For `observable.ref` annotation:
   - Implementation is similar to `{ shallowRef: true }` option but applied as
     an annotation
   - Creates a direct observable box for the value without transforming it
   - Maintains original references of the property values

## When To Use Which

- Use `observable({}, {}, { shallowRef: true })` when:
  - Working with React props in a global manner
  - Need to maintain reference equality for all properties
  - Don't want collection operations to trigger reactions

- Use `observable.ref` annotation when:
  - Working with specific React props or immutable values
  - Need to maintain reference equality for specific properties
  - Don't want collection operations to trigger reactions
  - Need property-level control rather than object-level control

- Use `observable.shallow` annotation when:
  - You want collection operations (add/delete) to trigger reactions
  - But don't want the items in the collections to become observable
  - Working with class instances or objects with collections that need specific
    observable behavior
