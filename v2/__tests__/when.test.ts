import * as fobx from "../index.ts"
import { beforeAll, expect, FakeTime, fn, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

test("when reaction disposes itself once condition is met", () => {
  const a = fobx.box(0)
  let runs = 0

  fobx.when(
    () => a.get() === 1,
    () => {
      runs += 1
    },
  )

  a.set(1)
  expect(runs).toBe(1)

  // the reaction was disposed so changing the value to 1 again doesn't cause another run
  a.set(2)
  a.set(1)
  expect(runs).toBe(1)
})

test("when reaction does nothing when disposed before condition is met", () => {
  const a = fobx.box(0)
  let runs = 0

  const dispose = fobx.when(
    () => a.get() === 1,
    () => {
      runs += 1
    },
  )
  dispose()

  // reaction is disposed, so even if condition is met it doesn't run
  a.set(1)
  expect(runs).toBe(0)
})

test("async when resolves when condition is met", async () => {
  const a = fobx.box(0)

  const p = fobx.when(() => a.get() === 1)
  a.set(1)
  await p
})

test("async when rejects when timeout hits", async () => {
  const p = fobx.when(() => false, { timeout: 1 })
  expect.assertions(1)
  try {
    await p
  } catch (e) {
    expect(e).toEqual(Error("Timeout waiting for condition"))
  }
})
