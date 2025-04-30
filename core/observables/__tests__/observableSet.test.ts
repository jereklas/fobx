import type { ObservableSetWithAdmin } from "../observableSet.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { describe, expect, fn, test } from "@fobx/testing"

test("observable API for sets successfully constructs sets", () => {
  const s = fobx.observable(new Set(["a", "b"]))
  expect(s.values()).toEqual(new Set(["a", "b"]).values())
  expect(fobx.isObservableSet(s)).toBe(true)

  const s2 = fobx.observable(new Set(["a", "b"]))
  expect(s2.values()).toEqual(new Set(["a", "b"]).values())
  expect(fobx.isObservableSet(s2)).toBe(true)

  const s3 = fobx.observable(new Set())
  expect(s3.values()).toEqual(new Set().values())
  expect(fobx.isObservableSet(s3)).toBe(true)

  const s4 = fobx.observable(new Set([1]))
  expect(s4.values()).toEqual(new Set([1]).values())
  expect(fobx.isObservableSet(s4)).toBe(true)

  const s5 = fobx.observable(new Set([true, false]))
  expect(s5.values()).toEqual(new Set([true, false]).values())
  expect(fobx.isObservableSet(s5)).toBe(true)
})

describe("ObservableSet", () => {
  const iterableTC = [
    { name: "entries", expected: ["a", "a"] },
    { name: "values", expected: "a" },
    { name: "keys", expected: "a" },
  ] as const
  iterableTC.forEach(({ name, expected }) => {
    test(`${name}() does not cause reaction unless the iterable next() is called`, () => {
      const m = fobx.observable(new Set()) as ObservableSetWithAdmin
      fobx.reaction(() => m[name](), fn())
      expect(m[$fobx].observers.length).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return m[name]().next().value
      }, reactionFn)
      expect(m[$fobx].observers.length).toBe(1)
      m.add("a")
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith(
        expected,
        undefined,
        expect.anything(),
      )
    })
  })

  test("reaction to set as a collection works as expected", () => {
    const m = fobx.observable(new Set())
    const reactionFn = fn()
    fobx.reaction(() => m, reactionFn)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    m.add(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    // assigning something that already is in map doesn't cause reaction
    m.add(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)

    m.add(2)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    m.delete(2)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(4)
  })

  test("reaction fires correctly after clear()", () => {
    const m = fobx.observable(new Set("a"))
    const reactionFn = fn()
    fobx.reaction(() => m.has("a"), reactionFn)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(1)
    m.add("a")
  })

  test("issue #2 - size property is correctly observable", () => {
    const set = fobx.observable(new Set())
    const reactionFn = fn()
    fobx.reaction(() => set.size, reactionFn)

    expect(reactionFn).toHaveBeenCalledTimes(0)
    set.add(7)
    expect(reactionFn).toHaveBeenCalledTimes(1)
  })
})

test("ObservableSet makes values observable", () => {
  const set = fobx.observable(new Set([{ a: "a" }]))
  set.add({ a: "b" })
  const values = Array.from(set)

  // initial value and set values are observable
  expect(fobx.isObservable(values[0], "a")).toBe(true)
  expect(fobx.isObservable(values[1], "a")).toBe(true)
})

test("ObservableSet does not make values observable when shallow = true", () => {
  const set = fobx.observable(new Set([{ a: "a" }]), { shallow: true })
  set.add({ a: "b" })
  const values = Array.from(set)

  // neither initial values or set values are observable
  expect(fobx.isObservable(values[0], "a")).toBe(false)
  expect(fobx.isObservable(values[1], "a")).toBe(false)
})
