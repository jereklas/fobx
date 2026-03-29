---
title: useObserver
description: Hook that makes a render function reactive at the call-site level.
navTitle: useObserver
navSection: ["@fobx/react", "API"]
navOrder: 2
---

`useObserver` is the low-level hook that powers `observer`. It tracks observable
reads inside a render callback and schedules re-renders when tracked observables
change. Most users should use `observer` instead.

## Signature

```tsx
function useObserver<T>(
  render: () => T,
  baseComponentName?: string,
): T
```

## Parameters

| Parameter           | Type      | Description                                                                     |
| ------------------- | --------- | ------------------------------------------------------------------------------- |
| `render`            | `() => T` | A function that reads observables and returns JSX (or any value)                |
| `baseComponentName` | `string`  | Optional label reserved for debugging metadata; currently unused by the runtime |

## Basic usage

```tsx
import { useObserver } from "@fobx/react"
import { store } from "./store"

function Counter() {
  return useObserver(() => <p>Count: {store.count}</p>)
}
```

## When to use `useObserver` over `observer`

`useObserver` is useful when you want to keep observable reads localized to one
callback, or when you can't use `observer` (e.g., in a render-prop pattern):

```tsx
function Dashboard() {
  // Non-reactive setup
  const theme = useContext(ThemeContext)

  // Only this callback reads observables
  return useObserver(() => (
    <div style={{ background: theme.bg }}>
      <p>{store.status}</p>
    </div>
  ))
}
```

Tracked changes still re-render the whole host component. `useObserver` scopes
dependency tracking to the callback; it does not create a partial-component
render boundary.

## Differences from `observer`

| Feature                     | `observer`        | `useObserver`                       |
| --------------------------- | ----------------- | ----------------------------------- |
| Applies `React.memo`        | Yes               | No                                  |
| Preserves static properties | Yes               | N/A                                 |
| Supports `forwardRef`       | Yes               | N/A                                 |
| Granularity                 | Wrapped component | Callback-scoped dependency tracking |

## Internals

`useObserver` uses:

- A `Tracker` from `@fobx/core/internals` to record dependency reads
- React's `useSyncExternalStore` to schedule re-renders when dependencies change
- `FinalizationRegistry` when available, with a timer-based fallback, for
  automatic cleanup if the component is garbage collected before unmount (guards
  against memory leaks in edge cases)
