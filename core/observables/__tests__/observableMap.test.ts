import type { ObservableMapWithAdmin } from "../observableMap.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

test("observable API for maps successfully constructs map", () => {
  const original = new Map([
    [1, 1],
    [2, 2],
  ])
  const m = fobx.observable(original)
  expect(m).not.toBe(original)
  expect(m.entries()).toEqual(original.entries())
  expect(fobx.isObservableMap(m)).toBe(true)

  const m2 = fobx.observable(original)
  expect(m2.entries()).toEqual(original.entries())
  expect(fobx.isObservableMap(m2)).toBe(true)

  const m3 = fobx.observable(new Map())
  expect(m3.entries()).toEqual(new Map().entries())
  expect(fobx.isObservableMap(m3)).toBe(true)

  const m4 = fobx.observable(new Map([["a", true]]))
  expect(m4.entries()).toEqual(new Map([["a", true]]).entries())
  expect(fobx.isObservableMap(m4)).toBe(true)

  const m5 = fobx.observable(new Map([["a", "a"]]))
  expect(m5.entries()).toEqual(new Map([["a", "a"]]).entries())
  expect(fobx.isObservableMap(m5)).toBe(true)

  const m6 = fobx.observable(new Map([["a", "a"]]))
  expect(m6.entries()).toEqual(new Map([["a", "a"]]).entries())
  expect(fobx.isObservableMap(m6)).toBe(true)
})

describe("ObservableMap", () => {
  const noReactionTC = [
    { name: "entries", expected: ["a", "v"] },
    { name: "values", expected: "v" },
    { name: "keys", expected: "a" },
  ] as const
  noReactionTC.forEach(
    (
      { name, expected }: {
        name: "entries" | "values" | "keys"
        expected: unknown
      },
    ) => {
      test(`${name} does not cause reaction unless the iterable.next() is called`, () => {
        const m = fobx.observable(new Map()) as ObservableMapWithAdmin
        fobx.reaction(() => m[name](), fn())
        expect(m[$fobx].observers.length).toBe(0)

        const reactionFn = fn()
        fobx.reaction(() => {
          return m[name]().next().value
        }, reactionFn)

        m.set("a", "v")
        expect(reactionFn).toHaveBeenCalledTimes(1)
        expect(reactionFn).toHaveBeenCalledWith(
          expected,
          undefined,
          expect.anything(),
        )
      })
    },
  )

  test("issue #4 - reaction fires correctly after clear()", () => {
    const m = fobx.observable(new Map([["a", 1]]))
    const reactionFn = fn()
    fobx.reaction(() => m.get("a"), reactionFn)

    m.set("a", 2)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(2)
    m.set("a", 3)
    expect(reactionFn).toHaveBeenCalledTimes(3)

    fobx.runInAction(() => {
      m.clear()
      m.set("a", 1)
    })
    expect(reactionFn).toHaveBeenCalledTimes(4)
  })

  test("size property is correctly observable", () => {
    const map = fobx.observable(new Map())
    const reactionFn = fn()
    fobx.reaction(() => map.size, reactionFn)

    expect(reactionFn).toHaveBeenCalledTimes(0)
    map.set("a", 7)
    expect(reactionFn).toHaveBeenCalledTimes(1)
  })

  test("reaction to map as a collection work as expected", () => {
    const m = fobx.observable(new Map())
    const reactionFn = fn()
    fobx.reaction(() => m, reactionFn)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    m.set(1, 1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    // assigning something that already is in map doesn't cause reaction
    m.set(1, 1)
    expect(reactionFn).toHaveBeenCalledTimes(1)

    m.set(1, 2)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    m.set(2, 3)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    m.delete(2)
    expect(reactionFn).toHaveBeenCalledTimes(4)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(5)
  })
})
