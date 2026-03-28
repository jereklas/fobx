// Low-level primitives for framework integration packages (@fobx/react, @fobx/dom, etc.).
// Not intended for direct use by application code — prefer @fobx/core instead.

export { effect, subscribe } from "./reactions/autorun.ts"
export { recycleReaction } from "./reactions/autorun.ts"
export { createTracker } from "./reactions/tracker.ts"
export type { Tracker } from "./reactions/tracker.ts"
export { endBatch, startBatch } from "./transactions/batch.ts"
export { $fobx, deleteObserver, setActiveScope } from "./state/global.ts"
export type { Dispose, ObservableAdmin } from "./state/global.ts"
