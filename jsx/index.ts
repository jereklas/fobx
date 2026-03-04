// deno-lint-ignore-file no-explicit-any
/**
 * @fobx/jsx — A JSX rendering solution that works natively with fobx.
 *
 * No virtual DOM. No diffing. Real DOM nodes with fine-grained reactive updates.
 *
 * Usage with modern JSX transform (recommended):
 *   // deno.jsonc or tsconfig.json
 *   {
 *     "compilerOptions": {
 *       "jsx": "react-jsx",
 *       "jsxImportSource": "@fobx/jsx"
 *     }
 *   }
 *
 * Usage with classic JSX transform:
 *   /** @jsx h *​/
 *   /** @jsxFrag Fragment *​/
 *   import { h, Fragment } from "@fobx/jsx"
 *
 * Reactive expressions in JSX:
 *   <div class={() => isActive.get() ? "active" : ""}>{() => count.get()}</div>
 */

export { Fragment, h } from "./h.ts"
export { Component } from "./component.ts"
export { render, unmount } from "./render.ts"
export type { FC, JsxProps } from "./types.ts"

// Reactive list rendering
export { For } from "./for.ts"
export type { ForProps } from "./for.ts"

// Re-export useful dom utilities
export { dispose, onDispose } from "../dom/reactive.ts"
export { mapArray, mountList } from "../dom/map-array.ts"
