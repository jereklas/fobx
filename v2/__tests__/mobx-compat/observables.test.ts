// deno-lint-ignore-file no-explicit-any
import { deepEqual } from "fast-equals"
import * as fobx from "../../index.ts"
import { $fobx, _batchDepth, _pending } from "../../global.ts"
import {
  beforeAll,
  beforeEach,
  expect,
  grabConsole,
  suppressConsole,
  test,
} from "@fobx/testing"
import type { ObservableBox } from "../../box.ts"
import type { Computed } from "../../computed.ts"

beforeAll(() => {
  fobx.configure({ comparer: { structural: deepEqual } })
})

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

test("argument-less observable", () => {
  const a = fobx.box(undefined)

  expect(fobx.isObservable(a)).toBe(true)
  expect(a.get()).toBe(undefined)
})

test("basic", function () {
  const x = fobx.box(3)
  const b: number[] = []
  fobx.reaction(
    () => x.get(),
    (v) => {
      b.push(v)
    },
  )
  expect(3).toBe(x.get())

  x.set(5)
  expect(x.get()).toBe(5)
  expect(b).toEqual([5])
  expect(_batchDepth).toBe(0)
})

test("basic2", function () {
  const x = fobx.box(3)
  const z = fobx.computed(function () {
    return x.get() * 2
  })
  const y = fobx.computed(function () {
    return x.get() * 3
  })
  fobx.autorun(() => z.get())

  expect(z.get()).toBe(6)
  expect(y.get()).toBe(9)

  x.set(5)
  expect(z.get()).toBe(10)
  expect(y.get()).toBe(15)

  expect(_batchDepth).toBe(0)
})

test("computed with asStructure modifier", function () {
  const x1 = fobx.box(3)
  const x2 = fobx.box(5)
  const y = fobx.computed(
    function () {
      return {
        sum: x1.get() + x2.get(),
      }
    },
    { comparer: "structural" },
  )
  const b: { sum: number }[] = []

  fobx.autorun(() => {
    b.push(y.get())
  })

  expect(8).toBe(y.get().sum)
  x1.set(4)
  expect(9).toBe(y.get().sum)
  expect(b).toEqual([{ sum: 8 }, { sum: 9 }])

  fobx.runInTransaction(function () {
    // swap values, computation results is structurally unchanged
    x1.set(5)
    x2.set(4)
  })

  expect(b).toEqual([{ sum: 8 }, { sum: 9 }])
  expect(_batchDepth).toBe(0)
})

test("dynamic", function () {
  const x = fobx.box(3)
  const y = fobx.computed(function () {
    return x.get()
  })
  const b: number[] = []

  fobx.autorun(() => b.push(y.get()))

  expect(3).toBe(y.get()) // First evaluation here..

  x.set(5)
  expect(5).toBe(y.get())

  expect(b).toEqual([3, 5])
  expect(_batchDepth).toBe(0)
})

test("dynamic2", function () {
  const x = fobx.box(3)
  const y = fobx.computed(function () {
    return x.get() * x.get()
  })

  expect(9).toBe(y.get())
  const b: number[] = []
  fobx.reaction(
    () => y.get(),
    (v) => b.push(v),
  )

  x.set(5)
  expect(25).toBe(y.get())

  //no intermediate value 15!
  expect(b).toEqual([25])
  expect(_batchDepth).toBe(0)
})

test("box uses equals", function () {
  const x = fobx.box("a", {
    comparer: (oldValue, newValue) => {
      return oldValue.toLowerCase() === newValue.toLowerCase()
    },
  })

  const b: string[] = []
  fobx.reaction(
    () => x.get(),
    (v) => b.push(v),
  )

  x.set("A")
  x.set("b")
  x.set("B")
  x.set("C")

  expect(b).toEqual(["b", "C"])
  expect(_batchDepth).toBe(0)
})

test("box uses equals2", function () {
  const x = fobx.box("01", {
    comparer: (oldValue, newValue) => {
      return parseInt(oldValue) === parseInt(newValue)
    },
  })

  const y = fobx.computed(function () {
    return parseInt(x.get())
  })

  const b: number[] = []
  fobx.reaction(
    () => y.get(),
    (v) => b.push(v),
  )

  x.set("2")
  x.set("02")
  x.set("002")
  x.set("03")

  expect(b).toEqual([2, 3])
  expect(_batchDepth).toBe(0)
})

