import * as fobx from "@fobx/core"
import { expect, test } from "@fobx/testing"

function delay<T>(time: number, value: T, shouldThrow = false) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (shouldThrow) reject(value)
      else resolve(value)
    }, time)
  })
}

test("it should support async generator actions", async () => {
  const values: number[] = []
  const x = fobx.observable({ a: 1 })
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const f = fobx.flow(function* (initial: number) {
    x.a = initial // this runs in action
    x.a = (yield delay(10, 3)) as number // and this as well!
    yield delay(10, 0)
    x.a = 4
    return x.a
  })

  const result = await f(2)
  expect(result).toBe(4)
  expect(values).toEqual([1, 2, 3, 4])
})

test("it should support try catch in async generator", async () => {
  const values: number[] = []
  const x = fobx.observable({ a: 1 })
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const f = fobx.flow(function* (initial) {
    x.a = initial // this runs in action
    try {
      x.a = (yield delay(10, 5, true)) as number // and this as well!
      yield delay(10, 0)
      x.a = 4
    } catch (e) {
      x.a = e as number
    }
    return x.a
  })

  const v = await f(2)
  expect(v).toBe(5)
  expect(values).toEqual([1, 2, 5])
})

test("it should support throw from async generator", () => {
  return fobx
    .flow(function* () {
      yield "a"
      throw 7
    })()
    .then(
      () => {
        expect("").toBe("should fail test if this case hits")
      },
      (e) => {
        expect(e).toBe(7)
      },
    )
})

test("it should support throw from yielded promise generator", () => {
  return fobx
    .flow(function* () {
      return yield delay(10, 7, true)
    })()
    .then(
      () => {
        expect("").toBe("should fail test if this case hits")
      },
      (e) => {
        expect(e).toBe(7)
      },
    )
})

test("flow function as instance member of class", async () => {
  const values: number[] = []

  class X {
    a = 1

    f = fobx.flow(function* (this: X, initial: number) {
      this.a = initial // this runs in action
      try {
        this.a = yield delay(10, 5, true) // and this as well!
        yield delay(10, 0)
        this.a = 4
      } catch (e) {
        this.a = e as number
      }
      return this.a
    })
    constructor() {
      fobx.observable(this)
    }
  }
  const x = new X()
  expect(fobx.isAction(x.f)).toBe(false)
  expect(fobx.isFlow(x.f)).toBe(true)

  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const v = await x.f(2)
  expect(v).toBe(5)
  expect(x.a).toBe(5)
  expect(values).toEqual([1, 2, 5])
})

test("flow function on class prototype", async () => {
  const values: number[] = []

  class X {
    a = 1;

    *f(initial: number) {
      this.a = initial // this runs in action
      try {
        this.a = yield delay(10, 5, true) // and this as well!
        yield delay(10, 0)
        this.a = 4
      } catch (e) {
        this.a = e as number
      }
      return this.a
    }

    constructor() {
      fobx.observable(this)
    }
  }
  const x = new X()
  expect(fobx.isAction(x.f)).toBe(false)
  expect(fobx.isFlow(x.f)).toBe(true)

  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const v = await x.f(2)
  expect(v).toBe(5)
  expect(x.a).toBe(5)
  expect(values).toEqual([1, 2, 5])
})

test("flows yield anything", async () => {
  const start = fobx.flow(function* () {
    const x = yield 2
    return x
  })

  const res = await start()
  expect(res).toBe(2)
})

test("it should support explicit flow annotation", async () => {
  const values: number[] = []

  class X {
    a = 1

    f = function* (this: X, initial: number) {
      this.a = initial // this runs in action
      try {
        this.a = yield delay(100, 5, true) // and this as well!
        yield delay(100, 0)
        this.a = 4
      } catch (e) {
        this.a = e as number
      }
      return this.a
    }
    constructor() {
      fobx.observable(this, {
        f: "flow",
      })
    }
  }

  const x = new X()
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const x2 = new X()
  expect(x2.f).not.toBe(x.f) // local field!

  const v = await x.f(2)
  expect(v).toBe(5)
  expect(values).toEqual([1, 2, 5])
  expect(x.a).toBe(5)
})

test("it should support implicit flow annotation", async () => {
  const values: number[] = []

  class X {
    a = 1;

    *f(initial: number) {
      this.a = initial // this runs in action
      try {
        this.a = yield delay(100, 5, true) // and this as well!
        yield delay(100, 0)
        this.a = 4
      } catch (e) {
        this.a = e as number
      }
      return this.a
    }

    constructor() {
      fobx.observable(this)
    }
  }

  const x = new X()
  expect(fobx.isFlow(X.prototype.f)).toBe(true)
  expect(Object.getOwnPropertyDescriptor(x, "f")).toBe(undefined)

  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const v = await x.f(2)
  expect(v).toBe(5)
  expect(values).toEqual([1, 2, 5])
  expect(x.a).toBe(5)
})

test("verify #2519", async () => {
  const values: number[] = []
  const x = fobx.observable({ a: 1 })
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const f = fobx.flow(function* (initial: number) {
    x.a = initial // this runs in action
    try {
      x.a = (yield delay(10, 5, false)) as number // and this as well!
      yield delay(10, 0)
      x.a = 4
    } catch (e) {
      x.a = e as number
    }
    return x.a
  })

  const v = await f(2)

  expect(v).toBe(4)
  expect(values).toEqual([1, 2, 5, 4])
})

