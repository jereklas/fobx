interface GlobalState {
  /**
   * This flag is significant to prevent a secondary render when a state change occurs during an
   * active render cycle.
   */
  preventAddingToPendingReactions: boolean;
}

const $react = Symbol.for("fobx-react");

export function getGlobalState(): GlobalState {
  // @ts-expect-error - global def doesn't know about $fobx symbol
  if (globalThis[$react] !== undefined) return globalThis[$react];

  const state: GlobalState = {
    preventAddingToPendingReactions: false,
  };

  Object.defineProperty(globalThis, $react, {
    value: state,
  });

  return state;
}
