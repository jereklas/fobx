---
title: Installation
navTitle: Installation
navSection: ["@fobx/dom"]
navOrder: 1
---

`@fobx/dom` depends on `@fobx/core`, so install both packages together.

## npm

```sh
npm install @fobx/core @fobx/dom
```

## yarn

```sh
yarn add @fobx/core @fobx/dom
```

## pnpm

```sh
pnpm add @fobx/core @fobx/dom
```

## First render

```ts
import { observableBox } from "@fobx/core"
import { button, div } from "@fobx/dom"

const count = observableBox(0)

const app = div(
  null,
  () => `Count: ${count.get()}`,
  button({ onClick: () => count.set(count.get() + 1) }, "Increment"),
)

document.body.appendChild(app)
```

## Requirements

- A DOM environment such as the browser, JSDOM, or happy-dom
- `@fobx/core` for observables and reactions

## Recommended reading order

1. [Introduction](/dom/)
2. [Overview](/dom/overview/)
3. [API Reference](/dom/api-reference/)
