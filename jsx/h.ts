/**
 * h — The createElement function for @fobx/jsx.
 */

import { dispose as disposeNode, el, onDispose } from "@fobx/dom"
import type { Children } from "@fobx/dom"
import { recreateChildren, registerRecreateFactory } from "@fobx/dom/recreate"
import { Fragment } from "./fragment.ts"
import {
  attachLifecycle,
  createLifecycleMarker,
  ownerHasLifecycle,
  withLifecycleOwner,
} from "./lifecycle.ts"
import { normalizeRenderedNodes } from "./nodes.ts"
import type { JsxProps } from "./types.ts"

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
type ComponentChildrenArgs<P> = P extends { children: infer C }
  ? C extends readonly unknown[] ? C
  : [C]
  : P extends { children?: infer C } ? C extends readonly unknown[] ? C
    : [Exclude<C, undefined>]
  : Children[]
type RuntimeTag =
  | string
  | AnyCallableComponent<Node | Node[] | null>
  | typeof Fragment

export function h<Tag extends IntrinsicTag>(
  tag: Tag,
  props?: JsxProps | null,
  ...children: Children[]
): ElementForTag<Tag>
export function h<
  P extends Record<string, unknown>,
  R extends Node | Node[] | null,
>(
  tag: ComponentFunction<P, R>,
  props?: Omit<P, "children"> | null,
  ...children: Children[]
): R
export function h<
  P extends Record<string, unknown>,
  R extends Node | Node[] | null,
>(
  tag: AnyCallableComponent<R>,
  props?: Omit<P, "children"> | null,
  ...children: ComponentChildrenArgs<P>
): R
export function h(
  tag: RuntimeTag,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  if (
    props?.children != null && Array.isArray(children) && children.length === 0
  ) {
    children = Array.isArray(props.children) ? props.children : [props.children]
  }

  if (typeof tag === "function" && tag === Fragment) {
    return registerRecreateFactory(
      tag({ ...props, children }),
      () =>
        h(Fragment, props, ...recreateChildren(children)) as DocumentFragment,
    )
  }

  if (typeof tag === "function") {
    const [rendered, owner] = withLifecycleOwner(() =>
      tag({ ...props, children })
    )
    const result = finalizeFunctionComponentResult(rendered, owner)
    return registerRecreateFactory(
      result,
      () =>
        h(
          tag,
          props as Record<string, unknown> | null,
          ...recreateChildren(children),
        ),
    )
  }

  if (typeof tag === "string") {
    const element = el(
      tag,
      props as JsxProps | null ?? null,
      ...(children as Children[]),
    )

    return registerRecreateFactory(
      element,
      () => h(tag, props as JsxProps | null, ...recreateChildren(children)),
    )
  }

  throw new Error(`[@fobx/jsx] h(): unsupported tag type: ${typeof tag}`)
}

function wrapInFragment(nodes: Node[]): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const node of nodes) frag.appendChild(node)
  onDispose(frag, () => {
    for (let i = 0; i < nodes.length; i++) {
      disposeNode(nodes[i])
    }
  })
  return frag
}

export { Fragment }

function finalizeFunctionComponentResult(
  rendered: Node | Node[] | null,
  owner: ReturnType<typeof withLifecycleOwner>[1],
): Node | Node[] | null {
  if (!ownerHasLifecycle(owner)) {
    return rendered
  }

  const nodes = normalizeRenderedNodes(rendered)
  if (nodes.length === 0) {
    return createLifecycleMarker(owner)
  }

  attachLifecycle(owner, nodes)
  return rendered
}
