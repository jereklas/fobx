---
title: FobX
description: Transparent reactive state management — observables, computeds, and reactions.
navOrder: 0
---

FobX is a lightweight, transparent reactive state management library. You model
application state as **observable** values, derive facts with **computeds**, and
drive side effects through **reactions**. FobX handles all dependency tracking
automatically — no subscriptions, no string event names, no diffing.

```
State (observables) → Derived values (computeds) → Side effects (reactions)
                  ↑__________________________|_____________________________|
                              automatic dependency tracking
```

---

## Packages

| Package       | Description                                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `@fobx/core`  | Framework-agnostic reactive primitives: observables, computeds, reactions, transactions |
| `@fobx/react` | React bindings — `observer` HOC, `useObserver`, `useViewModel`                          |

---

## A quick taste

```ts
import * as fobx from "@fobx/core"

const store = fobx.observable({
  count: 0,
  get doubled() {
    return this.count * 2
  },
  increment() {
    this.count++
  },
})

const stop = fobx.autorun(() => {
  console.log(`count=${store.count}, doubled=${store.doubled}`)
})
// Logs: "count=0, doubled=0"

store.increment()
// Logs: "count=1, doubled=2"

stop()
```

Data properties become observable, getters become computed values, and functions
become batched transactions — all from one `observable()` call.

---

## Where to go next

- [@fobx/core Introduction](/core/) — learn the reactive model
- [@fobx/core Installation](/core/installation/) — add FobX to your project
- [@fobx/core Overview](/core/overview/) — a 5-minute tour of every feature
- [@fobx/react Introduction](/react/) — integrate with React
- [Migration guide](/core/migration-0.11/) — upgrading from 0.10.x to 0.11.0
