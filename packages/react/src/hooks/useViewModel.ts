/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { getGlobalState } from "../state/global";
import { getGlobalState as getFobxState, observable } from "@fobx/core";

const globalState = getGlobalState();
const fobxState = getFobxState();

export interface IViewModel<VM extends new (...args: any) => any> {
  update(...args: ConstructorParameters<VM>): void;
  onConnect(): void;
  onDisconnect(): void;
}

export class ViewModel<T extends object = {}, E extends Element = HTMLElement> implements IViewModel<typeof ViewModel> {
  // @ts-expect-error - when no props are supplied give default empty object
  constructor(props: T = {}) {
    const annotations: Record<string, "observable"> = {};
    // spreading to remove all non-enumerable props (e.g. react's ref prop)
    const newProps = { ...props };
    Object.entries(newProps).forEach(([key]) => {
      annotations[key] = "observable";
    });
    this._props = observable(newProps, annotations, { shallow: true });
    observable(this);
  }

  get props() {
    return this._props;
  }
  private _props: T;

  ref: E | null = null;

  setRef = (el: E | null) => {
    this.ref = el;
  };

  onConnect(): void {}

  onDisconnect(): void {}

  update(props: T): void {
    Object.assign(this._props, props);
  }
}

export function useViewModel<T extends InstanceType<U>, U extends new (...args: any) => any>(
  ctor: T,
  ...args: ConstructorParameters<T>
) {
  const isFirstRender = useRef(true);
  const reaction = useRef(fobxState.reactionContext);

  const [vm] = useState(() => new ctor(...args) as IViewModel<T>);

  if (!isFirstRender.current) {
    const prev = globalState.updatingReaction;
    globalState.updatingReaction = reaction.current;
    try {
      vm.update(...args);
    } finally {
      globalState.updatingReaction = prev;
    }
  }
  isFirstRender.current = false;

  useEffect(() => {
    vm.onConnect();
    return () => vm.onDisconnect();
  }, [vm]);

  return vm as InstanceType<T>;
}