test("readme1", function () {
  const b: number[] = []

  const vat = fobx.box(0.2)
  const order = {} as {
    price: ObservableBox<number>
    priceWithVat: Computed<number>
  }
  order.price = fobx.box(10)
  // Prints: New price: 24
  // in TS, just: value(() => this.price() * (1+vat()))
  order.priceWithVat = fobx.computed(function () {
    return order.price.get() * (1 + vat.get())
  })

  fobx.reaction(
    () => order.priceWithVat.get(),
    (v) => b.push(v),
  )

  order.price.set(20)
  expect(b).toEqual([24])
  order.price.set(10)
  expect(b).toEqual([24, 12])
  expect(_batchDepth).toBe(0)
})

test("batch", function () {
  const buf: number[] = []
  const a = fobx.box(2)
  const b = fobx.box(3)
  const c = fobx.computed(function () {
    return a.get() * b.get()
  })
  const d = fobx.computed(function () {
    return c.get() * b.get()
  })
  fobx.reaction(
    () => d.get(),
    (v) => {
      buf.push(v)
    },
  )

  a.set(4)
  b.set(5)
  // Note, 60 should not happen! (that is d being computed before c after update of b)
  expect(buf).toEqual([36, 100])

  const x = fobx.runInTransaction(() => {
    a.set(2)
    b.set(3)
    a.set(6)
    expect(d[$fobx].value).toBe(100) // not updated; in transaction
    expect(d.get()).toBe(54) // consistent due to inspection
    return 2
  })

  expect(x).toBe(2) // test return value
  expect(buf).toEqual([36, 100, 54]) // only one new value for d
})

test("transaction with inspection", function () {
  const a = fobx.box(2)
  let calcs = 0
  const b = fobx.computed(function () {
    calcs++
    return a.get() * 2
  })

  // if not inspected during transaction, postpone value to end
  fobx.runInTransaction(function () {
    a.set(3)
    expect(b.get()).toBe(6)
    expect(calcs).toBe(1)
  })
  expect(b.get()).toBe(6)
  expect(calcs).toBe(2)

  // if inspected, evaluate eagerly
  fobx.runInTransaction(function () {
    a.set(4)
    expect(b.get()).toBe(8)
    expect(calcs).toBe(3)
  })
  expect(b.get()).toBe(8)
  expect(calcs).toBe(4)
})

test("transaction with inspection 2", function () {
  const a = fobx.box(2)
  let calcs = 0
  let b: number | undefined
  fobx.autorun(function () {
    calcs++
    b = a.get() * 2
  })

  // if not inspected during transaction, postpone value to end
  fobx.runInTransaction(function () {
    a.set(3)
    expect(b).toBe(4)
    expect(calcs).toBe(1)
  })
  expect(b).toBe(6)
  expect(calcs).toBe(2)

  // if inspected, evaluate eagerly
  fobx.runInTransaction(function () {
    a.set(4)
    expect(b).toBe(6)
    expect(calcs).toBe(2)
  })
  expect(b).toBe(8)
  expect(calcs).toBe(3)
})

test("scope", function () {
  const vat = fobx.box(0.2)
  const Order = function (this: any) {
    this.price = fobx.box(20)
    this.amount = fobx.box(2)
    this.total = fobx.computed(
      function (this: any) {
        return (1 + vat.get()) * this.price.get() * this.amount.get()
      },
      { bind: this },
    )
  }

  //@ts-expect-error - testing
  const order = new Order()
  fobx.autorun(() => order.total.get())
  order.price.set(10)
  order.amount.set(3)
  expect(36).toBe(order.total.get())
  expect(_batchDepth).toBe(0)
})

test("props1", function () {
  const vat = fobx.box(0.2)
  const Order = function (this: any) {
    fobx.extendObservable(this, {
      price: 20,
      amount: 2,
      get total() {
        return (1 + vat.get()) * this.price * this.amount // price and amount are now properties!
      },
    })
  }

  //@ts-expect-error - testing
  const order = new Order()
  expect(48).toBe(order.total)
  order.price = 10
  order.amount = 3
  expect(36).toBe(order.total)

  const totals: number[] = []
  const sub = fobx.autorun(function () {
    totals.push(order.total)
  })
  order.amount = 4
  sub()
  order.amount = 5
  expect(totals).toEqual([36, 48])

  expect(_batchDepth).toBe(0)
})

