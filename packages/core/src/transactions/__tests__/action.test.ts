import { observableBox } from "../../observables/observableBox";
import { computed } from "../../reactions/computed";
import { reaction } from "../../reactions/reaction";
import { configure } from "../../state/instance";
import { action, runInAction } from "../action";

beforeEach(() => {
  // avoid console warnings
  configure({ enforceActions: false });
});

describe("runInAction", () => {
  test("returns the value of the supplied function", () => {
    const a1 = (a: number, b: number) => {
      return a + b;
    };

    expect(runInAction(() => a1(1, 2))).toBe(3);
  });

  test("allows multiple observables to be set with only one reaction occurring from those value changes", () => {
    const o1 = observableBox(1);
    const o2 = observableBox(2);
    const o3 = observableBox(3);
    const reactionFn = jest.fn();
    const computedFn = jest.fn(() => o1.value + o2.value + o3.value);
    const c = computed(computedFn);
    const dispose = reaction(() => {
      return [o1.value, o2.value, o3.value, c.value];
    }, reactionFn);

    // computed runs one time after being added to the reaction
    expect(computedFn).toHaveBeenCalledTimes(1);
    o1.value += 1;
    o2.value += 1;
    o3.value += 1;
    expect(computedFn).toHaveBeenCalledTimes(4);
    expect(reactionFn).toHaveBeenCalledTimes(3);
    expect(c.value).toBe(9);

    // clear call count for clarity below
    reactionFn.mockClear();
    computedFn.mockClear();
    expect(computedFn).toHaveBeenCalledTimes(0);
    expect(reactionFn).toHaveBeenCalledTimes(0);

    // action changes multiple observables, but the reactions only update once in response
    const result = runInAction(() => {
      o1.value = 5;
      o2.value = 6;
      o3.value = 7;
    });
    expect(result).toBe(undefined);
    // computed
    expect(reactionFn).toHaveBeenCalledTimes(1);
    expect(computedFn).toHaveBeenCalledTimes(1);
    expect(reactionFn).toHaveBeenCalledWith([5, 6, 7, 18], [2, 3, 4, 9], expect.anything());
    dispose();
  });
});

test("action retains original function's prototype", () => {
  const fn = () => {};
  Object.defineProperty(fn, "toString", { value: () => "abc" });
  expect(fn.toString()).toBe("abc");

  const a = action(fn);
  expect(a.toString()).toBe("abc");
});
