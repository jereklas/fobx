---
title: createSelector In Depth
description: How to leverage createSelector for O(1) reactive selection in lists, forms, state machines, and more.
navSection: Guides
navOrder: 2
---

## What problem does `createSelector` solve?

Consider a list of 1,000 items where exactly one is "selected". The naïve
approach — every item reacting to the selection signal — means **all 1,000
reactions run** each time the selection changes, even though only two items
actually changed (the old selection and the new one).

`createSelector` eliminates this. It maintains a map of per-key observers and
notifies **only the two affected keys** on each change — the one leaving the
selection and the one entering it. The cost is O(1) regardless of list size.

```ts
import * as fobx from "@fobx/core"

const selectedId = fobx.observableBox("none")
const isSelected = fobx.createSelector(() => selectedId.get())

// isSelected(key) is reactive — it returns true only for the current key.
// When selectedId changes from "a" to "b", only observers of "a" and "b"
// are notified. Observers of all other keys are untouched.
```

---

## API signature

```ts
createSelector<T>(
  source: () => T,
  equals?: (a: T, b: T) => boolean,
): Selector<T>

type Selector<T> = ((key: T) => boolean) & {
  dispose(): void
  getAdmin(key: T): ObservableAdmin<boolean>
}
```

| Parameter   | Description                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `source`    | A reactive function returning the currently "selected" key. Tracked by an internal `autorun`.   |
| `equals`    | Optional comparator (defaults to `===`). Useful for object keys or case-insensitive matching.   |
| **Returns** | A `Selector<T>` — callable as `isSelected(key)`, reactive when called inside a tracked context. |

The returned `Selector` is callable as a function and also has:

- `.dispose()` — tears down the internal autorun and clears all per-key
  subscriptions. Call this when the selector is no longer needed.
- `.getAdmin(key)` — returns the internal `ObservableAdmin<boolean>` for a
  specific key. Useful for advanced framework integration (the `ObservableAdmin`
  type is exported from `@fobx/core/internals`).

---

## How it works

Internally, `createSelector` creates an `autorun` that watches the `source`
function. When the source value changes:

1. The per-key admin for the **previous** value (if any observers exist) is set
   to `false` and its observers are notified.
2. The per-key admin for the **new** value (if any observers exist) is set to
   `true` and its observers are notified.
3. All other keys are **completely untouched** — their observers never fire.

Each time `isSelected(key)` is called inside a tracked context (e.g. an
`autorun` or `reaction`), a lightweight per-key admin object is created (if
needed) and returned as a dependency. When a key loses all its observers, its
admin is automatically cleaned up via `onLoseObserver`, preventing memory leaks.

---

## Example 1 — Optimized DOM list selection

This is the most common use case: a long rendered list where one row is
selected. Each row reads `isSelected(row.id)` for its class, highlight, or
expanded state. When the selection changes, only the previously selected row and
the newly selected row need to update.

```ts
import * as fobx from "@fobx/core"

type Row = {
  id: number
  label: string
}

const rows: Row[] = [
  { id: 1, label: "Alpha" },
  { id: 2, label: "Beta" },
  { id: 3, label: "Gamma" },
]

const selectedRowId = fobx.observableBox(1)
const isSelectedRow = fobx.createSelector(() => selectedRowId.get())

function mountRow(row: Row): () => void {
  return fobx.autorun(() => {
    const className = isSelectedRow(row.id) ? "row selected" : "row"
    console.log(`render ${row.label}: ${className}`)
  })
}

const disposers = rows.map(mountRow)

// Initial output:
//   render Alpha: row selected
//   render Beta: row
//   render Gamma: row

selectedRowId.set(3)
// Only two rows re-render:
//   render Alpha: row
//   render Gamma: row selected

selectedRowId.set(2)
// Only two rows re-render:
//   render Gamma: row
//   render Beta: row selected

disposers.forEach((d) => d())
isSelectedRow.dispose()
```

In a real DOM renderer, those `autorun()` blocks would update each row's class
or attributes. The important part is the dependency shape: each row subscribes
to its own key, so selection changes only wake up two rows instead of the whole
list.

