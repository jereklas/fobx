import * as fobx from "../../src";
import { $fobx } from "../../src/state/global";

test("observable API for sets successfully constructs sets", () => {
  const s = fobx.observable(new Set(["a", "b"]));
  expect(s.values()).toStrictEqual(new Set(["a", "b"]).values());
  expect(fobx.isObservableSet(s)).toBe(true);

  const s2 = fobx.observable(new Set(["a", "b"]));
  expect(s2.values()).toStrictEqual(new Set(["a", "b"]).values());
  expect(fobx.isObservableSet(s2)).toBe(true);

  const s3 = fobx.observable(new Set());
  expect(s3.values()).toStrictEqual(new Set().values());
  expect(fobx.isObservableSet(s3)).toBe(true);

  const s4 = fobx.observable(new Set([1]));
  expect(s4.values()).toStrictEqual(new Set([1]).values());
  expect(fobx.isObservableSet(s4)).toBe(true);

  const s5 = fobx.observable(new Set([true, false]));
  expect(s5.values()).toStrictEqual(new Set([true, false]).values());
  expect(fobx.isObservableSet(s5)).toBe(true);
});

describe("ObservableSet", () => {
  test.each`
    fn           | expected
    ${"entries"} | ${["a", "a"]}
    ${"values"}  | ${"a"}
    ${"keys"}    | ${"a"}
  `("$fn() does not cause reaction unless the iterable.next() is called", ({ fn, expected }) => {
    const m = fobx.observable(new Set());
    fobx.reaction(() => m[fn](), jest.fn());
    expect(m[$fobx].observers.size).toBe(0);

    const reactionFn = jest.fn();
    fobx.reaction(() => {
      return m[fn]().next().value;
    }, reactionFn);
    expect(m[$fobx].observers.size).toBe(1);
    m.add("a");
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith(expected, undefined, expect.anything());
  });

  test("reaction to set as a collection works as expected", () => {
    const m = fobx.observable(new Set());
    const reactionFn = jest.fn();
    fobx.reaction(() => m, reactionFn);
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
