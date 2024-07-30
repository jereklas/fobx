import { observable, obs } from "../../src/decorators";
import * as fobx from "../../dist/index";

beforeAll(() => {
  fobx.configure({ enforceActions: false });
});

test("using observable export not from decorator entrypoint throws error", () => {
  expect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class A {
      @fobx.observable a = 0;
    }
  }).toThrow('[@fobx/core] @observable decorator must be imported from "@fobx/core/decorators"');
});

test("using @observable decorator without accessor keyword throws an error", () => {
  expect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class A {
      @obs a = 0;
    }
  }).toThrow(
    "[@fobx/core] @observable decorator must be used with the accessor keyword (i.e. @observable accessor x = 10)."
  );
});

class C {
  @obs accessor a = 10;
}

test("@observable accessor a = 10; is correctly observable", () => {
  const a = new C();
  const b = new C();
  expect(fobx.isObservable(b, "a")).toBe(true);
  expect(fobx.isObservable(a, "a")).toBe(true);

  let count = -1;
  fobx.autorun(() => {
    a.a;
    b.a;
    count++;
  });
  expect(count).toBe(0);

  a.a = 0;
  expect(count).toBe(1);
  expect(a.a).toBe(0);
  expect(b.a).toBe(10);

  b.a = 5;
  expect(count).toBe(2);
  expect(a.a).toBe(0);
  expect(b.a).toBe(5);
});
