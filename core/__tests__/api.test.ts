import * as fobx from "../index.ts"
import { expect, test } from "@fobx/testing"

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toEqual([
    "Reaction",
    "ReactionAdmin",
    "action",
    "autorun",
    "computed",
    "configure",
    "extendObservable",
    "flow",
    "getGlobalState",
    "isAction",
    "isComputed",
    "isFlow",
    "isObservable",
    "isObservableArray",
    "isObservableMap",
    "isObservableObject",
    "isObservableSet",
    "observable",
    "observableBox",
    "reaction",
    "runInAction",
    "when",
  ])
})
