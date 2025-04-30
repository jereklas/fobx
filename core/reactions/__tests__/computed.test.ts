import { $fobx } from "../../state/global.ts"
import type { ComputedWithAdmin } from "../computed.ts"
import type {
  IObservable,
  ObservableBoxWithAdmin,
} from "../../observables/observableBox.ts"
import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("Computed", () => {
  test("should not run the computation upon instantiation", () => {
    const mock = fn()
    fobx.computed(mock)
    expect(mock).not.toHaveBeenCalled()
  })
})

test("changes to observable array cause computed to re-calculate", () => {
  const a = fobx.observable([1, 2, 3])
  const computedFn = fn(() => a[0])
  const c = fobx.computed(computedFn)
  const reactionFn = fn(() => c.value)
  const d = fobx.reaction(reactionFn, fn())
  expect(computedFn).toHaveBeenCalledTimes(1)
  expect(reactionFn).toHaveBeenCalledTimes(1)

  // assigning same value doesn't cause anything to re-run
  a[0] = 1
  expect(computedFn).toHaveBeenCalledTimes(1)
  expect(reactionFn).toHaveBeenCalledTimes(1)

  // pushing a new item makes computed have to re-run, but reaction doesn't since computed value didn't change
  a.push(5)
  expect(computedFn).toHaveBeenCalledTimes(2)
  expect(reactionFn).toHaveBeenCalledTimes(1)

  // both computed and reaction run because value at index 0 changed
  a[0] = 10
  expect(computedFn).toHaveBeenCalledTimes(3)
  expect(reactionFn).toHaveBeenCalledTimes(2)

  d()
})

