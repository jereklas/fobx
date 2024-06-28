interface GlobalState {
  /**
   * Tracks the current observer reaction that is in the process of updating (i.e. in middle of react render)
   */
  updatingReaction: unknown;
}

const $react = Symbol.for("fobx-react");

export function getGlobalState(): GlobalState {
  // @ts-expect-error - global def doesn't know about $fobx symbol
  if (globalThis[$react] !== undefined) return globalThis[$react];

  const state: GlobalState = {
    updatingReaction: null,
  };

  Object.defineProperty(globalThis, $react, {
    value: state,
  });

  return state;
}
