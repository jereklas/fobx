---
title: Recipes
navTitle: Recipes
navSection: ["@fobx/dom"]
navOrder: 4
---

This page collects practical `@fobx/dom` patterns for building reactive DOM
without JSX.

The common theme is always the same:

- create the node structure once
- use functions only where a binding should stay reactive
- dispose explicit subtrees when you own their removal

## Reactive text inside static structure

One of the best default patterns is to keep the outer structure static and make
just the changing text reactive.

```ts
import { observableBox } from "@fobx/core"
import { div, h1, p } from "@fobx/dom"

const first = observableBox("Ada")
const last = observableBox("Lovelace")

const profile = div(
  { class: "profile-card" },
  h1(null, () => `${first.get()} ${last.get()}`),
  p(null, "Inventor of the first algorithm intended for a machine."),
)
```

That gives you precise updates without rebuilding the whole subtree.

## Conditional DOM ranges

Use a reactive child that returns either a node or `null`.

```ts
import { observableBox } from "@fobx/core"
import { button, div, span } from "@fobx/dom"

const open = observableBox(false)

const panel = div(
  null,
  button({ onClick: () => open.set(!open.get()) }, "Toggle"),
  () => open.get() ? span({ class: "panel" }, "Visible") : null,
)
```

Use this when the child structure itself should appear or disappear.

## Conditional attributes and classes

When the structure should stay in place and only the binding should change, use
reactive props.

```ts
import { observableBox } from "@fobx/core"
import { div } from "@fobx/dom"

const active = observableBox(false)

const status = div({
  class: () => active.get() ? "status active" : "status",
  classList: () => ({
    disabled: !active.get(),
  }),
}, () => active.get() ? "Online" : "Offline")
```

## Controlled input

Bind the DOM property reactively and write changes back through an event
handler.

```ts
import { observableBox } from "@fobx/core"
import { input, label } from "@fobx/dom"

const name = observableBox("")

const field = label(
  null,
  "Name",
  input({
    value: () => name.get(),
    onInput: (event) => {
      const target = event.target as HTMLInputElement | null
      name.set(target?.value ?? "")
    },
  }),
)
```

This same pattern works for `checked`, `selected`, and related DOM-backed
properties.

## Keyed list rendering

Use `mountList()` when you want DOM reuse and keyed reconciliation inside a
container.

```ts
import { observableArray } from "@fobx/core"
import { li, mountList, ul } from "@fobx/dom"

const todos = observableArray([
  { id: 1, label: "Buy milk" },
  { id: 2, label: "Write docs" },
])

const list = ul(null)

mountList(
  list,
  () => todos,
  (todo) => li(null, todo.label),
  (todo) => todo.id,
)
```

Use `mountListRange()` when you already own the surrounding DOM markers and only
need reconciliation inside a bounded range.

## Detached mapped nodes with `mapArray()`

Use `mapArray()` when you want a live mapped node list before deciding where to
mount it.

```ts
import { observableArray } from "@fobx/core"
import { mapArray, span } from "@fobx/dom"

const items = observableArray(["A", "B"])

const mapped = mapArray(
  () => items,
  (item) => span(null, item),
)

document.body.append(...mapped.nodes)

// Later:
mapped.dispose()
```

Removed entries are disposed when the source data changes, and the whole mapped
result can be disposed manually when you are done with it.

## Imperative DOM refs

Use `ref` to capture the actual DOM node after creation.

```ts
import { button, input } from "@fobx/dom"

let inputEl: HTMLInputElement | null = null

const search = input({
  ref: (el) => {
    inputEl = el as HTMLInputElement
  },
})

const focusButton = button({
  onClick: () => inputEl?.focus(),
}, "Focus")
```

This is useful for focus, measurement, scroll, or direct DOM APIs.

## SVG icons

Known SVG tags created through `el()` are mounted in the SVG namespace.

```ts
import { el } from "@fobx/dom"

const icon = el(
  "svg",
  { viewBox: "0 0 16 16", class: "icon" },
  el("use", { "attr:xlink:href": "#icon-check" }),
)
```

Use the `attr:` namespace when you want explicit control over SVG attributes,
including `xlink:*` forms.

## Manual subtree disposal

If you remove a standalone reactive subtree yourself, call `dispose()` before or
when removing it.

```ts
import { dispose, div } from "@fobx/dom"

const node = div(null, () => count.get())

dispose(node)
node.remove()
```

If a parent reconciler or container unmount owns the subtree, that higher-level
owner should perform disposal instead.

## Custom cleanup with `onDispose()`

Attach teardown directly to a node when it owns an external resource.

```ts
import { div, onDispose } from "@fobx/dom"

const node = div(null, "Timer owner")
const timer = setInterval(() => {
  console.log("tick")
}, 1000)

onDispose(node, () => {
  clearInterval(timer)
})
```

That keeps external resources aligned with DOM ownership.

## Scoped cleanup with `createScope()`

Use `createScope()` when a factory or low-level primitive needs flat cleanup
without relying on a DOM tree walk.

```ts
import { createScope, div, onCleanup } from "@fobx/dom"

const [node, disposeScope] = createScope(() => {
  const node = div(null, "scoped")
  onCleanup(() => {
    console.log("scope disposed")
  })
  return node
})

disposeScope()
```

This is mainly useful for custom list and composition primitives, but it is a
good tool to understand when building abstractions on top of `@fobx/dom`.

## When to choose `@fobx/dom`

Use `@fobx/dom` directly when:

- you want the smallest runtime surface
- you do not need JSX syntax
- you want explicit DOM ownership and disposal
- you are building lower-level primitives for other layers

If you prefer authoring structure in JSX while keeping the same fine-grained DOM
runtime, use `@fobx/jsx` instead.
