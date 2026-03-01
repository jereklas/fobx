import type { ReactionAdmin } from "../../global.ts"
import type { ObservableBox } from "../../box.ts"
import { $fobx } from "../../global.ts"
import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("ObservableBox", () => {
  test("wraps supplied value in an object", () => {
    const str = fobx.box("a") as ObservableBox<string>
    expect(str[$fobx].observers.length).toBe(0)
    expect(str[$fobx].name).toBe("Box@1")
    expect(str.get()).toBe("a")

    const num = fobx.box(10) as ObservableBox<number>
    expect(num.get()).toBe(10)
    expect(num[$fobx].name).toBe("Box@2")
    expect(num[$fobx].observers.length).toBe(0)
  })

  test("are correctly associated with the reaction when dereferenced.", () => {
    const obs1 = fobx.box("a")
    const obs2 = fobx.box("b")
    let r!: ReactionAdmin
    const dispose = fobx.reaction(
      () => {
        return [obs1.get(), obs2.get()]
      },
      fn(() => {}),
    )
    obs1.set("c")

    r = obs1[$fobx].observers[0]

    expect(r.deps.length).toBe(2)
    expect(r.deps.indexOf(obs1[$fobx])).not.toBe(-1)
    expect(r.deps.indexOf(obs2[$fobx])).not.toBe(-1)

    expect(obs1[$fobx].observers.length).toBe(1)
    expect(obs2[$fobx].observers.length).toBe(1)
    expect(obs1[$fobx].observers.includes(r)).toBe(true)
    expect(obs2[$fobx].observers.includes(r)).toBe(true)
    dispose()
  })
})
