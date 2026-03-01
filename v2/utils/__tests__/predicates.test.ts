import { $fobx } from "../../global.ts"
import * as fobx from "../../index.ts"
import { describe, expect, test } from "@fobx/testing"

describe("isPlainObject", () => {
  test("returns false when non-object is passed", () => {
    expect(fobx.isPlainObject("str")).toBe(false)
  })

  test("returns true for objects with a null prototype", () => {
    expect(fobx.isPlainObject(Object.create(null))).toBe(true)
  })
})

describe("hasFobxAdmin", () => {
  test("returns false when non-object is passed", () => {
    expect(fobx.hasFobxAdmin("str")).toBe(false)
  })

  test("returns true for observable values", () => {
    expect(fobx.hasFobxAdmin(fobx.box(1))).toBe(true)
  })
})

describe("isObservableObject", () => {
  test("returns false when non-object is passed", () => {
    expect(fobx.isObservableObject("str")).toBe(false)
  })

  test("returns false when object has invalid administration ", () => {
    expect(fobx.isObservableObject({ [$fobx]: "str" })).toBe(false)
  })
})

describe("isComputed", () => {
  test("returns false when no administration exists on the object", () => {
    expect(fobx.isComputed({})).toBe(false)
  })

  test("returns false when administration is invalid", () => {
    expect(fobx.isComputed({ [$fobx]: "str" })).toBe(false)
  })
})

describe("isObservableCollection", () => {
  test("array detection is based on array shape plus fobx symbol", () => {
    const arr = [1]
    Object.defineProperty(arr, $fobx, { value: "str" })
    expect(fobx.isObservableArray(arr)).toBe(true)
    expect(fobx.isObservableMap(arr)).toBe(false)
    expect(fobx.isObservableSet(arr)).toBe(false)
  })

  test("returns false when administration is invalid", () => {
    const arr = [1]
    Object.defineProperty(arr, $fobx, { value: "str" })
    expect(fobx.isObservableCollection(arr)).toBe(false)
  })
})

test("isObservable works as expected", () => {
  const primitives = [0, "a", true, Symbol(), BigInt(Number.MAX_SAFE_INTEGER)]

  primitives.forEach((i) => {
    expect(fobx.isObservable(i)).toBe(false)
  })

  primitives.forEach((i) => {
    const obs = fobx.box(i)
    expect(fobx.isObservable(obs)).toBe(true)
  })

  class NonObservableClass {}
  const objects = [[], new Set(), new Map(), new NonObservableClass(), {}]

  objects.forEach((i) => {
    expect(fobx.isObservable(i)).toBe(false)
  })

  objects.pop()
  objects.pop()

  objects.forEach((i) => {
    const obs = fobx.observable(i)
    expect(fobx.isObservable(obs)).toBe(true)
  })

  expect(fobx.isObservable(fobx.observable({}))).toBe(false)
  expect(fobx.isObservable(new NonObservableClass())).toBe(false)
})
