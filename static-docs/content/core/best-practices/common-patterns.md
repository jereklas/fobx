---
title: Common Patterns
description: Frequently used patterns and recipes for FobX applications.
navTitle: Common Patterns
navSection: ["@fobx/core", "Best Practices"]
navOrder: 2
---

For the complementary guidance on what to avoid, see
[Patterns & Anti-Patterns](/core/best-practices/patterns-and-antipatterns/).

---

## Async data loading with `flow`

```ts
import { flow, makeObservable } from "@fobx/core"

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.data = yield res.json()
    } catch (e) {
      this.error = String(e)
    } finally {
      this.loading = false
    }
  }
}
```

## Form state management

```ts
import { computed, observable } from "@fobx/core"

const form = observable({
  email: "",
  password: "",
  submitted: false,

  get emailError() {
    if (!this.email) return "Required"
    if (!this.email.includes("@")) return "Invalid email"
    return null
  },

  get passwordError() {
    if (!this.password) return "Required"
    if (this.password.length < 8) return "Too short"
    return null
  },

  get isValid() {
    return !this.emailError && !this.passwordError
  },

  submit() {
    this.submitted = true
    if (!this.isValid) return
    // ... submit logic
  },
})
```

## Undo/redo with snapshots

```ts
import { observable, runInTransaction } from "@fobx/core"

function createUndoable<T extends object>(initial: T) {
  const state = observable(structuredClone(initial))
  const history: T[] = [structuredClone(initial)]
  let pointer = 0

  return {
    state,

    commit() {
      pointer++
      history.length = pointer
      history.push(structuredClone(state) as T)
    },

    undo() {
      if (pointer <= 0) return
      pointer--
      runInTransaction(() => Object.assign(state, history[pointer]))
    },

    redo() {
      if (pointer >= history.length - 1) return
      pointer++
      runInTransaction(() => Object.assign(state, history[pointer]))
    },

    get canUndo() {
      return pointer > 0
    },
    get canRedo() {
      return pointer < history.length - 1
    },
  }
}
```

If you want `canUndo` and `canRedo` to participate in reactivity, store the
history pointer in an observable (for example an `observableBox`) or wrap the
returned controller in `observable()`.

## Debounced reaction

```ts
import { reaction } from "@fobx/core"

function debouncedReaction<T>(
  expression: () => T,
  effect: (value: T) => void,
  delay: number,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return reaction(expression, (value) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => effect(value), delay)
  })
}

// Usage
const stop = debouncedReaction(
  () => searchStore.query,
  (query) => searchStore.search(query),
  300,
)
```

## Local observable state (vanilla JS)

For UI components without a framework binding, pair an observable with
`autorun`:

```ts
import { autorun, observable } from "@fobx/core"

function createCounter(element: HTMLElement) {
  const state = observable({ count: 0 })

  const stop = autorun(() => {
    element.textContent = `Count: ${state.count}`
  })

  element.addEventListener("click", () => state.count++)

  return { dispose: stop }
}
```

## Conditional tracking

Dependencies are only tracked for branches that execute:

```ts
import { computed, observableBox } from "@fobx/core"

const useMetric = observableBox(true)
const tempC = observableBox(20)
const tempF = observableBox(68)

const displayTemp = computed(() =>
  useMetric.get() ? `${tempC.get()}°C` : `${tempF.get()}°F`
)

// When useMetric=true, only tempC is tracked
// When useMetric=false, only tempF is tracked
```

## Differences from MobX

FobX is inspired by MobX but makes different design choices:

| Feature               | FobX                                         | MobX                          |
| --------------------- | -------------------------------------------- | ----------------------------- |
| Decorators            | Not supported                                | Supported                     |
| `observable()` target | Objects, class instances, arrays, maps, sets | Objects, arrays, maps, sets   |
| Proxy requirement     | Used for observable arrays                   | Optional (with fallback)      |
| Scheduler             | Synchronous, epoch-based                     | Synchronous, derivation-based |
| Bundle size           | ~5 KB gzipped                                | ~16 KB gzipped                |
| Computed caching      | Suspended when unobserved                    | Always cached once created    |
| Global state          | Shared via `Symbol.for`                      | Instance-based                |

FobX intentionally omits some MobX features to stay small and fast:

- No decorator support
- No `extendObservable`
- No `intercept` / `observe` listeners
- No `spy` / `trace` debugging tools
- No `toJS` (use `structuredClone` or manual serialization)
