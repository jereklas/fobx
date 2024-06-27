import * as fobx from "../../src";
import { endAction, startAction } from "../../src/transactions/action";
import { grabConsole, suppressConsole } from "../utils";

beforeEach(() => {
  fobx.configure({ enforceActions: false });
});

test("multiple state changes can occur within an action with only 1 side effect", () => {
  const obs = fobx.observable(0);

  const increment = fobx.action((by: number) => {
    obs.value += by * 2;
    obs.value -= by;
  });

  const reactionFn = jest.fn();
  const d = fobx.reaction(() => obs.value, reactionFn);

  increment(7);

  expect(reactionFn).toHaveBeenCalledTimes(1);
  expect(reactionFn).toHaveBeenCalledWith(7, 0, expect.anything());
  d();
});

test("actions can safely use externally scoped variables", () => {
  const obs = fobx.observable(1);
  let i = 3;
  let b = 0;

  const d = fobx.reaction(
    () => obs.value * 2,
    (newValue) => {
      b = newValue;
    }
  );

  const act = fobx.action(() => {
    obs.value = ++i;
  });

  expect(b).toBe(0);
  act();
  expect(b).toBe(8);
  act();
  expect(b).toBe(10);
  d();
});

test("actions setting observables read by computed result in correct value", () => {
  const obs = fobx.observable(1);
  const double = fobx.computed(() => obs.value * 2);
  let b = 0;

  const d = fobx.reaction(
    () => double.value,
    (newVal) => {
      b = newVal;
    },
    { fireImmediately: true }
  );

  const act = fobx.action(() => {
    obs.value += 1;
  });

  expect(b).toBe(2);
  act();
  expect(b).toBe(4);
  act();
  expect(b).toBe(6);
  d();
});

test("action is untracked", () => {
  const a = fobx.observable(3);
  const b = fobx.observable(4);

  let latest = 0;
  let runs = 0;

  const act = fobx.action((baseValue: number) => {
    b.value = baseValue * 2;
    latest = b.value;
  });

  const d = fobx.autorun(() => {
    runs++;
    const current = a.value;
    act(current);
  });

  expect(b.value).toBe(6);
  expect(latest).toBe(6);

  a.value = 7;
  expect(b.value).toBe(14);
  expect(latest).toBe(14);

  a.value = 8;
  expect(b.value).toBe(16);
  expect(latest).toBe(16);

  b.value = 7;
  expect(a.value).toBe(8);
  expect(b.value).toBe(7);
  expect(latest).toBe(16);

  a.value = 3;
  expect(b.value).toBe(6);
  expect(latest).toBe(6);

  expect(runs).toBe(4);
  d();
});

test("should be able to create autorun within action", () => {
  const a = fobx.observable(1);
  const values: number[] = [];

  const adder = fobx.action((inc: number) => {
    return fobx.autorun(() => {
      values.push(a.value + inc);
    });
  });

  const d1 = adder(2);
  a.value = 3;

  const d2 = adder(17);
  a.value = 24;
  d1();
  a.value = 11;
  d2();
  a.value = 100;

  expect(values).toStrictEqual([3, 5, 20, 26, 41, 28]);
});

test("should be able to change unobserved state in an action called from a computed", () => {
  const a = fobx.observable(2);
  const testAction = fobx.action(() => {
    a.value = 3;
  });
  const c = fobx.computed(() => {
    testAction();
  });
  const d = fobx.autorun(() => {
    c.value;
  });

  expect(a.value).toBe(3);
  d();
});

test("should be able to change observed state in an action called from a computed", () => {
  fobx.configure({ enforceActions: true });

  const a = fobx.observable(2);
  const d = fobx.autorun(() => {
    a.value;
  });
  const testAction = fobx.action(() => {
    a.value = 5;
    expect(a.value).toBe(5);
  });

  const c = fobx.computed(() => {
    // changing value outside of action issues a warning, but still changes the value.
    expect(
      grabConsole(() => {
        a.value = 4;
      })
    ).toMatch(
      /<STDOUT> \[@fobx\/core\] Changing tracked observable values \(ObservableValue@.*\) outside of an action is discouraged as reactions run more frequently than necessary/
    );
    expect(a.value).toBe(4);

    // changing a value inside of an action does not issue a warning
    expect(grabConsole(testAction)).toStrictEqual("");
    return a.value;
  });

  expect(c.value).toBe(5);
  d();
});

