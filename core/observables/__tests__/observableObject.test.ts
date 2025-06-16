import {
  createAutoObservableObject,
  type ObservableObjectWithAdmin,
} from "../observableObject.ts"
import type { ObservableArrayWithAdmin } from "../observableArray.ts"
import type { ReactionWithAdmin } from "../../reactions/reaction.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"
import { ViewModel } from "@fobx/react"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

const noErrorOnObservableTC = [
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
]
noErrorOnObservableTC.forEach((name) => {
  test(`calling observable on an object with '${name}' defined does not throw`, () => {
    expect(() => fobx.observable({ [name]: () => "string" })).not.toThrow()
  })
})

test("observable(this) called in both super and base class does not incorrectly re-assign observables to computeds", () => {
  class ViewModel<T extends object = object> {
    constructor(props: T) {
      const annotations: Record<string, "observable"> = {}
      Object.entries(props).forEach(([key]) => {
        annotations[key] = "observable"
      })
      this._props = fobx.observable(props, annotations, { shallowRef: true })
      fobx.observable(this)
    }

    get props() {
      return this._props
    }
    private _props: T
  }

  class BaseVm extends ViewModel<{ a: number }> {
    constructor(props: { a: number }) {
      super(props)
      fobx.observable(this)
    }

    get classes() {
      return [this.props.a]
    }
  }

  const vm = new BaseVm({ a: 1 })
  expect(fobx.isComputed(vm, "_props")).toBe(false)
})

test("observable API for arrays successfully constructs arrays", () => {
  const o = fobx.observable({ a: 0 })
  expect(o).toEqual({ a: 0 })
  expect(fobx.isObservableObject(o)).toBe(true)
  expect(fobx.isObservable(o, "a")).toBe(true)
})

describe("isObservableObject", () => {
  const TC = [
    {
      desc: "valid observable object",
      obj: { [$fobx]: { values: new Map() } },
      expected: true,
    },
    { desc: "blank object", obj: {}, expected: false },
    {
      desc: "fobx administration without 'values' field",
      obj: { [$fobx]: {} },
      expected: false,
    },
  ]
  TC.forEach(({ desc, obj, expected }) => {
    test(`returns ${expected} when called with ${desc}`, () => {
      expect(fobx.isObservableObject(obj)).toBe(expected)
    })
  })
})

