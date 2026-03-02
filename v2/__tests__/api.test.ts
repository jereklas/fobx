import * as fobx from "../index.ts"
import { expect, test } from "@fobx/testing"

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toEqual([
    "$fobx",
    "array",
    "autorun",
    "box",
    "computed",
    "configure",
    "createTracker",
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
    "reaction",
    "runInTransaction",
    "set",
    "transaction",
    "when",
    "withoutTracking",
  ])
})
