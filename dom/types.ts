// deno-lint-ignore-file no-explicit-any

/** A value that can be reactive (a function) or static. */
export type ReactiveValue<T> = T | (() => T)

/** Style object — camelCase or kebab-case keys with string/number values. */
export type StyleObject = Record<string, string | number>

/** Event handler type — matches standard addEventListener signature. */
export type EventHandler = (event: Event) => void

/** Single child node: a DOM node, string, number, boolean, null/undefined, or reactive fn. */
export type Child =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | (() => Child | Child[])

/** Children can be a single child or an array (potentially nested). */
export type Children = Child | Children[]

/** Props object passed to element factories. */
export interface Props {
  /** CSS class name(s). Accepts string or reactive function returning string. */
  class?: ReactiveValue<string>
  /** Inline styles. Accepts a string, StyleObject, or reactive function. */
  style?: ReactiveValue<string | StyleObject>
  /** Ref callback — called with the real DOM element after creation. */
  ref?: (el: HTMLElement) => void
  /** Any other props: attributes, event handlers (onXxx), data-*, aria-*, etc. */
  [key: string]: any
}
