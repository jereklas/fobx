import { $fobx } from "../global.ts"
import type { ObservableAdmin } from "../global.ts"
import * as fobx from "../index.ts"
import {
  beforeEach,
  describe,
  expect,
  fn,
  grabConsole,
  test,
} from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("Reaction", () => {
  test("observables are tracked as expected", () => {
    const sideEffectFn = fn()
    const val1 = fobx.box("a")
    const val2 = fobx.box(1)
    const val3 = fobx.box(true)
    const val1Admin = val1[$fobx] as ObservableAdmin
    const val2Admin = val2[$fobx] as ObservableAdmin
    const val3Admin = val3[$fobx] as ObservableAdmin
    const dispose = fobx.reaction(() => {
      return [val1.get(), val2.get(), val3.get()]
    }, sideEffectFn)

    expect(val1Admin.observers.size).toBe(1)
    expect(val2Admin.observers.size).toBe(1)
    expect(val3Admin.observers.size).toBe(1)
    dispose()
  })
})

describe("reaction", () => {
  test("side effect function is ran when observable value(s) change", () => {
    const val1 = fobx.box(1)
    const val2 = fobx.box(2)
    const sideEffectFn1 = fn()
    let dispose = fobx.reaction(() => {
      return [val1.get(), val2.get()]
    }, sideEffectFn1)
    // change first observable
    val1.set(3)
    expect(sideEffectFn1).toHaveBeenCalledTimes(1)
    expect(sideEffectFn1).toHaveBeenCalledWith(
      [3, 2],
      [1, 2],
      expect.anything(),
    )

    // change second observable
    sideEffectFn1.mockClear()
    val2.set(1)
    expect(sideEffectFn1).toHaveBeenCalledTimes(1)
    expect(sideEffectFn1).toHaveBeenCalledWith(
      [3, 1],
      [3, 2],
      expect.anything(),
    )
    dispose()

    // reaction with single value
    const sideEffectFn2 = fn()
    dispose = fobx.reaction(() => {
      return val1.get()
    }, sideEffectFn2)
    val1.set(10)
    expect(sideEffectFn2).toHaveBeenCalledTimes(1)
    expect(sideEffectFn2).toHaveBeenCalledWith(10, 3, expect.anything())
    dispose()
  })

  test("side effect function is not ran when observable is re-assigned same value", () => {
    const obs = fobx.box(1)
    const sideEffectFn = fn()
    const dispose = fobx.reaction(() => obs.get(), sideEffectFn)
    obs.set(1)
    expect(sideEffectFn).not.toHaveBeenCalled()
    dispose()
  })

  test("dispose removes observables from being tracked and prevents sideEffectFn from being called", () => {
    const val = fobx.box(0)
    const valAdmin = val[$fobx] as ObservableAdmin
    const sideEffectFn = fn()
    const dispose = fobx.reaction(() => {
      return val.get()
    }, sideEffectFn)
    // value change caused sideEffectFn to run
    val.set(10)
    expect(valAdmin.observers.size).toBe(1)
    expect(sideEffectFn).toHaveBeenCalledTimes(1)
    expect(sideEffectFn).toHaveBeenCalledWith(10, 0, expect.anything())

    // dispose removes tracking
    sideEffectFn.mockClear()
    dispose()
    expect(valAdmin.observers.size).toBe(0)
    // value change doesn't cause sideEffectFn to run
    val.set(5)
    expect(sideEffectFn).not.toHaveBeenCalled()
  })
})

test("An exception thrown in the side effect gets logged to stderr", () => {
  const onReactionError = fn()
  fobx.configure({ enforceActions: false, onReactionError })

  const a = fobx.box(0)
  fobx.reaction(
    () => a.get(),
    () => {
      throw Error("hmm")
    },
  )

  expect(
    grabConsole(() => {
      a.set(a.get() + 1)
    }),
  ).toMatch(/\[@fobx\/core\] "Reaction@.* threw an exception/)
  expect(onReactionError).toHaveBeenCalledWith(Error("hmm"), expect.anything())
})
