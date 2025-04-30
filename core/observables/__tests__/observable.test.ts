import * as fobx from "@fobx/core"
import { expect, grabConsole, test } from "@fobx/testing"

test("creating an observable object with shallow=true works correctly", () => {
  const obj = { a: { b: "c" }, arr: [], set: new Set(), map: new Map() }
  const shallow = fobx.observable(obj, {}, { shallow: true })
  const deep = fobx.observable(obj)

  // the first level props are always observable
  expect(fobx.isObservable(deep, "a")).toBe(true)
  expect(fobx.isObservable(deep, "arr")).toBe(true)
  expect(fobx.isObservable(deep, "set")).toBe(true)
  expect(fobx.isObservable(deep, "map")).toBe(true)
  expect(fobx.isObservable(shallow, "a")).toBe(true)
  expect(fobx.isObservable(shallow, "arr")).toBe(true)
  expect(fobx.isObservable(shallow, "set")).toBe(true)
  expect(fobx.isObservable(shallow, "map")).toBe(true)

  // the value of those props are not observable on the shallow observable
  expect(fobx.isObservableObject(deep.a)).toBe(true)
  expect(fobx.isObservableArray(deep.arr)).toBe(true)
  expect(fobx.isObservableSet(deep.set)).toBe(true)
  expect(fobx.isObservableMap(deep.map)).toBe(true)
  expect(fobx.isObservableObject(shallow.a)).toBe(false)
  expect(fobx.isObservableArray(shallow.arr)).toBe(false)
  expect(fobx.isObservableSet(shallow.set)).toBe(false)
  expect(fobx.isObservableMap(shallow.map)).toBe(false)
})

test("class with non-extensible field causes console warning", () => {
  class EInner {}
  class E {
    b = Object.preventExtensions(new EInner())
    constructor() {
      fobx.observable(this)
    }
  }

  expect(
    grabConsole(() => {
      new E()
    }),
  ).toMatch(
    /<STDOUT> \[@fobx\/core\] Attempted to make a non-extensible object observable, which is not possible\./,
  )
})

test("classes with populated map injected into constructor get initialize correctly", () => {
  class M {
    map: Map<string, string>
    constructor(map: Map<string, string>) {
      this.map = map
    }
  }

  const a = fobx.observable(
    new M(
      new Map([
        ["a", "a"],
        ["b", "b"],
      ]),
    ),
  )
  expect(a.map.size).toBe(2)
  expect(Array.from(a.map.entries())).toEqual([
    ["a", "a"],
    ["b", "b"],
  ])
})

test("classes with populated array injected into constructor get initialize correctly", () => {
  class A {
    arr: string[]
    constructor(arr: string[]) {
      this.arr = arr
    }
  }

  // deno-lint-ignore no-array-constructor
  const a = fobx.observable(new A(new Array("a", "b")))

  expect(a.arr.length).toBe(2)
  expect(a.arr).toEqual(["a", "b"])
})

test("classes with populated set injected into constructor get initialize correctly", () => {
  class S {
    set: Set<string>
    constructor(set: Set<string>) {
      this.set = set
    }
  }

  const a = fobx.observable(new S(new Set(["a", "b"])))

  expect(a.set.size).toBe(2)
  expect(Array.from(a.set)).toEqual(["a", "b"])
})
