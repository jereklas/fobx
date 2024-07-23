import { reaction } from "../../reactions/reaction";
import { $fobx } from "../../state/global";
import { isObservable, isObservableSet } from "../../utils/predicates";
import { observable } from "../observable";
import { ObservableSet, ObservableSetWithAdmin } from "../observableSet";

test("observable API for sets successfully constructs sets", () => {
  const s = observable(new Set(["a", "b"]));
  expect(s.values()).toStrictEqual(new Set(["a", "b"]).values());
  expect(isObservableSet(s)).toBe(true);

  const s2 = observable(new Set(["a", "b"]));
  expect(s2.values()).toStrictEqual(new Set(["a", "b"]).values());
  expect(isObservableSet(s2)).toBe(true);

  const s3 = observable(new Set());
  expect(s3.values()).toStrictEqual(new Set().values());
  expect(isObservableSet(s3)).toBe(true);

  const s4 = observable(new Set([1]));
  expect(s4.values()).toStrictEqual(new Set([1]).values());
  expect(isObservableSet(s4)).toBe(true);

  const s5 = observable(new Set([true, false]));
  expect(s5.values()).toStrictEqual(new Set([true, false]).values());
  expect(isObservableSet(s5)).toBe(true);
});

describe("ObservableSet", () => {
  test.each`
    fn           | expected
    ${"entries"} | ${["a", "a"]}
    ${"values"}  | ${"a"}
    ${"keys"}    | ${"a"}
  `("$fn() does not cause reaction unless the iterable.next() is called", ({ fn, expected }) => {
    const m = observable(new Set()) as ObservableSetWithAdmin;
    // @ts-expect-error
    reaction(() => m[fn](), jest.fn());
    expect(m[$fobx].observers.size).toBe(0);

    const reactionFn = jest.fn();
    reaction(() => {
      // @ts-expect-error
      return m[fn]().next().value;
    }, reactionFn);
    expect(m[$fobx].observers.size).toBe(1);
    m.add("a");
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith(expected, undefined, expect.anything());
  });

  test("reaction to set as a collection works as expected", () => {
    const m = observable(new Set());
    const reactionFn = jest.fn();
    reaction(() => m, reactionFn);
    expect(reactionFn).toHaveBeenCalledTimes(0);

    m.add(1);
    expect(reactionFn).toHaveBeenCalledTimes(1);
    // assigning something that already is in map doesn't cause reaction
    m.add(1);
    expect(reactionFn).toHaveBeenCalledTimes(1);

    m.add(2);
    expect(reactionFn).toHaveBeenCalledTimes(2);
    m.delete(2);
    expect(reactionFn).toHaveBeenCalledTimes(3);
    m.clear();
    expect(reactionFn).toHaveBeenCalledTimes(4);
  });
});

test("ObservableSet makes values observable", () => {
  const set = new ObservableSet([{ a: "a" }]);
  set.add({ a: "b" });
  const values = Array.from(set);

  // initial value and set values are observable
  expect(isObservable(values[0], "a")).toBe(true);
  expect(isObservable(values[1], "a")).toBe(true);
});

test("ObservableSet does not make values observable when shallow = true", () => {
  const set = new ObservableSet([{ a: "a" }], { shallow: true });
  set.add({ a: "b" });
  const values = Array.from(set);

  // neither initial values or set values are observable
  expect(isObservable(values[0], "a")).toBe(false);
  expect(isObservable(values[1], "a")).toBe(false);
});
