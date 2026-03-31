/**
 * useViewModel — manages a reactive ViewModel instance across React renders.
 *
 * Creates the VM once, calls vm.update() on subsequent renders to sync React
 * props into the VM's observable state, and handles lifecycle hooks
 * (onConnect / onDisconnect) via useEffect.
 */

// @ts-ignore - to suppress tsc false error
import { useEffect, useRef, useState } from "react"
import {
  type AnnotationsMap,
  type AnnotationValue,
  observable,
} from "@fobx/core"
import { endBatch, startBatch } from "@fobx/core/internals"
import { runInRenderPhase } from "./renderPhase.ts"

type ViewModelAnnotationTarget<T extends object, E extends Element> =
  & ViewModel<T, E>
  & { _props: T }

const viewModelBaseAnnotations = {
  _props: "observable.ref",
  props: "computed",
  ref: "observable.ref",
  setRef: "transaction",
  update: "none",
  onConnect: "none",
  onDisconnect: "none",
} satisfies Record<string, AnnotationValue>

// ─── ViewModel protocol ───────────────────────────────────────────────────────

/**
 * Interface for objects managed by useViewModel.
 * All methods are optional — implement only what you need.
 */
export interface ViewModelLike {
  /** Called on subsequent renders with the new constructor arguments. */
  update?(...args: unknown[]): void
  /** Called when the component mounts (inside useEffect). */
  onConnect?(): void
  /** Called when the component unmounts (useEffect cleanup). */
  onDisconnect?(): void
}

// ─── ViewModel base class ─────────────────────────────────────────────────────

/**
 * Convenience base class for ViewModels.
 *
 * Provides:
 * - `props` — a shallow-observable copy of React props (reads are tracked, writes notify)
 * - `ref` / `setRef` — a convenience ref callback for the root element
 * - `update()` — syncs new props into the observable props object
 * - `onConnect()` / `onDisconnect()` — lifecycle hooks
 *
 * Subclasses should call `observable(this)` in their constructor to make
 * their own properties, getters, and methods reactive:
 *
 * ```ts
 * class CounterVM extends ViewModel<{ initial: number }> {
 *   count: number
 *
 *   constructor(props: { initial: number }) {
 *     super(props)
 *     this.count = props.initial
 *     observable(this)
 *   }
 *
 *   get double() { return this.count * 2 }
 *   increment() { this.count++ }
 * }
 * ```
 */
export class ViewModel<
  T extends object = object,
  E extends Element = HTMLElement,
> implements ViewModelLike {
  protected _props: T

  // @ts-expect-error - when no props are supplied give default empty object
  constructor(props: T = {}) {
    // Each prop is tracked by reference — primitives, callbacks, and objects
    // are stored as-is without deep observable conversion.
    this._props = observable({ ...props }, {
      defaultAnnotation: "observable.ref",
    })

    // Define `props` as an own-property getter on this instance rather than on
    // the prototype, so that calling observable(this) in a subclass installs
    // any Computed at the instance level and does not affect sibling subclasses.
    const propsValue = this._props
    Object.defineProperty(this, "props", {
      get: () => propsValue,
      enumerable: true,
      configurable: true,
    })

    // Pin the base ViewModel semantics before any subclass calls observable(this).
    observable(this, {
      annotations: viewModelBaseAnnotations as unknown as Partial<
        AnnotationsMap<ViewModelAnnotationTarget<T, E>>
      >,
    })
  }

  /** Read-access to observable props. Reads are tracked. */
  declare props: T

  /** Ref to the component's root DOM element. */
  ref: E | null = null

  /** Callback ref — pass as `ref={vm.setRef}` to bind the root element. */
  setRef = (el: E | null): void => {
    this.ref = el
  }

  /** Called when the component mounts. Override in subclass. */
  onConnect(): void {}

  /** Called when the component unmounts. Override in subclass. */
  onDisconnect(): void {}

  /** Syncs new props into the observable props object. */
  update(props: Partial<T>): void {
    startBatch()
    try {
      Object.assign(this._props, props)
    } finally {
      endBatch()
    }
  }
}

// ─── useViewModel hook ────────────────────────────────────────────────────────

/**
 * Creates and manages a ViewModel instance across React renders.
 *
 * On first render: instantiates `new ctor(...args)`.
 * On subsequent renders: calls `vm.update(...args)` inside a batch so all
 * prop writes notify reactions atomically, while reads inside `update()` are
 * still tracked as component dependencies.
 *
 * @param ctor - The ViewModel class (or any class matching ViewModelLike)
 * @param args - Constructor arguments (typically React props)
 * @returns The ViewModel instance (stable across renders)
 */
// deno-lint-ignore no-explicit-any
export function useViewModel<T extends new (...args: any[]) => any>(
  ctor: T,
  ...args: ConstructorParameters<T>
): InstanceType<T> {
  const isFirstRender = useRef(true)

  const [vm] = useState(() => new ctor(...args))

  if (!isFirstRender.current && typeof vm.update === "function") {
    runInRenderPhase(() => {
      startBatch()
      try {
        vm.update(...args)
      } finally {
        endBatch()
      }
    })
  }
  isFirstRender.current = false

  useEffect(() => {
    if (typeof vm.onConnect === "function") vm.onConnect()
    return () => {
      if (typeof vm.onDisconnect === "function") vm.onDisconnect()
    }
    // vm is stable (created once via useState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm])

  return vm as InstanceType<T>
}
