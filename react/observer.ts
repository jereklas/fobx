/**
 * observer — Higher-Order Component that makes a React function component reactive.
 *
 * Wraps the component in `useObserver` and `React.memo`. When any observable
 * read during render changes, the component re-renders. `React.memo` prevents
 * re-renders from parent when props haven't changed (observables handle the rest).
 *
 * Supports:
 * - Function components
 * - forwardRef components
 * - Static property hoisting
 * - displayName / name preservation
 */

// deno-lint-ignore-file no-explicit-any
// @ts-ignore - to suppress tsc false error
import React from "react"
import { useObserver } from "./hooks/useObserver.ts"

const hasSymbol = typeof Symbol === "function" && Symbol.for
const isFunctionNameConfigurable =
  Object.getOwnPropertyDescriptor(() => {}, "name")?.configurable ?? false

const ReactForwardRefSymbol = hasSymbol
  ? Symbol.for("react.forward_ref")
  : typeof React.forwardRef === "function" &&
    React.forwardRef(() => null)["$$typeof"]

const ReactMemoSymbol = hasSymbol
  ? Symbol.for("react.memo")
  : typeof React.memo === "function" && React.memo(() => null)["$$typeof"]

type TypeOf = { ["$$typeof"]: symbol }

// ─── Overloads ───────────────────────────────────────────────────────────────

export function observer<P extends object, TRef = object>(
  baseComponent: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >,
): React.MemoExoticComponent<
  React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >
>
export function observer<P extends object>(
  baseComponent: React.FunctionComponent<P>,
): React.FunctionComponent<P>
export function observer<
  C extends React.FunctionComponent<any>,
>(
  baseComponent: C,
): C & { displayName: string }

// ─── Implementation ──────────────────────────────────────────────────────────

export function observer<P extends object, TRef = object>(
  baseComponent:
    | React.FunctionComponent<P>
    | React.ForwardRefExoticComponent<
      React.PropsWithoutRef<P> & React.RefAttributes<TRef>
    >,
) {
  // Prevent double-wrapping
  if (
    ReactMemoSymbol && (baseComponent as TypeOf)["$$typeof"] === ReactMemoSymbol
  ) {
    throw new Error(
      `[@fobx/react] observer() was applied to a component already wrapped in observer() or React.memo(). ` +
        `observer() already applies React.memo() for you.`,
    )
  }

  let useForwardRef = false
  let render = baseComponent
  const baseComponentName = baseComponent.displayName || baseComponent.name

  // Unwrap forwardRef so we can re-wrap: memo(forwardRef(observer))
  if (
    ReactForwardRefSymbol &&
    (baseComponent as TypeOf)["$$typeof"] === ReactForwardRefSymbol
  ) {
    useForwardRef = true
    render = (baseComponent as any)["render"]
  }

  let ObserverComponent = (props: any, ref: React.Ref<TRef>) => {
    return useObserver(() => render(props, ref), baseComponentName)
  } // Preserve displayName and function name
  ;(ObserverComponent as React.FunctionComponent).displayName =
    baseComponent.displayName
  if (isFunctionNameConfigurable) {
    Object.defineProperty(ObserverComponent, "name", {
      value: baseComponent.name,
      writable: true,
      configurable: true,
    })
  }

  // Support legacy context: contextTypes must be applied before memo
  if ((baseComponent as any).contextTypes) {
    ;(ObserverComponent as React.FunctionComponent).contextTypes =
      (baseComponent as any).contextTypes
  }

  // forwardRef must come before memo
  if (useForwardRef) {
    ObserverComponent = React.forwardRef(ObserverComponent)
  }

  ObserverComponent = React.memo(ObserverComponent)

  copyStaticProperties(baseComponent, ObserverComponent)

  return ObserverComponent
}

// ─── Static property hoisting ────────────────────────────────────────────────
// Based on https://github.com/mridgway/hoist-non-react-statics

const hoistBlackList: any = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  displayName: true,
}

function copyStaticProperties(base: any, target: any) {
  Object.keys(base).forEach((key) => {
    if (!hoistBlackList[key]) {
      Object.defineProperty(
        target,
        key,
        Object.getOwnPropertyDescriptor(base, key)!,
      )
    }
  })
}
