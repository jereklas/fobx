import * as fobx from "../../src";

beforeAll(() => {
  fobx.configure({ enforceActions: false });
});

describe("autorun subscriptions happen at end of the autorun body", () => {
  test("autorun with observable", () => {
    const o = fobx.observable(0);
    const seen: number[] = [];

    fobx.autorun(() => {
      seen.push(o.value);
      if (o.value < 5) o.value += 1;
    });
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5]);

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.value += 1;
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("autorun with computed", () => {
    const o = fobx.observable(0);
    const c = fobx.computed(
      () => o.value,
      (v) => {
        o.value = v;
      }
    );
    const seen: number[] = [];

    // make sure computed doesn't behave differently than observables with respect to subscription
    fobx.autorun(() => {
      seen.push(c.value);
      if (c.value < 5) c.value += 1;
    });
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5]);

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.value += 1;
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("autorun with observables inside of an action", () => {
    const o = fobx.observable(0);
    const seen: number[] = [];

    // autorun created inside of action behaves the same as one created outside of an action
    fobx.runInAction(() => {
      fobx.autorun(() => {
        seen.push(o.value);
        if (o.value < 5) o.value += 1;
      });
    });

    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5]);

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.value += 1;
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("autorun with observables inside of an action", () => {
    const o = fobx.observable(0);
    const c = fobx.computed(
      () => o.value,
      (v) => {
        o.value = v;
      }
    );
    const seen: number[] = [];

    // autorun created inside of
    fobx.runInAction(() => {
      fobx.autorun(() => {
        seen.push(c.value);
        if (c.value < 5) c.value += 1;
      });
    });
    // subscriptions happen at end of the autorun, making the first state change ignored
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5]);

    // now that autorun is setup, a value change will cause looping as all state updates are respected
    o.value += 1;
    expect(seen).toStrictEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
