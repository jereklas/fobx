---
title: "@fobx/react"
description: React bindings for FobX — make components automatically re-render when observable state changes.
navTitle: Introduction
navSection: ["@fobx/react"]
navOrder: 0
navSectionOrder: 7
navSectionExpanded: true
---

`@fobx/react` connects FobX's reactive system to React. It provides tools to
make components automatically re-render when the observable state they read
changes — nothing more, nothing less.

## What's included

| Export                                       | Description                                                         |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [`observer`](/react/api/observer/)           | HOC that wraps a component with `useObserver` + `React.memo`        |
| [`useObserver`](/react/api/use-observer/)    | Hook that makes a render function reactive                          |
| [`useViewModel`](/react/api/use-view-model/) | Hook for managing a reactive ViewModel instance across renders      |
| [`ViewModel`](/react/api/use-view-model/)    | Base class for ViewModels with observable props and lifecycle hooks |

## Quick example

```tsx
import { observable } from "@fobx/core"
import { observer } from "@fobx/react"

const store = observable({
  count: 0,
  increment() {
    this.count++
  },
})

const Counter = observer(() => (
  <button onClick={() => store.increment()}>
    Count: {store.count}
  </button>
))
```

When `store.count` changes, only `Counter` re-renders — no context providers, no
selectors, no `useReducer` boilerplate.

## How it works

1. `observer` wraps your component with `useObserver`, which uses React's
   `useSyncExternalStore` internally.
2. During render, a lightweight **tracker** records every observable that is
   read.
3. When any tracked observable changes, the tracker bumps a version counter and
   tells `useSyncExternalStore` to schedule a re-render.
4. `React.memo` prevents re-renders from parent prop changes when nothing
   observable changed. You get both observable-driven and prop-driven
   granularity.

## Requirements

- React 18+ (requires `useSyncExternalStore`)
- `@fobx/core` as a peer dependency
