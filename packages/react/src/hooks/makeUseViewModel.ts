/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { getGlobalState } from "../state/global";
import { getGlobalState as getFobxState } from "@fobx/core";

const globalState = getGlobalState();
const fobxState = getFobxState();

export interface IViewModel<VM extends abstract new (...args: any) => any> {
  update(...args: ConstructorParameters<VM>): void;
}

export function makeUseViewModel<T extends Record<string, new (...args: any[]) => any>>(vms: T) {
  type Keys = keyof typeof vms;
  type ViewModelByKey<K> = K extends Keys ? [K, InstanceType<(typeof vms)[K]>] : never;
  type ClassType<K extends Keys> = Extract<ViewModelByKey<Keys>, [K, any]>[1];

  const useViewModel = <K extends Keys>(
    viewModel: K,
    ...args: ConstructorParameters<(typeof vms)[K]>
  ): ClassType<K> => {
    const reaction = useRef(fobxState.reactionContext);
    // arrow function ensures we don't create another class on each render (it runs once on first render)
    const [vm] = useState(() => new vms[viewModel](...args));

    const prev = globalState.updatingReaction;
    globalState.updatingReaction = reaction.current;
    try {
      vm.update(...args);
    } finally {
      globalState.updatingReaction = prev;
    }

    return vm;
  };

  return useViewModel;
}
