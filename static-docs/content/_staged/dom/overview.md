---
title: Overview
navTitle: Overview
navSection: ["@fobx/dom"]
navOrder: 2
---

This guide covers the main mental model and day-to-day patterns for `@fobx/dom`.

## Static vs reactive values

Element factories create real DOM nodes immediately. A plain value is written
once. A function value becomes a fine-grained reactive binding.

```ts
const active = observableBox(false)

const node = div({
  id: "profile-card",
  class: () => active.get() ? "card active" : "card",
}, "Hello")
```

Rule of thumb:

- plain prop value: write once
- function prop value: track reads and update that binding only
- function child: track reads and update that child range only
- event handler: attach once, not reactively rebound

## Props

`@fobx/dom` supports normal attributes, common DOM properties, and explicit
namespaced bindings.

```ts
const checkbox = input({
  type: "checkbox",
  checked: () => isSelected.get(),
  "prop:indeterminate": () => isPartial.get(),
  "attr:data-state": () => state.get(),
  "bool:data-open": () => isOpen.get(),
})
```

### class and classList

`class` / `className` set the base class string. `classList` adds conditional
class tokens. The final class attribute is merged and deduplicated.

```ts
const node = div({
  class: "button base",
  classList: () => ({
    active: isActive.get(),
    disabled: isDisabled.get(),
    base: true,
  }),
})
```

### style

`style` accepts either a string or an object. Object mode patches individual
properties, and nullish values remove them.

```ts
const node = div({
  style: () =>
    mode.get() === "compact"
      ? { paddingTop: "4px", marginTop: null }
      : "padding-top: 12px; margin-top: 8px;",
})
```

Switching between string mode and object mode clears the old mode first.

### textContent and innerHTML

Both are supported as static or reactive bindings.

```ts
div({ textContent: () => label.get() })
div({ innerHTML: () => trustedHtml.get() })
```

`innerHTML` is not sanitized. Only pass trusted content.

### SVG and namespaced attributes

Known SVG tags created through `el()` are mounted in the SVG namespace.

```ts
const icon = el(
  "svg",
  { viewBox: "0 0 16 16" },
  el("use", { "attr:xlink:href": "#icon-check" }),
)
```

`xlink:*` and `xml:*` attributes are applied through namespaced DOM methods.

## Children

Children can be strings, numbers, nodes, fragments, arrays, nullish values, or
reactive functions.

```ts
const node = div(
  null,
  "static before ",
  () => userName.get(),
  " static after",
)
```

Reactive children can switch shape over time: text, element, fragment, array, or
`null`.

```ts
const node = div(
  null,
  () => showDetails.get() ? [h1(null, title.get()), p(null, body.get())] : null,
)
```

## Events

`onClick`, `onInput`, and other `onXxx` props attach listeners directly. `on:`
uses the exact event name.

```ts
button({ onClick: () => save() }, "Save")
div({ "on:MyEvent": (event) => console.log(event.type) })
```

Solid-style handler tuples are supported and call `handler(data, event)`.

```ts
button({ onClick: [handleSelect, "todo-1"] }, "Select")
```

Listener objects with `capture`, `once`, `passive`, and `signal` are also
supported.

```ts
const controller = new AbortController()

button({
  onClick: {
    once: true,
    signal: controller.signal,
    handleEvent(event) {
      console.log(event.type)
    },
  },
}, "Run once")
```

## Lists

Use `mountList()` when you want keyed reconciliation inside a container. Items
keep their DOM nodes when possible, including fragment-backed rows.

```ts
const list = ul(null)
mountList(list, () => todos, (todo) => li(null, todo.text), (todo) => todo.id)
```

Use `mountListRange()` when the parent range is already owned by another
primitive and you only want to reconcile within start/end markers.

Use `mapArray()` when you want a live node list without immediately attaching it
to a parent container. The mapped result exposes both `nodes` and `dispose()`.

## Cleanup

`dispose(node)` tears down reactive bindings under that node. Use it when you
remove a standalone subtree manually.

```ts
const node = div(null, () => count.get())
dispose(node)
```

`onDispose(node, cleanup)` registers custom teardown. Cleanup execution is
exception-safe: remaining disposers still run if one throws.

For lower-level primitives and custom reconciler work, `createScope()` and
`onCleanup()` let you collect cleanup in a flat scope rather than attaching it
to a node tree.

For concrete direct-DOM patterns like controlled inputs, SVG, imperative refs,
and manual cleanup, see [Recipes](/dom/recipes/).
