# @fobx/jsx

A JSX rendering solution that works natively with `@fobx/v2` — powered by
`@fobx/dom`.

**No virtual DOM. No reconciler. Real DOM nodes with fine-grained reactive
updates.**

JSX expressions compile to direct DOM node creation. Reactive expressions
(functions) in props or children are automatically wrapped in autoruns, so only
the specific text node or attribute that depends on an observable gets updated —
not the entire component tree.

## Setup

### Modern JSX Transform (recommended)

```jsonc
// deno.jsonc or tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@fobx/jsx"
  }
}
```

### Classic JSX Transform

```tsx
/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h } from "@fobx/jsx"
```

## Quick Start

```tsx
import { box } from "@fobx/v2"
import { render } from "@fobx/jsx"

const count = box(0)

const App = () => (
  <div class="counter">
    <span>Count: {() => count.get()}</span>
    <button onClick={() => count.set(count.get() + 1)}>+</button>
    <button onClick={() => count.set(count.get() - 1)}>-</button>
  </div>
)

render(<App />, document.getElementById("root")!)
```

## Functional Components

Components are plain functions that receive props and return DOM nodes:

```tsx
interface GreetingProps {
  name: string
}

const Greeting = (props: GreetingProps) => (
  <h1>Hello, {props.name}!</h1>
)

// Usage:
<Greeting name="World" />
```

### Children

Children are passed via `props.children`:

```tsx
const Card = (props: { title: string; children?: any }) => (
  <div class="card">
    <h2>{props.title}</h2>
    <div class="body">{props.children}</div>
  </div>
)

<Card title="Hello">
  <p>Card content here</p>
</Card>
```

## Reactive Props

Pass a function to make any prop reactive:

```tsx
const isActive = box(false)

<div class={() => isActive.get() ? "active" : ""}>
  Content
</div>
```

## Reactive Children

Wrap expressions in arrow functions to make them reactive:

```tsx
const name = box("World")

<div>Hello, {() => name.get()}!</div>
```

Conditional rendering:

```tsx
const loggedIn = box(false)

<div>
  {() => loggedIn.get()
    ? <span>Welcome back!</span>
    : <span>Please log in</span>
  }
</div>
```

## Collections

For reactive lists, use `mapArray` / `mountList` from `@fobx/dom` (re-exported
from `@fobx/jsx`):

```tsx
import { array } from "@fobx/v2"
import { mountList } from "@fobx/jsx"

const todos = array(["Buy milk", "Write code"])

const TodoList = () => {
  const list = <ul />
  mountList(list, () => todos, (todo) => <li>{todo}</li>)
  return list
}
```

Or use a reactive function child (simpler but less efficient for large lists):

```tsx
<ul>
  {() => todos.map((todo) => <li>{todo}</li>)}
</ul>
```

## Class Components

For components that need lifecycle hooks or imperative updates:

```tsx
import { Component } from "@fobx/jsx"
import { box } from "@fobx/v2"

class Timer extends Component<{ initial: number }> {
  count = box(this.props.initial)
  interval?: number

  didMount() {
    this.interval = setInterval(() => {
      this.count.set(this.count.get() + 1)
    }, 1000)
  }

  didUnmount() {
    clearInterval(this.interval)
  }

  render() {
    return <div>Elapsed: {() => this.count.get()}s</div>
  }
}
```

### Lifecycle Methods

| Method         | When                             |
| -------------- | -------------------------------- |
| `didMount()`   | After first render, DOM inserted |
| `willUpdate()` | Before `update()` re-renders     |
| `didUpdate()`  | After `update()` re-renders      |
| `didUnmount()` | When removed from DOM            |

## Fragment

Use `<>...</>` to group elements without a wrapper:

```tsx
const Header = () => (
  <>
    <h1>Title</h1>
    <p>Subtitle</p>
  </>
)
```

## render / unmount

```tsx
import { render, unmount } from "@fobx/jsx"

// Mount
render(<App />, document.getElementById("root")!)

// Teardown (disposes all reactive bindings)
unmount(document.getElementById("root")!)
```

## Cleanup

`dispose(node)` tears down reactive bindings on a node and its descendants. It's
called automatically by `unmount` and `render` (when clearing).

```tsx
import { dispose } from "@fobx/jsx"

const node = <div>{() => observable.get()}</div>
dispose(node) // Stops all reactive updates
```

## How It Works

1. **JSX compiles to `h()` calls** — each call creates a real DOM element (via
   `@fobx/dom`)
2. **Function props** → wrapped in `autorun`, update the specific attribute on
   change
3. **Function children** → wrapped in `autorun` with comment markers, surgically
   replace the affected DOM region
4. **No diffing** — changes are tracked at the observable level, not the
   component tree level
5. **Batching** — use `runInTransaction` to batch multiple observable mutations
   into a single DOM update pass
