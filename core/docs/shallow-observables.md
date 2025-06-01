# Shallow Observables in FobX

This document explains the subtle differences between two approaches to shallow
observables in FobX:

1. Using `observable({}, {}, { shallow: true })`
2. Using `makeObservable({}, { prop: "observable.shallow" })`

## The Two Implementations

### 1. Using `observable()` with `{ shallow: true }` option

```ts
const obj = observable(someObject, {}, { shallow: true })
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

### 2. Using `makeObservable()` with `"observable.shallow"` annotation

```ts
makeObservable(obj, { prop: "observable.shallow" })
```

This implementation:

- Makes the property observable
- If the property is a collection (Array, Map, Set), it turns it into an
  ObservableArray/ObservableMap/ObservableSet with `{ shallow: true }`
- Changes to the collection (adding/removing items) WILL trigger reactions
- The items inside the collection maintain their original references (not made
  observable)

## Why Two Different Implementations?

### React Props Use Case

The `observable({}, {}, { shallow: true })` implementation was created
specifically to handle React props. In React components, we want to:

1. Observe when props change
2. Maintain the original object references for each prop value to preserve
   identity and prevent unnecessary renders
3. Avoid making the props' values themselves observable, as they come from
   parent components and shouldn't be mutated

Making collections like arrays non-observable is important in this case because
we want to preserve reference equality and avoid adding reactivity to data that
should be treated as immutable in React.

### Collection-Level Reactivity

The `makeObservable()` with `"observable.shallow"` approach is useful when:

1. You want to track changes to collections (additions, deletions)
2. But don't want to make the items within those collections observable
3. This provides a good balance between reactivity and performance

This is particularly useful for collections where you care about their
composition changing, but the items themselves might be complex objects that you
don't want to make deeply observable.

## Implementation Details

In the codebase:

1. For `observable({}, {}, { shallow: true })`:
   - Implementation uses `observableBox(value, equalityOptions)` for all values
   - Values are wrapped directly in an observable box without transformation

2. For `makeObservable()` with `"observable.shallow"`:
   - Collections are first converted to their observable variants with
     `{ shallow: true }`
   - Then these observable collections are wrapped in an observable box
   - This preserves collection-specific reactivity while keeping collection
     items non-observable

## When To Use Which

- Use `observable({}, {}, { shallow: true })` when:
  - Working with React props
  - Need to maintain reference equality for all properties
  - Don't want collection operations to trigger reactions

- Use `makeObservable({}, { prop: "observable.shallow" })` when:
  - You want collection operations (add/delete) to trigger reactions
  - But don't want the items in the collections to become observable
  - Working with class instances or objects with collections that need specific
    observable behavior
