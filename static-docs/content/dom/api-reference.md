---
title: API Reference
navTitle: API Reference
navSection: ["@fobx/dom"]
navOrder: 3
---

This page summarizes the public `@fobx/dom` surface.

## Element factories

Every standard HTML tag is exported as a function.

```ts
div(props?, ...children)
span(props?, ...children)
button(props?, ...children)
input(props?, ...children)
```

Each factory returns the real DOM element instance.

## `el(tag, props?, ...children)`

Create a custom element or a tag chosen dynamically at runtime.

```ts
const node = el("my-widget", { class: "ready" }, "content")
```

Known SVG tags are created in the SVG namespace.

## `mountList(parent, items, mapFn, keyFn?)`

Mount a keyed reactive list into a parent node.

- `parent`: container node
- `items`: function returning an iterable
- `mapFn(item, index)`: returns a node or fragment for each row
- `keyFn(item)`: optional stable key extractor, default is identity

Returns a dispose function.

## `mountListRange(startMarker, endMarker, items, mapFn, keyFn?)`

Like `mountList`, but reconciles only between two markers that you already own.
Use this when another primitive manages the surrounding DOM structure.

## `mapArray(items, mapFn, keyFn?)`

Build a live mapped list without immediately mounting it.

Returns:

- `nodes`: current normalized node array
- `dispose()`: stop tracking and dispose row bindings

## `appendChildNode(parent, child)`

Low-level child insertion helper used by the runtime. Accepts nodes, strings,
numbers, arrays, fragments, nullish values, and reactive functions.

## `dispose(node)`

Dispose all reactive bindings on a node and its descendants.

Use it when removing a subtree manually outside a parent reconciler or container
unmount flow.

## `onDispose(node, cleanup)`

Register teardown for a node. Cleanup runs when that node is disposed.

## `createScope(fn)` / `onCleanup(cleanup)`

Scope-oriented disposal helpers used by higher-level list primitives.

- `createScope(fn)` runs `fn` and returns `[result, dispose]`
- `onCleanup(cleanup)` registers cleanup with the active scope, if one exists

## Props and types

Important exported types:

- `Props`
- `Children`
- `ReactiveValue<T>`
- `StyleObject`
- `EventBindingValue`
- `EventHandlerTuple`
- `EventListenerWithOptions`
- `RefCallback`

Prop conventions:

- `class` / `className`: base class string
- `classList`: conditional token map
- `style`: string or object
- `prop:*`: set a DOM property directly
- `attr:*`: set/remove a serialized attribute
- `bool:*`: add/remove a boolean-style attribute
- `onXxx` / `on:*`: attach event listeners
- `textContent` / `innerHTML`: direct content bindings

Event bindings also accept listener objects with:

- `capture`
- `once`
- `passive`
- `signal`

## Notes

- Event handlers are attached once and are not reactive bindings.
- `innerHTML` is not sanitized.
- `class={false}` is treated as no base class, not the literal string `"false"`.
- Reactive children can switch between text, nodes, fragments, arrays, and
  `null` without replacing unaffected siblings.
