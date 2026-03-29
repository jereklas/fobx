---
title: Performance Tips
description: Guidelines for getting the best performance from FobX.
navTitle: Performance
navSection: ["@fobx/core", "Best Practices"]
navOrder: 1
---

FobX is designed to be fast by default. These tips help you avoid common
performance pitfalls.

## Use computed values as firewalls

Computeds only propagate when their output changes according to their comparer.
Scalar results act as firewalls by default. If you return a fresh array or
object, use a structural comparer when you need the computed itself to absorb
unchanged results.

```ts
// ❌ Every change to any todo re-runs the autorun
autorun(() => {
  const active = store.todos.filter((t) => !t.done)
  renderList(active)
})

// ✅ Computed centralizes the filter work.
// Add a structural comparer if you want the array itself to be a firewall.
const activeTodos = computed(() => store.todos.filter((t) => !t.done))
autorun(() => renderList(activeTodos.get()))
```

## Batch mutations

Always wrap multiple mutations in a transaction to avoid intermediate reaction
runs:

```ts
// ❌ Two separate reaction runs
store.firstName = "Bob"
store.lastName = "Smith"

// ✅ Single reaction run
runInTransaction(() => {
  store.firstName = "Bob"
  store.lastName = "Smith"
})
```

Methods annotated as `"transaction"` already batch automatically.

## Use `observable.ref` for non-reactive data

If a property holds data that doesn't need deep reactivity (e.g., a DOM element
reference, a large immutable dataset), use `"observable.ref"`:

```ts
class Store {
  canvasElement: HTMLCanvasElement | null = null
  largeDataset: readonly DataPoint[] = []

  constructor() {
    makeObservable(this, {
      annotations: {
        canvasElement: "observable.ref",
        largeDataset: "observable.ref",
      },
    })
  }
}
```

This avoids the overhead of converting the value to a deep observable.

## Use `observable.shallow` for collections of non-observable items

When you have a collection of external objects (e.g., API responses) that don't
need per-property tracking:

```ts
class Store {
  apiResults: ApiResult[] = []

  constructor() {
    makeObservable(this, {
      annotations: {
        apiResults: "observable.shallow",
      },
    })
  }
}
```

The array itself is reactive (push/splice trigger reactions), but objects inside
are not wrapped.

## Use `createSelector` for selection patterns

For list selection, use `createSelector` instead of having every item observe
the selection state:

```ts
// ❌ O(n) — every row reads selectedId
autorun(() => {
  const isActive = selectedId.get() === row.id
})

// ✅ O(1) — only old and new selection re-evaluate
const isSelected = createSelector(() => selectedId.get())
autorun(() => {
  const isActive = isSelected(row.id)
})
```

## Use structural comparers for derived objects

If a computed returns a new object reference each time but the content rarely
changes, add a structural comparer. This requires a one-time `configure()` call
at app startup:

```ts
import { configure } from "@fobx/core"
configure({ comparer: { structural: myDeepEqual } })
```

```ts
const bounds = computed(
  () => ({
    width: container.get().offsetWidth,
    height: container.get().offsetHeight,
  }),
  { comparer: "structural" },
)
```

## Avoid tracking unnecessary dependencies

Use `runWithoutTracking` to read observables without subscribing:

```ts
autorun(() => {
  const value = important.get() // tracked
  // Read config without subscribing to it
  const cfg = runWithoutTracking(() => config.get())
  process(value, cfg)
})
```

## Keep reactions small and focused

Prefer many small reactions over one large reaction. A focused reaction re-runs
less often because it has fewer dependencies:

```ts
// ❌ One large reaction with many dependencies
autorun(() => {
  renderHeader(store.title)
  renderList(store.items)
  renderFooter(store.count)
})

// ✅ Three focused reactions — each re-runs independently
autorun(() => renderHeader(store.title))
autorun(() => renderList(store.items))
autorun(() => renderFooter(store.count))
```

In React, this happens naturally when you use `observer` on small components.