---

## Example 2 — Active tab in a tab group

The classic "one of many" UI pattern. One tab is active; switching tabs should
only re-render the newly active and the previously active tab.

```ts
import * as fobx from "@fobx/core"

const activeTab = fobx.observableBox("dashboard")
const isActiveTab = fobx.createSelector(() => activeTab.get())

const tabs = ["dashboard", "settings", "profile", "billing"]

// Each tab sets up its own reaction. When activeTab changes from
// "dashboard" to "settings", only those two reactions fire.
const disposers = tabs.map((tab) =>
  fobx.autorun(() => {
    const active = isActiveTab(tab)
    console.log(`[${tab}] active=${active}`)
  })
)

// Initial output:
//   [dashboard] active=true
//   [settings] active=false
//   [profile] active=false
//   [billing] active=false

activeTab.set("settings")
// Only two lines printed:
//   [dashboard] active=false
//   [settings] active=true

activeTab.set("profile")
// Only two lines printed:
//   [settings] active=false
//   [profile] active=true

// Cleanup
disposers.forEach((d) => d())
isActiveTab.dispose()
```

Without `createSelector`, changing `activeTab` would run **all four** reactions
every time — because each one reads `activeTab.get()` directly. With
`createSelector`, only the two affected tabs react.

---

## Example 3 — Form field focus tracking

In a form with many fields, track which field currently has focus. Only the
previously-focused and newly-focused fields need to update (e.g. to show
validation hints or change styling logic).

```ts
import * as fobx from "@fobx/core"

const focusedField = fobx.observableBox("")
const isFocused = fobx.createSelector(() => focusedField.get())

const fields = ["email", "password", "name", "address", "phone", "notes"]

// Each field has its own reaction scoped to whether it is focused:
const disposers = fields.map((field) =>
  fobx.autorun(() => {
    if (isFocused(field)) {
      console.log(`→ Show validation hint for "${field}"`)
    }
  })
)

focusedField.set("email")
// → Show validation hint for "email"

focusedField.set("password")
// → Show validation hint for "password"
// (the "email" observer fires too — it just doesn't match the if-check)

// Cleanup
disposers.forEach((d) => d())
isFocused.dispose()
```

---

## Example 4 — Permission / role gate

Given a set of roles, track which role is currently active. Components or
subsystems that only care about a specific role can subscribe selectively.

```ts
import * as fobx from "@fobx/core"

type Role = "viewer" | "editor" | "admin"

const currentRole = fobx.observableBox<Role>("viewer")
const isRole = fobx.createSelector(() => currentRole.get())

// Subsystem A only cares when it becomes "admin"
const stopAdminWatch = fobx.autorun(() => {
  if (isRole("admin")) {
    console.log("Admin panel: enabled")
  } else {
    console.log("Admin panel: disabled")
  }
})

// Subsystem B only cares about "editor"
const stopEditorWatch = fobx.autorun(() => {
  if (isRole("editor")) {
    console.log("Editor toolbar: visible")
  } else {
    console.log("Editor toolbar: hidden")
  }
})

// Initial:
//   Admin panel: disabled
//   Editor toolbar: hidden

currentRole.set("editor")
//   Editor toolbar: visible
// (admin watch is NOT notified — totally silent)

currentRole.set("admin")
//   Admin panel: enabled
//   Editor toolbar: hidden

// Cleanup
stopAdminWatch()
stopEditorWatch()
isRole.dispose()
```

Because each subsystem only tracks its own key, switching from `"viewer"` to
`"editor"` does not wake up the admin watcher at all.

---

## Example 5 — State‑machine step tracker

Track which step of a multi-step process is active. Each step's logic only runs
when that step becomes current.

