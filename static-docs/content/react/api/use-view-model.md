---
title: useViewModel / ViewModel
description: Manage a reactive ViewModel instance across React renders with lifecycle hooks.
navTitle: useViewModel / ViewModel
navSection: ["@fobx/react", "API"]
navOrder: 3
---

`useViewModel` creates and manages a reactive ViewModel instance across React
renders. The ViewModel survives re-renders, receives prop updates, and has
mount/unmount lifecycle hooks.

---

## `useViewModel` hook

### Signature

```tsx
function useViewModel<T extends new (...args: any[]) => any>(
  ctor: T,
  ...args: ConstructorParameters<T>
): InstanceType<T>
```

### Parameters

| Parameter | Type             | Description                                                   |
| --------- | ---------------- | ------------------------------------------------------------- |
| `ctor`    | Class            | The ViewModel class to instantiate                            |
| `...args` | Constructor args | Passed to `new ctor()` on first render, then to `vm.update()` |

### Lifecycle

1. **First render**: `new ctor(...args)` — creates the instance.
2. **Subsequent renders**: `vm.update(...args)` — syncs new values (batched).
3. **Mount**: `vm.onConnect()` — called inside `useEffect`.
4. **Unmount**: `vm.onDisconnect()` — called as `useEffect` cleanup.

In React 18 StrictMode development, initial mount work is intentionally
replayed. Keep constructors, custom `update()` implementations, `onConnect()`,
and `onDisconnect()` idempotent.

`update()` intentionally stays a plain method on `ViewModel` subclasses. That
means reads inside a custom `update()` remain trackable by the surrounding
component render instead of being hidden behind an action wrapper.

### Basic usage

```tsx
import { observer, useViewModel } from "@fobx/react"
import { observable } from "@fobx/core"

class CounterVM {
  count = 0

  constructor() {
    observable(this)
  }

  increment() {
    this.count++
  }
  decrement() {
    this.count--
  }
}

const Counter = observer(() => {
  const vm = useViewModel(CounterVM)

  return (
    <div>
      <p>{vm.count}</p>
      <button onClick={() => vm.increment()}>+</button>
      <button onClick={() => vm.decrement()}>-</button>
    </div>
  )
})
```

---

## `ViewModel` base class

A convenience base class that provides observable props, a ref callback, and
lifecycle stubs.

### Signature

```ts
class ViewModel<T extends object = object, E extends Element = HTMLElement>
  implements ViewModelLike {
  constructor(props?: T)

  /** Observable props — reads are tracked. */
  props: T

  /** Root DOM element ref. */
  ref: E | null

  /** Callback ref — pass as ref={vm.setRef}. */
  setRef: (el: E | null) => void

  /** Syncs new props into observable props. */
  update(props: Partial<T>): void

  /** Called on mount. Override in subclass. */
  onConnect(): void

  /** Called on unmount. Override in subclass. */
  onDisconnect(): void
}
```

### With props

```tsx
interface FilterProps {
  items: Item[]
  onSelect: (item: Item) => void
}

class FilterVM extends ViewModel<FilterProps> {
  query = ""

  constructor(props: FilterProps) {
    super(props)
    observable(this)
  }

  get filtered() {
    const q = this.query.toLowerCase()
    return this.props.items.filter((i) => i.name.toLowerCase().includes(q))
  }

  select(item: Item) {
    this.props.onSelect(item)
  }
}

const FilterList = observer((props: FilterProps) => {
  const vm = useViewModel(FilterVM, props)

  return (
    <div>
      <input
        value={vm.query}
        onChange={(e) => (vm.query = e.target.value)}
      />
      <ul>
        {vm.filtered.map((item) => (
          <li
            key={item.id}
            onClick={() => vm.select(item)}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  )
})
```

### How props syncing works

1. You pass React props to `useViewModel(FilterVM, props)`.
2. On first render, `new FilterVM(props)` creates observable props via
   `super(props)`.
3. On re-renders, `vm.update(props)` uses `Object.assign` to copy new values
   into the existing observable props — this fires reactions tracking those
   props.
4. The update is wrapped in a batch, so all prop changes are atomic while
  render-time reads inside `update()` stay tracked by the surrounding render.

### Inherited annotations on `ViewModel`

The base `ViewModel` constructor locks in the semantics of its inherited hooks
before your subclass runs `observable(this)`:

- `_props` and `ref` use `observable.ref`
- `props` stays `computed`
- `update()`, `onConnect()`, and `onDisconnect()` stay `none`

So calling `observable(this)` in a subclass is safe: it auto-infers your own
fields, getters, and methods, but it does not re-wrap the inherited `ViewModel`
API.

### Props are `observable.ref`

The `ViewModel` base class stores each prop as `observable.ref` (reference
equality). This means:

- Primitive props (strings, numbers, booleans) trigger reactions when they
  change.
- Object/array props trigger reactions when a new reference is passed.
- Mutations to the same object reference do **not** trigger prop reactions (the
  reference hasn't changed).

### Lifecycle hooks

```ts
class ChartVM extends ViewModel<{ data: number[] }> {
  private resizeObserver: ResizeObserver | null = null

  constructor(props: { data: number[] }) {
    super(props)
    observable(this)
  }

  onConnect() {
    // Component mounted — set up side effects
    this.resizeObserver = new ResizeObserver(() => this.redraw())
    if (this.ref) this.resizeObserver.observe(this.ref)
  }

  onDisconnect() {
    // Component unmounting — clean up
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
  }

  redraw() {/* ... */}
}

const Chart = observer((props: { data: number[] }) => {
  const vm = useViewModel(ChartVM, props)
  return <canvas ref={vm.setRef} />
})
```

Like any `useEffect`-driven lifecycle, these hooks should be written so they
remain safe under React 18 StrictMode development replay.

---

## `ViewModelLike` interface

Any class can be used with `useViewModel` as long as it optionally implements:

```ts
interface ViewModelLike {
  update?(...args: unknown[]): void
  onConnect?(): void
  onDisconnect?(): void
}
```

You don't need to extend `ViewModel` — it's just a convenience.

---

## Aliases

| Export         | Alias           |
| -------------- | --------------- |
| `useViewModel` | `useController` |
| `ViewModel`    | `Controller`    |