describe("computed", () => {
  test("should run computation each time value is accessed when not actively observed", () => {
    const mock = fn()
    const c = fobx.computed(mock)
    mock.mockClear()

    expect(mock).toHaveBeenCalledTimes(0)
    c.value
    expect(mock).toHaveBeenCalledTimes(1)
    c.value
    expect(mock).toHaveBeenCalledTimes(2)
    c.value
    expect(mock).toHaveBeenCalledTimes(3)
  })

  test("should use cached value each time value is accessed when actively being observed", () => {
    const obs = fobx.observableBox(1) as IObservable
    const computedFn = fn(() => obs.value + 1)
    const c = fobx.computed(computedFn)
    expect(computedFn).not.toHaveBeenCalled()

    // adding computed to reaction causes computed to run
    const reactionFn = fn()
    const dispose = fobx.reaction(() => c.value, reactionFn)
    expect(computedFn).toHaveBeenCalledTimes(1)
    // subsequent access uses cached value
    expect(c.value).toBe(2)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(c.value).toBe(2)
    expect(computedFn).toHaveBeenCalledTimes(1)
    dispose()
  })

  test("should re-compute when any of the observable values change", () => {
    const o1 = fobx.observableBox(1) as IObservable
    const o2 = fobx.observableBox(2) as IObservable
    const o3 = fobx.observableBox(3) as IObservable
    const c1Fn = fn(() => o1.value + o2.value)
    const c1 = fobx.computed(c1Fn)
    const c2Fn = fn(() => c1.value + o3.value)
    const c2 = fobx.computed(c2Fn)

    // reaction to make computed run
    const reactionFn = fn()
    const dispose = fobx.reaction(() => [c1.value, c2.value], reactionFn)
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)
    expect(c1.value).toBe(3)
    expect(c2.value).toBe(6)
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)

    c1Fn.mockClear()
    c2Fn.mockClear()
    expect(c1Fn).toHaveBeenCalledTimes(0)
    expect(c2Fn).toHaveBeenCalledTimes(0)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    o1.value = 2
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith([4, 7], [3, 6], expect.anything())

    o2.value = 4
    expect(c1Fn).toHaveBeenCalledTimes(2)
    expect(c2Fn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith([6, 9], [4, 7], expect.anything())

    o3.value = 7
    expect(c1Fn).toHaveBeenCalledTimes(2)
    expect(c2Fn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith([6, 13], [6, 9], expect.anything())
    dispose()
  })

  test("should activate and suspend as expected", () => {
    const obs = fobx.observableBox(1) as IObservable
    const computedFn = fn(() => obs.value + 1)
    const c = fobx.computed(computedFn) as ComputedWithAdmin
    computedFn.mockClear()

    // computed doesn't run when observable changes because nothing is observing it
    obs.value = 2
    expect(computedFn).not.toHaveBeenCalled()

    // adding computed to a reaction causes the computed to run
    expect(c[$fobx].dependencies.length).toBe(0) // computed is lazy so until it's accessed it has no observables
    expect(c[$fobx].observers.length).toBe(0)
    const reactionFn = fn()
    const d = fobx.reaction(() => c.value, reactionFn)
    expect(c[$fobx].dependencies.length).toBe(1)
    expect(c[$fobx].observers.length).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // accessing the computed value directly now uses cached value
    expect(c.value).toBe(3)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // reactions (computed + reaction) are correctly ran when observable value changes
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    expect(reactionFn).not.toHaveBeenCalled()
    obs.value = 3
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(4, 3, expect.anything())

    // disposing the reaction should return the computed to a suspended state
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    d()
    expect(c[$fobx].observers.length).toBe(0)
    expect(c[$fobx].dependencies.length).toBe(0)
    obs.value = 4
    expect(computedFn).not.toHaveBeenCalled()

    // calling in the suspended state results computation running and correct value being returned
    expect(c.value).toBe(5)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // computed runs once when activated
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    const reactionFn2 = fn()
    const d2 = fobx.reaction(() => c.value, reactionFn2)
    expect(c[$fobx].dependencies.length).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(1)
    // accessing it when active uses cached value
    expect(c.value).toBe(5)
    expect(computedFn).toHaveBeenCalledTimes(1)
    d2()
  })

  test("should dynamically add/remove tracked observables based code branches executed", () => {
    const a = fobx.observableBox(10) as ObservableBoxWithAdmin
    const b = fobx.observableBox(true) as ObservableBoxWithAdmin
    const c = fobx.computed(() => {
      if (b.value) {
        return a.value
      }
      return 0
    }) as ComputedWithAdmin
    expect(c[$fobx].dependencies.length).toBe(0)

    // reaction causes computed to run and have both observable values tracked
    const reactionFn = fn()
    const dispose = fobx.reaction(() => c.value, reactionFn)
    expect(c[$fobx].dependencies.length).toBe(2)
    expect(c[$fobx].dependencies.includes(a[$fobx] as never)).toBe(true)
    expect(c[$fobx].dependencies.includes(b[$fobx] as never)).toBe(true)

    // when b is false, a is no longer used
    b.value = false
    expect(c[$fobx].dependencies.length).toBe(1)
    expect(c[$fobx].dependencies.includes(a[$fobx] as never)).toBe(false)
    expect(a[$fobx].observers.length).toBe(0)
    expect(c[$fobx].dependencies.includes(b[$fobx] as never)).toBe(true)

    // returning b to true adds a back to the list of observables
    b.value = true
    expect(c[$fobx].dependencies.length).toBe(2)
    expect(c[$fobx].dependencies.includes(a[$fobx] as never)).toBe(true)
    expect(a[$fobx].observers.length).toBe(1)
    expect(c[$fobx].dependencies.includes(b[$fobx] as never)).toBe(true)
    dispose()
  })
})

test("computed value removes references to dependencies", () => {
  const a = fobx.observableBox(10) as ObservableBoxWithAdmin
  const c = fobx.computed(() => {
    return a.value + 1
  }) as ComputedWithAdmin
  expect(c[$fobx].dependencies.length).toBe(0)

  // need a reaction to make computed run
  const reactionFn = fn()
  fobx.reaction(() => c.value, reactionFn)
  expect(c[$fobx].dependencies.length).toBe(1)
  expect(a[$fobx].observers.length).toBe(1)

  c.dispose()
  expect(c[$fobx].dependencies.length).toBe(0)
  expect(a[$fobx].observers.length).toBe(0)
})
