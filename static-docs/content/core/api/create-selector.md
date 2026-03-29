---
title: createSelector
description: Efficient selection primitive for one-of-many patterns.
navTitle: createSelector
navSection: ["@fobx/core", "API"]
navOrder: 13
---

`createSelector` creates a reactive selector function optimized for the
"one-of-many" selection pattern common in lists. Instead of every row observing
the selection signal (O(n) reactions per change), only the previously-selected
and newly-selected items are notified. With the default equality comparer,
selection changes stay O(1).

## Signature

```ts
function createSelector<T>(
  source: () => T,
  equals?: (a: T, b: T) => boolean,
): Selector<T>

type Selector<T> = ((key: T) => boolean) & {
  dispose(): void
  getAdmin(key: T): ObservableAdmin<boolean>
}
```

## Parameters

| Parameter | Type                | Description                                                       |
| --------- | ------------------- | ----------------------------------------------------------------- |
| `source`  | `() => T`           | A reactive function returning the current selected key            |
| `equals`  | `(a, b) => boolean` | Optional custom equality (defaults to identity with NaN handling) |

**Returns** a `Selector<T>` function: call it with a key to get a reactive
boolean.

## The problem

With a naive approach, every row in a list observes the selection observable.
When the selection changes, **all** N rows re-evaluate:

```ts
// ❌ Naive approach — O(n) re-evaluations per selection change
const selectedId = observableBox("item-1")

function Row({ id }) {
  autorun(() => {
    const isActive = selectedId.get() === id // ALL rows track selectedId
    setStyle(isActive ? "active" : "inactive")
  })
}
```

## The solution

`createSelector` uses per-key tracking so only the old and new selection
re-evaluate when you use the default equality comparer:

```ts
// ✅ Efficient — O(1) re-evaluations per selection change with the default comparer
import { autorun, createSelector, observableBox } from "@fobx/core"

const selectedId = observableBox("item-1")
const isSelected = createSelector(() => selectedId.get())

function Row({ id }) {
  autorun(() => {
    const isActive = isSelected(id) // only THIS key is tracked
    setStyle(isActive ? "active" : "inactive")
  })
}

// When selectedId changes from "item-1" to "item-2":
// - Only the Row with id="item-1" re-runs (now false)
// - Only the Row with id="item-2" re-runs (now true)
// - All other rows: no work
```

## How it works

1. An internal `autorun` tracks the `source` function.
2. When the source value changes, the selector notifies only two per-key admins:
   the one for the **previous** value (now `false`) and the one for the **new**
   value (now `true`).
3. Each key's admin is lazily created on first access and cleaned up when it
   loses all observers.

## Outside tracked context

When called outside a reaction (no active tracking), `isSelected(key)` returns a
plain boolean without creating subscriptions:

```ts
console.log(isSelected("item-1")) // true (plain boolean, no tracking)
```

## Custom equality

```ts
const isSelected = createSelector(
  () => selectedCoords.get(),
  (a, b) => a.x === b.x && a.y === b.y,
)
```

When you supply a custom `equals` function, `createSelector` still keeps
re-renders targeted to the affected keys, but source changes scan subscribed
keys to find matches.

## Dispose

Call `dispose()` to tear down the internal autorun and all per-key admins:

```ts
isSelected.dispose()
```
