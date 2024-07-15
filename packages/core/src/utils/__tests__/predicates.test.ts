import { $fobx } from "../../fobx";
import { isComputed, isObservableCollection, isObservableObject, isPlainObject } from "../predicates";

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
