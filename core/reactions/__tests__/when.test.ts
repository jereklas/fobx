import * as fobx from "../../index.ts"
import { beforeAll, expect, FakeTime, fn, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

test("when reaction disposes itself once condition is met", () => {
  const a = fobx.observableBox(0)
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
  const a = fobx.observableBox(0)
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

test("when callback form aborts when AbortSignal aborts", () => {
  const a = fobx.observableBox(0)
  const controller = new AbortController()
  const onError = fn()
  let runs = 0

  fobx.when(
    () => a.get() === 1,
    () => {
      runs += 1
    },
    { signal: controller.signal, onError },
  )

  controller.abort()
  expect(onError).toHaveBeenCalledWith(Error("When reaction was aborted"))

  a.set(1)
  expect(runs).toBe(0)
})

test("when reaction throws timeout error if timeout was hit", () => {
  using time = new FakeTime()
  const a = fobx.observableBox(0)
  let runs = 0

  fobx.when(
    () => a.get() === 1,
    () => {
      runs += 1
    },
    { timeout: 100 },
  )

  expect(() => time.tick(100)).toThrow("When reaction timed out")
  // reaction is disposed when timeout occurs
  a.set(1)
  expect(runs).toBe(0)
})

test("when reaction calls onError function on timeout if one is provided", () => {
  using time = new FakeTime()
  const a = fobx.observableBox(0)
  const onError = fn()
  let runs = 0

  fobx.when(
    () => a.get() === 1,
    () => {
      runs += 1
    },
    { timeout: 100, onError },
  )

  expect(() => time.tick(100)).not.toThrow()
  expect(onError).toHaveBeenCalledWith(Error("When reaction timed out"))

  // reaction is disposed when timeout occurs
  a.set(1)
  expect(runs).toBe(0)
})

test("when reaction does nothing when timeout occurs after being disposed", () => {
  using time = new FakeTime()

  const dispose = fobx.when(
    () => false,
    () => {},
    { timeout: 100 },
  )
  dispose()

  expect(() => time.tick(100)).not.toThrow()
})

test("an error is thrown if onError is provided as an option to async when", () => {
  expect(() => fobx.when(() => false, { onError: fn() })).toThrow(
    "[@fobx/core] Cannot use onError option when using async when.",
  )
})

test("async when resolves when condition is met", async () => {
  const a = fobx.observableBox(0)

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
    expect(e).toEqual(Error("When reaction timed out"))
  }
})

test("async when rejects cancel is called", async () => {
  using _time = new FakeTime()
  const p = fobx.when(() => false, { timeout: 100 })
  expect.assertions(1)
  try {
    p.cancel()
    await p
  } catch (e) {
    expect(e).toEqual(Error("When reaction was canceled"))
  }
})

test("async when rejects when AbortSignal aborts", async () => {
  using _time = new FakeTime()
  const controller = new AbortController()

  const p = fobx.when(() => false, { timeout: 100, signal: controller.signal })
  expect.assertions(1)
  try {
    controller.abort()
    await p
  } catch (e) {
    expect(e).toEqual(Error("When reaction was aborted"))
  }
})
