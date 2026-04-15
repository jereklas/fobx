---
title: Patterns and Anti-Patterns
description: Practical guidance on what to lean into and what to avoid when using @fobx/core.
navTitle: Patterns & Anti-Patterns
navSection: ["@fobx/core", "Best Practices"]
navOrder: 1
---

This page focuses on the habits that tend to make FobX code work well over time,
and the habits that usually create unnecessary work, subtle bugs, or reactivity
that is harder to reason about.

The short version is:

- use observables for source state
- use computeds for derived state
- use reactions for side effects
- use transactions for grouped writes
- keep the dependency graph simple and intentional

## 1. Prefer computeds over manually synchronized derived state

### Good

```ts
const cart = observable({
  items: [] as { price: number; qty: number }[],
  get total() {
    return this.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  },
})
```

### Avoid

```ts
const cart = observable({
  items: [] as { price: number; qty: number }[],
  total: 0,
})

autorun(() => {
  cart.total = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0)
})
```

Why:

- the computed version is lazy and cached while observed
- there is no extra synchronization path to maintain
- downstream reactions are only notified when the computed output changes

Manual syncing through `autorun()` usually means you are using a side-effect API
to maintain derived state that should just be expressed declaratively.

## 2. Use reactions for side effects, not state shaping

### Good

```ts
const stop = reaction(
  () => auth.userId,
  (userId) => {
    localStorage.setItem("last-user-id", String(userId))
  },
)
```

### Avoid

```ts
reaction(
  () => settings.theme,
  (theme) => {
    settings.themeLabel = theme.toUpperCase()
  },
)
```

If the target is more observable state, ask whether it should be a computed
instead.

Reactions are the right tool when you need to:

- talk to the network
- touch storage
- log
- bridge to timers or external libraries
- update a non-reactive host environment

They are usually the wrong tool for keeping your own state graph in sync.

## 3. Batch related writes inside transactions

### Good

```ts
runInTransaction(() => {
  profile.firstName = "Ada"
  profile.lastName = "Lovelace"
})
```

### Avoid

```ts
profile.firstName = "Ada"
profile.lastName = "Lovelace"
```

when those two writes are really one logical event.

Why:

- reactions see one consistent final snapshot
- you avoid extra reruns
- grouped writes are easier to reason about during debugging

If the work is reusable, prefer `transaction(fn)` over repeatedly wrapping the
same logic with `runInTransaction()`.

## 4. Keep source state minimal

### Good

```ts
const filters = observable({
  query: "",
  category: "all",
  get isFiltered() {
    return this.query !== "" || this.category !== "all"
  },
})
```

### Avoid

```ts
const filters = observable({
  query: "",
  category: "all",
  isFiltered: false,
})

reaction(
  () => [filters.query, filters.category],
  ([query, category]) => {
    filters.isFiltered = query !== "" || category !== "all"
  },
)
```

The more duplicated state you store, the more invariants you have to maintain.

## 5. Let conditional tracking do the work

FobX only tracks the reads that actually happen.

### Good

```ts
const activeTab = observableBox<"profile" | "billing">("profile")
const profileName = observableBox("Ada Lovelace")
const billingPlan = observableBox("Pro")

const heading = computed(() =>
  activeTab.get() === "profile"
    ? `Profile: ${profileName.get()}`
    : `Plan: ${billingPlan.get()}`
)
```

### Avoid

```ts
const heading = computed(() => {
  const name = profileName.get()
  const plan = billingPlan.get()
  return activeTab.get() === "profile" ? `Profile: ${name}` : `Plan: ${plan}`
})
```

The second version tracks both values even though only one branch matters for
each run.

## 6. Use `observable.ref` or shallow annotations intentionally

### Good

```ts
class ViewState {
  schema: FormSchema

  constructor(schema: FormSchema) {
    this.schema = schema
    makeObservable(this, {
      annotations: {
        schema: "observable.ref",
      },
    })
  }
}
```

### Avoid

Deep-observing large immutable objects, third-party instances, or external data
graphs that you only ever replace wholesale.

Why:

- deep observation is useful for mutable, domain-owned data
- reference observation is better when replacement matters more than internals
- shallow annotations are often a good fit for large collections of already
  well-structured values

## 7. Dispose long-lived reactions explicitly

### Good

```ts
const stop = autorun(() => {
  console.log(store.count)
})

// later
stop()
```

### Avoid

Creating reactions in long-lived services, DOM integrations, or tests without a
clear disposal path.

Reactions are lightweight, but they are still subscriptions. If the owner goes
away, the reaction should go away too.

## 8. Use `runWithoutTracking()` sparingly and intentionally

### Good

```ts
autorun(() => {
  const tracked = search.query
  const snapshot = runWithoutTracking(() => debugState.get())
  console.log(tracked, snapshot)
})
```

### Avoid

Wrapping large parts of your logic in `runWithoutTracking()` just to suppress
reruns you do not fully understand.

If tracking is causing surprising updates, the first question should usually be:

- am I reading too much inside this computation?
- should some of this logic be split into a computed?
- is a branch reading more observables than necessary?

`runWithoutTracking()` is a precision tool, not a general fix for noisy graphs.

## 9. Prefer framework-agnostic stores

### Good

```ts
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
    try {
      const res = yield fetch("/api/users")
      this.users = yield res.json()
    } finally {
      this.loading = false
    }
  }
}
```

### Avoid

Mixing framework components, DOM manipulation, or transport-specific details
directly into your store model unless the store is explicitly meant to be a
host-specific adapter.

This keeps your reactive graph reusable across React, DOM, tests, and services.

## 10. Make async state explicit

### Good

```ts
class DataStore {
  data: Item[] = []
  loading = false
  error: string | null = null

  constructor() {
    makeObservable(this, {
      annotations: {
        data: "observable",
        loading: "observable",
        error: "observable",
        fetchData: "flow",
      },
    })
  }

  *fetchData() {
    this.loading = true
    this.error = null
    try {
      const res = yield fetch("/api/items")
      this.data = yield res.json()
    } catch (error) {
      this.error = String(error)
    } finally {
      this.loading = false
    }
  }
}
```

### Avoid

Encoding async lifecycle indirectly through nullable data alone, such as “no
data means loading, unless it means idle, unless it means failure”.

Explicit loading and error state makes reactions and UI bindings much easier to
understand.

## 11. Prefer plain reads inside computeds and reactions

### Good

```ts
const visibleTodos = computed(() => {
  const filter = store.filter
  return filter === "all"
    ? store.todos
    : store.todos.filter((todo) => todo.done === (filter === "done"))
})
```

### Avoid

Doing unrelated work, creating timers, mutating state, or triggering network
effects inside a computed.

Computeds should stay pure and derivational. If it has side effects, it is
probably a reaction instead.

## Quick decision rules

When you are unsure which primitive to use:

- if it is source state: observable
- if it is derived from other state: computed
- if it changes the outside world: reaction
- if it groups writes: transaction
- if it spans async steps with batched sync segments: flow

Those five rules cover most design decisions in FobX.