test("props2", function () {
  const vat = fobx.box(0.2)
  const Order = function (this: any) {
    fobx.extendObservable(this, {
      price: 20,
      amount: 2,
      get total() {
        return (1 + vat.get()) * this.price * this.amount // price and amount are now properties!
      },
    })
  }

  //@ts-expect-error - testing
  const order = new Order()
  expect(48).toBe(order.total)
  order.price = 10
  order.amount = 3
  expect(36).toBe(order.total)
})

test("props4", function () {
  function Bzz(this: any) {
    fobx.extendObservable(this, {
      fluff: [1, 2],
      get sum() {
        return this.fluff.reduce(function (a, b) {
          return a + b
        }, 0)
      },
    })
  }

  //@ts-expect-error - testing
  const x = new Bzz()
  x.fluff
  expect(x.sum).toBe(3)
  x.fluff.push(3)
  expect(x.sum).toBe(6)
  x.fluff = [5, 6]
  expect(x.sum).toBe(11)
  x.fluff.push(2)
  expect(x.sum).toBe(13)
})

test("object enumerable props", function () {
  const x = fobx.observable({
    a: 3,
    get b() {
      return 2 * this.a
    },
  })
  fobx.extendObservable(x, { c: 4 })
  const ar: string[] = []
  for (const key in x) ar.push(key)
  expect(ar).toEqual(["a", "b", "c"])
})

test("observe property", function () {
  const sb: number[] = []
  const mb: number[] = []

  const Wrapper = function (this: any, chocolateBar: any) {
    fobx.extendObservable(this, {
      chocolateBar: chocolateBar,
      get calories() {
        return this.chocolateBar.calories
      },
    })
  }

  const snickers = fobx.observable({
    calories: null as null | number,
  })
  const mars = fobx.observable({
    calories: undefined as undefined | number,
  })

  // @ts-expect-error - testing
  const wrappedSnickers = new Wrapper(snickers)
  // @ts-expect-error - testing
  const wrappedMars = new Wrapper(mars)

  const disposeSnickers = fobx.autorun(function () {
    sb.push(wrappedSnickers.calories)
  })
  const disposeMars = fobx.autorun(function () {
    mb.push(wrappedMars.calories)
  })
  snickers.calories = 10
  mars.calories = 15

  disposeSnickers()
  disposeMars()
  snickers.calories = 5
  mars.calories = 7

  expect(sb).toEqual([null, 10])
  expect(mb).toEqual([undefined, 15])
})

test("observables removed", function () {
  let calcs = 0
  const a = fobx.box(1)
  const b = fobx.box(2)
  const c = fobx.computed(function () {
    calcs++
    if (a.get() === 1) return b.get() * a.get() * b.get()
    return 3
  })

  expect(calcs).toBe(0)
  fobx.autorun(() => c.get())
  expect(c.get()).toBe(4)
  expect(calcs).toBe(1)
  a.set(2)
  expect(c.get()).toBe(3)
  expect(calcs).toBe(2)

  b.set(3) // should not retrigger calc
  expect(c.get()).toBe(3)
  expect(calcs).toBe(2)

  a.set(1)
  expect(c.get()).toBe(9)
  expect(calcs).toBe(3)

  expect(_batchDepth).toBe(0)
})

test("lazy evaluation", function () {
  let bCalcs = 0
  let cCalcs = 0
  let dCalcs = 0
  let observerChanges = 0

  const a = fobx.box(1)
  const b = fobx.computed(function () {
    bCalcs += 1
    return a.get() + 1
  })

  const c = fobx.computed(function () {
    cCalcs += 1
    return b.get() + 1
  })

  expect(bCalcs).toBe(0)
  expect(cCalcs).toBe(0)
  expect(c.get()).toBe(3)
  expect(bCalcs).toBe(1)
  expect(cCalcs).toBe(1)

  expect(c.get()).toBe(3)
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(2)

  a.set(2)
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(2)

  expect(c.get()).toBe(4)
  expect(bCalcs).toBe(3)
  expect(cCalcs).toBe(3)

  const d = fobx.computed(function () {
    dCalcs += 1
    return b.get() * 2
  })

  const handle = fobx.reaction(
    () => d.get(),
    function () {
      observerChanges += 1
    },
  )
  expect(bCalcs).toBe(4)
  expect(cCalcs).toBe(3)
  expect(dCalcs).toBe(1) // d is evaluated, so that its dependencies are known

  a.set(3)
  expect(d.get()).toBe(8)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(3)
  expect(dCalcs).toBe(2)

  expect(c.get()).toBe(5)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(2)

  expect(b.get()).toBe(4)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(2)

  handle() // un listen
  expect(d.get()).toBe(8)
  expect(bCalcs).toBe(6) // gone to sleep
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(3)

  expect(observerChanges).toBe(1)

  expect(_batchDepth).toBe(0)
})