describe("observableObject", () => {
  const errorsTC = [
    { arg: "", expected: typeof "" },
    { arg: 10, expected: typeof 10 },
    { arg: true, expected: typeof true },
    { arg: Symbol(""), expected: typeof Symbol("") },
    { arg: undefined, expected: typeof undefined },
    { arg: BigInt(1), expected: typeof BigInt(1) },
    { arg: () => null, expected: typeof (() => null) },
    { arg: null, expected: "null" },
    { arg: [], expected: "array" },
    { arg: new Map(), expected: "map" },
    { arg: new Set(), expected: "set" },
  ]
  // deno-lint-ignore no-explicit-any
  errorsTC.forEach(({ arg, expected }: { arg: any; expected: string }) => {
    test(`throws error if supplied type of '${expected}'`, () => {
      expect(() => createAutoObservableObject(arg)).toThrow(
        `[@fobx/core] Cannot make an observable object out of type "${expected}"`,
      )
    })
  })

  test("successfully returns an observable object", () => {
    const obs = fobx.observable({ a: "a" })
    expect(fobx.isObservableObject(obs)).toBe(true)
    expect(obs.a).toBe("a")
  })

  test("when called with an observable object returns same object", () => {
    const obs = fobx.observable({ a: "a" })
    expect(fobx.observable(obs)).toBe(obs)
  })

  test("computed values recompute as expected", () => {
    let callCount = 0
    const o1 = fobx.observableBox(1)
    const obj = fobx.observable({
      get a() {
        callCount++
        return o1.value + 1
      },
    })
    // each access runs computation because no reaction is using it
    expect(obj.a).toBe(2)
    expect(callCount).toBe(1)
    expect(obj.a).toBe(2)
    expect(callCount).toBe(2)
    // change to value doesn't cause computation to run since no reactions use it
    o1.value = 2
    expect(callCount).toBe(2)

    // hooking it up to a reaction makes it only be called once upon hooking it up to the reaction
    callCount = 0
    const reactionFn = fn()
    fobx.reaction(() => obj.a, reactionFn)
    expect(callCount).toBe(1)
    expect(obj.a).toBe(3)
    expect(callCount).toBe(1)
    // change to observable causes objects computed to run
    o1.value = 3
    expect(callCount).toBe(2)
    expect(obj.a).toBe(4)
    expect(callCount).toBe(2)
  })

  test("computed/action have proper 'this' reference", () => {
    let callCount = 0
    const obj = fobx.observable(
      {
        a: 10,
        inc() {
          this.a++
        },
        b: 1,
        get c() {
          callCount++
          return this.b + this.a
        },
      },
      { b: "none" },
    )
    // hooking up reaction to computed causes computed to compute
    fobx.reaction(() => obj.c, fn())
    expect(callCount).toBe(1)
    expect(obj.a).toBe(10)
    expect(obj.b).toBe(1)
    expect(obj.c).toBe(11)

    // calling "a" increments observable causing computed to run
    obj.inc()
    expect(callCount).toBe(2)
    expect(obj.a).toBe(11)
    expect(obj.b).toBe(1)
    expect(obj.c).toBe(12)

    // changing something that isn't observable doesn't cause computed to re-run
    obj.b = 2
    expect(callCount).toBe(2)
    expect(obj.a).toBe(11)
    expect(obj.b).toBe(2)
    expect(obj.c).toBe(12) // reports incorrect value because it's cached and obj.b change is ignored
  })

  // TODO: this test isn't valid in deno since it only runs in strict mode js
  // test("'this' argument inside plain object observable functions is treated identically to plain object", () => {
  //   const plain = {
  //     test() {
  //       console.log("here", this)
  //       return this.b
  //     },
  //     b: 1,
  //   }

  // // 'this' is unbound by default on 'plain' object
  // expect(plain.test()).toBe(1)
  // const { test: plainTest } = plain
  // expect(plainTest()).toBe(undefined)

  // // 'this' is unbound for object function that isn't marked as an action.
  // const obs = fobx.observable(plain, { test: "none" })
  // expect(obs.test()).toBe(1)
  // const { test: observableTest } = obs
  // expect(observableTest()).toBe(undefined)

  // // 'this' is unbound for object function marked as an action.
  // const obsWithAction = fobx.observable(plain, { test: "action" })
  // expect(obsWithAction.test()).toBe(1)
  // const { test: obsWithActionTest } = obsWithAction
  // expect(obsWithActionTest()).toBe(undefined)
  // })

  test("'this' function arguments inside observable class objects behave the same as regular classes", () => {
    class Plain {
      b = 1
      test() {
        return this.b
      }
    }
    class WithoutAction {
      b = 1
      constructor() {
        fobx.observable(this, { test: "none" })
      }
      test() {
        return this.b
      }
    }
    class WithAction {
      b = 1
      constructor() {
        fobx.observable(this)
      }
      test() {
        return this.b
      }
    }

    const plain = new Plain()
    expect(plain.test()).toBe(1)
    const { test: plainTest } = plain
    expect(() => plainTest()).toThrow()

    const woAction = new WithoutAction()
    expect(woAction.test()).toBe(1)
    const { test: classWithoutActionTest } = woAction
    expect(() => classWithoutActionTest()).toThrow()

    const wAction = new WithAction()
    expect(wAction.test()).toBe(1)
    const { test: classWithActionTest } = wAction
    expect(() => classWithActionTest()).toThrow()
  })

  test("$fobx symbol is not writable, configurable, or enumerable", () => {
    const obj = fobx.observable({ a: "a" })
    expect(Object.getOwnPropertyDescriptor(obj, $fobx)).toEqual(
      expect.objectContaining({
        writable: false,
        enumerable: false,
        configurable: false,
      }),
    )
  })

  test("constructing object with computed values defined before the observable works", () => {
    let callCount = 0
    const obj = fobx.observable({
      get a() {
        callCount++
        return this.c
      },
      get b() {
        return this.a
      },
      c: 5,
    })
    expect(callCount).toBe(0)

    // nothing is observing the computed chain, so each access is calculated
    expect(obj.a).toBe(5)
    expect(callCount).toBe(1)
    expect(obj.b).toBe(5)
    expect(callCount).toBe(2)
    expect(obj.a).toBe(5)
    expect(callCount).toBe(3)
    expect(obj.b).toBe(5)
    expect(callCount).toBe(4)

    // there is now a non-computed observer, so one more calc happens and now it can cache
    const d = fobx.reaction(
      () => obj.b,
      () => {},
    )
    expect(callCount).toBe(5)

    expect(obj.a).toBe(5)
    expect(callCount).toBe(5)
    expect(obj.b).toBe(5)
    expect(callCount).toBe(5)

    d()
  })

  test("making a class observable results in correct 'this' references", () => {
    class A {
      a: number
      callCount = 0
      constructor() {
        this.a = 10
        fobx.observable(this, { callCount: "none" })
      }
      get b() {
        this.callCount++
        return this.a
      }
      set b(v: number) {
        this.a = v
      }
      action() {
        return this.a
      }
    }

    const a = new A()
    const a2 = new A()

    expect(a.callCount).toBe(0)
    // a.b causes computed to run because it's not observed at all
    expect(a.b).toBe(10)
    expect(a.callCount).toBe(1)

    // adding reaction to a.b causes computed to run again
    const reactionFn = fn()
    fobx.reaction(() => a.b, reactionFn)
    expect(a.callCount).toBe(2)

    // now that it's observed we cache it
    expect(a.b).toBe(10)
    expect(a.callCount).toBe(2)

    // assigning computed causes computed to run
    a.b = 5
    expect(a.b).toBe(5)
    expect(a.callCount).toBe(3)
    expect(a.action()).toBe(5)
    expect(a.callCount).toBe(3)
    // another instance of A does not have same state
    expect(a2.b).toBe(10)
  })

  test("both super class and subclass can be annotated", () => {
    let timesBCalled = 0
    class A {
      a: number
      constructor() {
        this.a = 10
        fobx.observable(this)
      }
      get b() {
        timesBCalled++
        return this.a
      }
    }
    let timesDCalled = 0
    class B extends A {
      c = 5
      constructor() {
        super()
        fobx.observable(this)
      }
      get d() {
        timesDCalled++
        return this.a + this.c
      }
    }

    const b = new B()
    expect(timesBCalled).toBe(0)
    expect(timesDCalled).toBe(0)

    // connecting to reaction causes it to compute
    fobx.reaction(() => [b.b, b.d], fn())
    expect(timesBCalled).toBe(1)
    expect(timesDCalled).toBe(1)

    expect(b.d).toBe(15)
    b.c += 1
    expect(timesBCalled).toBe(1)
    expect(timesDCalled).toBe(2)
    expect(b.d).toBe(16)

    b.a += 1
    expect(timesBCalled).toBe(2)
    expect(timesDCalled).toBe(3)
    expect(b.b).toBe(11)
    expect(b.d).toBe(17)
  })

  test("arrays are turned into ObservableArray as expected", () => {
    const o = fobx.observable({
      a: [1, 2, 3],
    })
    expect(o.a).toEqual([1, 2, 3])
    let r!: ReactionWithAdmin
    const reactionFn = fn((_o, _n, reaction) => {
      r = reaction
    })
    fobx.reaction(() => {
      return o.a
    }, reactionFn)

    o.a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith([1, 2, 3, 4], [1, 2, 3, 4], r)
    o.a[0] = 5
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith([5, 2, 3, 4], [5, 2, 3, 4], r)

    const firstArray = o.a as ObservableArrayWithAdmin
    expect(r[$fobx].dependencies.length).toBe(2)
    expect(firstArray[$fobx].observers.length).toBe(1)

    // non observable array being assigned should convert it to an observable array
    o.a = []
    expect(o.a).toEqual([])
    expect(fobx.isObservableArray(o.a)).toBe(true)
    expect((o.a as ObservableArrayWithAdmin)[$fobx].name).not.toBe(
      firstArray[$fobx].name,
    )
    // the observers from the first array should be transferred to the new array
    expect(firstArray[$fobx].observers.length).toBe(0)
    expect((o.a as ObservableArrayWithAdmin)[$fobx].observers.length).toBe(1)
    // the reactions observables list should have been adjusted to remove reference to first array
    const deps = r[$fobx].dependencies
    expect(deps.length).toBe(2)
    expect(deps.map((d) => d.name).includes(firstArray[$fobx].name)).toBe(
      false,
    )
    expect(
      deps.map((d) => d.name).includes(
        (o.a as ObservableArrayWithAdmin)[$fobx].name,
      ),
    ).toBe(true)
    // expect the reaction to have run due to value being changed
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith([], [5, 2, 3, 4], r)

    // re-mapping of observer/observable lists was successful and reaction still responds to changes
    o.a.push(1)
    expect(o.a).toEqual([1])
    expect(reactionFn).toHaveBeenCalledTimes(4)
    expect(reactionFn).toHaveBeenCalledWith([1], [1], r)
  })

  test("createAutoObservable deeply observes the object", () => {
    const a = {
      b: {
        c: {
          a: 1,
        },
      },
    }
    const o = fobx.observable(a)

    // observability is not shallow
    expect(fobx.isObservable(o, "b")).toBe(true)
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(fobx.isObservable(o.b.c, "a")).toBe(true)

    const reactionFn = fn()
    fobx.reaction(() => o.b.c.a, reactionFn)

    const originalA = (o.b.c as unknown as ObservableObjectWithAdmin)[$fobx]
      .values.get(
        "a",
      ) as unknown as ObservableArrayWithAdmin
    expect(originalA[$fobx].observers.length).toBe(1)
    const [reactionName] = originalA[$fobx].observers

    // replacing with non-observable object converts to observable and re-maps observers
    o.b.c = { a: 1 }
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(reactionFn).not.toHaveBeenCalled() // not called because a value is still same
    expect(originalA[$fobx].observers.length).toBe(0)
    const secondA = (o.b.c as unknown as ObservableObjectWithAdmin)[$fobx]
      .values.get(
        "a",
      ) as unknown as ObservableArrayWithAdmin
    expect(secondA[$fobx].observers.length).toBe(1)
    const [n] = secondA[$fobx].observers
    expect(n).toBe(reactionName)

    // verify reaction runs when a changes
    o.b.c.a = 2
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(2, 1, expect.anything())

    // replacing with object with new 'a' value causes reaction to run + re-mapped reactions
    o.b.c = { a: 3 }
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith(3, 2, expect.anything())
    expect(secondA[$fobx].observers.length).toBe(0)
    const thirdA = (o.b.c as unknown as ObservableObjectWithAdmin)[$fobx].values
      .get(
        "a",
      ) as unknown as ObservableArrayWithAdmin
    expect(thirdA[$fobx].observers.length).toBe(1)
    const [name] = thirdA[$fobx].observers
    expect(name).toBe(reactionName)

    // reaction still runs
    o.b.c.a = 4
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith(4, 3, expect.anything())
  })
})

