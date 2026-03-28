import { deepEqual } from "fast-equals"
import { $fobx } from "../../state/global.ts"
import type { ObservableAdmin } from "../../state/global.ts"
import { observerCount } from "../../state/global.ts"
import * as fobx from "../../index.ts"
import { UNDEFINED } from "../reaction.ts"
import {
  beforeEach,
  describe,
  expect,
  fn,
  grabConsole,
  suppressConsole,
  test,
} from "@fobx/testing"

beforeEach(() => {
  fobx.configure({
    enforceActions: false,
    comparer: { structural: deepEqual },
  })
})

describe("Reaction", () => {
  test("observables are tracked as expected", () => {
    const sideEffectFn = fn()
    const val1 = fobx.observableBox("a")
    const val2 = fobx.observableBox(1)
    const val3 = fobx.observableBox(true)
    const val1Admin = val1[$fobx] as ObservableAdmin
    const val2Admin = val2[$fobx] as ObservableAdmin
    const val3Admin = val3[$fobx] as ObservableAdmin
    const dispose = fobx.reaction(() => {
      return [val1.get(), val2.get(), val3.get()]
    }, sideEffectFn)

    expect(observerCount(val1Admin)).toBe(1)
    expect(observerCount(val2Admin)).toBe(1)
    expect(observerCount(val3Admin)).toBe(1)
    dispose()
  })
})

describe("reaction", () => {
  test("side effect function is ran when observable value(s) change", () => {
    const val1 = fobx.observableBox(1)
    const val2 = fobx.observableBox(2)
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
    const obs = fobx.observableBox(1)
    const sideEffectFn = fn()
    const dispose = fobx.reaction(() => obs.get(), sideEffectFn)
    obs.set(1)
    expect(sideEffectFn).not.toHaveBeenCalled()
    dispose()
  })

  test("dispose removes observables from being tracked and prevents sideEffectFn from being called", () => {
    const val = fobx.observableBox(0)
    const valAdmin = val[$fobx] as ObservableAdmin
    const sideEffectFn = fn()
    const dispose = fobx.reaction(() => {
      return val.get()
    }, sideEffectFn)
    // value change caused sideEffectFn to run
    val.set(10)
    expect(observerCount(valAdmin)).toBe(1)
    expect(sideEffectFn).toHaveBeenCalledTimes(1)
    expect(sideEffectFn).toHaveBeenCalledWith(10, 0, expect.anything())

    // dispose removes tracking
    sideEffectFn.mockClear()
    dispose()
    expect(observerCount(valAdmin)).toBe(0)
    // value change doesn't cause sideEffectFn to run
    val.set(5)
    expect(sideEffectFn).not.toHaveBeenCalled()
  })
})

test("An exception thrown in the side effect gets logged to stderr", () => {
  const onReactionError = fn()
  fobx.configure({ enforceActions: false, onReactionError })

  const a = fobx.observableBox(0)
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

// ─── MobX-compat reaction tests ───────────────────────────────────────────────

test("basic", () => {
  const a = fobx.observableBox(1)
  // deno-lint-ignore no-explicit-any
  const values: any[][] = []

  const d = fobx.reaction(
    () => a.get(),
    (newValue, oldValue) => {
      values.push([newValue, oldValue])
    },
  )

  a.set(2)
  a.set(3)
  d()
  a.set(4)

  expect(values).toEqual([
    [2, 1],
    [3, 2],
  ])
})

test("effect fireImmediately is honored", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  const d = fobx.reaction(
    () => a.get(),
    (newValue) => {
      values.push(newValue)
    },
    { fireImmediately: true },
  )

  a.set(2)
  a.set(3)
  d()
  a.set(4)

  expect(values).toEqual([1, 2, 3])
})

test("effect is untracked", () => {
  const a = fobx.observableBox(1)
  const b = fobx.observableBox(2)
  const values: number[] = []

  const d = fobx.reaction(
    () => a.get(),
    (newValue) => {
      values.push(newValue * b.get())
    },
    { fireImmediately: true },
  )

  a.set(2)
  b.set(7) // shouldn't trigger a new change
  a.set(3)
  d()
  a.set(4)

  expect(values).toEqual([2, 4, 21])
})

test("passes Reaction as an argument to expression function", () => {
  const a = fobx.observableBox<number | string>(1)
  const values: (number | string)[] = []

  const dispose = fobx.reaction(
    () => {
      if (a.get() === "pleaseDispose") dispose()
      return a.get()
    },
    (newValue) => {
      values.push(newValue)
    },
    { fireImmediately: true },
  )

  a.set(2)
  a.set(2)
  a.set("pleaseDispose")
  a.set(3)
  a.set(4)

  expect(values).toEqual([1, 2, "pleaseDispose"])
})

test("passes Reaction as an argument to effect function", () => {
  const a = fobx.observableBox<number | string>(1)
  const values: (number | string)[] = []

  fobx.reaction(
    () => a.get(),
    (newValue, _oldValue, dispose) => {
      if (a.get() === "pleaseDispose") dispose()
      values.push(newValue)
    },
    { fireImmediately: true },
  )

  a.set(2)
  a.set(2)
  a.set("pleaseDispose")
  a.set(3)
  a.set(4)

  expect(values).toEqual([1, 2, "pleaseDispose"])
})

test("can dispose reaction on first run", () => {
  const a = fobx.observableBox(1)

  // deno-lint-ignore no-explicit-any
  const valuesExpr1st: any[][] = []
  fobx.reaction(
    () => a.get(),
    (newValue, oldValue, dispose) => {
      dispose()
      valuesExpr1st.push([newValue, oldValue])
    },
    { fireImmediately: true },
  )

  // deno-lint-ignore no-explicit-any
  const valuesEffect1st: any[][] = []
  fobx.reaction(
    (dispose) => {
      dispose()
      return a.get()
    },
    (newValue, oldValue) => {
      valuesEffect1st.push([newValue, oldValue])
    },
    { fireImmediately: true },
  )

  // deno-lint-ignore no-explicit-any
  const valuesExpr: any[][] = []
  fobx.reaction(
    () => a.get(),
    (newValue, oldValue, dispose) => {
      dispose()
      valuesExpr.push([newValue, oldValue])
    },
  )

  // deno-lint-ignore no-explicit-any
  const valuesEffect: any[][] = []
  fobx.reaction(
    (dispose) => {
      dispose()
      return a.get()
    },
    (newValue, oldValue) => {
      valuesEffect.push([newValue, oldValue])
    },
  )

  a.set(2)
  a.set(3)

  expect(valuesExpr1st).toEqual([[1, UNDEFINED]])
  expect(valuesEffect1st).toEqual([[1, UNDEFINED]])
  expect(valuesExpr).toEqual([[2, 1]])
  expect(valuesEffect).toEqual([])
})

test("do not rerun if expr output doesn't change", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  const d = fobx.reaction(
    () => (a.get() < 10 ? a.get() : 11),
    (newValue) => {
      values.push(newValue)
    },
  )

  a.set(2)
  a.set(3)
  a.set(10)
  a.set(11)
  a.set(12)
  a.set(4)
  a.set(5)
  a.set(13)

  d()
  a.set(4)

  expect(values).toEqual([2, 3, 11, 4, 5, 11])
})

