---
title: Installation
description: Install @fobx/react and its peer dependencies.
navTitle: Installation
navSection: ["@fobx/react"]
navOrder: 1
---

## npm

```bash
npm install @fobx/core @fobx/react react
```

## Deno

```ts
import { observer } from "npm:@fobx/react"
```

Or add to your import map:

```json
{
  "imports": {
    "@fobx/core": "npm:@fobx/core",
    "@fobx/react": "npm:@fobx/react"
  }
}
```

These docs track the current repository source. If you are using an older
published prerelease of `@fobx/react`, verify that the exports you need are
available in that version.

## Peer dependencies

`@fobx/react` requires:

- `@fobx/core` — the reactive core
- `react` ≥ 18.0 — for `useSyncExternalStore`
