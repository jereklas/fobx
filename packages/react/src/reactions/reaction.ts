import { Reaction, ReactionAdmin } from "@fobx/core";
import { useSyncExternalStore } from "react";
import { getGlobalState } from "../state/global";

const globalState = getGlobalState();

export type ObserverAdministration = {
  reaction: Reaction | null;
  state: symbol; // symbols are used as they are always unique
  name: string;
  onStoreChange: (() => void) | null;
  subscribe: Parameters<typeof useSyncExternalStore>[0];
  getSnapshot: Parameters<typeof useSyncExternalStore>[1];
};

class ObserverReactionAdmin extends ReactionAdmin {
  preventRun = false;
  constructor(effectFn: () => void, name?: string) {
    super(effectFn, name);
  }

  run(): void {
    if (this.preventRun) {
      this.dependenciesChanged = false;
      this.preventRun = false;
    } else {
      super.run();
    }
  }

  addToPendingReactions(): void {
    if (globalState.updatingReaction === this) {
      this.preventRun = true;
    }
    super.addToPendingReactions();
  }
}

export const createReaction = (adm: ObserverAdministration) => {
  // make sure state is new for reaction creation so update is guaranteed to trigger
  adm.state = Symbol();

  const effectFn = () => {
    // need to update the state before calling onStoreChange for update to trigger
    adm.state = Symbol();
    adm.onStoreChange?.();
  };

  adm.reaction = new Reaction(new ObserverReactionAdmin(effectFn, "ReactObserver"));
};
