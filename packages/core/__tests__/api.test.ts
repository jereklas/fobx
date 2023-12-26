import * as fobx from "../src";

test("library has expected exports", () => {
  expect(Object.keys(fobx).sort()).toStrictEqual([
    "Reaction",
    "action",
    "autorun",
    "computed",
    "configure",
    "extendObservable",
    "flow",
    "getDependencyTree",
    "getObserverTree",
    "isAction",
    "isComputed",
    "isFlow",
    "isObservable",
    "isObservableArray",
    "isObservableMap",
    "isObservableObject",
    "isObservableProp",
    "isObservableSet",
    "observable",
    "reaction",
    "runInAction",
    "when",
  ]);
});