test("flow is called with correct context", async () => {
  const thisArg = {}
  const f = fobx.flow(function* (this: object) {
    yield delay(10, 0)
    expect(this).toBe(thisArg)
  })
  await f.call(thisArg)
})

// TODO: add ability to cancel flows
// test("flows are cancelled with an instance of FlowCancellationError", async () => {
//   const start = flow(function* () {
//       yield Promise.resolve()
//   })

//   const promise = start()

//   promise.cancel()
//   await expect(promise).rejects.toBeInstanceOf(FlowCancellationError)
// })

// test("FlowCancellationError sanity check", () => {
//   const cancellationError = new FlowCancellationError()
//   expect(cancellationError).toBeInstanceOf(Error)
//   expect(cancellationError).toBeInstanceOf(FlowCancellationError)
//   expect(cancellationError.message).toBe("FLOW_CANCELLED")
// })

// test("isFlowCancellationError returns true iff the argument is a FlowCancellationError", () => {
//   expect(isFlowCancellationError(new FlowCancellationError())).toBe(true)
//   expect(isFlowCancellationError(new Error("some random error"))).toBe(false)
// })

// test("flows can be cancelled - 1 - uncaught cancellation", done => {
//   let steps = 0
//   const start = flow(function* () {
//       steps = 1
//       yield Promise.resolve()
//       steps = 2
//   })

//   const promise = start()
//   promise.then(
//       () => {
//           fail()
//       },
//       err => {
//           expect(steps).toBe(1)
//           expect("" + err).toBe("Error: FLOW_CANCELLED")
//           done()
//       }
//   )
//   promise.cancel()
// })

// test("flows can be cancelled - 2 - finally clauses are run", done => {
//   let steps = 0
//   let finallyHandled = false
//   const start = flow(function* () {
//       steps = 1
//       try {
//           yield Promise.resolve()
//           steps = 2
//       } finally {
//           expect(steps).toBe(1)
//           finallyHandled = true
//       }
//   })
//   const promise = start()
//   promise.then(
//       () => {
//           fail()
//       },
//       err => {
//           expect("" + err).toBe("Error: FLOW_CANCELLED")
//           expect(finallyHandled).toBeTruthy()
//           done()
//       }
//   )
//   promise.cancel()
// })

// test("flows can be cancelled - 3 - throw in finally should be caught", done => {
//   const counter = mobx.observable({ counter: 0 })
//   const d = mobx.reaction(
//       () => counter.counter,
//       () => {}
//   )
//   mobx.configure({ enforceActions: "observed" })

//   const start = flow(function* () {
//       counter.counter = 1
//       try {
//           yield Promise.resolve()
//           counter.counter = 15
//       } finally {
//           counter.counter = 4
//           throw "OOPS"
//       }
//   })

//   const promise = start()
//   promise.then(
//       () => fail("flow should not have failed"),
//       err => {
//           expect("" + err).toBe("OOPS")
//           expect(counter.counter).toBe(4)
//           mobx.configure({ enforceActions: "never" })
//           d()
//           done()
//       }
//   )
//   promise.cancel()
// })

// test("flows can be cancelled - 4 - pending Promise will be ignored", done => {
//   let steps = 0
//   const start = flow(function* () {
//       steps = 1
//       yield Promise.reject("This won't be caught anywhere!") // cancel will resolve this flow before this one is throw, so this promise goes uncaught
//       steps = 2
//   })

//   const promise = start()
//   promise.then(
//       () => fail(),
//       err => {
//           expect(steps).toBe(1)
//           expect("" + err).toBe("Error: FLOW_CANCELLED")
//           done()
//       }
//   )
//   promise.cancel()
// })

// test("flows can be cancelled - 5 - return before cancel", done => {
//   const start = flow(function* () {
//       return Promise.resolve(2) // cancel will be to late..
//   })

//   const promise = start()
//   promise.then(
//       value => {
//           expect(value).toBe(2), done()
//       },
//       () => {
//           fail()
//       }
//   )
//   promise.cancel() // no-op
// })

// test("flows can be cancelled - 5 - flows cancel recursively", done => {
//   let flow1cancelled = false
//   let flow2cancelled = false
//   let stepsReached = 0

//   const flow1 = flow(function* () {
//       try {
//           yield Promise.resolve()
//           stepsReached++
//       } finally {
//           flow1cancelled = true
//       }
//   })

//   const flow2 = flow(function* () {
//       try {
//           yield flow1()
//           stepsReached++
//       } finally {
//           flow2cancelled = true
//       }
//   })

//   const p = flow2()
//   p.then(
//       () => fail(),
//       err => {
//           expect("" + err).toBe("Error: FLOW_CANCELLED")
//           expect(stepsReached).toBe(0)
//           expect(flow2cancelled).toBeTruthy()
//           expect(flow1cancelled).toBeTruthy()
//           done()
//       }
//   )
//   p.cancel()
// })
// test("cancelled flow should not result in runaway reject", async () => {
//   const start = flow(function* () {
//       try {
//           const x = yield 2
//           return x
//       } finally {
//           yield Promise.reject("Oh noes")
//           return 4
//       }
//   })

//   const p = start()
//   p.cancel()
//   try {
//       await p
//       fail()
//   } catch (e) {
//       expect("" + e).toBe("Error: FLOW_CANCELLED")
//   }
// })
