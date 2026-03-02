// Configuration
export { configure } from "./instance.ts"

// Primitives
export { box } from "./box.ts"
export { computed } from "./computed.ts"
export { autorun } from "./autorun.ts"
export { reaction } from "./reaction.ts"
export { when } from "./when.ts"
export { map } from "./map.ts"
export { array } from "./array.ts"
export { set } from "./set.ts"
export {
  makeObservable,
  observable,
} from "./object.ts"

// Batching
export { runInTransaction, transaction } from "./batch.ts"

// Tracking utilities
export { withoutTracking } from "./tracking.ts"
export { createTracker } from "./tracker.ts"
export type { Tracker } from "./tracker.ts"

// Utilities
export {
  isComputed,
  isObservable,
  isObservableArray,
  isObservableBox,
  isObservableCollection,
  isObservableMap,
  isObservableObject,
  isObservableSet,
  isPlainObject,
  isTransaction,
} from "./utils.ts"

// Global utilities
export { $fobx } from "./global.ts"

// Types
export type { BoxOptions, ObservableBox } from "./box.ts"
export type { Computed, ComputedOptions } from "./computed.ts"
export type { AutorunOptions } from "./autorun.ts"
export type { ReactionOptions } from "./reaction.ts"
export type { WhenOptions, WhenPromise } from "./when.ts"
export type { MapOptions, ObservableMap } from "./map.ts"
export type { ArrayOptions, ObservableArray } from "./array.ts"
export type { ObservableSet, SetOptions } from "./set.ts"
export type {
  AnnotationsMap,
  AnnotationString,
  AnnotationValue,
  MakeObservableOptions,
  ObservableObjectAdmin,
  ObservableOptions,
} from "./object.ts"
export type { ConfigureOptions } from "./instance.ts"
export type { EqualityChecker, EqualityComparison } from "./global.ts"
export type {
  ComputedAdmin,
  Dispose,
  FobxAdmin,
  ObservableAdmin,
  ReactionAdmin,
} from "./global.ts"
