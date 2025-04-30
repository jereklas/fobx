import type { ObservableArrayWithAdmin } from "../observableArray.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

test("observable API for arrays successfully constructs arrays", () => {
  const a = fobx.observable([1, 2, 3])
  expect(a).toEqual([1, 2, 3])
  expect(fobx.isObservableArray(a)).toBe(true)

  const a2 = fobx.observable([true, false])
  expect(a2).toEqual([true, false])
  expect(fobx.isObservableArray(a2)).toBe(true)

  const a3 = fobx.observable([])
  expect(a3).toEqual([])
  expect(fobx.isObservableArray(a3)).toBe(true)

  const a4 = fobx.observable(["a", "b", "c"])
  expect(a4).toEqual(["a", "b", "c"])
  expect(fobx.isObservableArray(a4)).toBe(true)
})

describe("ObservableArray", () => {
  test("observing single index of observable array behaves as expected", () => {
    const a = fobx.observable([1, 2, 3, 4])
    const computedFn = fn(() => {
      return a[0]
    })
    const c = fobx.computed(computedFn)
    const reactionSideEffect = fn()
    const reactionDataFn = fn(() => a[0])
    fobx.reaction(reactionDataFn, reactionSideEffect)
    expect(reactionDataFn).toHaveBeenCalledTimes(1)
    reactionDataFn.mockClear()

    // computed runs once something is observing it
    const reactionBasedOnComputed = fn()
    const reactionDataFnBasedOnComputed = fn(() => c.value)
    fobx.reaction(reactionDataFnBasedOnComputed, reactionBasedOnComputed)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(computedFn).toHaveBeenCalledTimes(1)
    reactionDataFnBasedOnComputed.mockClear()
    computedFn.mockClear()

    expect(computedFn).toHaveBeenCalledTimes(0)
    expect(reactionSideEffect).toHaveBeenCalledTimes(0)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0)

    a.push(5)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(reactionDataFn).toHaveBeenCalledTimes(1)
    expect(reactionSideEffect).toHaveBeenCalledTimes(0)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(0)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0)

    // everything updates because exact index being observed changes
    a[0] = 10
    expect(computedFn).toHaveBeenCalledTimes(2)
    expect(reactionDataFn).toHaveBeenCalledTimes(2)
    expect(reactionSideEffect).toHaveBeenCalledTimes(1)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1)

    // reaction + computed re-run because array changed, but reaction based on computed doesn't
    a[1] = 11
    expect(computedFn).toHaveBeenCalledTimes(3)
    expect(reactionDataFn).toHaveBeenCalledTimes(3)
    expect(reactionSideEffect).toHaveBeenCalledTimes(1)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1)

    // assigning length to zero removes all array data
    a.length = 0
    expect(a.at(0)).toBe(undefined)
    expect(computedFn).toHaveBeenCalledTimes(4)
    expect(reactionDataFn).toHaveBeenCalledTimes(4)
    expect(reactionSideEffect).toHaveBeenCalledTimes(2)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(2)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(2)

    // pushing a value to the empty array still causes reactions to run
    a.push(1)
    expect(a.at(0)).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(5)
    expect(reactionDataFn).toHaveBeenCalledTimes(5)
    expect(reactionSideEffect).toHaveBeenCalledTimes(3)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(3)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(3)
  })

  test("Array.from(observableArray) should always trigger reaction", () => {
    const a = fobx.observable<number>([])
    const reactionFn = fn()
    fobx.reaction(() => Array.from(a), reactionFn)
    a[0] = 1
    a[0] = 2
    expect(reactionFn).toHaveBeenCalledTimes(2)
  })

  test("a reaction returning an observable array should run reaction when mutation occurs", () => {
    const a = fobx.observable([] as number[])
    const reactionFn = fn()
    fobx.reaction(() => a, reactionFn)
    a[0] = 1
    expect(reactionFn).toHaveBeenCalledTimes(1)
    // assigning same value to index doesn't cause change
    a[0] = 1
    expect(reactionFn).toHaveBeenCalledTimes(1)

    a[0] = 2
    expect(reactionFn).toHaveBeenCalledTimes(2)
    a.push(1)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    a.sort()
    expect(reactionFn).toHaveBeenCalledTimes(4)
  })

  test("multiple observable arrays can exist without state bleeding between them", () => {
    const a = fobx.observable([1, 2, 3])
    const b = fobx.observable([4, 5, 6])

    const reactionFn = fn()
    fobx.reaction(() => {
      return [a.length, b.length]
    }, reactionFn)
    expect(reactionFn).not.toHaveBeenCalled()

    a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith([4, 3], [3, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4])
    expect(b).toEqual([4, 5, 6])

    a.push(5)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith([5, 3], [4, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4, 5])

    b.push(10)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith([5, 4], [5, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4, 5])
    expect(b).toEqual([4, 5, 6, 10])
  })

  test("previous and current values on reaction are as expected from change to array", () => {
    const a = fobx.observable([1, 2, 3])
    const reactionFn = fn()
    fobx.reaction(() => {
      return a.map((v) => v * 2)
    }, reactionFn)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(
      [2, 4, 6, 8],
      [2, 4, 6],
      expect.anything(),
    )
  })

  test("length property is correctly observable", () => {
    const a = fobx.observable<string>([])
    const reactionFn = fn()
    fobx.reaction(() => a.length, reactionFn)

    expect(reactionFn).toHaveBeenCalledTimes(0)
    a.push("a")
    expect(reactionFn).toHaveBeenCalledTimes(1)
  })

  const iterableTC = [
    { name: "values", expected: 5 },
    { name: "entries", expected: [0, 5] },
    { name: "keys", expected: 0 },
  ]
  iterableTC.forEach(({ name, expected }) => {
    test(`${name} does not cause reaction unless the iterable.next() is called`, () => {
      const a = fobx.observable<number>([]) as ObservableArrayWithAdmin
      fobx.reaction(() => a[name as keyof ObservableArrayWithAdmin](), fn())
      expect(a[$fobx].observers.length).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return a[name as keyof ObservableArrayWithAdmin]().next().value
      }, reactionFn)
      a.push(5)
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith(
        expected,
        undefined,
        expect.anything(),
      )
    })
  })

  const nonObservableTC = [
    { name: "concat", args: [] },
    { name: "filter", args: [(v: number) => v] },
    { name: "flat", args: [] },
    { name: "flatMap", args: [(v: number) => v] },
    { name: "map", args: [(v: number) => v] },
    { name: "slice", args: [] },
    { name: "splice", args: [] },
    { name: "toReversed", args: [] },
    { name: "toSorted", args: [] },
    { name: "toSpliced", args: [] },
    { name: "with", args: [] },
  ]
  nonObservableTC.forEach(({ name, args }) => {
    test(`${name} should return non-observable copy of array`, () => {
      const a = fobx.observable([1, 2, 3]) as fobx.ObservableArray
      const result = a[name as keyof fobx.ObservableArray](...args)

      expect(result !== a).toBe(true)
      expect(!fobx.isObservable(result)).toBe(true)
    })
  })
})