test("multiple view dependencies", function () {
  let bCalcs = 0
  let dCalcs = 0
  const a = fobx.box(1)
  const b = fobx.computed(function () {
    bCalcs++
    return 2 * a.get()
  })
  const c = fobx.box(2)
  const d = fobx.computed(function () {
    dCalcs++
    return 3 * c.get()
  })

  let add = true
  const buffer: number[] = []
  let fCalcs = 0
  const dis = fobx.autorun(function () {
    fCalcs++
    if (add) buffer.push(b.get() + d.get())
    else buffer.push(d.get() + b.get())
  })

  add = false
  c.set(3)
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(2)
  expect(fCalcs).toBe(2)
  expect(buffer).toEqual([8, 11])

  c.set(4)
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(3)
  expect(fCalcs).toBe(3)
  expect(buffer).toEqual([8, 11, 14])

  dis()
  c.set(5)
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(3)
  expect(fCalcs).toBe(3)
  expect(buffer).toEqual([8, 11, 14])
})

test("observe", function () {
  const x = fobx.box(3)
  const x2 = fobx.computed(function () {
    return x.get() * 2
  })
  const b: number[] = []

  const cancel = fobx.autorun(function () {
    b.push(x2.get())
  })

  x.set(4)
  x.set(5)
  expect(b).toEqual([6, 8, 10])
  cancel()
  x.set(7)
  expect(b).toEqual([6, 8, 10])
})

test("when", function () {
  const x = fobx.box(3)

  let called = 0
  fobx.when(
    function () {
      return x.get() === 4
    },
    function () {
      called += 1
    },
  )

  x.set(5)
  expect(called).toBe(0)
  x.set(4)
  expect(called).toBe(1)
  x.set(3)
  expect(called).toBe(1)
  x.set(4)
  expect(called).toBe(1)
})

test("verify array in transaction", function () {
  const ar = fobx.observable<number>([])
  let aCount = 0
  let aValue

  fobx.autorun(function () {
    aCount++
    aValue = 0
    for (let i = 0; i < ar.length; i++) aValue += ar[i]
  })

  fobx.runInTransaction(function () {
    ar.push(2)
    ar.push(3)
    ar.push(4)
    ar.unshift(1)
  })
  expect(aValue).toBe(10)
  expect(aCount).toBe(2)
})

test("prematurely end autorun", function () {
  const x = fobx.box(2)
  let dis1: any
  let dis2: any
  let r1: any
  let r2: any

  fobx.runInTransaction(function () {
    dis1 = fobx.autorun(function (r) {
      r1 = r
      x.get()
    })
    dis2 = fobx.autorun(function (r) {
      r2 = r
      x.get()
    })

    // neither autorun runs while inside the transaction
    expect(r1).toBe(undefined)
    expect(r2).toBe(undefined)

    dis1()
  })
  // After transaction, dis2's autorun should have run and be active
  expect(r2).not.toBe(undefined)
  // dis1 was disposed so it shouldn't have run
  expect(r1).toBe(undefined)
  dis2()
})

test("computed values believe NaN === NaN", function () {
  const a = fobx.box(2)
  const b = fobx.box(3)
  const c = fobx.computed(function () {
    return String(a.get() * b.get())
  })
  const buf: string[] = []
  fobx.reaction(
    () => c.get(),
    (v) => buf.push(v),
  )

  a.set(NaN)
  b.set(NaN)
  a.set(NaN)
  a.set(2)
  b.set(3)

  expect(buf).toEqual(["NaN", "6"])
})

test("computed values believe deep NaN === deep NaN when using compareStructural", function () {
  const a = fobx.observable({ b: { a: 1 } })
  const c = fobx.computed(
    function () {
      return a.b
    },
    { comparer: "structural" },
  )

  const buf: { a: number }[] = []
  fobx.reaction(
    () => c.get(),
    (newValue) => {
      buf.push(newValue)
    },
  )

  a.b = { a: NaN }
  a.b = { a: NaN }
  a.b = { a: NaN }
  a.b = { a: 2 }
  a.b = { a: NaN }

  expect(isNaN(buf[0].a)).toBe(true)
  expect(buf[1]).toEqual({ a: 2 })
  expect(isNaN(buf[2].a)).toBe(true)
  expect(buf.length).toBe(3)
})

