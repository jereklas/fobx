import { observable } from "../../observables/observable";
import { autorun } from "../../reactions/autorun";
import { configure } from "../../state/instance";

configure({ enforceActions: false });

test("computed values correctly re-compute after a suspended state", () => {
  const o = observable({
    _a: 1,
    get a() {
      return this._a;
    },
    set a(val: number) {
      this._a = val;
    },
  });

  let value = 0;
  let dispose = autorun(() => {
    value = o.a;
  });
  expect(value).toBe(1);

  // make o.a become "suspended" and then set a new value on the computed
  dispose();
  o.a = 4;

  // make o.a become "active" again to verify the value seen in the autorun is not the cached value
  dispose = autorun(() => {
    value = o.a;
  });
  expect(value).toBe(4);
});

test("computed values correctly re-compute after a suspended state #2", () => {
  const o = observable({
    _a: 1,
    c: false,
    get a() {
      if (this.c) {
        return this._a;
      }
      return this.b;
    },

    get b() {
      return this._b;
    },
    _b: 2,
  });

  let value = 0;
  autorun(() => {
    value = o.a;
  });
  expect(value).toBe(2);

  o.c = true;
  expect(value).toBe(1);

  // the underlying observable changes, make sure the value isn't cached
  o._b = 3;
  o.c = false;
  expect(value).toBe(3);
});
