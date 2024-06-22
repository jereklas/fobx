/* eslint-disable @typescript-eslint/no-explicit-any */
import { forwardRef, memo } from "react";
import { useObserver } from "../hooks/useObserver";

const hasSymbol = typeof Symbol === "function" && Symbol.for;
const isFunctionNameConfigurable = Object.getOwnPropertyDescriptor(() => {}, "name")?.configurable ?? false;

const ReactForwardRefSymbol = hasSymbol
  ? Symbol.for("react.forward_ref")
  : typeof forwardRef === "function" && forwardRef(() => null)["$$typeof"];

const ReactMemoSymbol = hasSymbol
  ? Symbol.for("react.memo")
  : typeof memo === "function" && memo(() => null)["$$typeof"];

type TypeOf = { ["$$typeof"]: symbol };

//
// Function overloads
//
export function observer<P extends object, TRef = object>(
  baseComponent: React.ForwardRefRenderFunction<TRef, P>
): React.MemoExoticComponent<React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>>;
export function observer<P extends object, TRef = object>(
  baseComponent: React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>
): React.MemoExoticComponent<React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>>;
export function observer<P extends object>(baseComponent: React.FunctionComponent<P>): React.FunctionComponent<P>;
export function observer<C extends React.FunctionComponent<any> | React.ForwardRefRenderFunction<any>>(
  baseComponent: C
): C & { displayName: string };

//
// Implementation
//
export function observer<P extends object, TRef = object>(
  baseComponent:
    | React.ForwardRefRenderFunction<TRef, P>
    | React.FunctionComponent<P>
    | React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>
) {
  if (ReactMemoSymbol && (baseComponent as TypeOf)["$$typeof"] === ReactMemoSymbol) {
    throw new Error(
      `[@fobx/react] You are trying to use "observer" on a function component wrapped in either another "observer" or "React.memo". The "observer" already applies "React.memo" for you.`
    );
  }

  let useForwardRef = false;
  let render = baseComponent;

  const baseComponentName = baseComponent.displayName || baseComponent.name;

  // If already wrapped with forwardRef, unwrap, so it can be wrapped in a memo
  if (ReactForwardRefSymbol && (baseComponent as TypeOf)["$$typeof"] === ReactForwardRefSymbol) {
    useForwardRef = true;
    render = (baseComponent as any)["render"];
  }

  let ObserverComponent = (props: any, ref: React.Ref<TRef>) => {
    return useObserver(() => render(props, ref), baseComponentName);
  };

  // Inherit original name and displayName
  (ObserverComponent as React.FunctionComponent).displayName = baseComponent.displayName;
  if (isFunctionNameConfigurable) {
    Object.defineProperty(ObserverComponent, "name", {
      value: baseComponent.name,
      writable: true,
      configurable: true,
    });
  }

  // Support legacy context: `contextTypes` must be applied before `memo`
  if ((baseComponent as any).contextTypes) {
    (ObserverComponent as React.FunctionComponent).contextTypes = (baseComponent as any).contextTypes;
  }

  // must forwardRef before memo
  if (useForwardRef) {
    ObserverComponent = forwardRef(ObserverComponent);
  }

  ObserverComponent = memo(ObserverComponent);

  copyStaticProperties(baseComponent, ObserverComponent);

  if (process.env.NODE_ENV !== "production") {
    Object.defineProperty(ObserverComponent, "contextTypes", {
      set() {
        const name = this.displayName || this.type?.displayName || this.type?.name || "Component";
        throw new Error(`[@fobx/react] "${name}.contextTypes" must be set before applying "observer".`);
      },
    });
  }

  return ObserverComponent;
}

// based on https://github.com/mridgway/hoist-non-react-statics/blob/master/src/index.js
const hoistBlackList: any = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  // Don't redefine `displayName`, it's defined as getter-setter pair on `memo`
  displayName: true,
};

function copyStaticProperties(base: any, target: any) {
  Object.keys(base).forEach((key) => {
    if (!hoistBlackList[key]) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(base, key)!);
    }
  });
}
