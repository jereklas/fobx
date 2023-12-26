import { Reaction } from "@fobx/core";
import { useSyncExternalStore, useRef } from "react";
import { observerFinalizationRegistry } from "./finalizationRegistry";

type ObserverAdministration = {
  reaction: Reaction | null;
  state: symbol; // symbols are used as they are always unique
  name: string;
  onStoreChange: (() => void) | null;
  subscribe: Parameters<typeof useSyncExternalStore>[0];
  getSnapshot: Parameters<typeof useSyncExternalStore>[1];
};

const createReaction = (adm: ObserverAdministration) => {
  // make sure state is new for reaction creation so update is guaranteed to trigger
  adm.state = Symbol();

  adm.reaction = new Reaction(() => {
    // need to update the state before calling onStoreChange for update to trigger
    adm.state = Symbol();
    adm.onStoreChange?.();
  });
};

// required for SSR hydration
const getServerSnapshot = () => {};

export const useObserver = <T>(render: () => T, baseComponentName: string = "observed") => {
  const admRef = useRef<ObserverAdministration>();

  // first render - create and assign the administration ref
  if (!admRef.current) {
    const adm: ObserverAdministration = {
      reaction: null,
      state: Symbol(),
      name: baseComponentName,
      onStoreChange: null,
      subscribe: (onStoreChange) => {
        // being here means the component was mounted, unregister the administration so reaction
        // wont be disposed by the finalization registry
        observerFinalizationRegistry.unregister(adm);
        adm.onStoreChange = onStoreChange;

        // Reaction was disposed before mount, occurs when:
        // 1. observerFinalizationRegistry disposes prior to component mount.
        // 2. React "re-mounts" same component without calling render in between (StrictMode/ConcurrentMode/Suspense).
        if (!adm.reaction) {
          createReaction(adm);
        }

        // cleanup function
        return () => {
          adm.onStoreChange = null;
          adm.reaction?.dispose();
          adm.reaction = null;
        };
      },
      getSnapshot: () => {
        return adm.state;
      },
    };
    admRef.current = adm;
  }

  const adm = admRef.current!;
  // first render - create the reaction
  if (!adm.reaction) {
    createReaction(adm);
    // StrictMode/ConcurrentMode/Suspense could mean component is rendered and abandoned multiple
    // times. Track the reaction so it can be disposed if it was abandoned (prevent memory leaks)
    observerFinalizationRegistry.register(adm);
  }

  useSyncExternalStore(adm.subscribe, adm.getSnapshot, getServerSnapshot);

  // closure to keep the render result/exception within the react function scope
  let renderResult!: T;
  let exception;
  adm.reaction!.track(() => {
    try {
      renderResult = render();
    } catch (e) {
      // DO NOT throw here, needs to be thrown below
      exception = e;
    }
  });

  // render exception has to be thrown within react function scope to trigger react's error boundary
  if (exception) {
    throw exception;
  }

  return renderResult;
};
