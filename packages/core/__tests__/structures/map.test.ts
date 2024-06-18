import * as fobx from "../../src";
import { $fobx } from "../../src/state/global";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

test("observable API for maps successfully constructs map", () => {
  const original = new Map([
    [1, 1],
    [2, 2],
  ]);
  const m = fobx.observable(original);
  expect(m).not.toBe(original);
  expect(m.entries()).toStrictEqual(original.entries());
  expect(fobx.isObservableMap(m)).toBe(true);

  const m2 = fobx.observable(original);
  expect(m2.entries()).toStrictEqual(original.entries());
  expect(fobx.isObservableMap(m2)).toBe(true);

  const m3 = fobx.observable(new Map());
  expect(m3.entries()).toStrictEqual(new Map().entries());
  expect(fobx.isObservableMap(m3)).toBe(true);

  const m4 = fobx.observable(new Map([["a", true]]));
  expect(m4.entries()).toStrictEqual(new Map([["a", true]]).entries());
  expect(fobx.isObservableMap(m4)).toBe(true);

  const m5 = fobx.observable(new Map([["a", "a"]]));
  expect(m5.entries()).toStrictEqual(new Map([["a", "a"]]).entries());
  expect(fobx.isObservableMap(m5)).toBe(true);

  const m6 = fobx.observable(new Map([["a", "a"]]));
  expect(m6.entries()).toStrictEqual(new Map([["a", "a"]]).entries());
  expect(fobx.isObservableMap(m6)).toBe(true);
});

describe("ObservableMap", () => {
  test.each`
    fn           | expected
    ${"entries"} | ${["a", "v"]}
    ${"values"}  | ${"v"}
    ${"keys"}    | ${"a"}
  `("$fn() does not cause reaction unless the iterable.next() is called", ({ fn, expected }) => {
    const m = fobx.observable(new Map());
    fobx.reaction(() => m[fn](), jest.fn());
    expect(m[$fobx].observers.size).toBe(0);

    const reactionFn = jest.fn();
    fobx.reaction(() => {
      return m[fn]().next().value;
    }, reactionFn);
    m.set("a", "v");
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith(expected, undefined, expect.anything());
  });

  test("reaction to map as a collection work as expected", () => {
    const m = fobx.observable(new Map());
    const reactionFn = jest.fn();
    fobx.reaction(() => m, reactionFn);
    expect(reactionFn).toHaveBeenCalledTimes(0);

    m.set(1, 1);
    expect(reactionFn).toHaveBeenCalledTimes(1);
    // assigning something that already is in map doesn't cause reaction
    m.set(1, 1);
    expect(reactionFn).toHaveBeenCalledTimes(1);

    m.set(1, 2);
    expect(reactionFn).toHaveBeenCalledTimes(2);
    m.set(2, 3);
    expect(reactionFn).toHaveBeenCalledTimes(3);
    m.delete(2);
    expect(reactionFn).toHaveBeenCalledTimes(4);
    m.clear();
    expect(reactionFn).toHaveBeenCalledTimes(5);
  });
});
