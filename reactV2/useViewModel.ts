/**
 * useViewModel — manages a reactive ViewModel instance across React renders.
 *
 * Creates the VM once (via useState), calls vm.update() on subsequent renders
 * to sync React props into the VM's observable state, and handles lifecycle
 * (onConnect/onDisconnect) via useEffect.
 *
 * ## Key improvements over v1:
 *
 * 1. **No global state** — v1 used a global `updatingReaction` variable to suppress
 *    self-notifications during vm.update(). This caused bugs when VMs were passed
 *    to child components (the global was shared across all observers). v2 uses
 *    per-tracker `isTracking` suppression + `withoutTracking`/`runInTransaction`,
 *    which is fully re-entrant and safe for any nesting depth.
 *
 * 2. **Protocol-based** — useViewModel works with any class that has an `update()`
 *    method. The `ViewModel` base class is provided for convenience but not required.
 *
 * 3. **Simpler observable setup** — Uses v2's `observable()` with auto-inference.
 */

// @ts-ignore - to suppress tsc false error
import { useEffect, useRef, useState } from "react"
import { observable, runInTransaction, withoutTracking } from "@fobx/v2"

// ─── ViewModel protocol ──────────────────────────────────────────────────────

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

// ─── ViewModel base class ────────────────────────────────────────────────────

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
 * their own properties/getters/methods reactive:
 *
 * ```ts
 * class CounterVM extends ViewModel<{ initial: number }> {
 *   count: number
 *
 *   constructor(props: { initial: number }) {
 *     super(props)
 *     this.count = props.initial
 *     observable(this) // makes count, double, increment reactive
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
    // Create a shallow-observable copy of props.
    // "observable.ref" means each property is tracked by reference — React
    // props (primitives, callbacks, objects) are stored as-is without deep
    // observable conversion. This prevents wrapping callback functions or
    // complex objects in observable proxies.
    this._props = observable({ ...props }, {
      defaultAnnotation: "observable.ref",
    })

    // IMPORTANT: Define `props` as an own-property getter on THIS instance
    // (not on the prototype). This prevents v2's observable() from replacing
    // the getter on ViewModel.prototype when a subclass calls observable(this).
    //
    // If `get props()` lived on the prototype, calling observable(this) in a
    // subclass would install a Computed getter on ViewModel.prototype, which
    // would break sibling subclasses that never called observable(this) — their
    // instances would have no $fobx admin, causing "Cannot read properties of
    // undefined (reading 'values')" at runtime.
    //
    // With an own-property getter, v2 intercepts it at the instance level
    // (installing the Computed on the instance, not the prototype), so there
    // is no cross-class prototype contamination.
    const propsValue = this._props
    Object.defineProperty(this, "props", {
      get: () => propsValue,
      enumerable: true,
      configurable: true, // configurable so v2 can convert it to a Computed if needed
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

  /** Called when component mounts. Override in subclass. */
  onConnect(): void {}

  /** Called when component unmounts. Override in subclass. */
  onDisconnect(): void {}

  /** Sync new props into the observable props object. */
  update(props: Partial<T>): void {
    Object.assign(this._props, props)
  }
}

// ─── useViewModel hook ───────────────────────────────────────────────────────

/**
 * Create and manage a ViewModel instance across React renders.
 *
 * On first render: instantiates `new ctor(...args)`.
 * On subsequent renders: calls `vm.update(...args)` inside `withoutTracking`
 * + `runInTransaction` to batch prop changes without triggering mid-render
 * re-renders.
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
    // Wrap in withoutTracking + runInTransaction:
    //
    // withoutTracking: prevents the parent observer's tracker from picking up
    //   the VM's prop box writes as dependencies. Without this, the observer
    //   would track the prop boxes AND their values, creating a circular
    //   dependency (write triggers re-render triggers write...).
    //
    // runInTransaction: batches all prop changes into a single atomic update.
    //   Reactions (including any child observers reading from this VM) fire
    //   only after all props are updated, not after each individual assignment.
    //
    // Together, these ensure:
    // - No mid-render reaction firing
    // - No global state pollution
    // - Safe when VM is passed to child components
    withoutTracking(() => {
      runInTransaction(() => {
        vm.update(...args)
      })
    })
  }
  isFirstRender.current = false

  useEffect(() => {
    if (typeof vm.onConnect === "function") vm.onConnect()
    return () => {
      if (typeof vm.onDisconnect === "function") vm.onDisconnect()
    }
    // vm is stable (created once via useState), so this effect runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm])

  return vm as InstanceType<T>
}
