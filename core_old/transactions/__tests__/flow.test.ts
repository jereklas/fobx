import * as fobx from "@fobx/core"
import { expect, test } from "@fobx/testing"

test("named generator functions supplied to flow is retained", () => {
  const f = fobx.flow(function* something() {
    yield Promise.resolve()
  })

  expect(f.name).toBe("something")
})
