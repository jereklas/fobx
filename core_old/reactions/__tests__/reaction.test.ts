import {
  type ReactionWithAdmin,
  ReactionWithoutBatch,
  runReactions,
} from "../reaction.ts"
import type { ObservableBoxWithAdmin } from "../../observables/observableBox.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import {
  beforeEach,
  describe,
  expect,
  fn,
  grabConsole,
  test,
} from "@fobx/testing"

const globalState = fobx.getGlobalState()
const onReactionError = fn()
beforeEach(() => {
  onReactionError.mockClear()
  fobx.configure({ enforceActions: false, onReactionError })
})

describe("Reaction", () => {
  test("observables are tracked as expected", () => {
    const sideEffectFn = fn()
    const val1 = fobx.observableBox("a") as ObservableBoxWithAdmin
    const val2 = fobx.observableBox(1) as ObservableBoxWithAdmin
    const val3 = fobx.observableBox(true) as ObservableBoxWithAdmin
    const dispose = fobx.reaction(() => {
      return [val1.value, val2.value, val3.value]
    }, sideEffectFn)

    expect(val1[$fobx].observers.length).toBe(1)
    expect(val2[$fobx].observers.length).toBe(1)
    expect(val3[$fobx].observers.length).toBe(1)
    dispose()
  })
})

describe("reaction", () => {
  test("side effect function is ran when observable value(s) change", () => {
    const val1 = fobx.observableBox(1)
    const val2 = fobx.observableBox(2)
    const sideEffectFn1 = fn()
    let dispose = fobx.reaction(() => {
      return [val1.value, val2.value]
    }, sideEffectFn1)
    // change first observable
    val1.value = 3
    expect(sideEffectFn1).toHaveBeenCalledTimes(1)
    expect(sideEffectFn1).toHaveBeenCalledWith(
      [3, 2],
      [1, 2],
      expect.anything(),
    )

    // change second observable
    sideEffectFn1.mockClear()
    val2.value = 1
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
      return val1.value
    }, sideEffectFn2)
    val1.value = 10
    expect(sideEffectFn2).toHaveBeenCalledTimes(1)
    expect(sideEffectFn2).toHaveBeenCalledWith(10, 3, expect.anything())
    dispose()
  })

  test("side effect function is not ran when observable is re-assigned same value", () => {
    const obs = fobx.observableBox(1)
    const sideEffectFn = fn()
    const dispose = fobx.reaction(() => obs.value, sideEffectFn)
    obs.value = 1
    expect(sideEffectFn).not.toHaveBeenCalled()
    dispose()
  })

  test("dispose removes observables from being tracked and prevents sideEffectFn from being called", () => {
    const val = fobx.observableBox(0) as ObservableBoxWithAdmin
    let r!: ReactionWithAdmin
    const sideEffectFn = fn((_n, _o, reaction) => {
      r = reaction
    })
    const dispose = fobx.reaction(() => {
      return val.value
    }, sideEffectFn)
    // value change caused sideEffectFn to run
    val.value = 10
    expect(val[$fobx].observers.length).toBe(1)
    expect(val[$fobx].observers.includes(r[$fobx])).toBe(true)
    expect(r[$fobx].dependencies.length).toBe(1)
    expect(r[$fobx].dependencies.indexOf(val[$fobx] as never)).not.toBe(-1)
    expect(sideEffectFn).toHaveBeenCalledTimes(1)
    expect(sideEffectFn).toHaveBeenCalledWith(10, 0, r)

    // dispose removes tracking
    sideEffectFn.mockClear()
    dispose()
    expect(val[$fobx].observers.length).toBe(0)
    expect(r[$fobx].dependencies.length).toBe(0)
    // value change doesn't cause sideEffectFn to run
    val.value = 5
    expect(sideEffectFn).not.toHaveBeenCalled()
  })
})

test("An exception thrown in the side effect gets logged to stderr", () => {
  const a = fobx.observableBox(0)
  fobx.reaction(
    () => a.value,
    () => {
      throw Error("hmm")
    },
  )

  expect(
    grabConsole(() => {
      a.value += 1
    }),
  ).toMatch(/<STDERR> \[@fobx\/core\] "Reaction@.* threw an exception\./)
  expect(onReactionError).toHaveBeenCalledWith(Error("hmm"), expect.anything())
})

test("The non batching reaction runs as expected", () => {
  const a = fobx.observableBox(0)
  let called = -1
  const reaction = new ReactionWithoutBatch(new fobx.ReactionAdmin(() => run()))

  const run = () => {
    reaction.track(() => {
      called += 1
      a.value
    })
  }
  run()
  expect(called).toBe(0)

  a.value += 1
  expect(called).toBe(1)
})

test("runReactions issues message to stderr if reactions can't run", () => {
  const mock = fn()
  let r!: ReactionWithAdmin
  fobx.reaction((re) => {
    r = re as ReactionWithAdmin
  }, mock)
  expect(mock).not.toHaveBeenCalled()

  const adm = r[$fobx]
  adm.canRun = () => false

  globalState.pendingReactions.push(adm)
  expect(globalState.pendingReactions.length).toBe(1)

  expect(
    grabConsole(() => {
      runReactions()
    }),
  ).toEqual(
    "<STDERR> [@fobx/core] Failed to run all reactions. This typically means a bad circular reaction.",
  )
})
