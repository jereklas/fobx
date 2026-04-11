---
title: Installation
navTitle: Installation
navSection: ["@fobx/core"]
navOrder: 1
---

## npm

```sh
npm install @fobx/core
```

## yarn

```sh
yarn add @fobx/core
```

## pnpm

```sh
pnpm add @fobx/core
```

---

## Initial configuration

Call `configure` once at application startup — before creating any observables:

```ts
import * as fobx from "@fobx/core"
import { equals } from "fast-equals" // or any deep-equality library

fobx.configure({
  // Required only if you use { comparer: "structural" } anywhere
  comparer: { structural: equals },

  // Global error handler for reactions and computed evaluations
  onReactionError: (err) => console.error("[fobx]", err),
})
```

See [configure](/core/api/configure/) for full option details.

---

## What's next

- [Overview](/core/overview/) — a 5-minute tour of every feature
- API Reference — browse one page per public function in the API section