test("issue 71, transacting running transformation", function () {
  const state = fobx.observable({
    things: [] as any[],
  })

  function Thing(this: any, value: number) {
    fobx.extendObservable(this, {
      value: value,
      get pos() {
        return state.things.indexOf(this)
      },
      get isVisible() {
        return this.pos !== -1
      },
    })

    fobx.when(
      () => {
        return this.isVisible
      },
      () => {
        if (this.pos < 4) {
          // @ts-expect-error - testing
          state.things.push(new Thing(value + 1))
        }
      },
    )
  }

  let copy
  let vSum
  fobx.autorun(function () {
    copy = state.things.map(function (thing) {
      return thing.value
    })
    vSum = state.things.reduce(function (a, thing) {
      return a + thing.value
    }, 0)
  })

  expect(copy).toEqual([])

  fobx.runInTransaction(function () {
    // @ts-expect-error - testing
    state.things.push(new Thing(1))
  })

  expect(copy).toEqual([1, 2, 3, 4, 5])
  expect(vSum).toBe(15)

  state.things.splice(0, 2)
  // @ts-expect-error - testing
  state.things.push(new Thing(6))

  expect(copy).toEqual([3, 4, 5, 6, 7])
  expect(vSum).toBe(25)
})

test("eval in transaction", function () {
  let bCalcs = 0
  const x = fobx.observable({
    a: 1,
    get b() {
      bCalcs++
      return this.a * 2
    },
  })
  let c: any

  fobx.autorun(function () {
    c = x.b
  })

  expect(bCalcs).toBe(1)
  expect(c).toBe(2)

  fobx.runInTransaction(function () {
    x.a = 3
    expect(x.b).toBe(6)
    expect(bCalcs).toBe(2)
    expect(c).toBe(2)

    x.a = 4
    expect(x.b).toBe(8)
    expect(bCalcs).toBe(3)
    expect(c).toBe(2)
  })
  expect(bCalcs).toBe(3) // 2 or 3 would be fine as well
  expect(c).toBe(8)
})

//cspell:ignore autoruns
test("autoruns created in autoruns should kick off", function () {
  const x = fobx.box(3)
  const x2: any[] = []
  let d: any

  fobx.autorun(function () {
    if (d) {
      // this shouldn't ever run because x is tracked by the inner autorun
      x2.push("disposed")
      d()
    }
    d = fobx.autorun(function () {
      x2.push(x.get() * 2)
    })
  })

  x.set(4)
  expect(x2).toEqual([6, 8])
})

test("#502 extendObservable throws on objects created with Object.create(null)", () => {
  const a = Object.create(null)
  fobx.extendObservable(a, { b: 3 })
  expect(fobx.isObservable(a, "b")).toBe(true)
})

test("prematurely ended autoruns are cleaned up properly", () => {
  const a = fobx.box(1)
  const b = fobx.box(2)
  const c = fobx.box(3)
  let called = 0

  fobx.autorun((dispose) => {
    called++
    if (a.get() === 2) {
      dispose() // dispose
      b.get() // consume
      a.set(3) // cause itself to re-run, but, disposed!
    } else {
      c.get()
    }
  })

  expect(called).toBe(1)

  a.set(2)

  expect(called).toBe(2)

  // none of the read boxes causes a re-run anymore
  a.set(3)
  b.set(1)
  c.set(1)
  expect(called).toBe(2)
})

test("un-optimizable subscriptions are diffed correctly", () => {
  const a = fobx.box(1)
  const b = fobx.box(1)
  const c = fobx.computed(() => {
    a.get()
    return 3
  })
  let called = 0
  let val = 0

  const d = fobx.autorun(() => {
    called++
    a.get()
    c.get() // reads a as well
    val = a.get()
    if (
      b.get() === 1 // only on first run
    ) {
      a.get() // second run: one read less for a
    }
  })

  expect(called).toBe(1)
  expect(val).toBe(1)

  b.set(2)

  expect(called).toBe(2)
  expect(val).toBe(1)

  a.set(2)

  expect(called).toBe(3)
  expect(val).toBe(2)

  d()
})

