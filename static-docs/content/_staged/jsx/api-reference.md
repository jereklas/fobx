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
- class components extending `Component`
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

## `Component<P>`

Base class for optional class components.

Key members:

- `props`
- `render()`
- `didMount()`
- `willUpdate()`
- `didUpdate()`
- `didUnmount()`
- `update()`

`render()` may return a node, array of nodes, fragment, or `null`.

Behavior notes:

- `didMount()` runs on the next microtask after initial render
- `update()` performs full root replacement rather than diffing
- `didUnmount()` runs when tracked root nodes are disposed or removed
- `ref` on a class component receives the instance
- assigning to `props` does not trigger an update automatically

See [Class Components](/jsx/class-components/) for a deeper walkthrough.

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
- Event handlers are attached once.
- `Component.update()` replaces root nodes rather than diffing them.
- `<For>` is wrapper-free and marker-based.
