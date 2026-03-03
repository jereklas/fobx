# @fobx/dom

Reactive DOM element construction library that integrates natively with
`@fobx/v2` observables.

**No virtual DOM. No diffing. Real DOM nodes with fine-grained reactive
updates.**

Every element factory (`div`, `span`, `input`, …) returns a real DOM node.
Reactive expressions (functions) passed as props or children are automatically
wrapped in autoruns that surgically update only the affected DOM attribute or
text node when observable dependencies change.

## Quick Start

```ts
import { box } from "@fobx/v2"
import { button, div, li, span, ul } from "@fobx/dom"

const count = box(0)

const app = div(
  { class: "counter" },
  span(null, "Count: ", () => String(count.get())),
  button({ onClick: () => count.set(count.get() + 1) }, "+"),
  button({ onClick: () => count.set(count.get() - 1) }, "-"),
)

document.body.appendChild(app)
```

## Element Factories

Every standard HTML element has a named factory function: `div`, `span`, `a`,
`input`, `button`, `ul`, `li`, etc.

```ts
// Signature: factory(props?, ...children) → HTMLElement
const node = div({ class: "foo", id: "bar" }, "Hello ", span(null, "World"))
```

The generic `el()` function creates elements by tag name:

```ts
import { el } from "@fobx/dom"
const node = el("custom-element", { class: "x" }, "content")
```

## Reactive Props

Pass a function as a prop value and it becomes reactive — an autorun tracks its
dependencies and updates the attribute when they change:

```ts
const active = box(false)
const node = div({ class: () => active.get() ? "active" : "" })

active.set(true) // className is now "active"
```

Supported reactive props include `class`, `style` (string or object), data
attributes, ARIA attributes, and standard HTML attributes.

## Reactive Children

Pass a function as a child to create a reactive text node or element(s) that
update automatically:

```ts
const name = box("World")
const greeting = div(null, "Hello, ", () => name.get(), "!")

name.set("fobx") // text updates to "Hello, fobx!"
```

Functions that return elements or arrays also work:

```ts
const show = box(true)
const node = div(null, () => show.get() ? span(null, "Visible") : null)
```

## Event Handlers

Props starting with `on` + uppercase letter are automatically wired as event
listeners:

```ts
const node = button({
  onClick: (e) => console.log("clicked!", e),
  onMouseEnter: () => console.log("hovering"),
}, "Click me")
```

## Reactive Lists — `mountList`

For collections, `mountList` efficiently maps an observable array to DOM nodes
with key-based reuse:

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
