---
title: Installation
navTitle: Installation
navSection: ["@fobx/jsx"]
navOrder: 1
---

`@fobx/jsx` depends on `@fobx/core` and uses `@fobx/dom` internally.

## npm

```sh
npm install @fobx/core @fobx/jsx
```

## yarn

```sh
yarn add @fobx/core @fobx/jsx
```

## pnpm

```sh
pnpm add @fobx/core @fobx/jsx
```

## Configure the JSX transform

### Automatic runtime

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@fobx/jsx"
  }
}
```

### Classic runtime

```tsx
/** @jsx h */
/** @jsxFrag Fragment */
import { Fragment, h } from "@fobx/jsx"
```

## First render

```tsx
import { observableBox } from "@fobx/core"
import { render } from "@fobx/jsx"

const count = observableBox(0)

const App = () => (
  <button onClick={() => count.set(count.get() + 1)}>
    Count: {() => count.get()}
  </button>
)

render(<App />, document.getElementById("root")!)
```

## Recommended reading order

1. [Introduction](/jsx/)
2. [Overview](/jsx/overview/)
3. [API Reference](/jsx/api-reference/)