test("support computed property getters / setters", () => {
  const a = fobx.observable({
    size: 1,
    get volume() {
      return this.size * this.size
    },
  })

  expect(a.volume).toBe(1)
  a.size = 3
  expect(a.volume).toBe(9)

  expect(
    grabConsole(() => {
      // @ts-expect-error - purposefully testing error case
      a.volume = 9
    }),
  ).toBe(
    "<STDOUT> [@fobx/core] There was an attempt to set a value on a computed value without any setter. Nothing was set.",
  )

  const b = fobx.extendObservable(
    {},
    {
      size: 2,
      get volume() {
        return this.size * this.size
      },
      set volume(v) {
        this.size = Math.sqrt(v)
      },
    },
  )

  const values: number[] = []
  const d = fobx.autorun(() => values.push(b.volume))

  b.volume = 9
  fobx.runInTransaction(() => {
    b.volume = 100
    b.volume = 64
  })

  expect(values).toEqual([4, 9, 64])
  expect(b.size).toEqual(8)

  d()
})

test("computed getter / setter for plan objects should succeed", function () {
  const b = fobx.observable({
    a: 3,
    get propX() {
      return this.a * 2
    },
    set propX(v) {
      this.a = v
    },
  })

  const values: number[] = []
  fobx.autorun(function () {
    return values.push(b.propX)
  })
  expect(b.propX).toBe(6)
  b.propX = 4
  expect(b.propX).toBe(8)

  expect(values).toEqual([6, 8])
})

test("helpful error for self referencing setter", function () {
  const a = fobx.observable({
    x: 1,
    get y() {
      return this.x
    },
    set y(v) {
      this.y = v // woops...;-)
    },
  })

  expect(() => (a.y = 2)).toThrow(
    "[@fobx/core] Computed setter is assigning to itself, this will cause an infinite loop.",
  )
})

test("#558 boxed observables stay boxed observables", function () {
  const a = fobx.observable({
    x: fobx.box(3),
  })

  expect(typeof a.x).toBe("object")
  expect(a.x.get()).toBe(3)
})

test("isComputed", function () {
  expect(fobx.isComputed(fobx.box(3))).toBe(false)
  expect(
    fobx.isComputed(
      fobx.computed(function () {
        return 3
      }),
    ),
  ).toBe(true)

  const x = fobx.observable({
    a: 3,
    get b() {
      return this.a
    },
  })

  expect(fobx.isComputed(x, "a")).toBe(false)
  expect(fobx.isComputed(x, "b")).toBe(true)
})

test("603 - transaction should not kill reactions", () => {
  const a = fobx.box(1)
  let b = 1
  fobx.autorun(() => {
    b = a.get()
  })

  try {
    fobx.runInTransaction(() => {
      a.set(2)
      throw 3
    })
  } catch {
    // empty
  }

  expect(_batchDepth).toEqual(0)
  expect(_pending.length).toEqual(0)

  expect(b).toBe(2)
  a.set(3)
  expect(b).toBe(3)
})

test("computed equals function only invoked when necessary", () => {
  suppressConsole(() => {
    const comparisons: { from: string; to: string }[] = []
    const loggingComparer = (from: string, to: string) => {
      comparisons.push({ from, to })
      return from === to
    }

    const left = fobx.box("A")
    const right = fobx.box("B")
    const combinedToLowerCase = fobx.computed(
      () => {
        return left.get().toLowerCase() + right.get().toLowerCase()
      },
      {
        comparer: loggingComparer,
      },
    )

    const values: string[] = []
    let disposeAutorun = fobx.autorun(() =>
      values.push(combinedToLowerCase.get())
    )

    // No comparison should be made on the first value
    expect(comparisons).toEqual([])

    // First change will cause a comparison
    left.set("C")
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Transition *to* CaughtException in the computed won't cause a comparison
    // @ts-expect-error - trying to cause exception
    left.set(null)
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Transition *between* CaughtException-s in the computed won't cause a comparison
    // @ts-expect-error - trying to cause exception
    right.set(null)
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // TODO: document this behavior differs from mobx
    // Transition *from* CaughtException in the computed won't cause a comparison
    left.set("D")
    right.set("E")
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
    ])

    // Another value change will cause a comparison
    right.set("F")
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
      { from: "de", to: "df" },
    ])

    // Becoming unobserved, then observed won't cause a comparison
    disposeAutorun()
    disposeAutorun = fobx.autorun(() => values.push(combinedToLowerCase.get()))
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
      { from: "de", to: "df" },
    ])

    expect(values).toEqual(["ab", "cb", "de", "df", "df"])

    disposeAutorun()
  })
})

