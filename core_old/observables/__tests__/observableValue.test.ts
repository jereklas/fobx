import type { ReactionWithAdmin } from "../../reactions/reaction.ts"
import type { ObservableBoxWithAdmin } from "../observableBox.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("ObservableBox", () => {
  test("wraps supplied value in an object", () => {
    const str = fobx.observableBox("a") as ObservableBoxWithAdmin
    expect(str[$fobx].observers.length).toBe(0)
    expect(str[$fobx].name).toBe("ObservableBox@1")
    expect(str.value).toBe("a")

    const num = fobx.observableBox(10) as ObservableBoxWithAdmin
    expect(num.value).toBe(10)
    expect(num[$fobx].name).toBe("ObservableBox@2")
    expect(num[$fobx].observers.length).toBe(0)
  })

  test("are correctly associated with the reaction when dereferenced.", () => {
    const obs1 = fobx.observableBox("a") as ObservableBoxWithAdmin
    const obs2 = fobx.observableBox("b") as ObservableBoxWithAdmin
    let r!: ReactionWithAdmin
    const dispose = fobx.reaction(
      () => {
        return [obs1.value, obs2.value]
      },
      fn((_n, _o, reaction) => {
        r = reaction as unknown as ReactionWithAdmin
      }),
    )
    // force reaction to run once so we can have reference to reaction
    obs1.value = "c"

    expect(r[$fobx].dependencies.length).toBe(2)
    expect(r[$fobx].dependencies.indexOf(obs1[$fobx])).not.toBe(-1)
    expect(r[$fobx].dependencies.indexOf(obs2[$fobx])).not.toBe(-1)

    expect(obs1[$fobx].observers.length).toBe(1)
    expect(obs2[$fobx].observers.length).toBe(1)
    expect(obs1[$fobx].observers.includes(r[$fobx])).toBe(true)
    expect(obs2[$fobx].observers.includes(r[$fobx])).toBe(true)
    dispose()
  })
})
