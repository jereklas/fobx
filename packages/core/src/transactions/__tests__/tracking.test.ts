import { observable } from "../../observables/observable";
import { autorun } from "../../reactions/autorun";

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