```ts
import * as fobx from "@fobx/core"

type Step = "collect" | "validate" | "transform" | "publish"

const currentStep = fobx.observableBox<Step>("collect")
const isStep = fobx.createSelector(() => currentStep.get())

const steps: Step[] = ["collect", "validate", "transform", "publish"]

const disposers = steps.map((step) =>
  fobx.reaction(
    () => isStep(step),
    (active) => {
      if (active) console.log(`▶ Starting step: ${step}`)
      else console.log(`  Finished step: ${step}`)
    },
  )
)

currentStep.set("validate")
//   Finished step: collect
//   ▶ Starting step: validate

currentStep.set("transform")
//   Finished step: validate
//   ▶ Starting step: transform

currentStep.set("publish")
//   Finished step: transform
//   ▶ Starting step: publish

// Cleanup
disposers.forEach((d) => d())
isStep.dispose()
```

---

## Example 6 — Selected row in a data table (non-DOM)

Even outside the DOM, the selection pattern is common when processing or logging
data about a large collection.

```ts
import * as fobx from "@fobx/core"

interface Row {
  id: number
  label: string
}

const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  label: `Row ${i}`,
}))

const selectedRowId = fobx.observableBox(-1)
const isSelectedRow = fobx.createSelector(() => selectedRowId.get())

// Imagine each row has a reaction — e.g. for streaming highlight state
// to a connected client, logging analytics, etc.
let notifyCount = 0

const disposers = rows.map((row) =>
  fobx.autorun(() => {
    const selected = isSelectedRow(row.id)
    if (selected) notifyCount++
  })
)

// Select row 500 — only 1 reaction fires (row 500 becomes true)
notifyCount = 0
selectedRowId.set(500)
console.log(`Notifications after first select: ${notifyCount}`)
// → Notifications after first select: 1

// Switch to row 200 — only 2 reactions fire (500 → false, 200 → true)
notifyCount = 0
selectedRowId.set(200)
console.log(`Notifications after switch: ${notifyCount}`)
// → Notifications after switch: 1

// Cleanup
disposers.forEach((d) => d())
isSelectedRow.dispose()
```

With a naïve `autorun(() => selectedRowId.get() === row.id)` approach, each
selection change would fire **all 1 000** reactions. `createSelector` keeps it
to at most **2**.

---

## Example 7 — Custom equality for object keys

When keys are objects (or when you need case-insensitive matching), provide a
custom `equals` function as the second argument.

```ts
import * as fobx from "@fobx/core"

// Case-insensitive string matching
const activeFilter = fobx.observableBox("ERROR")
const isActiveFilter = fobx.createSelector(
  () => activeFilter.get(),
  (a, b) => a.toLowerCase() === b.toLowerCase(),
)

const stopInfo = fobx.autorun(() => {
  console.log(`info filter active: ${isActiveFilter("info")}`)
})
const stopError = fobx.autorun(() => {
  console.log(`error filter active: ${isActiveFilter("error")}`)
})

// Initial:
//   info filter active: false
//   error filter active: true   ← matches "ERROR" case-insensitively

activeFilter.set("Info")
//   info filter active: true
//   error filter active: false

// Cleanup
stopInfo()
stopError()
isActiveFilter.dispose()
```

---

## Cleanup

Always call `.dispose()` on the selector when it is no longer needed. This stops
the internal `autorun` that watches the source and clears all per-key admin
entries. Individual per-key admins are also automatically cleaned up when they
lose all observers (e.g. when you dispose the `autorun` or `reaction` that was
reading `isSelected(key)`).

```ts
const isSelected = fobx.createSelector(() => selectedId.get())

// ... use isSelected in autoruns / reactions ...

// When done:
isSelected.dispose()
```

---

## When to use `createSelector` vs. a plain `computed`

| Scenario                                   | Recommendation                                               |
| ------------------------------------------ | ------------------------------------------------------------ |
| One value derived from one or more signals | `computed` — it caches and re-computes lazily                |
| "Is X the active one?" across many items   | `createSelector` — O(1) per change instead of O(n)           |
| Small fixed set of states (2–5)            | Either works; `createSelector` is marginally better          |
| Large or dynamic set of keys               | `createSelector` — the performance advantage grows with size |

The rule of thumb: if you would write `selectedId.get() === key` inside many
separate reactions, use `createSelector` instead.