test("annotations work as expected in inheritance", () => {
  class GrandParent {
    g = 3
    constructor() {
      fobx.observable(this, {}, { shallowRef: true })
    }
    get g2() {
      return this.g
    }

    gfn() {}
  }

  class Parent extends GrandParent {
    p = 2
    constructor() {
      super()
      fobx.observable(this, { p2: "none", pfn: "none" })
    }
    get p2() {
      return this.p
    }

    pfn() {}
  }

  class Child extends Parent {
    c = 1
    constructor() {
      super()
      fobx.observable(this)
    }
    get c2() {
      return this.c
    }
    cfn() {}
  }

  const c = new Child()
  expect(fobx.isAction(c.pfn)).toBe(false)
  expect(fobx.isComputed(c, "p2")).toBe(false)
  expect(c.p2).toBe(2)
  expect(fobx.isObservable(c, "g")).toBe(true)
  expect(c.g).toBe(3)
})

test("computed values are correctly applied for each instance of a class, not just the first", () => {
  class Vm extends ViewModel {
    private _a = 1
    constructor() {
      super()
      fobx.observable(this)
    }

    get a() {
      return this._a + 1
    }
  }

  const vm1 = new Vm()
  const vm2 = new Vm()
  expect(fobx.isComputed(vm1, "a")).toBe(true)
  expect(
    fobx.isComputed(vm2, "a"),
    "second instance of class lost the computed property annotation",
  ).toBe(true)
})
