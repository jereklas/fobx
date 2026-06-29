/** A value that can be reactive (a function) or static. */
export type ReactiveValue<T> = T | (() => T)

/** DOM attribute values supported by attr:* and normal attribute serialization. */
export type AttributeValue = string | number | boolean | null | undefined

/** Ref callback for DOM elements or component instances. */
export type RefCallback<T = HTMLElement> = (value: T) => void

/** Style object — camelCase or kebab-case keys with string/number values. */
export type StyleObject = Record<string, string | number | null | undefined>

type BivariantHandler<Args extends unknown[]> = {
  bivarianceHack(...args: Args): void
}["bivarianceHack"]

/** Event handler type — matches standard addEventListener signature. */
export type EventHandler<E extends Event = Event> = BivariantHandler<[
  event: E,
]>

/** Event handler receiving bound data plus the event object. */
export type EventHandlerWithData<Data = unknown, E extends Event = Event> =
  BivariantHandler<[
    data: Data,
    event: E,
  ]>

/** Event handler tuple: [handler, data] → handler(data, event). */
export type EventHandlerTuple<Data = unknown, E extends Event = Event> =
  readonly [
    handler: EventHandlerWithData<Data, E>,
    data: Data,
  ]

/** Listener object with addEventListener options. */
export interface EventListenerWithOptions<E extends Event = Event>
  extends EventListenerObject {
  handleEvent(event: E): void
  capture?: boolean
  once?: boolean
  passive?: boolean
  signal?: AbortSignal
}

/** Accepted runtime event binding shapes for onXxx and on:* props. */
export type EventBindingValue<E extends Event = Event> =
  | EventHandler<E>
  | EventHandlerTuple<unknown, E>
  | EventListenerWithOptions<E>

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

type NamespacedPropBindings = {
  [K in `prop:${string}`]?: ReactiveValue<unknown>
}

type NamespacedAttributeBindings = {
  [K in `attr:${string}`]?: ReactiveValue<AttributeValue>
}

type NamespacedBooleanBindings = {
  [K in `bool:${string}`]?: ReactiveValue<unknown>
}

type DirectEventBindings = {
  [K in `on:${string}`]?: EventBindingValue
}

type CamelCaseEventBindings = {
  [K in `on${Capitalize<string>}`]?: EventBindingValue
}

type GenericPropValue =
  | ReactiveValue<unknown>
  | EventBindingValue
  | RefCallback<HTMLElement>
  | undefined

/** Props object passed to element factories. */
export type Props =
  & {
    /** CSS class name(s). Accepts string or reactive function returning string. */
    class?: ReactiveValue<string | null | undefined | false>
    /** Alias for class. */
    className?: ReactiveValue<string | null | undefined | false>
    /** Conditional CSS classes merged into the element class name. */
    classList?: ReactiveValue<Record<string, unknown> | null | undefined>
    /** Inline styles. Accepts a string, StyleObject, or reactive function. */
    style?: ReactiveValue<string | StyleObject | null | undefined | false>
    /** Ref callback — called with the real DOM element after creation. */
    ref?: RefCallback<HTMLElement>
    /** Common DOM properties that are often set reactively. */
    value?: ReactiveValue<unknown>
    checked?: ReactiveValue<boolean | null | undefined>
    disabled?: ReactiveValue<boolean | null | undefined>
    selected?: ReactiveValue<boolean | null | undefined>
    htmlFor?: ReactiveValue<string | null | undefined | false>
    innerHTML?: ReactiveValue<string | null | undefined | false>
    textContent?: ReactiveValue<string | number | null | undefined | false>
    /** Any other props: attributes, event handlers (onXxx), data-*, aria-*, etc. */
    [key: string]: GenericPropValue
  }
  & NamespacedPropBindings
  & NamespacedAttributeBindings
  & NamespacedBooleanBindings
  & DirectEventBindings
  & CamelCaseEventBindings
