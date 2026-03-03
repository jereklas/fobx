// deno-lint-ignore-file no-explicit-any
/**
 * @fobx/jsx — JSX types.
 */

/** Functional component — a function that receives props and returns a Node or null. */
export interface FC<P = any> {
  (props: P): Node | Node[] | null
}

/** Props passed to the h/jsx function for intrinsic elements. */
export interface JsxProps {
  children?: any
  ref?: (el: any) => void
  key?: any
  [k: string]: any
}
