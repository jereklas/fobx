import * as fobx from "../../index.ts"
import {
  beforeEach,
  expect,
  FakeTime,
  suppressConsole,
  test,
} from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

test("autorun passes Dispose function as an argument to view function", () => {
  const a = fobx.box(1)
  const values: number[] = []

  fobx.autorun((dispose) => {
    expect(typeof dispose).toBe("function")
    if (a.get() === 3) {
      dispose()
    }
    values.push(a.get())
  })

  a.set(2)
  a.set(2)
  a.set(3)
  a.set(4)

  expect(values).toEqual([1, 2, 3])
})

test("autorun can be disposed on first run", () => {
  const a = fobx.box(1)
  const values: number[] = []

  fobx.autorun((dispose) => {
    dispose()
    values.push(a.get())
  })

  a.set(2)

  expect(values).toEqual([1])
})

test("autorun warns when passed an action", () => {
  const act = fobx.transaction(() => {})
  expect(() => fobx.autorun(act)).toThrow(
    "[@fobx/core] Autorun cannot have a transaction as the tracked function.",
  )
})

test("autorun batches automatically", () => {
  let runs = 0
  let a1runs = 0
  let a2runs = 0

  const x = fobx.observable({
    a: 1,
    b: 1,
    c: 1,
    get d() {
      runs++
      return this.c + this.b
    },
  })

  const d1 = fobx.autorun(() => {
    a1runs++
    x.d // read
  })

  const d2 = fobx.autorun(() => {
    a2runs++
    x.b = x.a
    x.c = x.a
  })

  expect(a1runs).toBe(1)
  expect(a2runs).toBe(1)
  expect(runs).toBe(1)

  x.a = 17

  expect(a1runs).toBe(2)
  expect(a2runs).toBe(2)
  expect(runs).toBe(2)

  d1()
  d2()
})

test("autorun tracks invalidation of unbound dependencies", () => {
  const a = fobx.box(0)
  const b = fobx.box(0)
  const c = fobx.computed(() => a.get() + b.get())
  const values: number[] = []

  fobx.autorun(() => {
    values.push(c.get())
    b.set(100)
  })

  a.set(1)
  expect(values).toEqual([0, 100, 101])
})

test("when effect is an action", async () => {
  using time = new FakeTime()
  const a = fobx.box(0)

  let messages

  fobx.when(
    () => a.get() === 1,
    () => {
      messages = suppressConsole(() => {
        a.set(2)
      })
    },
    { timeout: 1 },
  )

  fobx.runInTransaction(() => {
    a.set(1)
  })
  await time.runAllAsync()

  expect(messages).toEqual([])
})
