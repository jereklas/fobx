/**
 * JSX Runtime — modern automatic JSX transform.
 */

import type { Children } from "@fobx/dom"
import { Fragment } from "./fragment.ts"
import { h } from "./h.ts"
import type { JsxProps } from "./types.ts"

type RuntimeProps = Record<string, unknown> & {
  children?: Children | Children[]
}
type IntrinsicTag = string
type ElementForTag<Tag extends IntrinsicTag> = Tag extends
  keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[Tag]
  : HTMLElement
type ComponentFunction<P, R extends Node | Node[] | null> = {
  bivarianceHack(props: P): R
}["bivarianceHack"]
type AnyCallableComponent<R extends Node | Node[] | null> = {
  bivarianceHack(...args: readonly unknown[]): R
}["bivarianceHack"]
type RuntimeTag =
  | string
  | AnyCallableComponent<Node | Node[] | null>
  | typeof Fragment

export { Fragment }

function createNode<Tag extends IntrinsicTag>(
  type: Tag,
  props: JsxProps | null | undefined,
  _key?: string,
): ElementForTag<Tag>
function createNode<
  P extends Record<string, unknown>,
  R extends Node | Node[] | null,
>(
  type: ComponentFunction<P, R>,
  props: P | null | undefined,
  _key?: string,
): R
function createNode<R extends Node | Node[] | null>(
  type: AnyCallableComponent<R>,
  props: RuntimeProps | null | undefined,
  _key?: string,
): R
function createNode(
  type: unknown,
  props: RuntimeProps | null | undefined,
  _key?: string,
): unknown {
  const { children, ...rest } = props ?? {}
  const runtimeType = type as RuntimeTag
  const invokeH = h as (
    tag: RuntimeTag,
    props?: RuntimeProps | null,
    ...children: Children[]
  ) => unknown

  if (children == null) {
    return invokeH(runtimeType, Object.keys(rest).length > 0 ? rest : null)
  }

  const childArray = Array.isArray(children) ? children : [children]
  return invokeH(
    runtimeType,
    Object.keys(rest).length > 0 ? rest : null,
    ...childArray,
  )
}

export type * from "./types.ts"
export { createNode as jsx }
export { createNode as jsxs }
export { createNode as jsxDev }
export { createNode as jsxDEV }
