import { isObservableCollection, isPlainObject } from "../predicates.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { describe, expect, test } from "@fobx/testing"

describe("isPlainObject", () => {
  test("returns false when non-object is passed", () => {
    expect(isPlainObject("str")).toBe(false)
  })

  test("returns true for objects with a null prototype", () => {
    expect(isPlainObject(Object.create(null))).toBe(true)
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
  test("returns false when administration is invalid", () => {
    const arr = [1]
    Object.defineProperty(arr, $fobx, { value: "str" })
    expect(isObservableCollection(arr)).toBe(false)
  })
})

test("isObservable works as expected", () => {
  const primitives = [0, "a", true, Symbol(), BigInt(Number.MAX_SAFE_INTEGER)]

  primitives.forEach((i) => {
    expect(fobx.isObservable(i)).toBe(false)
  })

  primitives.forEach((i) => {
    const obs = fobx.observableBox(i)
    expect(fobx.isObservable(obs)).toBe(true)
  })

  // objects/collections
  class NonObservableClass {}
  const objects = [[], new Set(), new Map(), new NonObservableClass(), {}]

  objects.forEach((i) => {
    expect(fobx.isObservable(i)).toBe(false)
  })

  // remove the object and class as they become a container of observable values but they
  // themselves are not observable
  objects.pop()
  objects.pop()

  objects.forEach((i) => {
    const obs = fobx.observable(i)
    expect(fobx.isObservable(obs)).toBe(true)
  })

  expect(fobx.isObservable(fobx.observable({}))).toBe(false)
  expect(fobx.isObservable(new NonObservableClass())).toBe(false)
})
