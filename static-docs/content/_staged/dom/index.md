---
title: "@fobx/dom"
description: Fine-grained DOM construction for FobX observables.
navTitle: Introduction
navSection: ["@fobx/dom"]
navOrder: 0
navSectionOrder: 5
navSectionExpanded: true
---

`@fobx/dom` lets you build real DOM nodes that react directly to `@fobx/core`
observables. There is no virtual DOM, no render diff, and no component tree
reconciliation step. You create nodes once, then reactive bindings update only
the exact DOM attribute, style entry, class token, text node, or child range
that depends on changed state.

## What you get

| Export                             | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `div`, `span`, `button`, ...       | Real DOM element factories for standard HTML tags         |
| `el()`                             | Create custom tags, dynamic tag names, and known SVG tags |
| `mountList()` / `mountListRange()` | Keyed list reconciliation for DOM collections             |
| `mapArray()`                       | Build a live mapped list without mounting it immediately  |
| `dispose()` / `onDispose()`        | Tear down reactive bindings and register cleanup          |

## Quick example

```ts
import { observableArray, observableBox } from "@fobx/core"
import { button, div, li, mountList, span, ul } from "@fobx/dom"

const count = observableBox(0)
const todos = observableArray(["Buy milk", "Write docs"])

const list = ul(null)
mountList(list, () => todos, (todo) => li(null, todo))

const app = div(
  { class: "app-shell" },
  span(null, "Count: ", () => String(count.get())),
  button({ onClick: () => count.set(count.get() + 1) }, "+"),
  list,
)

document.body.appendChild(app)
```

## Mental model

`@fobx/dom` follows the same fine-grained mental model as SolidJS:

- Static values are written once.
- Function props become reactive bindings.
- Function children become reactive text bindings or reactive DOM ranges.
- List reconciliation is explicit through `mountList()` or `mountListRange()`.

The main thing to remember is that event listeners are not reactive accessors.
Passing a function to `onClick` means "this is the handler", not "track this
expression and swap handlers later".

Known SVG tags are created in the SVG namespace, and `xlink:*` / `xml:*`
attributes are written with namespaced DOM APIs.

## When to use it

Use `@fobx/dom` when you want the smallest possible runtime surface and you are
comfortable authoring the DOM directly instead of through JSX. It is a good fit
for:

- framework-free widgets
- embedded interactive controls
- reactive islands inside existing server-rendered HTML
- performance-sensitive lists where you want explicit DOM ownership

## Next steps

- [Installation](/dom/installation/) — add `@fobx/dom` to a project
- [Overview](/dom/overview/) — learn props, children, events, lists, and cleanup
- [Recipes](/dom/recipes/) — practical patterns for direct DOM authoring, refs,
  lists, SVG, and disposal
- [API Reference](/dom/api-reference/) — signatures and behavior of the public
  API
