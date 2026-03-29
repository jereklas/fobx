// Low-level primitives for framework integration packages (@fobx/react, @fobx/dom, etc.).
// Not intended for direct use by application code — prefer @fobx/core instead.

export {
  $fobx,
  createTracker,
  deleteObserver,
  effect,
  endBatch,
  recycleReaction,
  setActiveScope,
  startBatch,
  subscribe,
} from "./core.ts"

export type { Tracker } from "./core.ts"
export type { Dispose, ObservableAdmin } from "./core.ts"
