import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  // avoid console warnings
  fobx.configure({ enforceActions: false })
})

describe("runInAction", () => {
  test("returns the value of the supplied function", () => {
    const a1 = (a: number, b: number) => {
      return a + b
    }

    expect(fobx.runInAction(() => a1(1, 2))).toBe(3)
  })

  test("allows multiple observables to be set with only one reaction occurring from those value changes", () => {
    const o1 = fobx.observableBox(1)
    const o2 = fobx.observableBox(2)
    const o3 = fobx.observableBox(3)
    const reactionFn = fn()
    const computedFn = fn(() => o1.value + o2.value + o3.value)
    const c = fobx.computed(computedFn)
    const dispose = fobx.reaction(() => {
      return [o1.value, o2.value, o3.value, c.value]
    }, reactionFn)

    // computed runs one time after being added to the reaction
    expect(computedFn).toHaveBeenCalledTimes(1)
    o1.value += 1
    o2.value += 1
    o3.value += 1
    expect(computedFn).toHaveBeenCalledTimes(4)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(c.value).toBe(9)

    // clear call count for clarity below
    reactionFn.mockClear()
    computedFn.mockClear()
    expect(computedFn).toHaveBeenCalledTimes(0)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    // action changes multiple observables, but the reactions only update once in response
    const result = fobx.runInAction(() => {
      o1.value = 5
      o2.value = 6
      o3.value = 7
    })
    expect(result).toBe(undefined)
    // computed
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(
      [5, 6, 7, 18],
      [2, 3, 4, 9],
      expect.anything(),
    )
    dispose()
  })
})

test("action retains original function's prototype", () => {
  const fn = () => {}
  Object.defineProperty(fn, "toString", { value: () => "abc" })
  expect(fn.toString()).toBe("abc")

  const a = fobx.action(fn)
  expect(a.toString()).toBe("abc")
})
