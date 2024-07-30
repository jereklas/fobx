import { $fobx } from "../../state/global";
import { observableBox } from "../../observables/observableBox";
import { isComputed, isObservable, isObservableCollection, isObservableObject, isPlainObject } from "../predicates";
import { observable } from "../../observables/observable";

describe("isPlainObject", () => {
  test("returns false when non-object is passed", () => {
    expect(isPlainObject("str")).toBe(false);
  });

  test("returns true for objects with a null prototype", () => {
    expect(isPlainObject(Object.create(null))).toBe(true);
  });
});

describe("isObservableObject", () => {
  test("returns false when non-object is passed", () => {
    expect(isObservableObject("str")).toBe(false);
  });

  test("returns false when object has invalid administration ", () => {
    expect(isObservableObject({ [$fobx]: "str" })).toBe(false);
  });
});

describe("isComputed", () => {
  test("returns false when no administration exists on the object", () => {
    expect(isComputed({})).toBe(false);
  });

  test("returns false when administration is invalid", () => {
    expect(isComputed({ [$fobx]: "str" })).toBe(false);
  });
});

describe("isObservableCollection", () => {
  test("returns false when administration is invalid", () => {
    const arr = [1];
    Object.defineProperty(arr, $fobx, { value: "str" });
    expect(isObservableCollection(arr)).toBe(false);
  });
});

test("isObservable works as expected", () => {
  const primitives = [0, "a", true, Symbol(), BigInt(Number.MAX_SAFE_INTEGER)];

  primitives.forEach((i) => {
    expect(isObservable(i)).toBe(false);
  });

  primitives.forEach((i) => {
    const obs = observableBox(i);
    expect(isObservable(obs)).toBe(true);
  });

  // objects/collections
  class NonObservableClass {}
  const objects = [[], new Set(), new Map(), new NonObservableClass(), {}];

  objects.forEach((i) => {
    expect(isObservable(i)).toBe(false);
  });

  // remove the object and class as they become a container of observable values but they
  // themselves are not observable
  objects.pop();
  objects.pop();

  objects.forEach((i) => {
    const obs = observable(i);
    expect(isObservable(obs)).toBe(true);
  });

  expect(isObservable(observable({}))).toBe(false);
  expect(isObservable(new NonObservableClass())).toBe(false);
});
