---
title: runWithoutTracking
description: Read observables without creating dependencies.
navTitle: runWithoutTracking
navSection: ["@fobx/core", "API"]
navOrder: 11
---

`runWithoutTracking` runs a function in an untracked context. Observable reads
inside the function do **not** register as dependencies, even when called from
within a reaction or computed.

## Signature

```ts
function runWithoutTracking<T>(fn: () => T): T
```

## Basic usage

```ts
import { autorun, observableBox, runWithoutTracking } from "@fobx/core"

const tracked = observableBox("hello")
const untracked = observableBox("world")

const stop = autorun(() => {
  const a = tracked.get() // tracked
  const b = runWithoutTracking(() => untracked.get()) // NOT tracked

  console.log(a, b)
})
// prints: hello world

untracked.set("earth") // no re-run — not a dependency
tracked.set("hi") // re-runs: hi earth

stop()
```

## Use cases

### Logging without dependencies

```ts
autorun(() => {
  const value = counter.get()
  runWithoutTracking(() => {
    // Read other observables for logging without adding them as deps
    console.log("counter changed to", value, "total:", total.get())
  })
})
```

### Accessing reference data

```ts
const selectedId = observableBox("user-1")
const userCache = observableMap<string, User>()

autorun(() => {
  const id = selectedId.get() // tracked — re-run when selection changes

  // Don't re-run when the entire cache changes, only when selectedId changes
  const user = runWithoutTracking(() => userCache.get(id))
  renderUser(user)
})
```

## Return value

Returns whatever the wrapped function returns:

```ts
const value = runWithoutTracking(() => box.get())
```
