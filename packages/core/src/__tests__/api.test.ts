import * as fobx from "..";

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toStrictEqual([
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
  ]);
});
