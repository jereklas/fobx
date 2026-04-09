import * as fobx from "../../index.ts"
import { expect, test } from "@fobx/testing"

fobx.configure({ enforceTransactions: false })

test("computed values correctly re-compute after a suspended state", () => {
  const o = fobx.observable({
    _a: 1,
    get a() {
      return this._a
    },
    set a(val: number) {
      this._a = val
    },
  })

  let value = 0
  let dispose = fobx.autorun(() => {
    value = o.a
  })
  expect(value).toBe(1)

  dispose()
  o.a = 4

  dispose = fobx.autorun(() => {
    value = o.a
  })
  expect(value).toBe(4)
})

test("computed values correctly re-compute after a suspended state #2", () => {
  const o = fobx.observable({
    _a: 1,
    c: false,
    get a() {
      if (this.c) {
        return this._a
      }
      return this.b
    },

    get b() {
      return this._b
    },
    _b: 2,
  })

  let value = 0
  fobx.autorun(() => {
    value = o.a
  })
  expect(value).toBe(2)

  o.c = true
  expect(value).toBe(1)

  o._b = 3
  o.c = false
  expect(value).toBe(3)
})
