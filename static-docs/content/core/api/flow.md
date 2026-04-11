---
title: flow
description: Generator-based async actions with per-step transactions.
navTitle: flow
navSection: ["@fobx/core", "API", "Transactions"]
navOrder: 1
navSectionOrders: [1, 5, 3]
navSectionCollapsible: false
---

`flow` wraps a generator function so that each synchronous segment between
`yield` points runs inside a transaction. This gives you async/await-style code
with proper batching.

## Signature

```ts
function flow<R>(
  makeGenerator: (...args: any[]) => Generator<any, any, any>,
  options?: FlowOptions,
): (...args: any[]) => Promise<R>

interface FlowOptions {
  name?: string
  getThis?: (that: unknown) => unknown
}
```

## Parameters

| Parameter         | Type                | Description                                      |
| ----------------- | ------------------- | ------------------------------------------------ |
| `makeGenerator`   | Generator function  | The async logic using `yield` instead of `await` |
| `options.name`    | `string`            | Debug name (defaults to the function name)       |
| `options.getThis` | `(that) => unknown` | Override `this` context (used for bound flows)   |

**Returns** a function that returns `Promise<R>`.

## Basic usage

```ts
import { autorun, flow, observableBox } from "@fobx/core"

const loading = observableBox(false)
const data = observableBox<string | null>(null)
const error = observableBox<string | null>(null)

const fetchData = flow(function* () {
  loading.set(true) // transaction 1
  error.set(null)

  try {
    const response = yield fetch("/api/data") // suspend — reactions flush
    const json = yield response.json() // suspend — reactions flush

    data.set(json.result) // transaction 2
    loading.set(false)
  } catch (e) {
    error.set(String(e)) // transaction 3
    loading.set(false)
  }
})

// In a reaction:
autorun(() => {
  if (loading.get()) console.log("Loading...")
  else if (error.get()) console.log("Error:", error.get())
  else console.log("Data:", data.get())
})

fetchData()
```

## How it works

1. The generator body runs synchronously until the first `yield`.
2. Each synchronous segment is wrapped in `runInTransaction()`.
3. When a `yield` expression produces a thenable (promise), the flow awaits it.
4. After the promise resolves, the next segment runs in a new transaction.
5. If a `yield`ed promise rejects, the error is thrown into the generator via
   `generator.throw()`, also within a transaction.

## With parameters

```ts
const fetchUser = flow(function* (id: string) {
  const response = yield fetch(`/api/users/${encodeURIComponent(id)}`)
  const user = yield response.json()
  return user
})

const user = await fetchUser("user-123")
```

## Error handling

Errors thrown inside the generator or from rejected promises propagate normally:

```ts
const riskyFlow = flow(function* () {
  const res = yield fetch("/api/data")
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return yield res.json()
})

try {
  await riskyFlow()
} catch (e) {
  console.error("Flow failed:", e)
}
```

## As a class annotation

Use `"flow"` or `"flow.bound"` annotations in `makeObservable()` or
`observable()`:

```ts
import { makeObservable, observableBox } from "@fobx/core"

class UserStore {
  loading = false
  user: User | null = null

  *fetchUser(id: string) {
    this.loading = true
    try {
      const res = yield fetch(`/api/users/${encodeURIComponent(id)}`)
      this.user = yield res.json()
    } finally {
      this.loading = false
    }
  }

  constructor() {
    makeObservable(this, {
      annotations: {
        loading: "observable",
        user: "observable",
        fetchUser: "flow",
        // or "flow.bound" to bind `this`
      },
    })
  }
}
```

With `observable()`, generator functions are auto-inferred as `"flow"`:

```ts
const store = observable({
  loading: false,
  *fetchData() {
    this.loading = true
    // ... yield fetch calls ...
    this.loading = false
  },
})
// store.fetchData is automatically wrapped as a flow
```

## Related API

Use [`isFlow()`](/core/api/is-flow/) to check whether a function was wrapped by
`flow()`.