// document that extendObservable is not inheritance compatible,
// and make sure this does work with decorate
test("Issue 1092 - Should not access attributes of siblings in the prot. chain", () => {
  // The parent is an observable
  // and has an attribute
  const parent = {} as { staticObservable: number }
  fobx.extendObservable(parent, {
    staticObservable: 11,
  })

  // Child1 "inherit" from the parent
  // and has an observable attribute
  const child1 = Object.create(parent)
  fobx.extendObservable(child1, {
    attribute: 7,
  })

  // Child2 also "inherit" from the parent
  // But does not have any observable attribute
  const child2 = Object.create(parent)

  // The second child should not be aware of the attribute of his
  // sibling child1
  expect(typeof child2.attribute).toBe("undefined")

  expect(parent.staticObservable).toBe(11)
  parent.staticObservable = 12
  expect(parent.staticObservable).toBe(12)
})

test("Issue 1092 - We should be able to define observable on all siblings", () => {
  expect.assertions(1)

  // The parent is an observable
  const parent = {}
  fobx.extendObservable(parent, {})

  // Child1 "inherit" from the parent
  // and has an observable attribute
  const child1 = Object.create(parent)
  fobx.extendObservable(child1, {
    attribute: 7,
  })

  // Child2 also "inherit" from the parent
  // But does not have any observable attribute
  const child2 = Object.create(parent)
  expect(() => {
    fobx.extendObservable(child2, {
      attribute: 8,
    })
  }).not.toThrow()
})

test("Issue 1120 - isComputed should return false for a non existing property", () => {
  expect(fobx.isComputed({}, "x")).toBe(false)
  expect(fobx.isComputed(fobx.observable({}), "x")).toBe(false)
})

test("can create computed with setter", () => {
  let y = 1
  const x = fobx.computed(
    () => y,
    {
      set: (v: number) => {
        y = v * 2
      },
    },
  )
  expect(x.get()).toBe(1)
  x.set(3)
  expect(x.get()).toBe(6)
})

// TODO: this test will pass once objects to not behave as an extendObservable
test("can make non-extensible objects observable", () => {
  const base = { x: 3 }
  Object.freeze(base)
  const o = fobx.observable(base)
  o.x = 4
  expect(o.x).toBe(4)
  expect(fobx.isObservable(o, "x")).toBe(true)
})

test("tuples", () => {
  // See #1391
  function tuple(a: number, b: number) {
    const res = Array.from<number>({ length: 2 })
    fobx.extendObservable(res, { [0]: a })
    fobx.extendObservable(res, { [1]: b })
    return res
  }

  const myStuff = tuple(1, 3)
  const events: number[] = []

  fobx.reaction(
    () => myStuff[0],
    (val) => events.push(val),
  )
  myStuff[1] = 17 // should not react
  myStuff[0] = 2 // should react
  expect(events).toEqual([2])

  expect(myStuff.map((x) => x * 2)).toEqual([4, 34])
})

test("extendObservable should not accept complex objects as second argument", () => {
  class X {
    x = 3
  }
  expect(() => {
    fobx.extendObservable({}, new X())
  }).toThrow(
    "[@fobx/core] 2nd argument to extendObservable must be a plain js object.",
  )
})

test("observable ignores class instances #2579", () => {
  class C {}
  const c = new C()
  expect(fobx.observable(c)).toBe(c)
})

test("generator props are observable flows", () => {
  const o = fobx.observable({
    observable: 0,
    *observableFlow() {
      yield this.observable
    },
  })
  expect(fobx.isObservable(o, "observable")).toBe(true)
  expect(fobx.isObservable(o, "observableFlow")).toBe(false)
})

test("#3747", () => {
  fobx.runInTransaction(() => {
    const o = fobx.box(0)
    const c = fobx.computed(() => o.get())
    expect(c.get()).toBe(0)
    o.set(1)
    expect(c.get()).toBe(1) // would fail
  })
})

test("change count optimization", function () {
  let bCalcs = 0
  let cCalcs = 0
  const a = fobx.box(3)
  const b = fobx.computed(function () {
    bCalcs += 1
    return 4 + a.get() - a.get()
  })
  const c = fobx.computed(function () {
    cCalcs += 1
    return b.get()
  })

  fobx.autorun(() => c.get())

  expect(b.get()).toBe(4)
  expect(c.get()).toBe(4)
  expect(bCalcs).toBe(1)
  expect(cCalcs).toBe(1)

  a.set(5)

  expect(b.get()).toBe(4)
  expect(c.get()).toBe(4)
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(1)

  expect(_batchDepth).toBe(0)
})

