import {
  autorun,
  box,
  computed,
  configure,
  isComputed,
  isTransaction,
  observable,
  reaction,
  runInTransaction,
  transaction,
} from "../../index.ts"
import {
  beforeEach,
  expect,
  fn,
  grabConsole,
  suppressConsole,
  test,
} from "@fobx/testing"

beforeEach(() => {
  configure({ enforceActions: false })
})

test("multiple state changes can occur within a transaction with only 1 side effect", () => {
  const obs = box(0)

  const increment = transaction((by: number) => {
    obs.set(obs.get() + by * 2)
    obs.set(obs.get() - by)
  })

  const reactionFn = fn()
  const d = reaction(() => obs.get(), reactionFn)

  increment(7)

  expect(reactionFn).toHaveBeenCalledTimes(1)
  expect(reactionFn).toHaveBeenCalledWith(7, 0, expect.anything())
  d()
})

test("transactions can safely use externally scoped variables", () => {
  const obs = box(1)
  let i = 3
  let b = 0

  const d = reaction(
    () => obs.get() * 2,
    (newValue) => {
      b = newValue
    },
  )

  const act = transaction(() => {
    obs.set(++i)
  })

  expect(b).toBe(0)
  act()
  expect(b).toBe(8)
  act()
  expect(b).toBe(10)
  d()
})

test("transactions setting observables read by computed result in correct value", () => {
  const obs = box(1)
  const double = computed(() => obs.get() * 2)
  let b = 0

  const d = reaction(
    () => double.get(),
    (newVal) => {
      b = newVal
    },
    { fireImmediately: true },
  )

  const act = transaction(() => {
    obs.set(obs.get() + 1)
  })

  expect(b).toBe(2)
  act()
  expect(b).toBe(4)
  act()
  expect(b).toBe(6)
  d()
})

test("transaction is untracked", () => {
  const a = box(3)
  const b = box(4)

  let latest = 0
  let runs = 0

  const act = transaction((baseValue: number) => {
    b.set(baseValue * 2)
    latest = b.get()
  })

  const d = autorun(() => {
    runs++
    const current = a.get()
    act(current)
  })

  expect(b.get()).toBe(6)
  expect(latest).toBe(6)

  a.set(7)
  expect(b.get()).toBe(14)
  expect(latest).toBe(14)

  a.set(8)
  expect(b.get()).toBe(16)
  expect(latest).toBe(16)

  b.set(7)
  expect(a.get()).toBe(8)
  expect(b.get()).toBe(7)
  expect(latest).toBe(16)

  a.set(3)
  expect(b.get()).toBe(6)
  expect(latest).toBe(6)

  expect(runs).toBe(4)
  d()
})

test("should be able to create autorun within transaction", () => {
  const a = box(1)
  const values: number[] = []

  const adder = transaction((inc: number) => {
    return autorun(() => {
      values.push(a.get() + inc)
    })
  })

  const d1 = adder(2)
  a.set(3)

  const d2 = adder(17)
  a.set(24)
  d1()
  a.set(11)
  d2()
  a.set(100)

  expect(values).toEqual([3, 5, 20, 26, 41, 28])
})

test("should be able to change unobserved state in a transaction called from a computed", () => {
  const a = box(2)
  const testAction = transaction(() => {
    a.set(3)
  })
  const c = computed(() => {
    testAction()
  })
  const d = autorun(() => {
    c.get()
  })

  expect(a.get()).toBe(3)
  d()
})

// TODO: enforceActions warning not yet implemented in v2 — box/observable setters don't check enforceActions
test.skip("should be able to change observed state in a transaction called from a computed", () => {
  configure({ enforceActions: true })

  const a = box(2)
  const d = autorun(() => {
    a.get()
  })
  const testAction = transaction(() => {
    a.set(5)
    expect(a.get()).toBe(5)
  })

  const c = computed(() => {
    // changing value outside of transaction issues a warning, but still changes the value.
    expect(
      grabConsole(() => {
        a.set(4)
      }),
    ).toMatch(
      /<STDERR> \[@fobx\/core\] Changing tracked observable values.*outside of a transaction is discouraged/,
    )
    expect(a.get()).toBe(4)

    // changing a value inside of a transaction does not issue a warning
    expect(grabConsole(testAction)).toEqual("")
    return a.get()
  })

  expect(c.get()).toBe(5)
  d()
})

test("transaction should not be converted to computed when using observable", () => {
  const a = observable({
    a: 1,
    // deno-lint-ignore no-explicit-any
    b: transaction(function (this: any) {
      this.a++
    }),
  })

  expect(isComputed(a.b)).toBe(false)
  expect(isTransaction(a.b)).toBe(true)
  a.b()
  expect(a.a).toBe(2)
})

test("exceptions thrown inside of transaction should not effect global state", () => {
  // this makes sure that the catch block was in fact hit.
  expect.assertions(3)

  let autorunTimes = 0

  const todo = observable({
    count: 0,
    // deno-lint-ignore no-explicit-any
    add: transaction(function (this: any) {
      this.count++
      if (this.count === 2) {
        throw new Error("An Action Error!")
      }
    }),
  })

  autorun(() => {
    autorunTimes++
    return todo.count
  })
  try {
    todo.add()
    expect(autorunTimes).toBe(2)
    todo.add()
  } catch {
    expect(autorunTimes).toBe(3)
    todo.add()
    expect(autorunTimes).toBe(4)
  }
})

