import * as fobx from "../../index.ts"
import { expect, test } from "@fobx/testing"

function delay<T>(time: number, value: T, shouldThrow = false) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (shouldThrow) reject(value)
      else resolve(value)
    }, time)
  })
}

// ─── Named function retention ─────────────────────────────────────────────────

test("named generator functions supplied to flow is retained", () => {
  const f = fobx.flow(function* something() {
    yield Promise.resolve()
  })

  expect(f.name).toBe("something")
})

// ─── Basic async generator flow ───────────────────────────────────────────────

test("it should support async generator actions", async () => {
  const values: number[] = []
  const x = fobx.observable({ a: 1 })
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const f = fobx.flow(function* (initial: number) {
    x.a = initial
    x.a = (yield delay(10, 3)) as number
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

  const f = fobx.flow(function* (initial: number) {
    x.a = initial
    try {
      x.a = (yield delay(10, 5, true)) as number
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

test("flows yield anything", async () => {
  const start = fobx.flow(function* () {
    const x = yield 2
    return x
  })

  const res = await start()
  expect(res).toBe(2)
})

// ─── this-binding ─────────────────────────────────────────────────────────────

test("flow is called with correct context", async () => {
  const thisArg = {}
  // @ts-ignore - not worried about type in test
  const f = fobx.flow(function* (this: object) {
    yield delay(10, 0)
    expect(this).toBe(thisArg)
  })
  await f.call(thisArg)
})

// ─── Class usage ──────────────────────────────────────────────────────────────

test("flow function as instance member of class", async () => {
  const values: number[] = []

  class X {
    a = 1

    // @ts-ignore - not worried about type in test
    f = fobx.flow(function* (this: X, initial: number) {
      this.a = initial
      try {
        this.a = yield delay(10, 5, true)
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
  expect(fobx.isTransaction(x.f)).toBe(false)
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
      this.a = initial
      try {
        this.a = yield delay(10, 5, true)
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
  expect(fobx.isTransaction(x.f)).toBe(false)
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

// ─── Annotation-based usage ───────────────────────────────────────────────────

test("it should support explicit flow annotation", async () => {
  const values: number[] = []

  class X {
    a = 1

    f = function* (this: X, initial: number) {
      this.a = initial
      try {
        this.a = yield delay(100, 5, true)
        yield delay(100, 0)
        this.a = 4
      } catch (e) {
        this.a = e as number
      }
      return this.a
    }
    constructor() {
      fobx.observable(this, {
        annotations: { f: "flow" },
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
  expect(x2.f).not.toBe(x.f) // local field, different instance

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
      this.a = initial
      try {
        this.a = yield delay(100, 5, true)
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

test("flow resolves correctly when promise succeeds", async () => {
  const values: number[] = []
  const x = fobx.observable({ a: 1 })
  fobx.reaction(
    () => x.a,
    (v) => values.push(v),
    { fireImmediately: true },
  )

  const f = fobx.flow(function* (initial: number) {
    x.a = initial
    try {
      x.a = (yield delay(10, 5, false)) as number
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

// ─── isFlow ───────────────────────────────────────────────────────────────────

test("isFlow returns true for flow-wrapped functions", () => {
  const f = fobx.flow(function* () {
    yield Promise.resolve()
  })
  expect(fobx.isFlow(f)).toBe(true)
})

test("isFlow returns false for regular functions", () => {
  expect(fobx.isFlow(() => {})).toBe(false)
  expect(fobx.isFlow(function () {})).toBe(false)
})

test("isFlow returns false for transactions", () => {
  const t = fobx.transaction(() => {})
  expect(fobx.isFlow(t)).toBe(false)
})
