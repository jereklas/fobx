import * as fobx from "../index.ts"
import * as internals from "../internals.ts"
import { expect, test } from "@fobx/testing"

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toEqual([
    "UNDEFINED",
    "autorun",
    "computed",
    "configure",
    "createSelector",
    "flow",
    "isComputed",
    "isFlow",
    "isObservable",
    "isObservableArray",
    "isObservableBox",
    "isObservableCollection",
    "isObservableMap",
    "isObservableObject",
    "isObservableSet",
    "isPlainObject",
    "isTransaction",
    "makeObservable",
    "observable",
    "observableArray",
    "observableBox",
    "observableMap",
    "observableSet",
    "reaction",
    "runInTransaction",
    "runWithoutTracking",
    "transaction",
    "when",
  ].sort())
})

test("internals has expected exports", () => {
  expect(Object.keys(internals).sort()).toEqual([
    "$fobx",
    "createTracker",
    "deleteObserver",
    "effect",
    "endBatch",
    "recycleReaction",
    "setActiveScope",
    "startBatch",
    "subscribe",
  ].sort())
})