test("do not rerun if expr output doesn't change structurally", () => {
  const users = fobx.observable([
    {
      name: "jan",
      get upperName(): string {
        return this.name.toUpperCase()
      },
    },
    {
      name: "piet",
      get upperName(): string {
        return this.name.toUpperCase()
      },
    },
  ])
  const values: string[][] = []

  const d = fobx.reaction(
    () => users.map((user) => user.upperName),
    (newValue) => {
      values.push(newValue)
    },
    {
      fireImmediately: true,
      comparer: "structural",
    },
  )

  users[0].name = "john"
  users[0].name = "JoHn"
  users[0].name = "jOHN"
  users[1].name = "tom"

  d()
  users[1].name = "w00t"

  expect(values).toEqual([
    ["JAN", "PIET"],
    ["JOHN", "PIET"],
    ["JOHN", "TOM"],
  ])
})

test("do not rerun if prev & next expr output is NaN", () => {
  const v = fobx.observableBox<string | typeof NaN>("a")
  const values: string[] = []
  const valuesS: string[] = []

  const d = fobx.reaction(
    () => v.get(),
    (newValue) => {
      values.push(String(newValue))
    },
    { fireImmediately: true },
  )
  const dd = fobx.reaction(
    () => v.get(),
    (newValue) => {
      valuesS.push(String(newValue))
    },
    { fireImmediately: true, comparer: "structural" },
  )

  v.set(NaN)
  v.set(NaN)
  v.set(NaN)
  v.set("b")

  d()
  dd()

  expect(values).toEqual(["a", "NaN", "b"])
  expect(valuesS).toEqual(["a", "NaN", "b"])
})

test("reaction uses equals", () => {
  const o = fobx.observableBox("a")
  const values: string[] = []
  const disposeReaction = fobx.reaction(
    () => o.get(),
    (value) => values.push(value.toLowerCase()),
    {
      comparer: (from, to) => from.toUpperCase() === to.toUpperCase(),
      fireImmediately: true,
    },
  )
  expect(values).toEqual(["a"])
  o.set("A")
  expect(values).toEqual(["a"])
  o.set("B")
  expect(values).toEqual(["a", "b"])
  o.set("A")
  expect(values).toEqual(["a", "b", "a"])

  disposeReaction()
})

test("reaction equals function only invoked when necessary", () => {
  suppressConsole(() => {
    const comparisons: { from: string; to: string }[] = []
    const loggingComparer = (from: string, to: string) => {
      comparisons.push({ from, to })
      return from === to
    }

    const left = fobx.observableBox("A")
    const right = fobx.observableBox("B")

    const values: string[] = []
    const disposeReaction = fobx.reaction(
      // Note: exceptions thrown here are intentional!
      () => left.get().toLowerCase() + right.get().toLowerCase(),
      (value) => values.push(value),
      { comparer: loggingComparer, fireImmediately: true },
    )

    // No comparison should be made on the first value
    expect(comparisons).toEqual([])

    // First change will cause a comparison
    left.set("C")
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Exception in the reaction expression won't cause a comparison
    // @ts-expect-error - causing exception on purpose
    left.set(null)
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Another exception in the reaction expression won't cause a comparison
    // @ts-expect-error - causing exception on purpose
    right.set(null)
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Transition from exception in the expression will cause a comparison with the last valid value
    left.set("D")
    right.set("E")
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
    ])

    // Another value change will cause a comparison
    right.set("F")
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
      { from: "de", to: "df" },
    ])

    expect(values).toEqual(["ab", "cb", "de", "df"])

    disposeReaction()
  })
})
