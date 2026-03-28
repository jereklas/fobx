import type { ObservableBox } from "../observableBox.ts"
import { $fobx } from "../../state/global.ts"
import { observerCount, observerHas } from "../../state/global.ts"
import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("ObservableBox", () => {
  test("wraps supplied value in an object", () => {
    const str = fobx.observableBox("a") as ObservableBox<string>
    expect(observerCount(str[$fobx])).toBe(0)
    expect(str[$fobx].name).toBe("Box@1")
    expect(str.get()).toBe("a")

    const num = fobx.observableBox(10) as ObservableBox<number>
    expect(num.get()).toBe(10)
    expect(num[$fobx].name).toBe("Box@2")
    expect(observerCount(num[$fobx])).toBe(0)
  })

  test("are correctly associated with the reaction when dereferenced.", () => {
    const obs1 = fobx.observableBox("a")
    const obs2 = fobx.observableBox("b")
    const dispose = fobx.reaction(
      () => {
        return [obs1.get(), obs2.get()]
      },
      fn(() => {}),
    )
    obs1.set("c")

    // Get the reaction — with compact observers, extract from single ref or Set
    const obsField = obs1[$fobx].observers
    const r = obsField instanceof Set
      ? obsField.values().next().value!
      : obsField!

    expect(r.deps.length).toBe(2)
    expect(r.deps.indexOf(obs1[$fobx])).not.toBe(-1)
    expect(r.deps.indexOf(obs2[$fobx])).not.toBe(-1)

    expect(observerCount(obs1[$fobx])).toBe(1)
    expect(observerCount(obs2[$fobx])).toBe(1)
    expect(observerHas(obs1[$fobx], r)).toBe(true)
    expect(observerHas(obs2[$fobx], r)).toBe(true)
    dispose()
  })
})
