// Configuration
export { configure } from "./instance.ts"

// Primitives
export { box, getBoxValue, setBoxValue } from "./box.ts"
export { computed } from "./computed.ts"
export { autorun } from "./autorun.ts"
export { reaction, UNDEFINED } from "./reaction.ts"
export { when } from "./when.ts"
export { map } from "./map.ts"
export { array } from "./array.ts"
export { set } from "./set.ts"
export {
  extendObservable,
  makeObservable,
  object,
  observable,
} from "./object.ts"

// Batching
export { runInTransaction, transaction, transactionBound } from "./batch.ts"

// Tracking utilities
export { withoutTracking } from "./tracking.ts"

// Utilities
export {
  hasFobxAdmin,
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
export type { WhenOptions } from "./when.ts"
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
export { POSSIBLY_STALE, STALE, UP_TO_DATE } from "./global.ts"
export type {
  ComputedAdmin,
  Dispose,
  FobxAdmin,
  ObservableAdmin,
  ReactionAdmin,
} from "./global.ts"
