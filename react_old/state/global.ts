// deno-lint-ignore-file no-explicit-any

interface GlobalState {
  /**
   * Tracks the current observer reaction that is in the process of updating (i.e. in middle of react render)
   */
  updatingReaction: unknown
}

const $react = Symbol.for("fobx-react")

export function getGlobalState(): GlobalState {
  if ((globalThis as any)[$react] !== undefined) {
    return (globalThis as any)[$react]
  }

  const state: GlobalState = {
    updatingReaction: null,
  }

  Object.defineProperty(globalThis, $react, {
    value: state,
  })

  return state
}
