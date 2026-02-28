import { $fobx } from "../global.ts"
import type { ComputedAdmin, ObservableAdmin } from "../types.ts"
import type { Computed } from "../computed.ts"
import type { ObservableBox } from "../box.ts"
import * as fobx from "../index.ts"
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
  const a = fobx.array([1, 2, 3])
  const computedFn = fn(() => a[0])
  const c = fobx.computed(computedFn)
  const reactionFn = fn(() => c.get())
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
    c.get()
    expect(mock).toHaveBeenCalledTimes(1)
    c.get()
    expect(mock).toHaveBeenCalledTimes(2)
    c.get()
    expect(mock).toHaveBeenCalledTimes(3)
  })

  test("should use cached value each time value is accessed when actively being observed", () => {
    const obs = fobx.box(1)
    const computedFn = fn(() => obs.get() + 1)
    const c = fobx.computed(computedFn)
    expect(computedFn).not.toHaveBeenCalled()

    // adding computed to reaction causes computed to run
    const reactionFn = fn()
    const dispose = fobx.reaction(() => c.get(), reactionFn)
    expect(computedFn).toHaveBeenCalledTimes(1)
    // subsequent access uses cached value
    expect(c.get()).toBe(2)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(c.get()).toBe(2)
    expect(computedFn).toHaveBeenCalledTimes(1)
    dispose()
  })

  test("should re-compute when any of the observable values change", () => {
    const o1 = fobx.box(1)
    const o2 = fobx.box(2)
    const o3 = fobx.box(3)
    const c1Fn = fn(() => o1.get() + o2.get())
    const c1 = fobx.computed(c1Fn)
    const c2Fn = fn(() => c1.get() + o3.get())
    const c2 = fobx.computed(c2Fn)

    // reaction to make computed run
    const reactionFn = fn()
    const dispose = fobx.reaction(() => [c1.get(), c2.get()], reactionFn)
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)
    expect(c1.get()).toBe(3)
    expect(c2.get()).toBe(6)
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)

    c1Fn.mockClear()
    c2Fn.mockClear()
    expect(c1Fn).toHaveBeenCalledTimes(0)
    expect(c2Fn).toHaveBeenCalledTimes(0)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    o1.set(2)
    expect(c1Fn).toHaveBeenCalledTimes(1)
    expect(c2Fn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith([4, 7], [3, 6], expect.anything())

    o2.set(4)
    expect(c1Fn).toHaveBeenCalledTimes(2)
    expect(c2Fn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith([6, 9], [4, 7], expect.anything())

    o3.set(7)
    expect(c1Fn).toHaveBeenCalledTimes(2)
    expect(c2Fn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith([6, 13], [6, 9], expect.anything())
    dispose()
  })

  test("should activate and suspend as expected", () => {
    const obs = fobx.box(1)
    const obsAdmin = obs[$fobx] as ObservableAdmin
    const computedFn = fn(() => obs.get() + 1)
    const c = fobx.computed(computedFn)
    const cAdmin = c[$fobx] as ComputedAdmin
    computedFn.mockClear()

    // computed doesn't run when observable changes because nothing is observing it
    obs.set(2)
    expect(computedFn).not.toHaveBeenCalled()

    // adding computed to a reaction causes the computed to run
    expect(cAdmin.deps.length).toBe(0) // computed is lazy so until it's accessed it has no observables
    expect(cAdmin.observers.length).toBe(0)
    const reactionFn = fn()
    const d = fobx.reaction(() => c.get(), reactionFn)
    expect(cAdmin.deps.length).toBe(1)
    expect(cAdmin.observers.length).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // accessing the computed value directly now uses cached value
    expect(c.get()).toBe(3)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // reactions (computed + reaction) are correctly ran when observable value changes
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    expect(reactionFn).not.toHaveBeenCalled()
    obs.set(3)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(4, 3, expect.anything())

    // disposing the reaction should return the computed to a suspended state
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    d()
    expect(cAdmin.observers.length).toBe(0)
    expect(cAdmin.deps.length).toBe(0)
    obs.set(4)
    expect(computedFn).not.toHaveBeenCalled()

    // calling in the suspended state results computation running and correct value being returned
    expect(c.get()).toBe(5)
    expect(computedFn).toHaveBeenCalledTimes(1)

    // computed runs once when activated
    computedFn.mockClear()
    expect(computedFn).not.toHaveBeenCalled()
    const reactionFn2 = fn()
    const d2 = fobx.reaction(() => c.get(), reactionFn2)
    expect(cAdmin.deps.length).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(1)
    // accessing it when active uses cached value
    expect(c.get()).toBe(5)
    expect(computedFn).toHaveBeenCalledTimes(1)
    d2()
  })

  test("should dynamically add/remove tracked observables based code branches executed", () => {
    const a = fobx.box(10)
    const aAdmin = a[$fobx] as ObservableAdmin
    const b = fobx.box(true)
    const bAdmin = b[$fobx] as ObservableAdmin
    const c = fobx.computed(() => {
      if (b.get()) {
        return a.get()
      }
      return 0
    })
    const cAdmin = c[$fobx] as ComputedAdmin
    expect(cAdmin.deps.length).toBe(0)

    // reaction causes computed to run and have both observable values tracked
    const reactionFn = fn()
    const dispose = fobx.reaction(() => c.get(), reactionFn)
    expect(cAdmin.deps.length).toBe(2)
    expect(cAdmin.deps.includes(aAdmin as never)).toBe(true)
    expect(cAdmin.deps.includes(bAdmin as never)).toBe(true)

    // when b is false, a is no longer used
    b.set(false)
    expect(cAdmin.deps.length).toBe(1)
    expect(cAdmin.deps.includes(aAdmin as never)).toBe(false)
    expect(aAdmin.observers.length).toBe(0)
    expect(cAdmin.deps.includes(bAdmin as never)).toBe(true)

    // returning b to true adds a back to the list of observables
    b.set(true)
    expect(cAdmin.deps.length).toBe(2)
    expect(cAdmin.deps.includes(aAdmin as never)).toBe(true)
    expect(aAdmin.observers.length).toBe(1)
    expect(cAdmin.deps.includes(bAdmin as never)).toBe(true)
    dispose()
  })
})