test("action should not be converted to computed when using (extend)observable", () => {
  const a = fobx.observable({
    a: 1,
    b: fobx.action(function () {
      this.a++;
    }),
  });

  expect(fobx.isComputed(a.b)).toBe(false);
  expect(fobx.isAction(a.b)).toBe(true);
  a.b();
  expect(a.a).toBe(2);

  fobx.extendObservable(a, {
    c: fobx.action(function () {
      this.a *= 3;
    }),
  });

  // here to remove typescript type errors when accessing "c" below
  if (!("c" in a)) throw Error("failed to extend");
  if (typeof a.c !== "function") throw Error("failed to extend");

  expect(fobx.isComputed(a.c)).toBe(false);
  expect(fobx.isAction(a.c)).toBe(true);
  a.c();
  expect(a.a).toBe(6);
});

test("exceptions thrown inside of action should not effect global state", () => {
  let autorunTimes = 0;
  function Todos() {
    fobx.extendObservable(this, {
      count: 0,
      add: fobx.action(function () {
        this.count++;
        if (this.count === 2) {
          throw new Error("An Action Error!");
        }
      }),
    });
  }
  const todo = new Todos();

  fobx.autorun(() => {
    autorunTimes++;
    return todo.count;
  });
  try {
    todo.add();
    expect(autorunTimes).toBe(2);
    todo.add();
  } catch (e) {
    expect(autorunTimes).toBe(3);
    todo.add();
    expect(autorunTimes).toBe(4);
  }
  // this makes sure that the catch block was in fact hit.
  expect.assertions(3);
});

test("runInAction", () => {
  fobx.configure({ enforceActions: true });
  const values: number[] = [];

  const obs = fobx.observable(0);
  const d = fobx.autorun(() => values.push(obs.value));

  let result = fobx.runInAction(() => {
    obs.value += 6 * 2;
    obs.value -= 3;
    return 2;
  });

  expect(result).toBe(2);
  expect(values).toStrictEqual([0, 9]);

  result = fobx.runInAction(() => {
    obs.value += 5 * 2;
    obs.value -= 4;
    return 3;
  });

  expect(result).toBe(3);
  expect(values).toStrictEqual([0, 9, 15]);
  d();
});

test("action in autorun does not keep / make computed values alive", () => {
  let calls = 0;
  const c = fobx.computed(() => {
    calls++;
  });
  const callComputedTwice = () => {
    c.value;
    c.value;
  };

  const runWithMemoizing = (fun) => {
    fobx.autorun(fun)();
  };

  callComputedTwice();
  expect(calls).toBe(2);

  runWithMemoizing(callComputedTwice);
  expect(calls).toBe(3);

  callComputedTwice();
  expect(calls).toBe(5);

  runWithMemoizing(() => {
    fobx.runInAction(callComputedTwice);
  });
  expect(calls).toBe(6);

  callComputedTwice();
  expect(calls).toBe(8);
});

test("computed values and actions", () => {
  let calls = 0;

  const number = fobx.observable(1);
  const squared = fobx.computed(() => {
    calls++;
    return number.value * number.value;
  });

  const changeNumber10Times = fobx.action(() => {
    squared.value;
    squared.value;
    for (let i = 0; i < 10; i++) {
      number.value += 1;
    }
  });

  changeNumber10Times();
  expect(calls).toBe(1);

  fobx.autorun(() => {
    changeNumber10Times();
    expect(calls).toBe(2);
  })();
  expect(calls).toBe(2);

  changeNumber10Times();
  expect(calls).toBe(3);
});

