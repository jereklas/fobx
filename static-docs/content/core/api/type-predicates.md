---
title: Type Predicates
description: Runtime type checks for FobX observables and utilities.
navTitle: Type Predicates
navSection: ["@fobx/core", "API"]
navOrder: 15
---

FobX exports a set of runtime type predicates for checking reactive values,
collections, and observable objects.

## Reference

### `isObservable(value, prop?)`

Returns `true` if the value is a boxed, computed, or collection observable. When
you pass `prop`, it checks whether that property on an observable object is
reactive.

```ts
import { computed, isObservable, observable, observableBox } from "@fobx/core"

isObservable(observableBox(1)) // true
isObservable(computed(() => 1)) // true
isObservable(observable({ count: 0 })) // false
isObservable(observable({ count: 0 }), "count") // true
isObservable({ plain: true }) // false
```

### `isObservableBox(value)`

Returns `true` if the value is an `observableBox`.

```ts
import { computed, isObservableBox, observableBox } from "@fobx/core"

isObservableBox(observableBox(1)) // true
isObservableBox(computed(() => 1)) // false
```

### `isComputed(value, prop?)`

Returns `true` if the value is a `computed`. When you pass `prop`, it checks
whether that property on an observable object is a computed getter.

```ts
import { computed, isComputed, observable } from "@fobx/core"

isComputed(computed(() => 42)) // true

const store = observable({
  count: 0,
  get doubled() {
    return this.count * 2
  },
})

isComputed(store, "doubled") // true
```

### `isObservableArray(value)`

Returns `true` if the value is an `observableArray`.

```ts
import { isObservableArray, observableArray } from "@fobx/core"

isObservableArray(observableArray([1, 2])) // true
isObservableArray([1, 2]) // false
```

### `isObservableMap(value)`

Returns `true` if the value is an `observableMap`.

```ts
import { isObservableMap, observableMap } from "@fobx/core"

isObservableMap(observableMap()) // true
isObservableMap(new Map()) // false
```

### `isObservableSet(value)`

Returns `true` if the value is an `observableSet`.

```ts
import { isObservableSet, observableSet } from "@fobx/core"

isObservableSet(observableSet()) // true
isObservableSet(new Set()) // false
```

### `isObservableObject(value)`

Returns `true` if the value was created by `observable()` or passed through
`makeObservable()`.

```ts
import { isObservableObject, observable } from "@fobx/core"

const store = observable({ count: 0 })
isObservableObject(store) // true
isObservableObject({}) // false
```

### `isObservableCollection(value)`

Returns `true` if the value is an observable array, map, or set.

```ts
import {
  isObservableCollection,
  observableArray,
  observableMap,
  observableSet,
} from "@fobx/core"

isObservableCollection(observableArray()) // true
isObservableCollection(observableMap()) // true
isObservableCollection(observableSet()) // true
isObservableCollection([]) // false
```

### `isTransaction(fn)`

Returns `true` if the function is a transaction-wrapped action.

```ts
import { isTransaction, transaction } from "@fobx/core"

const action = transaction(() => {})
isTransaction(action) // true
```

### `isFlow(value)`

Returns `true` if the function was wrapped by `flow()`.

```ts
import { flow, isFlow } from "@fobx/core"

const fn = flow(function* () {})
isFlow(fn) // true
```

### `isPlainObject(value)`

Returns `true` if the value is a plain object
(`Object.getPrototypeOf(value) === Object.prototype` or `null`).

```ts
import { isPlainObject } from "@fobx/core"

isPlainObject({}) // true
isPlainObject({ a: 1 }) // true
isPlainObject(new Map()) // false
isPlainObject(null) // false
```
