---
title: observer
description: Higher-order component that makes a React function component reactive.
navTitle: observer
navSection: ["@fobx/react", "API"]
navOrder: 1
navSectionOrder: 3
---

`observer` is a higher-order component (HOC) that wraps a React function
component to make it reactive. When any observable read during render changes,
the component re-renders.

## Signature

```tsx
function observer<P>(
  component: React.FunctionComponent<P>,
): React.FunctionComponent<P>

function observer<P, TRef>(
  component: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >,
): React.MemoExoticComponent<...>
```

## Basic usage

```tsx
import { observable } from "@fobx/core"
import { observer } from "@fobx/react"

const store = observable({ count: 0 })

const Counter = observer(() => <p>Count: {store.count}</p>)
```

When `store.count` changes, `Counter` re-renders. Other components are
unaffected.

## What `observer` does

1. Wraps the component body in `useObserver`, which sets up a reactive tracker.
2. Applies `React.memo` so the component also skips re-renders when parent props
   haven't changed.
3. Preserves `displayName` and hoists enumerable own static properties such as
   `propTypes` and `defaultProps`.

## With `forwardRef`

```tsx
const Input = observer(
  React.forwardRef<HTMLInputElement, { label: string }>((props, ref) => (
    <label>
      {props.label}
      <input ref={ref} value={store.value} />
    </label>
  )),
)
```

## Important rules

### Reads must happen inside render

The tracking context only captures observables read during the synchronous
execution of the render function. Reads outside render are not tracked:

```tsx
// ❌ count is read outside the render body — not tracked
const count = store.count
const BadCounter = observer(() => <p>{count}</p>)

// ✅ count is read inside the render body — tracked
const GoodCounter = observer(() => <p>{store.count}</p>)
```

### Don't capture observable values early

```tsx
// ❌ Observable values captured before the tracked render starts
const a = store.a
const b = store.b
const BadComponent = observer(() => <p>{a} {b}</p>)

// ✅ Destructuring inside tracked render is fine
const GoodComponent = observer(({ store: { a, b } }) => <p>{a} {b}</p>)
```

### Every component that reads observables needs `observer`

If a child component reads an observable but is not wrapped in `observer`, it
won't re-render when that observable changes:

```tsx
// ✅ Both parent and child are observer
const Parent = observer(() => <Child />)
const Child = observer(() => <p>{store.value}</p>)
```

## `observer` vs `React.memo`

`observer` already applies `React.memo`. You do _not_ need to wrap an observer
component in `React.memo` again, and passing a memoized component to
`observer()` throws.

| Wrapper         | Re-renders on prop change | Re-renders on observable change     |
| --------------- | ------------------------- | ----------------------------------- |
| Plain component | Yes                       | No                                  |
| `React.memo`    | Only if props changed     | No                                  |
| `observer`      | Only if props changed     | Yes, if tracked observables changed |
