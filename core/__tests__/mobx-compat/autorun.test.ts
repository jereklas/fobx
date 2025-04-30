import * as fobx from "@fobx/core"
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

test("autorun passes Reaction as an argument to view function", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  fobx.autorun((r) => {
    expect(typeof r.dispose).toBe("function")
    if (a.value === 3) {
      r.dispose()
    }
    values.push(a.value)
  })

  a.value = 2
  a.value = 2
  a.value = 3
  a.value = 4

  expect(values).toEqual([1, 2, 3])
})

test("autorun can be disposed on first run", () => {
  const a = fobx.observableBox(1)
  const values: number[] = []

  fobx.autorun((r) => {
    r.dispose()
    values.push(a.value)
  })

  a.value = 2

  expect(values).toEqual([1])
})

test("autorun warns when passed an action", () => {
  const act = fobx.action(() => {})
  expect.assertions(1)
  expect(() => fobx.autorun(act)).toThrow(
    "[@fobx/core] Autorun cannot have an action as the tracked function.",
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
  const a = fobx.observableBox(0)
  const b = fobx.observableBox(0)
  const c = fobx.computed(() => a.value + b.value)
  const values: number[] = []

  fobx.autorun(() => {
    values.push(c.value)
    b.value = 100
  })

  a.value = 1
  expect(values).toEqual([0, 100, 101])
})

test("when effect is an action", async () => {
  using time = new FakeTime()
  const a = fobx.observableBox(0)

  let messages

  fobx.when(
    () => a.value === 1,
    () => {
      messages = suppressConsole(() => {
        a.value = 2
      })
    },
    { timeout: 1 },
  )

  fobx.runInAction(() => {
    a.value = 1
  })
  await time.runAllAsync()

  expect(messages).toEqual([])
})
