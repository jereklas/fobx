// deno-lint-ignore-file no-explicit-any
/**
 * JSX Runtime — modern automatic JSX transform.
 *
 * Configure your project to use this as the JSX import source:
 *
 *   // deno.jsonc / tsconfig.json
 *   {
 *     "compilerOptions": {
 *       "jsx": "react-jsx",
 *       "jsxImportSource": "@fobx/jsx"
 *     }
 *   }
 *
 * Or with pragma comments:
 *   // @jsxRuntime automatic
 *   // @jsxImportSource @fobx/jsx
 */

export { Fragment } from "./fragment.ts"
import { h } from "./h.ts"

/**
 * jsx / jsxs — called by the compiler for JSX expressions.
 *
 * Signature: jsx(type, props, key)
 * The compiler puts children inside props.children.
 */
function createNode(type: any, props: any, _key?: string): any {
  const { children, ...rest } = props ?? {}

  if (children == null) {
    return h(type, Object.keys(rest).length > 0 ? rest : null)
  }

  const childArray = Array.isArray(children) ? children : [children]
  return h(type, Object.keys(rest).length > 0 ? rest : null, ...childArray)
}

export { createNode as jsx }
export { createNode as jsxs }
export { createNode as jsxDev }
export { createNode as jsxDEV }
