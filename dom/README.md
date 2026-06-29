# @fobx/dom

`@fobx/dom` builds real DOM nodes that react directly to `@fobx/core`
observables.

**No virtual DOM. No diffing. Real nodes with fine-grained updates.**

Every element factory returns an actual DOM node. When a prop or child is a
function, fobx tracks the observable reads inside that function and updates only
the affected attribute, style entry, class token, text node, or child range.

## Quick Start

```ts
import { observableBox } from "@fobx/core"
import { button, div, span } from "@fobx/dom"

const count = observableBox(0)

const app = div(
  { class: "counter" },
  span(null, "Count: ", () => String(count.get())),
  button({ onClick: () => count.set(count.get() + 1) }, "+"),
)

document.body.appendChild(app)
```

## Element Factories

Every standard HTML element has a named factory such as `div`, `span`, `button`,
`input`, `ul`, and `li`.

```ts
const node = div(
  { class: "panel", id: "todo-app" },
  "Hello ",
  span(null, "World"),
)
```

Use `el()` when you need a dynamic tag name, a custom element, or an SVG tag:

```ts
import { el } from "@fobx/dom"

const widget = el("my-widget", { class: "ready" }, "content")

const icon = el(
  "svg",
  { viewBox: "0 0 16 16" },
  el("use", { "attr:xlink:href": "#icon-check" }),
)
```

Known SVG tags are created in the SVG namespace, and `xlink:*` / `xml:*`
attributes use namespaced DOM APIs.

## Reactive Props

Pass a function as a prop value to make that binding reactive:

```ts
import { observableBox } from "@fobx/core"

const active = observableBox(false)
const node = div({ class: () => active.get() ? "active" : "" })

active.set(true)
```

Supported bindings include:

- `class` / `className`
- `classList`
- `style` as a string or object
- `textContent` and `innerHTML`
- standard attributes and common DOM properties
- namespaced bindings with `prop:`, `attr:`, and `bool:`

`class` and `classList` are merged. Duplicate tokens are deduplicated, and
`false`, `null`, and `undefined` remove the base class string instead of
serializing to text.

```ts
const selected = observableBox(false)

const node = div({
  class: "button",
  classList: () => ({
    selected: selected.get(),
    idle: !selected.get(),
  }),
})
```

Style objects are patched property-by-property. `null` and `undefined` remove
individual inline styles, and switching between string mode and object mode
clears the previous mode first.

```ts
const accent = observableBox("tomato")

const node = div({
  style: () => ({
    color: accent.get(),
    marginTop: null,
  }),
})
```

When you need explicit control over how a key is applied, use namespaced props:

```ts
const node = input({
  type: "checkbox",
  "prop:indeterminate": true,
  "attr:data-state": "ready",
  "bool:data-open": true,
})
```

## Reactive Children

Pass a function as a child to create a reactive text binding or reactive DOM
range:

```ts
const name = observableBox("World")
const greeting = div(null, "Hello, ", () => name.get(), "!")

name.set("fobx")
```

Reactive children can also return nodes, fragments, arrays, or `null`:

```ts
const show = observableBox(true)

const node = div(
  null,
  () => show.get() ? span(null, "Visible") : null,
)
```

## Event Handlers

Props starting with `on` + uppercase letter become event listeners:

```ts
const node = button({
  onClick: (event) => console.log("clicked", event.type),
  onMouseEnter: () => console.log("hovering"),
}, "Click me")
```

Listener props are **not** reactive accessors. A function passed to `onClick` or
`on:*` is the listener itself. If the handler must change, render a new element.

`on:` uses the exact event name and is useful for case-sensitive custom events:

```ts
const node = div({
  "on:MyEvent": (event) => console.log(event.type),
})
```

Event handler tuples are supported.

The tuple shape is `[handler, data]`:

- `handler` is the function to call when the event fires
- `data` is an arbitrary value that fobx pre-binds to that handler

When the event fires, fobx calls `handler(data, event)`.

```ts
function handleSelect(id: string, event: Event) {
  console.log(id, event.type)
}

const node = button({
  onClick: [handleSelect, "todo-1"],
}, "Select")
```

Listener objects with `capture`, `once`, `passive`, and `signal` are also
supported:

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
}, "Fire once")
```

## Lists

Use `mountList()` when you want keyed DOM reconciliation for collections:

```ts
import { observableArray } from "@fobx/core"
import { li, mountList, ul } from "@fobx/dom"

const items = observableArray(["Apple", "Banana", "Cherry"])
const list = ul(null)

mountList(list, () => items, (item) => li(null, item))

items.push("Date")
items.splice(1, 1)
```

Use `mountListRange()` when you already own the boundary markers and want to
reconcile a list inside an existing DOM range.

Use `mapArray()` when you want a live mapped node array without mounting it into
a parent yet. Removed entries are disposed when the source collection changes or
when you call `dispose()` on the mapped result.

## Cleanup and Scopes

Call `dispose(node)` when you manually remove a standalone reactive subtree from
the DOM:

```ts
import { dispose } from "@fobx/dom"

const node = div(null, () => count.get())
dispose(node)
```

Register custom teardown with `onDispose()`:

```ts
import { onDispose } from "@fobx/dom"

const node = div(null, "dynamic")
onDispose(node, () => console.log("cleaned up"))
```

For lower-level list and factory internals, `createScope()` and `onCleanup()`
let you collect cleanup into a flat scope instead of attaching it to the DOM
node tree:

```ts
import { createScope, onCleanup } from "@fobx/dom"

const [node, disposeScope] = createScope(() => {
  const node = div(null, "scoped")
  onCleanup(() => console.log("scope cleanup"))
  return node
})

disposeScope()
```

## Ref

Use `ref` to capture the real DOM element after creation:

```ts
let myInput: HTMLInputElement | null = null

const node = input({
  ref: (el) => {
    myInput = el as HTMLInputElement
  },
})
```

```ts
import { array } from "@fobx/v2"
import { li, mountList, ul } from "@fobx/dom"

const items = array(["Apple", "Banana", "Cherry"])
const list = ul(null)

mountList(list, () => items, (item) => li(null, item))

items.push("Date") // only adds one new <li>
items.splice(1, 1) // only removes the "Banana" <li>
```

## Cleanup

Call `dispose(element)` to tear down all reactive bindings on an element and its
descendants:

```ts
import { dispose } from "@fobx/dom"

const node = div(null, () => observable.get())
// ... later, when removing from DOM:
dispose(node)
```

Register custom cleanup with `onDispose`:

```ts
import { onDispose } from "@fobx/dom"

const node = div(null, "dynamic")
onDispose(node, () => console.log("cleaned up"))
```

## Ref

Use the `ref` prop to get a reference to the underlying DOM element:

```ts
let myInput: HTMLElement
const node = input({
  ref: (el) => {
    myInput = el
  },
})
```
