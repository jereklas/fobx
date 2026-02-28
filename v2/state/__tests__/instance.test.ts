import { $instance, resolveComparer } from "../../instance.ts"
import * as fobx from "../../index.ts"
import { describe, expect, fn, test } from "@fobx/testing"

const isDifferent = (
  a: unknown,
  b: unknown,
  comparer: "default" | "structural",
) => {
  return !resolveComparer(comparer)(a, b)
}

describe("isDifferent", () => {
  test("throws error on structural compare if no structural compare has been configured", () => {
    expect(() => isDifferent("a", "a", "structural")).toThrow(
      "[@fobx/core] Need to supply a structural equality comparer in order to use struct comparisons. See 'configure' api for more details.",
    )
  })

  test("structural compare is not called when using default diff", () => {
    const compare = fn(() => true)
    fobx.configure({ comparer: { structural: compare } })

    expect(isDifferent("a", "a", "default")).toBe(false)
    expect(compare).not.toHaveBeenCalled()
  })
})

test("enforceActions is true by default, but can be set to false", () => {
  expect($instance.enforceActions).toBe(true)

  fobx.configure({ enforceActions: false })

  expect($instance.enforceActions).toBe(false)
})