test("observable respects action annotations", () => {
  const x = fobx.observable(
    {
      a1() {
        return this;
      },
      a2() {
        return this;
      },
      a3() {
        return this;
      },
    },
    {
      a1: "action",
      a2: "action.bound",
      a3: "none",
    }
  );

  const { a1, a2, a3 } = x;
  // plain action should behave as non-annotated function with respect to 'this'
  expect(fobx.isAction(x.a1)).toBe(true);
  expect(a1()).toBe(global);
  expect(a1.call(x)).toBe(x);
  expect(fobx.isAction(x.a3)).toBe(false);
  expect(a3()).toBe(global);
  expect(a3.call(x)).toBe(x);

  // a2 is bound so calling it with another "this" doesn't result in x changing.
  expect(fobx.isAction(x.a2)).toBe(true);
  expect(a2()).toBe(x);
  expect(a2.call({})).toBe(x);
});

test("expect warning for invalid decorator", () => {
  expect(() => {
    // @ts-expect-error - purposefully passing something not supported by the type definition
    fobx.observable({ x: 1 }, { x: "bad" });
  }).toThrow(/is not a valid annotation./);
});

test("bound actions bind", () => {
  let called = 0;
  const src = {
    y: 0,
    z: function (v) {
      this.y += v;
      this.y += v;
    },
    get yValue() {
      called++;
      return this.y;
    },
  };

  const x = fobx.observable(src, {
    z: "action.bound",
  });

  const d = fobx.autorun(() => {
    x.yValue;
  });
  const runner = x.z;
  runner(3);
  expect(x.yValue).toBe(6);
  expect(called).toBe(2);

  expect(Object.keys(src)).toEqual(["y", "z", "yValue"]);
  expect(Object.keys(x)).toEqual(["y", "z", "yValue"]);

  d();
});

test("make sure extendObservable correctly annotates action if source isn't an observable object", () => {
  const x = fobx.extendObservable(
    {},
    {
      method() {},
    },
    { method: "action" }
  );
  x.method();
  expect(fobx.isAction(x.method)).toBe(true);
});

test("reaction errors should be suppressed if action threw an error first", () => {
  const messages = suppressConsole(() => {
    try {
      const a = fobx.observable(3);
      fobx.autorun(() => {
        if (a.value === 4) throw new Error("Reaction error");
      });

      fobx.action(() => {
        a.value = 4;
        throw new Error("Action error");
      })();
    } catch (e) {
      expect(e.toString()).toEqual("Error: Action error");
      console.error(e);
    }
  });

  expect(messages).toStrictEqual([
    "<STDERR> [@fobx/core] Reaction's exception was suppressed because an action threw an error first. Fix the action's error below first.",
    "<STDERR> Error: Action error",
  ]);
});

test("reaction errors should not be suppressed if action didn't throw an error", () => {
  const message = grabConsole(() => {
    const a = fobx.observable(3);
    fobx.autorun(() => {
      if (a.value === 4) throw new Error("Reaction error");
    });

    fobx.action(() => {
      a.value = 4;
    })();
  });

  expect(message).toMatch(/<STDERR> \[@fobx\/core\] "Autorun@.*" threw an exception/);
});

test("out of order startAction / endAction", () => {
  // no action has started
  expect(() => endAction()).toThrow("invalid endAction call");

  // action has started, but 2 endAction calls occurs
  startAction();
  endAction();
  expect(() => endAction()).toThrow("invalid endAction call");
});

test("given actionName, the action function name should be defined as the actionName", () => {
  const a1 = fobx.action(() => {}, { name: "testAction" });
  expect(a1.name).toBe("testAction");
});

test("given anonymous action, the action name should be <unnamed action>", () => {
  const a1 = fobx.action(() => {});
  expect(a1.name).toBe("<unnamed action>");
});

test("given function declaration, the action name should be as the function name", () => {
  const a1 = fobx.action(function testAction() {});
  expect(a1.name).toBe("testAction");
});
