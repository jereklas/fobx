/**
 * @fobx/jsx — JSX types.
 */

import type { Children, Props as DomProps } from "@fobx/dom"

/** Component props enriched with children. */
export type PropsWithChildren<P = Record<string, unknown>> = P & {
  children?: Children | Children[]
}

/** Functional component — a function that receives props and returns a Node or null. */
export interface FC<P = Record<string, unknown>> {
  (props: PropsWithChildren<P>): Node | Node[] | null
}

/** Props passed to the h/jsx function for intrinsic elements. */
export type JsxProps = DomProps & {
  children?: Children | Children[]
}

export declare namespace JSX {
  export type Element = Node | Node[] | null
  export interface ElementAttributesProperty {
    props: unknown
  }
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicElements {
    [elemName: string]: JsxProps
  }
}
