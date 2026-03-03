import * as fobx from "../index.ts"
import { expect, test } from "@fobx/testing"

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toEqual([
    "$fobx",
    "$scheduler",
    "array",
    "autorun",
    "box",
    "computed",
    "configure",
    "createSelector",
    "createTracker",
    "effect",
    "isComputed",
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
    "map",
    "observable",
    "observerCount",
    "observerHas",
    "reaction",
    "runInTransaction",
    "set",
    "subscribe",
    "transaction",
    "when",
    "withoutTracking",
  ])
})
