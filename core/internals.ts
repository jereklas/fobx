// Low-level primitives for framework integration packages (@fobx/react, @fobx/dom, etc.).
// Not intended for direct use by application code — prefer @fobx/core instead.

export {
  $fobx,
  buildDebugMermaidGraph,
  buildDebugTextReport,
  buildDebugTraceSummary,
  configureDebugTracking,
  createTracker,
  deleteObserver,
  effect,
  endBatch,
  explainDebugTarget,
  getDebugSnapshot,
  recycleReaction,
  resetDebugTracking,
  setActiveScope,
  startBatch,
  subscribe,
} from "./core.ts"

export type { Tracker } from "./core.ts"
export type { Dispose, ObservableAdmin } from "./core.ts"
export type {
  DebugEventSnapshot,
  DebugExplanation,
  DebugNodeSnapshot,
  DebugOptions,
  DebugSnapshot,
  DebugTraceEventSummary,
  DebugTraceNodeSnapshot,
  DebugTraceOptions,
  DebugTraceSummary,
  DebugValueSummary,
} from "./core.ts"
