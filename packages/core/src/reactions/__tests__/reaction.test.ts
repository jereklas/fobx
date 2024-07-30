import { ReactionAdmin, ReactionWithoutBatch, reaction, runReactions, type ReactionWithAdmin } from "../reaction";
import { observableBox, type ObservableBoxWithAdmin } from "../../observables/observableBox";
import { $fobx, getGlobalState } from "../../state/global";
import { grabConsole } from "../../../__tests__/utils";
import { configure } from "../../state/instance";

const globalState = getGlobalState();
const onReactionError = jest.fn();
beforeEach(() => {
  onReactionError.mockClear();
  configure({ enforceActions: false, onReactionError });
});

describe("Reaction", () => {
  test("observables are tracked as expected", () => {
    const sideEffectFn = jest.fn();
    const val1 = observableBox("a") as ObservableBoxWithAdmin;
    const val2 = observableBox(1) as ObservableBoxWithAdmin;
    const val3 = observableBox(true) as ObservableBoxWithAdmin;
    const dispose = reaction(() => {
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
    const val1 = observableBox(1);
    const val2 = observableBox(2);
    const sideEffectFn1 = jest.fn();
    let dispose = reaction(() => {
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
    dispose = reaction(() => {
      return val1.value;
    }, sideEffectFn2);
    val1.value = 10;
    expect(sideEffectFn2).toHaveBeenCalledTimes(1);
    expect(sideEffectFn2).toHaveBeenCalledWith(10, 3, expect.anything());
    dispose();
  });

  test("side effect function is not ran when observable is re-assigned same value", () => {
    const obs = observableBox(1);
    const sideEffectFn = jest.fn();
    const dispose = reaction(() => obs.value, sideEffectFn);
    obs.value = 1;
    expect(sideEffectFn).not.toHaveBeenCalled();
    dispose();
  });

  test("dispose removes observables from being tracked and prevents sideEffectFn from being called", () => {
    const val = observableBox(0) as ObservableBoxWithAdmin;
    let r!: ReactionWithAdmin;
    const sideEffectFn = jest.fn((o, n, reaction) => {
      r = reaction;
    });
    const dispose = reaction(() => {
      return val.value;
    }, sideEffectFn);
    // value change caused sideEffectFn to run
    val.value = 10;
    expect(val[$fobx].observers.size).toBe(1);
    expect(val[$fobx].observers.has(r[$fobx])).toBe(true);
    expect(r[$fobx].dependencies.length).toBe(1);
    expect(r[$fobx].dependencies.indexOf(val[$fobx] as never)).not.toBe(-1);
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

test("An exception thrown in the side effect gets logged to stderr", () => {
  const a = observableBox(0);
  reaction(
    () => a.value,
    () => {
      throw Error("hmm");
    }
  );

  expect(
    grabConsole(() => {
      a.value += 1;
    })
  ).toMatch(/<STDERR> \[@fobx\/core\] "Reaction@.* threw an exception\./);
  expect(onReactionError).toHaveBeenCalledWith(Error("hmm"), expect.anything());
});

test("The non batching reaction runs as expected", () => {
  const a = observableBox(0);
  let called = -1;
  const reaction = new ReactionWithoutBatch(new ReactionAdmin(() => run()));

  const run = () => {
    reaction.track(() => {
      called += 1;
      a.value;
    });
  };
  run();
  expect(called).toBe(0);

  a.value += 1;
  expect(called).toBe(1);
});

test("runReactions issues message to stderr if reactions can't run", () => {
  const fn = jest.fn();
  let r!: ReactionWithAdmin;
  reaction((re) => {
    r = re as ReactionWithAdmin;
  }, fn);
  expect(fn).not.toHaveBeenCalled();

  const adm = r[$fobx];
  adm.canRun = () => false;

  globalState.pendingReactions.push(adm);
  expect(globalState.pendingReactions.length).toBe(1);

  expect(
    grabConsole(() => {
      runReactions();
    })
  ).toMatch("<STDERR> [@fobx/core] Failed to run all reactions. This typically means a bad circular reaction.");
});
