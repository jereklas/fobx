import { computed } from "../../reactions/computed";
import { reaction } from "../../reactions/reaction";
import { $fobx } from "../../state/global";
import { configure } from "../../state/instance";
import { isObservableArray } from "../../utils/predicates";
import { observable } from "../observable";
import { ObservableArray, ObservableArrayWithAdmin } from "../observableArray";

beforeEach(() => {
  configure({ enforceActions: false });
});

test("observable API for arrays successfully constructs arrays", () => {
  const a = observable([1, 2, 3]);
  expect(a).toStrictEqual([1, 2, 3]);
  expect(isObservableArray(a)).toBe(true);

  const a2 = observable([true, false]);
  expect(a2).toStrictEqual([true, false]);
  expect(isObservableArray(a2)).toBe(true);

  const a3 = observable([]);
  expect(a3).toStrictEqual([]);
  expect(isObservableArray(a3)).toBe(true);

  const a4 = observable(["a", "b", "c"]);
  expect(a4).toStrictEqual(["a", "b", "c"]);
  expect(isObservableArray(a4)).toBe(true);
});

describe("ObservableArray", () => {
  test("observing single index of observable array behaves as expected", () => {
    const a = observable([1, 2, 3, 4]);
    const computedFn = jest.fn(() => {
      return a[0];
    });
    const c = computed(computedFn);
    const reactionSideEffect = jest.fn();
    const reactionDataFn = jest.fn(() => a[0]);
    reaction(reactionDataFn, reactionSideEffect);
    expect(reactionDataFn).toHaveBeenCalledTimes(1);
    reactionDataFn.mockClear();

    // computed runs once something is observing it
    const reactionBasedOnComputed = jest.fn();
    const reactionDataFnBasedOnComputed = jest.fn(() => c.value);
    reaction(reactionDataFnBasedOnComputed, reactionBasedOnComputed);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1);
    expect(computedFn).toHaveBeenCalledTimes(1);
    reactionDataFnBasedOnComputed.mockClear();
    computedFn.mockClear();

    expect(computedFn).toHaveBeenCalledTimes(0);
    expect(reactionSideEffect).toHaveBeenCalledTimes(0);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0);

    a.push(5);
    expect(computedFn).toHaveBeenCalledTimes(1);
    expect(reactionDataFn).toHaveBeenCalledTimes(1);
    expect(reactionSideEffect).toHaveBeenCalledTimes(0);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(0);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0);

    // everything updates because exact index being observed changes
    a[0] = 10;
    expect(computedFn).toHaveBeenCalledTimes(2);
    expect(reactionDataFn).toHaveBeenCalledTimes(2);
    expect(reactionSideEffect).toHaveBeenCalledTimes(1);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1);

    // reaction + computed re-run because array changed, but reaction based on computed doesn't
    a[1] = 11;
    expect(computedFn).toHaveBeenCalledTimes(3);
    expect(reactionDataFn).toHaveBeenCalledTimes(3);
    expect(reactionSideEffect).toHaveBeenCalledTimes(1);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1);

    // assigning length to zero removes all array data
    a.length = 0;
    expect(a.at(0)).toBe(undefined);
    expect(computedFn).toHaveBeenCalledTimes(4);
    expect(reactionDataFn).toHaveBeenCalledTimes(4);
    expect(reactionSideEffect).toHaveBeenCalledTimes(2);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(2);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(2);

    // pushing a value to the empty array still causes reactions to run
    a.push(1);
    expect(a.at(0)).toBe(1);
    expect(computedFn).toHaveBeenCalledTimes(5);
    expect(reactionDataFn).toHaveBeenCalledTimes(5);
    expect(reactionSideEffect).toHaveBeenCalledTimes(3);
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(3);
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(3);
  });

  test("Array.from(observableArray) should always trigger reaction", () => {
    const a = observable<number>([]);
    const reactionFn = jest.fn();
    reaction(() => Array.from(a), reactionFn);
    a[0] = 1;
    a[0] = 2;
    expect(reactionFn).toHaveBeenCalledTimes(2);
  });

  test("a reaction returning an observable array should run reaction when mutation occurs", () => {
    const a = observable([] as number[]);
    const reactionFn = jest.fn();
    reaction(() => a, reactionFn);
    a[0] = 1;
    expect(reactionFn).toHaveBeenCalledTimes(1);
    // assigning same value to index doesn't cause change
    a[0] = 1;
    expect(reactionFn).toHaveBeenCalledTimes(1);

    a[0] = 2;
    expect(reactionFn).toHaveBeenCalledTimes(2);
    a.push(1);
    expect(reactionFn).toHaveBeenCalledTimes(3);
    a.sort();
    expect(reactionFn).toHaveBeenCalledTimes(4);
  });

  test("multiple observable arrays can exist without state bleeding between them", () => {
    const a = observable([1, 2, 3]);
    const b = observable([4, 5, 6]);

    const reactionFn = jest.fn();
    reaction(() => {
      return [a.length, b.length];
    }, reactionFn);
    expect(reactionFn).not.toHaveBeenCalled();

    a.push(4);
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith([4, 3], [3, 3], expect.anything());
    expect(a).toStrictEqual([1, 2, 3, 4]);
    expect(b).toStrictEqual([4, 5, 6]);

    a.push(5);
    expect(reactionFn).toHaveBeenCalledTimes(2);
    expect(reactionFn).toHaveBeenCalledWith([5, 3], [4, 3], expect.anything());
    expect(a).toStrictEqual([1, 2, 3, 4, 5]);

    b.push(10);
    expect(reactionFn).toHaveBeenCalledTimes(3);
    expect(reactionFn).toHaveBeenCalledWith([5, 4], [5, 3], expect.anything());
    expect(a).toStrictEqual([1, 2, 3, 4, 5]);
    expect(b).toStrictEqual([4, 5, 6, 10]);
  });

  test("previous and current values on reaction are as expected from change to array", () => {
    const a = observable([1, 2, 3]);
    const reactionFn = jest.fn();
    reaction(() => {
      return a.map((v) => v * 2);
    }, reactionFn);
    expect(reactionFn).toHaveBeenCalledTimes(0);

    a.push(4);
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith(
      [2, 4, 6, 8],
      [2, 4, 6],
      expect.anything(),
    );
  });

  test("length property is correctly observable", () => {
    const a = observable<string>([]);
    const reactionFn = jest.fn();
    reaction(() => a.length, reactionFn);

    expect(reactionFn).toHaveBeenCalledTimes(0);
    a.push("a");
    expect(reactionFn).toHaveBeenCalledTimes(1);
  });

  test.each`
    fn           | expected
    ${"values"}  | ${5}
    ${"entries"} | ${[0, 5]}
    ${"keys"}    | ${0}
  `(
    "$fn() does not cause reaction unless the iterable.next() is called",
    ({ fn, expected }: { fn: keyof Array<number>; expected: number }) => {
      const a = observable([] as number[]) as ObservableArrayWithAdmin;
      reaction(() => a[fn](), jest.fn());
      expect(a[$fobx].observers.length).toBe(0);

      const reactionFn = jest.fn();
      reaction(() => {
        return a[fn]().next().value;
      }, reactionFn);
      a.push(5);
      expect(reactionFn).toHaveBeenCalledTimes(1);
      expect(reactionFn).toHaveBeenCalledWith(
        expected,
        undefined,
        expect.anything(),
      );
    },
  );

  test.each`
    fn           | args
    ${"concat"}  | ${[]}
    ${"filter"}  | ${[(v: number) => v]}
    ${"flat"}    | ${[]}
    ${"flatMap"} | ${[(v: number) => v]}
    ${"map"}     | ${[(v: number) => v]}
    ${"slice"}   | ${[]}
    ${"splice"}  | ${[]}
  `(
    "$fn should return non-observable array (it creates a copy)",
    ({ fn, args }) => {
      const a = observable([1, 2, 3]) as ObservableArray;
      const result = a[fn](...args);
      // the functions return
      expect(result !== a).toBe(true);
      expect(!isObservableArray(result)).toBe(true);
    },
  );

  test.each`
    fn              | args
    ${"toReversed"} | ${[]}
    ${"toSorted"}   | ${[]}
    ${"toSpliced"}  | ${[]}
    ${"with"}       | ${[]}
  `("$fn should return new Array (non observable)", ({ fn, args }) => {
    const a = observable([1, 2, 3]) as ObservableArray;
    const result = a[fn](...args);
    // the functions return
    expect(result !== a).toBe(true);
    expect(!isObservableArray(result)).toBe(true);
  });
});
