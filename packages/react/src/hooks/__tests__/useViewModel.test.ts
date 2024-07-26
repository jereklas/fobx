import { observable } from "@fobx/core";
import { ViewModel } from "../useViewModel";

type BaseVmProps = { a: number; b: number };
class BaseVm<T extends BaseVmProps> extends ViewModel<T> {
  constructor(props: T) {
    super(props);
    observable(this);
  }

  get classes() {
    return [this.props.a];
  }
}

test("non-enumerable props are removed from prop list", () => {
  // ref prop is enumerable
  const vm = new BaseVm({ a: 1, b: 2, ref: "abc" });
  expect("ref" in vm.props).toBe(true);

  // ref prop is not enumerable
  const o = { a: 1, b: 2 };
  Object.defineProperty(o, "ref", { value: "abc" });
  const vm2 = new BaseVm(o);
  expect("ref" in vm2.props).toBe(false);
});
