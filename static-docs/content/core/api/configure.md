---
title: configure
description: Set global options for FobX behavior.
navTitle: configure
navSection: ["@fobx/core", "API"]
navOrder: 14
---

`configure` sets global options that affect all FobX behavior in the current
page.

## Signature

```ts
function configure(options: ConfigureOptions): void

interface ConfigureOptions {
  enforceTransactions?: boolean
  warnOnDependentlessComputeds?: boolean
  onReactionError?: (error: unknown, reaction: unknown) => void
  comparer?: {
    structural?: EqualityChecker
  }
}
```

## Options

### `enforceTransactions`

When `true`, FobX warns (in development) when an observable that has active
observers is mutated outside a transaction:

```ts
import { autorun, configure, observableBox } from "@fobx/core"

configure({ enforceTransactions: true })

const x = observableBox(0)
const stop = autorun(() => console.log(x.get()))

x.set(1) // ⚠️ console.warn: mutation outside transaction
```

Default: `true`.

Set to `false` to suppress warnings:

```ts
configure({ enforceTransactions: false })
```

### `warnOnDependentlessComputeds`

When `true`, FobX warns in development when a computed is evaluated through the
reactive runtime but ends up with no observable dependencies. That usually
means the computed is reading only plain values, so it will never update:

```ts
import { autorun, computed, configure } from "@fobx/core"

configure({ warnOnDependentlessComputeds: true })

const settings = { locale: "en-US" } // plain object, not observable
const label = computed(() => settings.locale.toUpperCase())

const stop = autorun(() => {
  console.log(label.get())
})
// ⚠️ console.warn: Computed value (...) was evaluated without any observable dependencies

stop()
```

Default: `false`.

FobX warns at most once per computed, and only when an observed or batched
evaluation finds zero dependencies.

### `onReactionError`

Global error handler for reactions. When a reaction throws, the error is caught
and passed to this callback instead of being silently swallowed:

```ts
configure({
  onReactionError: (error) => {
    console.error("Reaction error:", error)
    // Send to error monitoring service
  },
})
```

Without this, reaction errors are logged to the console.

### `comparer`

Override the built-in `"structural"` equality comparer. This must be set before
using `{ comparer: "structural" }` on any observableBox, computed, or
annotation:

```ts
import { configure } from "@fobx/core"
import { equals } from "fast-equals" // or any deep-equality library

configure({
  comparer: {
    structural: equals,
  },
})
```

Without this configuration, using `"structural"` as a comparer will throw.

## Typical setup

Call `configure()` once at application startup:

```ts
import { configure } from "@fobx/core"

configure({
  enforceTransactions: true,
  onReactionError: (error) => {
    console.error("[FobX] Reaction error:", error)
  },
})
```

## Multiple calls

Each `configure()` call merges with the current configuration. You can call it
multiple times to set different options:

```ts
configure({ enforceTransactions: true })
configure({ warnOnDependentlessComputeds: true })
configure({ onReactionError: myHandler })
// All settings are now active
```
