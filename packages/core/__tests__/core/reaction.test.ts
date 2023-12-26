import type { ObservableValueWithAdmin, IReaction } from "../../src/types";

import * as fobx from "../../src";
import { $fobx } from "../../src/state/global";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

describe("Reaction", () => {
  test("observables are tracked as expected", () => {
    const sideEffectFn = jest.fn();
    const val1 = fobx.observable("a") as ObservableValueWithAdmin;
    const val2 = fobx.observable(1) as ObservableValueWithAdmin;
    const val3 = fobx.observable(true) as ObservableValueWithAdmin;
    const dispose = fobx.reaction(() => {
      return [val1.value, val2.value, val3.value];
    }, sideEffectFn);

    expect(val1[$fobx].observers.size).toBe(1);
    expect(val2[$fobx].observers.size).toBe(1);
    expect(val3[$fobx].observers.size).toBe(1);
    dispose();
  });
});

describe("reaction", () => {
  test("side effect function is ran when observable value(s) change", () => {
    const val1 = fobx.observable(1);
    const val2 = fobx.observable(2);
    const sideEffectFn1 = jest.fn();
    let dispose = fobx.reaction(() => {
      return [val1.value, val2.value];
    }, sideEffectFn1);
    // change first observable
    val1.value = 3;
    expect(sideEffectFn1).toHaveBeenCalledTimes(1);
    expect(sideEffectFn1).toHaveBeenCalledWith([3, 2], [1, 2], expect.anything());

    // change second observable
    sideEffectFn1.mockClear();
    val2.value = 1;
    expect(sideEffectFn1).toHaveBeenCalledTimes(1);
    expect(sideEffectFn1).toHaveBeenCalledWith([3, 1], [3, 2], expect.anything());
    dispose();

    // reaction with single value
    const sideEffectFn2 = jest.fn();
    dispose = fobx.reaction(() => {
      return val1.value;
    }, sideEffectFn2);
    val1.value = 10;
    expect(sideEffectFn2).toHaveBeenCalledTimes(1);
    expect(sideEffectFn2).toHaveBeenCalledWith(10, 3, expect.anything());
    dispose();
  });

  test("side effect function is not ran when observable is re-assigned same value", () => {
    const obs = fobx.observable(1);
    const sideEffectFn = jest.fn();
    const dispose = fobx.reaction(() => obs.value, sideEffectFn);
    obs.value = 1;
    expect(sideEffectFn).not.toHaveBeenCalled();
    dispose();
  });

  test("dispose removes observables from being tracked and prevents sideEffectFn from being called", () => {
    const val = fobx.observable(0) as ObservableValueWithAdmin;
    let r!: IReaction;
    const sideEffectFn = jest.fn((o, n, reaction) => {
      r = reaction;
    });
    const dispose = fobx.reaction(() => {
      return val.value;
    }, sideEffectFn);
    // value change caused sideEffectFn to run
    val.value = 10;
    expect(val[$fobx].observers.size).toBe(1);
    expect(val[$fobx].observers.has(r[$fobx])).toBe(true);
    expect(r[$fobx].dependencies.length).toBe(1);
    expect(r[$fobx].dependencies.indexOf(val[$fobx])).not.toBe(-1);
    expect(sideEffectFn).toHaveBeenCalledTimes(1);
    expect(sideEffectFn).toHaveBeenCalledWith(10, 0, r);

    // dispose removes tracking
    sideEffectFn.mockClear();
    dispose();
    expect(val[$fobx].observers.size).toBe(0);
    expect(r[$fobx].dependencies.length).toBe(0);
    // value change doesn't cause sideEffectFn to run
    val.value = 5;
    expect(sideEffectFn).not.toHaveBeenCalled();
  });
});