test("nested observable2", function () {
  const factor = fobx.box(0)
  const price = fobx.box(100)
  let totalCalcs = 0
  let innerCalcs = 0

  const total = fobx.computed(function () {
    totalCalcs += 1 // outer observable shouldn't re-calc if inner observable didn't publish a real change
    return (
      price.get() *
      fobx.computed(function () {
        innerCalcs += 1
        return factor.get() % 2 === 0 ? 1 : 3
      }).get()
    )
  })

  const b: number[] = []
  fobx.reaction(
    () => total.get(),
    function (x) {
      b.push(x)
    },
  )
  expect(total.get()).toBe(100)

  price.set(150)
  factor.set(7) // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
  factor.set(5) // doesn't trigger outer calc
  factor.set(3) // doesn't trigger outer calc
  factor.set(4) // triggers innerCalc twice
  price.set(20)

  expect(b).toEqual([150, 450, 150, 20])
  expect(innerCalcs).toBe(9)
  expect(totalCalcs).toBe(5)
})

test("verify calculation count", () => {
  const calcs: string[] = []
  const a = fobx.box(1)
  const b = fobx.computed(() => {
    calcs.push("b")
    return a.get()
  })
  const c = fobx.computed(() => {
    calcs.push("c")
    return b.get()
  })
  const d = fobx.autorun(() => {
    calcs.push("d")
    return b.get()
  })
  const e = fobx.autorun(() => {
    calcs.push("e")
    return c.get()
  })
  const f = fobx.computed(() => {
    calcs.push("f")
    return c.get()
  })

  expect(f.get()).toBe(1)

  calcs.push("change")
  a.set(2)

  expect(f.get()).toBe(2)

  calcs.push("transaction")
  fobx.runInTransaction(() => {
    expect(b.get()).toBe(2)
    expect(c.get()).toBe(2)
    expect(f.get()).toBe(2)
    expect(f.get()).toBe(2)
    calcs.push("change")
    a.set(3)
    expect(b.get()).toBe(3)
    expect(b.get()).toBe(3)
    calcs.push("try c")
    expect(c.get()).toBe(3)
    expect(c.get()).toBe(3)
    calcs.push("try f")
    expect(f.get()).toBe(3)
    expect(f.get()).toBe(3)
    calcs.push("end transaction")
  })

  expect(calcs).toEqual([
    "d",
    "b",
    "e",
    "c",
    "f",
    "change",
    "b",
    "d",
    "c",
    "e",
    "f",
    "transaction",
    "f",
    "change",
    "b",
    "try c",
    "c",
    "try f",
    "f",
    "end transaction",
    "d",
    "e",
  ])

  d()
  e()
})

const MAX_SPLICE_SIZE = 10000
test("ObservableArray.replace", () => {
  // both lists are small
  let ar = fobx.observable([1]) as fobx.ObservableArray<number>
  let del = ar.replace([2])
  expect(ar.toJSON()).toEqual([2])
  expect(del).toEqual([1])

  // the replacement is large
  ar = fobx.observable([1]) as fobx.ObservableArray<number>
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del).toEqual([1])

  // the original is large
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE })) as fobx.ObservableArray<number>
  del = ar.replace([2])
  expect(ar).toEqual([2])
  expect(del.length).toEqual(MAX_SPLICE_SIZE)

  // both are large; original larger than replacement
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 })) as fobx.ObservableArray<number>
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)

  // both are large; replacement larger than original
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE })) as fobx.ObservableArray<number>
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE + 1 }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE + 1)
  expect(del.length).toEqual(MAX_SPLICE_SIZE)
})

test("ObservableArray.splice", () => {
  // Deleting 1 item from a large list
  let ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 })) as fobx.ObservableArray<number>
  let del = ar.splice(1, 1)
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del.length).toEqual(1)

  // Deleting many items from a large list
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 2 })) as fobx.ObservableArray<number>
  del = ar.splice(1, MAX_SPLICE_SIZE + 1)
  expect(ar.length).toEqual(1)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)

  // Deleting 1 item from a large list and inserting many items
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 })) as fobx.ObservableArray<number>
  del = ar.splice(1, 1, ...Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE * 2 + 1)
  expect(del.length).toEqual(1)

  // Deleting many items from a large list and inserting many items
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 10 })) as fobx.ObservableArray<number>
  del = ar.splice(
    1,
    MAX_SPLICE_SIZE + 1,
    ...Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }),
  )
  expect(ar.length).toEqual(MAX_SPLICE_SIZE + 10)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)
})