test("runInTransaction", () => {
  expect.assertions(4)
  configure({ enforceActions: true })
  const values: number[] = []

  const obs = box(0)
  const d = autorun(() => values.push(obs.get()))

  let result = runInTransaction(() => {
    obs.set(obs.get() + 6 * 2)
    obs.set(obs.get() - 3)
    return 2
  })

  expect(result).toBe(2)
  expect(values).toEqual([0, 9])

  result = runInTransaction(() => {
    obs.set(obs.get() + 5 * 2)
    obs.set(obs.get() - 4)
    return 3
  })

  expect(result).toBe(3)
  expect(values).toEqual([0, 9, 15])
  d()
})

test("transaction in autorun does not keep / make computed values alive", () => {
  let calls = 0
  const c = computed(() => {
    calls++
  })
  const callComputedTwice = () => {
    c.get()
    c.get()
  }

  const runWithMemoizing = (fun: () => void) => {
    autorun(fun)()
  }

  callComputedTwice()
  expect(calls).toBe(2)

  runWithMemoizing(callComputedTwice)
  expect(calls).toBe(3)

  callComputedTwice()
  expect(calls).toBe(5)

  runWithMemoizing(() => {
    runInTransaction(callComputedTwice)
  })
  expect(calls).toBe(6)

  callComputedTwice()
  expect(calls).toBe(8)
})

test("computed values and transactions", () => {
  let calls = 0

  const number = box(1)
  const squared = computed(() => {
    calls++
    return number.get() * number.get()
  })

  const changeNumber10Times = transaction(() => {
    squared.get()
    squared.get()
    for (let i = 0; i < 10; i++) {
      number.set(number.get() + 1)
    }
  })

  changeNumber10Times()
  expect(calls).toBe(1)

  autorun(() => {
    changeNumber10Times()
    expect(calls).toBe(2)
  })()
  expect(calls).toBe(2)

  changeNumber10Times()
  expect(calls).toBe(3)
})

test("observable respects action annotations", () => {
  const x = observable(
    {
      a1() {
        return this
      },
      a2() {
        return this
      },
      a3() {
        return this
      },
    },
    {
      a1: "transaction",
      a2: "transaction.bound",
      a3: "none",
    },
  )

  const { a1, a2, a3 } = x
  //plain action should behave as non-annotated function with respect to 'this'
  expect(isTransaction(x.a1)).toBe(true)
  // TODO: strict mode in js is on always in deno so cannot check globalThis
  // expect(a1()).toBe(globalThis)
  expect(a1.call(x)).toBe(x)
  expect(isTransaction(x.a3)).toBe(false)
  // TODO: strict mode in js is on always in deno so cannot check globalThis
  // expect(a3()).toBe(globalThis)
  expect(a3.call(x)).toBe(x)

  // a2 is bound so calling it with another "this" doesn't result in x changing.
  expect(isTransaction(x.a2)).toBe(true)
  expect(a2()).toBe(x)
  expect(a2.call({})).toBe(x)
})

test("expect error for invalid annotation", () => {
  expect(() => {
    // @ts-expect-error - purposefully passing something not supported by the type definition
    observable({ x: 1 }, { x: "bad" })
  }).toThrow(/Unknown annotation/)
})

test("bound actions bind", () => {
  let called = 0
  const src = {
    y: 0,
    z: function (v: number) {
      this.y += v
      this.y += v
    },
    get yValue() {
      called++
      return this.y
    },
  }

  const x = observable(src, {
    z: "transaction.bound",
  })

  const d = autorun(() => {
    x.yValue
  })
  const runner = x.z
  runner(3)
  expect(x.yValue).toBe(6)
  expect(called).toBe(2)

  expect(Object.keys(src)).toEqual(["y", "z", "yValue"])
  expect(Object.keys(x)).toEqual(["y", "z", "yValue"])

  d()
})

test("reaction errors should be suppressed if transaction threw an error first", () => {
  const messages = suppressConsole(() => {
    try {
      const a = box(3)
      autorun(() => {
        if (a.get() === 4) throw new Error("Reaction error")
      })

      transaction(() => {
        a.set(4)
        throw new Error("Action error")
      })()
    } catch (e) {
      expect((e as Error).toString()).toEqual("Error: Action error")
      console.error(e)
    }
  })

  const expected = [
    /<STDERR> \[@fobx\/core\] ".+" exception suppressed because a transaction threw an error first. Fix the transaction's error./,
    /<STDERR> Error: Action error/,
  ]
  messages.forEach((msg, index) => {
    expect(msg).toMatch(expected[index])
  })
})

test("reaction errors should not be suppressed if transaction didn't throw an error", () => {
  const message = grabConsole(() => {
    const a = box(3)
    autorun(() => {
      if (a.get() === 4) throw new Error("Reaction error")
    })

    transaction(() => {
      a.set(4)
    })()
  })

  expect(message).toMatch(
    /<STDERR> \[@fobx\/core\] "Autorun@.*" threw an exception/,
  )
})

test("given transaction name, the function name should be defined as the name", () => {
  const a1 = transaction(() => {}, { name: "testAction" })
  expect(a1.name).toBe("testAction")
})

test("given anonymous transaction, the name should be <unnamed transaction>", () => {
  const a1 = transaction(() => {})
  expect(a1.name).toBe("<unnamed transaction>")
})

test("given function declaration, the transaction name should be as the function name", () => {
  const a1 = transaction(function testAction() {})
  expect(a1.name).toBe("testAction")
})
