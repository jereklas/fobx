---
title: API Reference
navTitle: API Reference
navSection: ["@fobx/jsx"]
navOrder: 4
---

This page summarizes the public `@fobx/jsx` surface.

## `h(type, props?, ...children)`

Low-level JSX factory used by the classic transform and by the automatic runtime
internally.

Supports:

- intrinsic element tags
- functional components
- `Fragment`

## Automatic runtime exports

`@fobx/jsx/jsx-runtime` exports:

- `jsx`
- `jsxs`
- `jsxDEV`
- `Fragment`

Use it via `jsxImportSource: "@fobx/jsx"`.

## `Fragment`

Render sibling nodes without a wrapper element.

```tsx
<>
  <span>A</span>
  <span>B</span>
</>
```

## `For`

Keyed JSX list primitive.

```tsx
<For each={items} key={(item) => item.id} fallback={<li>Empty</li>}>
  {(item, index) => <li>{index()}: {item.label}</li>}
</For>
```

Props:

- `each`: iterable or accessor returning an iterable
- `key`: optional key extractor
- `fallback`: content for empty collections
- `children`: render callback `(item, index) => Node`

Notes:

- `index` is a reactive accessor, not a static number
- fallback content is disposed when hidden and recreated when shown again later
- `<For>` is wrapper-free and marker-based internally

## `onMount(fn)`

Register setup for the current function component.

- runs once after the component is actually mounted into the rendered tree
- can only be called while a function component is rendering

## `onCleanup(fn)`

Register teardown for the current function component.

- runs when the component's root nodes are disposed or unmounted
- can only be called while a function component is rendering
- may be called during render or from `onMount()`

## `render(element, container, options?)`

Mount a node, fragment, or node array into a container.

- `options.clear` defaults to `true`
- when clearing, existing children are disposed before removal

## `unmount(container)`

Dispose and remove everything inside a container.

## Re-exported DOM helpers

`@fobx/jsx` re-exports:

- `dispose`
- `onDispose`
- `mapArray`
- `mountList`

## Types

Important exported types:

- `FC<P>`
- `JsxProps`
- `PropsWithChildren<P>`
- `ForProps<T>`

## Notes

- Function props and function children are the reactive boundaries.
- Lifecycle is function-based through `onMount()` and `onCleanup()`.
- Event handlers are attached once.
- `<For>` is wrapper-free and marker-based.
