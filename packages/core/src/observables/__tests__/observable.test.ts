import { observable } from "../observable";
import { grabConsole } from "../../../__tests__/utils";
import { isObservable } from "../../fobx";

test("creating an observable object with shallow=true works correctly", () => {
  const shallow = observable({ a: { b: "c" } }, {}, { shallow: true });
  const deep = observable({ a: { b: "c" } });

  // first level is always observable
  expect(isObservable(deep, "a")).toBe(true);
  expect(isObservable(shallow, "a")).toBe(true);

  // second level is not observable when shallow is used
  expect(isObservable(deep.a, "b")).toBe(true);
  expect(isObservable(shallow.a, "b")).toBe(false);
});

test("class with non-extensible field causes console warning", () => {
  class EInner {}
  class E {
    b = Object.preventExtensions(new EInner());
    constructor() {
      observable(this);
    }
  }

  expect(
    grabConsole(() => {
      new E();
    })
  ).toMatch(/<STDOUT> \[@fobx\/core\] Attempted to make a non-extensible object observable, which is not possible\./);
});

test("classes with populated map injected into constructor get initialize correctly", () => {
  class M {
    map: Map<string, string>;
    constructor(map: Map<string, string>) {
      this.map = map;
    }
  }

  const a = observable(
    new M(
      new Map([
        ["a", "a"],
        ["b", "b"],
      ])
    )
  );
  expect(a.map.size).toBe(2);
  expect(Array.from(a.map.entries())).toStrictEqual([
    ["a", "a"],
    ["b", "b"],
  ]);
});

test("classes with populated array injected into constructor get initialize correctly", () => {
  class A {
    arr: string[];
    constructor(arr: string[]) {
      this.arr = arr;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-array-constructor
  const a = observable(new A(new Array("a", "b")));

  expect(a.arr.length).toBe(2);
  expect(a.arr).toStrictEqual(["a", "b"]);
});

test("classes with populated set injected into constructor get initialize correctly", () => {
  class S {
    set: Set<string>;
    constructor(set: Set<string>) {
      this.set = set;
    }
  }

  const a = observable(new S(new Set(["a", "b"])));

  expect(a.set.size).toBe(2);
  expect(Array.from(a.set)).toStrictEqual(["a", "b"]);
});
