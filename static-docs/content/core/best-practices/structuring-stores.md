---
title: Structuring Stores
description: Patterns for organizing reactive state in FobX applications.
navTitle: Structuring Stores
navSection: ["@fobx/core", "Best Practices"]
navOrder: 0
navSectionOrder: 6
---

## Prefer computed values over manual sync

The most important pattern in FobX: put derived state in computeds, not in
effects. Computeds are automatically cached, lazy, and act as firewalls:

```ts
// ❌ Don't compute derived state in a reaction
const store = observable({
  items: [] as Item[],
  totalPrice: 0,
  updateTotal() {
    this.totalPrice = this.items.reduce((sum, i) => sum + i.price, 0)
  },
})
autorun(() => store.updateTotal()) // wasteful manual sync

// ✅ Use computed — automatically cached and lazy
const store = observable({
  items: [] as Item[],
  get totalPrice() {
    return this.items.reduce((sum, i) => sum + i.price, 0)
  },
})
```

---

## Single store vs multiple stores

FobX does not prescribe a single store architecture. Choose based on your app's
complexity:

### Single root store

Good for small-to-medium apps where all state is related:

```ts
import { observable } from "@fobx/core"

const store = observable({
  user: null as User | null,
  todos: [] as Todo[],
  filter: "all" as "all" | "active" | "done",

  get visibleTodos() {
    if (this.filter === "all") return this.todos
    const done = this.filter === "done"
    return this.todos.filter((t) => t.done === done)
  },

  addTodo(text: string) {
    this.todos.push({ text, done: false })
  },
})
```

### Multiple domain stores

Better for larger apps with distinct domains:

```ts
class AuthStore {
  user: User | null = null
  token: string | null = null

  constructor() {
    makeObservable(this, {
      annotations: {
        user: "observable",
        token: "observable",
        login: "flow",
      },
    })
  }

  *login(credentials: Credentials) {
    const res = yield fetch("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    })
    const data = yield res.json()
    this.user = data.user
    this.token = data.token
  }
}

class TodoStore {
  todos: Todo[] = []
  constructor(private auth: AuthStore) {
    makeObservable(this, {
      annotations: {
        todos: "observable",
        fetchTodos: "flow",
      },
    })
  }

  *fetchTodos() {
    const res = yield fetch("/api/todos", {
      headers: { Authorization: `Bearer ${this.auth.token}` },
    })
    this.todos = yield res.json()
  }
}

// Wire stores together
const auth = new AuthStore()
const todos = new TodoStore(auth)
```

## Plain objects vs classes

### Plain objects with `observable()`

Best for simple, self-contained stores without lifecycle:

```ts
const counterStore = observable({
  count: 0,
  increment() {
    this.count++
  },
  decrement() {
    this.count--
  },
  reset() {
    this.count = 0
  },
})
```

### Classes with `makeObservable()`

Best when you need:

- Prototype methods shared across instances
- Inheritance
- Constructor injection (dependency injection)
- TypeScript access modifiers (`private`, `protected`)

```ts
class TimerStore {
  elapsed = 0
  private intervalId: number | null = null

  constructor() {
    makeObservable(this, {
      annotations: {
        elapsed: "observable",
        start: "transaction",
        stop: "transaction",
        tick: "transaction",
      },
    })
  }

  private tick() {
    this.elapsed++
  }

  start() {
    if (this.intervalId) return
    this.intervalId = setInterval(() => this.tick(), 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}
```

## Keeping stores framework-agnostic

A well-structured store has no framework imports. All React/DOM-specific code
lives in the component layer:

```ts
// ✅ store.ts — pure FobX, no React
import { flow, makeObservable } from "@fobx/core"

class UserStore {
  users: User[] = []
  loading = false

  constructor() {
    makeObservable(this, {
      annotations: {
        users: "observable",
        loading: "observable",
        fetchUsers: "flow",
      },
    })
  }

  *fetchUsers() {
    this.loading = true
    const res = yield fetch("/api/users")
    this.users = yield res.json()
    this.loading = false
  }
}
```

```tsx
// ✅ UserList.tsx — React component consumes the store
import { observer } from "@fobx/react"

const UserList = observer(({ store }: { store: UserStore }) => (
  <div>
    {store.loading
      ? <p>Loading...</p>
      : store.users.map((u) => <p key={u.id}>{u.name}</p>)}
  </div>
))
```
