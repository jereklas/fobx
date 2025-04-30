// deno-lint-ignore-file no-explicit-any
import type {
  ObservableBox,
  ObservableBoxWithAdmin,
} from "../../observables/observableBox.ts"
import { $fobx } from "../../state/global.ts"
import { deepEqual } from "fast-equals"
import * as fobx from "@fobx/core"
import {
  beforeAll,
  beforeEach,
  expect,
  grabConsole,
  suppressConsole,
  test,
} from "@fobx/testing"
import type { ComputedWithAdmin } from "../../reactions/computed.ts"
import type { ReactionWithAdmin } from "../../reactions/reaction.ts"

beforeAll(() => {
  fobx.configure({ comparer: { structural: deepEqual } })
})

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

test("argument-less observable", () => {
  const a = fobx.observableBox(undefined)

  expect(fobx.isObservable(a)).toBe(true)
  expect(a.value).toBe(undefined)
})

test("basic", function () {
  const x = fobx.observableBox(3)
  const b: number[] = []
  fobx.reaction(
    () => x.value,
    (v) => {
      b.push(v)
    },
  )
  expect(3).toBe(x.value)

  x.value = 5
  expect(x.value).toBe(5)
  expect(b).toEqual([5])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("basic2", function () {
  const x = fobx.observableBox(3)
  const z = fobx.computed(function () {
    return x.value * 2
  })
  const y = fobx.computed(function () {
    return x.value * 3
  })
  fobx.autorun(() => z.value)

  expect(z.value).toBe(6)
  expect(y.value).toBe(9)

  x.value = 5
  expect(z.value).toBe(10)
  expect(y.value).toBe(15)

  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("computed with asStructure modifier", function () {
  const x1 = fobx.observableBox(3)
  const x2 = fobx.observableBox(5)
  const y = fobx.computed(
    function () {
      return {
        sum: x1.value + x2.value,
      }
    },
    { comparer: "structural" },
  )
  const b: { sum: number }[] = []

  fobx.autorun(() => {
    b.push(y.value)
  })

  expect(8).toBe(y.value.sum)
  x1.value = 4
  expect(9).toBe(y.value.sum)
  expect(b).toEqual([{ sum: 8 }, { sum: 9 }])

  fobx.runInAction(function () {
    // swap values, computation results is structurally unchanged
    x1.value = 5
    x2.value = 4
  })

  expect(b).toEqual([{ sum: 8 }, { sum: 9 }])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("dynamic", function () {
  const x = fobx.observableBox(3)
  const y = fobx.computed(function () {
    return x.value
  })
  const b: number[] = []

  fobx.autorun(() => b.push(y.value))

  expect(3).toBe(y.value) // First evaluation here..

  x.value = 5
  expect(5).toBe(y.value)

  expect(b).toEqual([3, 5])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("dynamic2", function () {
  const x = fobx.observableBox(3)
  const y = fobx.computed(function () {
    return x.value * x.value
  })

  expect(9).toBe(y.value)
  const b: number[] = []
  fobx.reaction(
    () => y.value,
    (v) => b.push(v),
  )

  x.value = 5
  expect(25).toBe(y.value)

  //no intermediate value 15!
  expect(b).toEqual([25])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("box uses equals", function () {
  const x = fobx.observableBox("a", {
    equals: (oldValue, newValue) => {
      return oldValue.toLowerCase() === newValue.toLowerCase()
    },
  })

  const b: string[] = []
  fobx.reaction(
    () => x.value,
    (v) => b.push(v),
  )

  x.value = "A"
  x.value = "b"
  x.value = "B"
  x.value = "C"

  expect(b).toEqual(["b", "C"])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("box uses equals2", function () {
  const x = fobx.observableBox("01", {
    equals: (oldValue, newValue) => {
      return parseInt(oldValue) === parseInt(newValue)
    },
  })

  const y = fobx.computed(function () {
    return parseInt(x.value)
  })

  const b: number[] = []
  fobx.reaction(
    () => y.value,
    (v) => b.push(v),
  )

  x.value = "2"
  x.value = "02"
  x.value = "002"
  x.value = "03"

  expect(b).toEqual([2, 3])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("readme1", function () {
  const b: number[] = []

  const vat = fobx.observableBox(0.2)
  const order = {} as {
    price: ObservableBox<number>
    priceWithVat: ObservableBox<number>
  }
  order.price = fobx.observableBox(10)
  // Prints: New price: 24
  // in TS, just: value(() => this.price() * (1+vat()))
  order.priceWithVat = fobx.computed(function () {
    return order.price.value * (1 + vat.value)
  })

  fobx.reaction(
    () => order.priceWithVat.value,
    (v) => b.push(v),
  )

  order.price.value = 20
  expect(b).toEqual([24])
  order.price.value = 10
  expect(b).toEqual([24, 12])
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("batch", function () {
  const buf: number[] = []
  const a = fobx.observableBox(2)
  const b = fobx.observableBox(3)
  const c = fobx.computed(function () {
    return a.value * b.value
  })
  const d = fobx.computed(function () {
    return c.value * b.value
  }) as ComputedWithAdmin
  fobx.reaction(
    () => d.value,
    (v) => {
      buf.push(v)
    },
  )

  a.value = 4
  b.value = 5
  // Note, 60 should not happen! (that is d begin computed before c after update of b)
  expect(buf).toEqual([36, 100])

  const x = fobx.runInAction(() => {
    a.value = 2
    b.value = 3
    a.value = 6
    expect(d[$fobx].value).toBe(100) // not updated; in transaction
    expect(d.value).toBe(54) // consistent due to inspection
    return 2
  })

  expect(x).toBe(2) // test return value
  expect(buf).toEqual([36, 100, 54]) // only one new value for d
})

test("transaction with inspection", function () {
  const a = fobx.observableBox(2)
  let calcs = 0
  const b = fobx.computed(function () {
    calcs++
    return a.value * 2
  })

  // if not inspected during transaction, postpone value to end
  fobx.runInAction(function () {
    a.value = 3
    expect(b.value).toBe(6)
    expect(calcs).toBe(1)
  })
  expect(b.value).toBe(6)
  expect(calcs).toBe(2)

  // if inspected, evaluate eagerly
  fobx.runInAction(function () {
    a.value = 4
    expect(b.value).toBe(8)
    expect(calcs).toBe(3)
  })
  expect(b.value).toBe(8)
  expect(calcs).toBe(4)
})

test("transaction with inspection 2", function () {
  const a = fobx.observableBox(2)
  let calcs = 0
  let b: number | undefined
  fobx.autorun(function () {
    calcs++
    b = a.value * 2
  })

  // if not inspected during transaction, postpone value to end
  fobx.runInAction(function () {
    a.value = 3
    expect(b).toBe(4)
    expect(calcs).toBe(1)
  })
  expect(b).toBe(6)
  expect(calcs).toBe(2)

  // if inspected, evaluate eagerly
  fobx.runInAction(function () {
    a.value = 4
    expect(b).toBe(6)
    expect(calcs).toBe(2)
  })
  expect(b).toBe(8)
  expect(calcs).toBe(3)
})

test("scope", function () {
  const vat = fobx.observableBox(0.2)
  const Order = function (this: any) {
    this.price = fobx.observableBox(20)
    this.amount = fobx.observableBox(2)
    this.total = fobx.computed(
      function (this: any) {
        return (1 + vat.value) * this.price.value * this.amount.value
      },
      { thisArg: this },
    )
  }

  //@ts-expect-error - testing
  const order = new Order()
  fobx.autorun(() => order.total.value)
  order.price.value = 10
  order.amount.value = 3
  expect(36).toBe(order.total.value)
  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("props1", function () {
  const vat = fobx.observableBox(0.2)
  const Order = function (this: any) {
    fobx.extendObservable(this, {
      price: 20,
      amount: 2,
      get total() {
        return (1 + vat.value) * this.price * this.amount // price and amount are now properties!
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

  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("props2", function () {
  const vat = fobx.observableBox(0.2)
  const Order = function (this: any) {
    fobx.extendObservable(this, {
      price: 20,
      amount: 2,
      get total() {
        return (1 + vat.value) * this.price * this.amount // price and amount are now properties!
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

// TODO: there's no equivalent reaction to an object that would report any update/prop add? I think that's ok
// test("observe object", function () {
//   let events: fobx.Change[] = [];
//   const a = fobx.observable({
//     a: 1,
//     get da() {
//       return this.a * 2;
//     },
//   }) as { a: number; da: number; b: number };
//   const stop = fobx.observe(a, function (change: fobx.Change) {
//     expect(change.kind).toEqual("object");
//     expect(change.object).toEqual(a);
//     delete change.object;
//     // @ts-expect-error - ok
//     delete change.kind;
//     events.push(change);
//   });

//   a.a = 2;
//   fobx.extendObservable(a, {
//     b: 3,
//   });
//   a.a = 4;
//   a.b = 5;
//   expect(events).toEqual([
//     { type: "update", key: "a", value: 2, oldValue: 1 },
//     { type: "add", key: "b", value: 3 },
//     { type: "update", key: "a", value: 4, oldValue: 2 },
//     { type: "update", key: "b", value: 5, oldValue: 3 },
//   ]);

//   stop();
//   events = [];
//   a.a = 6;
//   expect(events.length).toBe(0);
// });

test("change count optimization", function () {
  let bCalcs = 0
  let cCalcs = 0
  const a = fobx.observableBox(3)
  const b = fobx.computed(function () {
    bCalcs += 1
    return 4 + a.value - a.value
  })
  const c = fobx.computed(function () {
    cCalcs += 1
    return b.value
  })

  fobx.autorun(() => c.value)

  expect(b.value).toBe(4)
  expect(c.value).toBe(4)
  expect(bCalcs).toBe(1)
  expect(cCalcs).toBe(1)

  a.value = 5

  expect(b.value).toBe(4)
  expect(c.value).toBe(4)
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(1)

  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("observables removed", function () {
  let calcs = 0
  const a = fobx.observableBox(1)
  const b = fobx.observableBox(2)
  const c = fobx.computed(function () {
    calcs++
    if (a.value === 1) return b.value * a.value * b.value
    return 3
  })

  expect(calcs).toBe(0)
  fobx.autorun(() => c.value)
  expect(c.value).toBe(4)
  expect(calcs).toBe(1)
  a.value = 2
  expect(c.value).toBe(3)
  expect(calcs).toBe(2)

  b.value = 3 // should not retrigger calc
  expect(c.value).toBe(3)
  expect(calcs).toBe(2)

  a.value = 1
  expect(c.value).toBe(9)
  expect(calcs).toBe(3)

  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("lazy evaluation", function () {
  let bCalcs = 0
  let cCalcs = 0
  let dCalcs = 0
  let observerChanges = 0

  const a = fobx.observableBox(1)
  const b = fobx.computed(function () {
    bCalcs += 1
    return a.value + 1
  })

  const c = fobx.computed(function () {
    cCalcs += 1
    return b.value + 1
  })

  expect(bCalcs).toBe(0)
  expect(cCalcs).toBe(0)
  expect(c.value).toBe(3)
  expect(bCalcs).toBe(1)
  expect(cCalcs).toBe(1)

  expect(c.value).toBe(3)
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(2)

  a.value = 2
  expect(bCalcs).toBe(2)
  expect(cCalcs).toBe(2)

  expect(c.value).toBe(4)
  expect(bCalcs).toBe(3)
  expect(cCalcs).toBe(3)

  const d = fobx.computed(function () {
    dCalcs += 1
    return b.value * 2
  })

  const handle = fobx.reaction(
    () => d.value,
    function () {
      observerChanges += 1
    },
  )
  expect(bCalcs).toBe(4)
  expect(cCalcs).toBe(3)
  expect(dCalcs).toBe(1) // d is evaluated, so that its dependencies are known

  a.value = 3
  expect(d.value).toBe(8)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(3)
  expect(dCalcs).toBe(2)

  expect(c.value).toBe(5)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(2)

  expect(b.value).toBe(4)
  expect(bCalcs).toBe(5)
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(2)

  handle() // un listen
  expect(d.value).toBe(8)
  expect(bCalcs).toBe(6) // gone to sleep
  expect(cCalcs).toBe(4)
  expect(dCalcs).toBe(3)

  expect(observerChanges).toBe(1)

  expect(fobx.getGlobalState().isRunningReactions).toBe(false)
})

test("multiple view dependencies", function () {
  let bCalcs = 0
  let dCalcs = 0
  const a = fobx.observableBox(1)
  const b = fobx.computed(function () {
    bCalcs++
    return 2 * a.value
  })
  const c = fobx.observableBox(2)
  const d = fobx.computed(function () {
    dCalcs++
    return 3 * c.value
  })

  let add = true
  const buffer: number[] = []
  let fCalcs = 0
  const dis = fobx.autorun(function () {
    fCalcs++
    if (add) buffer.push(b.value + d.value)
    else buffer.push(d.value + b.value)
  })

  add = false
  c.value = 3
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(2)
  expect(fCalcs).toBe(2)
  expect(buffer).toEqual([8, 11])

  c.value = 4
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(3)
  expect(fCalcs).toBe(3)
  expect(buffer).toEqual([8, 11, 14])

  dis()
  c.value = 5
  expect(bCalcs).toBe(1)
  expect(dCalcs).toBe(3)
  expect(fCalcs).toBe(3)
  expect(buffer).toEqual([8, 11, 14])
})

test("nested observable2", function () {
  const factor = fobx.observableBox(0)
  const price = fobx.observableBox(100)
  let totalCalcs = 0
  let innerCalcs = 0

  const total = fobx.computed(function () {
    totalCalcs += 1 // outer observable shouldn't re-calc if inner observable didn't publish a real change
    return (
      price.value *
      fobx.computed(function () {
        innerCalcs += 1
        return factor.value % 2 === 0 ? 1 : 3
      }).value
    )
  })

  const b: number[] = []
  fobx.reaction(
    () => total.value,
    function (x) {
      b.push(x)
    },
  )
  expect(total.value).toBe(100)

  price.value = 150
  factor.value = 7 // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
  factor.value = 5 // doesn't trigger outer calc
  factor.value = 3 // doesn't trigger outer calc
  factor.value = 4 // triggers innerCalc twice
  price.value = 20

  expect(b).toEqual([150, 450, 150, 20])
  expect(innerCalcs).toBe(9)
  expect(totalCalcs).toBe(5)
})

test("observe", function () {
  const x = fobx.observableBox(3)
  const x2 = fobx.computed(function () {
    return x.value * 2
  })
  const b: number[] = []

  const cancel = fobx.autorun(function () {
    b.push(x2.value)
  })

  x.value = 4
  x.value = 5
  expect(b).toEqual([6, 8, 10])
  cancel()
  x.value = 7
  expect(b).toEqual([6, 8, 10])
})

test("when", function () {
  const x = fobx.observableBox(3)

  let called = 0
  fobx.when(
    function () {
      return x.value === 4
    },
    function () {
      called += 1
    },
  )

  x.value = 5
  expect(called).toBe(0)
  x.value = 4
  expect(called).toBe(1)
  x.value = 3
  expect(called).toBe(1)
  x.value = 4
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

  fobx.runInAction(function () {
    ar.push(2)
    ar.push(3)
    ar.push(4)
    ar.unshift(1)
  })
  expect(aValue).toBe(10)
  expect(aCount).toBe(2)
})

test("prematurely end autorun", function () {
  const x = fobx.observableBox(2) as ObservableBoxWithAdmin
  let dis1: any
  let dis2: any
  let r1: any
  let r2: any

  fobx.runInAction(function () {
    dis1 = fobx.autorun(function (r) {
      console.log("running")
      r1 = r
      x.value
    })
    dis2 = fobx.autorun(function (r) {
      r2 = r
      x.value
    })

    expect(x[$fobx].observers.length).toBe(0)
    // neither autorun runs while inside the action
    expect(r1).toBe(undefined)
    expect(r2).toBe(undefined)

    dis1()
  })
  expect(x[$fobx].observers.length).toBe(1)
  expect(r1).toBe(undefined)
  expect(r2[$fobx].dependencies.length).toBe(1)
  dis2()

  expect(x[$fobx].observers.length).toBe(0)
  expect(r1).toBe(undefined)
  expect(r2[$fobx].dependencies.length).toBe(0)
})

test("computed values believe NaN === NaN", function () {
  const a = fobx.observableBox(2)
  const b = fobx.observableBox(3)
  const c = fobx.computed(function () {
    return String(a.value * b.value)
  })
  const buf: string[] = []
  fobx.reaction(
    () => c.value,
    (v) => buf.push(v),
  )

  a.value = NaN
  b.value = NaN
  a.value = NaN
  a.value = 2
  b.value = 3

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
    () => c.value,
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

  fobx.runInAction(function () {
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

  fobx.runInAction(function () {
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
  const x = fobx.observableBox(3)
  const x2: number[] = []
  let d: any

  let outer: any
  let inner: any
  fobx.autorun(function (r) {
    outer = r
    if (d) {
      // dispose previous autorun
      d()
    }
    d = fobx.autorun(function (r2) {
      inner = r2
      x2.push(x.value * 2)
    })
  })

  // a should be observed by the inner autorun, not the outer
  expect(outer[$fobx].dependencies.length).toBe(0)
  expect(inner[$fobx].dependencies.length).toBe(1)

  x.value = 4
  expect(x2).toEqual([6, 8])
})

test("#502 extendObservable throws on objects created with Object.create(null)", () => {
  const a = Object.create(null)
  fobx.extendObservable(a, { b: 3 })
  expect(fobx.isObservable(a, "b")).toBe(true)
})

test("prematurely ended autoruns are cleaned up properly", () => {
  const a = fobx.observableBox(1) as ObservableBoxWithAdmin
  const b = fobx.observableBox(2) as ObservableBoxWithAdmin
  const c = fobx.observableBox(3) as ObservableBoxWithAdmin
  let called = 0

  let aa!: ReactionWithAdmin
  const d = fobx.autorun((r) => {
    called++
    aa = r as ReactionWithAdmin
    if (a.value === 2) {
      d() // dispose
      b.value // consume
      a.value = 3 // cause itself to re-run, but, disposed!
    } else {
      c.value
    }
  })

  expect(called).toBe(1)
  expect(a[$fobx].observers.length).toBe(1)
  expect(b[$fobx].observers.length).toBe(0)
  expect(c[$fobx].observers.length).toBe(1)
  expect(aa[$fobx].dependencies.length).toBe(2)

  a.value = 2

  expect(called).toBe(2)
  expect(a[$fobx].observers.length).toBe(0)
  expect(b[$fobx].observers.length).toBe(0)
  expect(c[$fobx].observers.length).toBe(0)
  expect(aa[$fobx].dependencies.length).toBe(0)
})

test("un-optimizable subscriptions are diffed correctly", () => {
  const a = fobx.observableBox(1) as ObservableBoxWithAdmin
  const b = fobx.observableBox(1) as ObservableBoxWithAdmin
  const c = fobx.computed(() => {
    a.value
    return 3
  }) as ComputedWithAdmin
  let called = 0
  let val = 0

  let aa!: ReactionWithAdmin
  const d = fobx.autorun((r) => {
    aa = r as ReactionWithAdmin
    called++
    a.value
    c.value // reads a as well
    val = a.value
    if (
      b.value === 1 // only on first run
    ) {
      a.value // second run: one read less for a
    }
  })

  expect(called).toBe(1)
  expect(val).toBe(1)
  expect(a[$fobx].observers.length).toBe(2)
  expect(b[$fobx].observers.length).toBe(1)
  expect(c[$fobx].observers.length).toBe(1)
  expect(aa[$fobx].dependencies.length).toBe(3) // 3 would be better!

  b.value = 2

  expect(called).toBe(2)
  expect(val).toBe(1)
  expect(a[$fobx].observers.length).toBe(2)
  expect(b[$fobx].observers.length).toBe(1)
  expect(c[$fobx].observers.length).toBe(1)
  expect(aa[$fobx].dependencies.length).toBe(3) // c was cached so accessing a was optimizable

  a.value = 2

  expect(called).toBe(3)
  expect(val).toBe(2)
  expect(a[$fobx].observers.length).toBe(2)
  expect(b[$fobx].observers.length).toBe(1)
  expect(c[$fobx].observers.length).toBe(1)
  expect(aa[$fobx].dependencies.length).toBe(3) // c was cached so accessing a was optimizable

  d()
})

test("verify calculation count", () => {
  const calcs: string[] = []
  const a = fobx.observableBox(1)
  const b = fobx.computed(() => {
    calcs.push("b")
    return a.value
  })
  const c = fobx.computed(() => {
    calcs.push("c")
    return b.value
  })
  const d = fobx.autorun(() => {
    calcs.push("d")
    return b.value
  })
  const e = fobx.autorun(() => {
    calcs.push("e")
    return c.value
  })
  const f = fobx.computed(() => {
    calcs.push("f")
    return c.value
  })

  expect(f.value).toBe(1)

  calcs.push("change")
  a.value = 2

  expect(f.value).toBe(2)

  calcs.push("transaction")
  fobx.runInAction(() => {
    expect(b.value).toBe(2)
    expect(c.value).toBe(2)
    expect(f.value).toBe(2)
    expect(f.value).toBe(2)
    calcs.push("change")
    a.value = 3
    expect(b.value).toBe(3)
    expect(b.value).toBe(3)
    calcs.push("try c")
    expect(c.value).toBe(3)
    expect(c.value).toBe(3)
    calcs.push("try f")
    expect(f.value).toBe(3)
    expect(f.value).toBe(3)
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
    "f", // would have expected b c e d f, but alas
    "transaction",
    "f",
    "change",
    "b",
    "try c",
    "c",
    "try f",
    "f",
    "end transaction",
    "d", // would have expected e d
    "e",
  ])

  d()
  e()
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
  fobx.runInAction(() => {
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
    x: fobx.observableBox(3),
  })

  expect(typeof a.x).toBe("object")
  expect(a.x.value).toBe(3)
})

test("isComputed", function () {
  expect(fobx.isComputed(fobx.observableBox(3))).toBe(false)
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
  const a = fobx.observableBox(1) as ObservableBoxWithAdmin
  let b = 1
  let d!: ReactionWithAdmin
  fobx.autorun((r) => {
    d = r as ReactionWithAdmin
    b = a.value
  })

  try {
    fobx.runInAction(() => {
      a.value = 2
      throw 3
    })
  } catch {
    // empty
  }

  expect(a[$fobx].observers.length).toBe(1)
  expect(d[$fobx].dependencies.length).toBe(1)
  expect(fobx.getGlobalState().batchedActionsCount).toEqual(0)
  expect(fobx.getGlobalState().pendingReactions.length).toEqual(0)
  expect(fobx.getGlobalState().reactionContext).toEqual(null)

  expect(b).toBe(2)
  a.value = 3
  expect(b).toBe(3)
})

test("computed equals function only invoked when necessary", () => {
  suppressConsole(() => {
    const comparisons: { from: string; to: string }[] = []
    const loggingComparer = (from: string, to: string) => {
      comparisons.push({ from, to })
      return from === to
    }

    const left = fobx.observableBox("A")
    const right = fobx.observableBox("B")
    const combinedToLowerCase = fobx.computed(
      () => {
        return left.value.toLowerCase() + right.value.toLowerCase()
      },
      {
        equals: loggingComparer,
      },
    )

    const values: string[] = []
    let disposeAutorun = fobx.autorun(() =>
      values.push(combinedToLowerCase.value)
    )

    // No comparison should be made on the first value
    expect(comparisons).toEqual([])

    // First change will cause a comparison
    left.value = "C"
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Transition *to* CaughtException in the computed won't cause a comparison
    // @ts-expect-error - trying to cause exception
    left.value = null
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // Transition *between* CaughtException-s in the computed won't cause a comparison
    // @ts-expect-error - trying to cause exception
    right.value = null
    expect(comparisons).toEqual([{ from: "ab", to: "cb" }])

    // TODO: document this behavior differs from mobx
    // Transition *from* CaughtException in the computed won't cause a comparison
    left.value = "D"
    right.value = "E"
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
    ])

    // Another value change will cause a comparison
    right.value = "F"
    expect(comparisons).toEqual([
      { from: "ab", to: "cb" },
      { from: "cb", to: "de" },
      { from: "de", to: "df" },
    ])

    // Becoming unobserved, then observed won't cause a comparison
    disposeAutorun()
    disposeAutorun = fobx.autorun(() => values.push(combinedToLowerCase.value))
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

// TODO: the next 3 test cases cannot be achieved with current annotation approach I took.
// TODO: SOLUTION?
// TODO: extend the annotations to allow for object values that allow the ability to supply computed options such as {type: computed, equals: fn, ...}
// test("computed comparer works with decorate (plain)", () => {
//   const sameTime = (from, to) => from.hour === to.hour && from.minute === to.minute
//   function Time(hour, minute) {
//       this.hour = hour
//       this.minute = minute
//       makeObservable(this, {
//           hour: observable,
//           minute: observable,
//           time: computed({ equals: sameTime })
//       })
//   }

//   Object.defineProperty(Time.prototype, "time", {
//       configurable: true,
//       enumerable: true,
//       get() {
//           return { hour: this.hour, minute: this.minute }
//       }
//   })
//   const time = new Time(9, 0)

//   const changes = []
//   const disposeAutorun = autorun(() => changes.push(time.time))

//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 9
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.minute = 0
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 10
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 }
//   ])
//   time.minute = 30
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 },
//       { hour: 10, minute: 30 }
//   ])

//   disposeAutorun()
// })

// test("computed comparer works with decorate (plain) - 2", () => {
//   const sameTime = (from, to) => from.hour === to.hour && from.minute === to.minute
//   function Time(hour, minute) {
//       extendObservable(
//           this,
//           {
//               hour,
//               minute,
//               get time() {
//                   return { hour: this.hour, minute: this.minute }
//               }
//           },
//           {
//               time: computed({ equals: sameTime })
//           }
//       )
//   }
//   const time = new Time(9, 0)

//   const changes = []
//   const disposeAutorun = autorun(() => changes.push(time.time))

//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 9
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.minute = 0
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 10
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 }
//   ])
//   time.minute = 30
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 },
//       { hour: 10, minute: 30 }
//   ])

//   disposeAutorun()
// })

// test("computed comparer works with decorate (plain) - 3", () => {
//   const sameTime = (from, to) => from.hour === to.hour && from.minute === to.minute
//   const time = observable.object(
//       {
//           hour: 9,
//           minute: 0,
//           get time() {
//               return { hour: this.hour, minute: this.minute }
//           }
//       },
//       {
//           time: computed({ equals: sameTime })
//       }
//   )

//   const changes = []
//   const disposeAutorun = autorun(() => changes.push(time.time))

//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 9
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.minute = 0
//   expect(changes).toEqual([{ hour: 9, minute: 0 }])
//   time.hour = 10
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 }
//   ])
//   time.minute = 30
//   expect(changes).toEqual([
//       { hour: 9, minute: 0 },
//       { hour: 10, minute: 0 },
//       { hour: 10, minute: 30 }
//   ])

//   disposeAutorun()
// })

test("can create computed with setter", () => {
  let y = 1
  const x = fobx.computed(
    () => y,
    (v: number) => {
      y = v * 2
    },
  )
  expect(x.value).toBe(1)
  x.value = 3
  expect(x.value).toBe(6)
})

test("can make non-extensible objects observable", () => {
  const base = { x: 3 }
  Object.freeze(base)
  const o = fobx.observable(base)
  o.x = 4
  expect(o.x).toBe(4)
  expect(fobx.isObservable(o, "x")).toBe(true)
})

// TODO: the following computed tests are all surrounding the keepAlive option, do I need it?
// TODO: I think the answer here is no. If someone wants the keepAlive functionality they can achieve
// TODO: it with an no-op autorun (i.e. const dispose = autorun(() => {someComputed.value})) as it
// TODO: provides a mechanism to dispose the computed. The autorun no-op is mentioned as an alternative
// TODO: to the keepAlive in the "tips" section found here https://mobx.js.org/computeds.html
// test("keeping computed properties alive does not run before access", () => {
//   let calcs = 0
//   mobx.observable(
//       {
//           x: 1,
//           get y() {
//               calcs++
//               return this.x * 2
//           }
//       },
//       {
//           y: mobx.computed({ keepAlive: true })
//       }
//   )

//   expect(calcs).toBe(0) // initially there is no calculation done
// })

// test("(for objects) keeping computed properties alive does not run before access", () => {
//   let calcs = 0
//   class Foo {
//       x = 1

//       constructor() {
//           makeObservable(this, {
//               x: observable,
//               y: computed({ keepAlive: true })
//           })
//       }

//       get y() {
//           calcs++
//           return this.x * 2
//       }
//   }
//   new Foo()

//   expect(calcs).toBe(0) // initially there is no calculation done
// })

// test("keeping computed properties alive runs on first access", () => {
//   let calcs = 0
//   const x = observable(
//       {
//           x: 1,
//           get y() {
//               calcs++
//               return this.x * 2
//           }
//       },
//       {
//           y: mobx.computed({ keepAlive: true })
//       }
//   )

//   expect(calcs).toBe(0)
//   expect(x.y).toBe(2) // perform calculation on access
//   expect(calcs).toBe(1)
// })

// test("keeping computed properties alive caches values on subsequent accesses", () => {
//   let calcs = 0
//   const x = observable(
//       {
//           x: 1,
//           get y() {
//               calcs++
//               return this.x * 2
//           }
//       },
//       {
//           y: mobx.computed({ keepAlive: true })
//       }
//   )

//   expect(x.y).toBe(2) // first access: do calculation
//   expect(x.y).toBe(2) // second access: use cached value, no calculation
//   expect(calcs).toBe(1) // only one calculation: cached!
// })

// test("keeping computed properties alive does not recalculate when dirty", () => {
//   let calcs = 0
//   const x = observable(
//       {
//           x: 1,
//           get y() {
//               calcs++
//               return this.x * 2
//           }
//       },
//       {
//           y: mobx.computed({ keepAlive: true })
//       }
//   )

//   expect(x.y).toBe(2) // first access: do calculation
//   expect(calcs).toBe(1)
//   x.x = 3 // mark as dirty: no calculation
//   expect(calcs).toBe(1)
//   expect(x.y).toBe(6)
// })

// test("keeping computed properties alive recalculates when accessing it dirty", () => {
//   let calcs = 0
//   const x = observable(
//       {
//           x: 1,
//           get y() {
//               calcs++
//               return this.x * 2
//           }
//       },
//       {
//           y: mobx.computed({ keepAlive: true })
//       }
//   )

//   expect(x.y).toBe(2) // first access: do calculation
//   expect(calcs).toBe(1)
//   x.x = 3 // mark as dirty: no calculation
//   expect(calcs).toBe(1)
//   expect(x.y).toBe(6) // second access: do calculation because it is dirty
//   expect(calcs).toBe(2)
// })

// test("(for objects) keeping computed properties alive recalculates when accessing it dirty", () => {
//   let calcs = 0
//   class Foo {
//       x = 1

//       constructor() {
//           makeObservable(this, {
//               x: observable,
//               y: computed({ keepAlive: true })
//           })
//       }

//       get y() {
//           calcs++
//           return this.x * 2
//       }
//   }
//   const x = new Foo()

//   expect(x.y).toBe(2) // first access: do calculation
//   expect(calcs).toBe(1)
//   x.x = 3 // mark as dirty: no calculation
//   expect(calcs).toBe(1)
//   expect(x.y).toBe(6) // second access: do calculation because it is dirty
//   expect(calcs).toBe(2)
// })

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

// TODO: should have safeDescriptors option?
// test("configure({ safeDescriptors: false })", () => {
//   function checkDescriptors(thing) {
//       Reflect.ownKeys(thing).forEach(key => {
//           const { get, set, writable, configurable } = Object.getOwnPropertyDescriptor(thing, key)
//           expect(get || set || writable).toBeTruthy()
//           expect(configurable).toBe(true)
//       })
//   }

//   const getGlobalState = mobx._getgetGlobalState()
//   expect(getGlobalState().safeDescriptors).toBe(true)
//   mobx.configure({ safeDescriptors: false })
//   expect(getGlobalState().safeDescriptors).toBe(false)

//   class Clazz {
//       observable = 0
//       action() {}
//       get computed() {}
//       *flow() {}
//       constructor() {
//           mobx.makeObservable(this, {
//               observable: mobx.observable,
//               action: mobx.action,
//               computed: mobx.computed,
//               flow: mobx.flow
//           })
//       }
//   }
//   checkDescriptors(Clazz.prototype)
//   const clazz = new Clazz()
//   checkDescriptors(clazz)

//   const plain = mobx.observable({
//       observable: 0,
//       action() {},
//       get computed() {},
//       *flow() {}
//   })

//   checkDescriptors(plain)

//   mobx.configure({ safeDescriptors: true })
//   expect(getGlobalState().safeDescriptors).toBe(true)
// })

test("generator props are observable flows", () => {
  const o = fobx.observable({
    observable: 0,
    *observableFlow() {
      yield this.observable
    },
  })
  expect(fobx.isObservable(o, "observable")).toBe(true)
  expect(fobx.isObservable(o, "observableFlow")).toBe(false)
  expect(fobx.isFlow(o.observableFlow)).toBe(true)
})

// TODO: should protect against providing options twice?
// test("options can be provided only once", () => {
//   const o = makeObservable({}, {}, { name: "TestObject" })
//   const error = `[MobX] Options can't be provided for already observable objects`
//   expect(() => {
//       extendObservable(o, { x: 0 }, {}, {})
//   }).toThrow(error)

//   expect(() => {
//       o.y = 0
//       makeObservable(o, { y: observable }, {})
//   }).toThrow(error)
// })

const MAX_SPLICE_SIZE = 10000
test("ObservableArray.replace", () => {
  // both lists are small
  let ar = fobx.observable([1])
  let del = ar.replace([2])
  expect(ar.toJSON()).toEqual([2])
  expect(del).toEqual([1])

  // the replacement is large
  ar = fobx.observable([1])
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del).toEqual([1])

  // the original is large
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE }))
  del = ar.replace([2])
  expect(ar).toEqual([2])
  expect(del.length).toEqual(MAX_SPLICE_SIZE)

  // both are large; original larger than replacement
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }))
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)

  // both are large; replacement larger than original
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE }))
  del = ar.replace(Array.from({ length: MAX_SPLICE_SIZE + 1 }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE + 1)
  expect(del.length).toEqual(MAX_SPLICE_SIZE)
})

test("ObservableArray.splice", () => {
  // Deleting 1 item from a large list
  let ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }))
  let del = ar.splice(1, 1)
  expect(ar.length).toEqual(MAX_SPLICE_SIZE)
  expect(del.length).toEqual(1)

  // Deleting many items from a large list
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 2 }))
  del = ar.splice(1, MAX_SPLICE_SIZE + 1)
  expect(ar.length).toEqual(1)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)

  // Deleting 1 item from a large list and inserting many items
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }))
  del = ar.splice(1, 1, ...Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }))
  expect(ar.length).toEqual(MAX_SPLICE_SIZE * 2 + 1)
  expect(del.length).toEqual(1)

  // Deleting many items from a large list and inserting many items
  ar = fobx.observable(Array.from<number>({ length: MAX_SPLICE_SIZE + 10 }))
  del = ar.splice(
    1,
    MAX_SPLICE_SIZE + 1,
    ...Array.from<number>({ length: MAX_SPLICE_SIZE + 1 }),
  )
  expect(ar.length).toEqual(MAX_SPLICE_SIZE + 10)
  expect(del.length).toEqual(MAX_SPLICE_SIZE + 1)
})

// TODO: some global options, should I add them?
// describe("`requiresReaction` takes precedence over global `computedRequiresReaction`", () => {
//   const name = "TestComputed"
//   let warnMsg = `[mobx] Computed value '${name}' is being read outside a reactive context. Doing a full recompute.`
//   let consoleWarnSpy
//   beforeEach(() => {
//       consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
//   })
//   afterEach(() => {
//       consoleWarnSpy.mockRestore()
//       mobx._resetgetGlobalState()
//   })

//   test("`undefined`", () => {
//       mobx.configure({ computedRequiresReaction: true })
//       const c = mobx.computed(() => {}, { name })
//       c.get()
//       expect(consoleWarnSpy).toHaveBeenLastCalledWith(warnMsg)
//   })

//   test("`true` over `false`", () => {
//       mobx.configure({ computedRequiresReaction: false })
//       const c = mobx.computed(() => {}, { name, requiresReaction: true })
//       c.get()
//       expect(consoleWarnSpy).toHaveBeenLastCalledWith(warnMsg)
//   })

//   test("`false` over `true`", () => {
//       mobx.configure({ computedRequiresReaction: true })
//       const c = mobx.computed(() => {}, { name, requiresReaction: false })
//       c.get()
//       expect(consoleWarnSpy).not.toHaveBeenCalled()
//   })
// })

// describe("`requiresObservable` takes precedence over global `reactionRequiresObservable`", () => {
//   const name = "TestReaction"
//   let warnMsg = `[mobx] Derivation '${name}' is created/updated without reading any observable value.`
//   let consoleWarnSpy
//   beforeEach(() => {
//       consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
//   })
//   afterEach(() => {
//       consoleWarnSpy.mockRestore()
//       mobx._resetgetGlobalState()
//   })

//   test("`undefined`", () => {
//       mobx.configure({ reactionRequiresObservable: true })
//       const dispose = mobx.autorun(() => {}, { name })
//       dispose()
//       expect(consoleWarnSpy).toHaveBeenLastCalledWith(warnMsg)
//   })

//   test("`true` over `false`", () => {
//       mobx.configure({ reactionRequiresObservable: false })
//       const dispose = mobx.autorun(() => {}, { name, requiresObservable: true })
//       dispose()
//       expect(consoleWarnSpy).toHaveBeenLastCalledWith(warnMsg)
//   })

//   test("`false` over `true`", () => {
//       mobx.configure({ reactionRequiresObservable: true })
//       const dispose = mobx.autorun(() => {}, { name, requiresObservable: false })
//       dispose()
//       expect(consoleWarnSpy).not.toHaveBeenCalled()
//   })
// })

test("#3747", () => {
  fobx.runInAction(() => {
    const o = fobx.observableBox(0)
    const c = fobx.computed(() => o.value)
    expect(c.value).toBe(0)
    o.value = 1
    expect(c.value).toBe(1) // would fail
  })
})
