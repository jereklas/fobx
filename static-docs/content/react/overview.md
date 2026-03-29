---
title: Quick Start
description: Get up and running with FobX and React in minutes.
navTitle: Overview
navSection: ["@fobx/react"]
navOrder: 2
---

This guide shows the essential patterns for using FobX with React.

## 1. Create a store

```ts
// stores/counter.ts
import { observable } from "@fobx/core"

export const counterStore = observable({
  count: 0,
  get doubled() {
    return this.count * 2
  },
  increment() {
    this.count++
  },
  decrement() {
    this.count--
  },
})
```

## 2. Wrap components with `observer`

```tsx
// components/Counter.tsx
import { observer } from "@fobx/react"
import { counterStore } from "../stores/counter"

export const Counter = observer(() => (
  <div>
    <p>Count: {counterStore.count}</p>
    <p>Doubled: {counterStore.doubled}</p>
    <button onClick={() => counterStore.increment()}>+</button>
    <button onClick={() => counterStore.decrement()}>-</button>
  </div>
))
```

The component re-renders only when the specific observables it reads change.

## 3. Pass stores via props (optional)

For better testability, pass stores as props:

```tsx
const TodoList = observer(({ store }: { store: TodoStore }) => (
  <ul>
    {store.visibleTodos.map((todo) => <li key={todo.id}>{todo.text}</li>)}
  </ul>
))
```

## 4. Async data loading

Use generator methods for async operations — `observable()` automatically wraps
them as flows:

```ts
import { observable } from "@fobx/core"

class UserStore {
  users: User[] = []
  loading = false

  constructor() {
    observable(this)
  }

  *fetchUsers() {
    this.loading = true
    const res = yield fetch("/api/users")
    this.users = yield res.json()
    this.loading = false
  }
}

export const userStore = new UserStore()
```

```tsx
const UserList = observer(() => {
  useEffect(() => {
    userStore.fetchUsers()
  }, [])

  if (userStore.loading) return <p>Loading...</p>

  return (
    <ul>
      {userStore.users.map((u) => <li key={u.id}>{u.name}</li>)}
    </ul>
  )
})
```

## 5. Local component state with `useViewModel`

For component-scoped reactive state:

```tsx
import { observer, useViewModel, ViewModel } from "@fobx/react"
import { observable } from "@fobx/core"

class FormVM extends ViewModel<{ onSubmit: (value: string) => void }> {
  text = ""

  constructor(props: { onSubmit: (value: string) => void }) {
    super(props)
    observable(this)
  }

  get isValid() {
    return this.text.length > 0
  }

  submit() {
    if (this.isValid) this.props.onSubmit(this.text)
  }
}

const Form = observer((props: { onSubmit: (value: string) => void }) => {
  const vm = useViewModel(FormVM, props)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        vm.submit()
      }}
    >
      <input value={vm.text} onChange={(e) => vm.text = e.target.value} />
      <button disabled={!vm.isValid}>Submit</button>
    </form>
  )
})
```

## Key rules

1. **Wrap with `observer`** — any component that reads observables must be
   wrapped, or it won't re-render.
2. **Don't read early** observable values before entering an `observer` or
   `useObserver` tracked render. Destructuring inside the tracked render is
   fine; capturing values outside it is not.
3. **Keep components small** — smaller observer components track fewer
   dependencies and re-render less.
