// deno-lint-ignore-file no-explicit-any
/**
 * Fragment — renders children without a wrapper element.
 *
 * In JSX: <></> or <Fragment>...</Fragment>
 * Produces a DocumentFragment containing the children.
 */

import { appendChildNode } from "../dom/reactive.ts"

export function Fragment(props: { children?: any }): DocumentFragment {
  const frag = document.createDocumentFragment()
  const children = props.children
  if (children != null) {
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length; i++) {
        appendChildNode(frag, children[i])
      }
    } else {
      appendChildNode(frag, children)
    }
  }
  return frag
}
