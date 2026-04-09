// deno-lint-ignore-file no-explicit-any
import type { ObservableObjectAdmin } from "../object.ts"
import type { ObservableArray } from "../observableArray.ts"
import type { ReactionAdmin } from "../../state/global.ts"
import { $fobx, observerCount } from "../../state/global.ts"
import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"
import { deepEqual } from "fast-equals"

beforeEach(() => {
  fobx.configure({ enforceTransactions: false, comparer: { structural: deepEqual } })
})

class TestViewModel {
  [key: string]: any
}

test("nested objects respect individually specified structural option", () => {
  const o = fobx.observable({ a: { b: 1 } }, {
    annotations: {
      a: ["observable", "structural"],
    },
  })
  let runs = -1

  fobx.autorun(() => {
    runs++
    o.a
  })
  expect(runs).toBe(0)

  o.a = { b: 1 }
  expect(runs).toBe(0)

  o.a = { b: 2 }
  expect(runs).toBe(1)

  o.a = { b: 2 }
  expect(runs).toBe(1)
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
      const annotations: Record<string, "observable.ref"> = {}
      Object.entries(props).forEach(([key]) => {
        annotations[key] = "observable.ref"
      })
      this._props = fobx.observable(props, { annotations })
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

test("subclass observable(this) cannot override base annotations", () => {
  class Base {
    ref = { value: 1 }

    constructor() {
      fobx.observable(this, {
        annotations: {
          ref: "observable.ref",
          value: "computed",
          update: "none",
        },
      })
    }

    get value() {
      return this.ref.value
    }

    update() {
      return this.value
    }
  }

  class Child extends Base {
    childValue = 2

    constructor() {
      super()
      fobx.observable(this, {
        annotations: {
          ref: "observable",
          value: "none",
          update: "transaction",
          childValue: "observable",
          childComputed: "computed",
        },
      })
    }

    get childComputed() {
      return this.childValue * 2
    }
  }

  const child = new Child()

  expect(fobx.isObservable(child.ref, "value")).toBe(false)
  expect(fobx.isComputed(child, "value")).toBe(true)
  expect(fobx.isTransaction(child.update)).toBe(false)
  expect(fobx.isObservable(child, "childValue")).toBe(true)
  expect(fobx.isComputed(child, "childComputed")).toBe(true)
  expect(child.value).toBe(1)
  expect(child.childComputed).toBe(4)
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
      obj: { [$fobx]: { values: new Map(), target: {}, id: 1, name: "x" } },
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
  // Note: v1 tested these via createAutoObservableObject (internal, objects-only).
  // v2's observable() correctly routes arrays/maps/sets to collection constructors,
  // so those entries are excluded here.
  const errorsTC = [
    { arg: "", expected: typeof "" },
    { arg: 10, expected: typeof 10 },
    { arg: true, expected: typeof true },
    { arg: Symbol(""), expected: typeof Symbol("") },
    { arg: undefined, expected: typeof undefined },
    { arg: BigInt(1), expected: typeof BigInt(1) },
    { arg: () => null, expected: typeof (() => null) },
    { arg: null, expected: "null" },
  ]
  errorsTC.forEach(({ arg, expected }: { arg: any; expected: string }) => {
    test(`throws error if supplied type of '${expected}'`, () => {
      expect(() => fobx.observable(arg)).toThrow(
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
        return o1.get() + 1
      },
    })
    expect(obj.a).toBe(2)
    expect(callCount).toBe(1)
    expect(obj.a).toBe(2)
    expect(callCount).toBe(2)
    o1.set(2)
    expect(callCount).toBe(2)

    callCount = 0
    const reactionFn = fn()
    fobx.reaction(() => obj.a, reactionFn)
    expect(callCount).toBe(1)
    expect(obj.a).toBe(3)
    expect(callCount).toBe(1)
    o1.set(3)
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
      { annotations: { b: "none" } },
    )
    fobx.reaction(() => obj.c, fn())
    expect(callCount).toBe(1)
    expect(obj.a).toBe(10)
    expect(obj.b).toBe(1)
    expect(obj.c).toBe(11)

    obj.inc()
    expect(callCount).toBe(2)
    expect(obj.a).toBe(11)
    expect(obj.b).toBe(1)
    expect(obj.c).toBe(12)

    obj.b = 2
    expect(callCount).toBe(2)
    expect(obj.a).toBe(11)
    expect(obj.b).toBe(2)
    expect(obj.c).toBe(12)
  })

  test("methods can be reassigned on observable plain objects", () => {
    const obj = fobx.observable({
      count: 0,
      increment() {
        this.count++
        return this.count
      },
    })

    expect(fobx.isTransaction(obj.increment)).toBe(true)

    let calls = 0
    const replacement = () => {
      calls++
      return 42
    }

    expect(() => {
      ;(obj as { increment: () => number }).increment = replacement
    }).not.toThrow()

    expect(obj.increment()).toBe(42)
    expect(calls).toBe(1)
  })

  // TODO: this test isn't valid in deno since it only runs in strict mode js
  // test("'this' argument inside plain object observable functions is treated identically to plain object", () => {
  //   const plain = {
  //     test() {
  //       return this.b
  //     },
  //     b: 1,
  //   }
  //
  // expect(plain.test()).toBe(1)
  // const { test: plainTest } = plain
  // expect(plainTest()).toBe(undefined)
  //
  // const obs = fobx.observable(plain, { test: "none" })
  // expect(obs.test()).toBe(1)
  // const { test: observableTest } = obs
  // expect(observableTest()).toBe(undefined)
  //
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
        fobx.observable(this, { annotations: { test: "none" } })
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

  test("methods can be reassigned on observable class instances", () => {
    class Vm {
      count = 0

      constructor() {
        fobx.observable(this)
      }

      increment() {
        this.count++
        return this.count
      }
    }

    const vm = new Vm()
    expect(fobx.isTransaction(vm.increment)).toBe(true)

    let calls = 0
    const replacement = () => {
      calls++
      return 7
    }

    expect(() => {
      ;(vm as { increment: () => number }).increment = replacement
    }).not.toThrow()

    expect(vm.increment()).toBe(7)
    expect(calls).toBe(1)
  })

  test("defaultAnnotation only changes own function fields, not prototype methods", () => {
    const storedCallback = () => 42
    const defaultAnnotations = [
      "observable",
      "observable.ref",
      "observable.shallow",
      "none",
    ] as const
    const dataLikeDefaults = defaultAnnotations.filter((annotation) => {
      return annotation !== "none"
    })

    for (const defaultAnnotation of dataLikeDefaults) {
      const plain = fobx.observable({ callback: storedCallback }, {
        defaultAnnotation,
      })

      expect(plain.callback).toBe(storedCallback)
      expect(fobx.isObservable(plain, "callback")).toBe(true)
      expect(fobx.isTransaction(plain.callback)).toBe(false)
    }

    for (const defaultAnnotation of defaultAnnotations) {
      class A {
        count = 0
        callback = storedCallback

        constructor() {
          fobx.observable(this, { defaultAnnotation })
        }

        fn() {
          this.count++
          return this.count
        }

        *gen() {
          yield this.count
        }
      }

      const a = new A()
      expect(fobx.isTransaction(a.fn)).toBe(true)
      expect(fobx.isObservable(a, "fn")).toBe(false)
      expect(fobx.isFlow(a.gen)).toBe(true)
      expect(a.callback).toBe(storedCallback)
      expect(fobx.isObservable(a, "callback")).toBe(
        defaultAnnotation !== "none",
      )
      expect(fobx.isTransaction(a.callback)).toBe(false)
      expect(a.fn()).toBe(1)

      const b = fobx.observable(new A(), { defaultAnnotation })
      expect(fobx.isTransaction(b.fn)).toBe(true)
      expect(fobx.isObservable(b, "fn")).toBe(false)
      expect(fobx.isFlow(b.gen)).toBe(true)
      expect(b.callback).toBe(storedCallback)
      expect(fobx.isObservable(b, "callback")).toBe(
        defaultAnnotation !== "none",
      )
      expect(b.fn()).toBe(1)
    }
  })

  test("plain-object defaultAnnotation none preserves own function-valued fields", () => {
    for (const inPlace of [false, true]) {
      const callback = () => 42
      const source = {
        value: 1,
        callback,
        *load() {
          yield this.value
        },
      }

      const observed = fobx.observable(source, {
        defaultAnnotation: "none",
        inPlace,
      })

      expect(observed === source).toBe(inPlace)
      expect(Object.keys(observed)).toEqual(["value", "callback", "load"])
      expect(observed.value).toBe(1)
      expect(observed.callback).toBe(callback)
      expect(observed.load).toBe(source.load)
      expect(fobx.isObservable(observed, "value")).toBe(false)
      expect(fobx.isObservable(observed, "callback")).toBe(false)
      expect(fobx.isObservable(observed, "load")).toBe(false)
      expect(fobx.isTransaction(observed.callback)).toBe(false)
      expect(fobx.isFlow(observed.load)).toBe(false)
      expect(Array.from(observed.load())).toEqual([1])
    }
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

    expect(obj.a).toBe(5)
    expect(callCount).toBe(1)
    expect(obj.b).toBe(5)
    expect(callCount).toBe(2)
    expect(obj.a).toBe(5)
    expect(callCount).toBe(3)
    expect(obj.b).toBe(5)
    expect(callCount).toBe(4)

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
        fobx.observable(this, { annotations: { callCount: "none" } })
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
    expect(a.b).toBe(10)
    expect(a.callCount).toBe(1)

    const reactionFn = fn()
    fobx.reaction(() => a.b, reactionFn)
    expect(a.callCount).toBe(2)

    expect(a.b).toBe(10)
    expect(a.callCount).toBe(2)

    a.b = 5
    expect(a.b).toBe(5)
    expect(a.callCount).toBe(3)
    expect(a.action()).toBe(5)
    expect(a.callCount).toBe(3)
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
    let r!: ReactionAdmin
    const reactionFn = fn((_o, _n) => {
      const obs = (o.a as any)[$fobx].observers
      r = obs instanceof Set ? obs.values().next().value : obs
    })
    fobx.reaction(() => {
      return o.a
    }, reactionFn)

    o.a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(
      [1, 2, 3, 4],
      [1, 2, 3, 4],
      expect.objectContaining({
        dispose: expect.any(Function),
        hasPrevious: true,
      }),
    )
    o.a[0] = 5
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith(
      [5, 2, 3, 4],
      [5, 2, 3, 4],
      expect.objectContaining({
        dispose: expect.any(Function),
        hasPrevious: true,
      }),
    )

    const firstArray = o.a as ObservableArray<number>
    expect(r.deps.length).toBeGreaterThanOrEqual(1)
    expect(observerCount((firstArray as any)[$fobx])).toBe(1)

    o.a = []
    expect(o.a).toEqual([])
    expect(fobx.isObservableArray(o.a)).toBe(true)
    expect((o.a as any)[$fobx].name).not.toBe((firstArray as any)[$fobx].name)
    expect(observerCount((firstArray as any)[$fobx])).toBe(0)
    expect(observerCount((o.a as any)[$fobx])).toBe(1)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith(
      [],
      [5, 2, 3, 4],
      expect.objectContaining({
        dispose: expect.any(Function),
        hasPrevious: true,
      }),
    )

    o.a.push(1)
    expect(o.a).toEqual([1])
    expect(reactionFn).toHaveBeenCalledTimes(4)
    expect(reactionFn).toHaveBeenCalledWith(
      [1],
      [1],
      expect.objectContaining({
        dispose: expect.any(Function),
        hasPrevious: true,
      }),
    )
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

    expect(fobx.isObservable(o, "b")).toBe(true)
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(fobx.isObservable(o.b.c, "a")).toBe(true)

    const reactionFn = fn()
    fobx.reaction(() => o.b.c.a, reactionFn)

    const originalA =
      (o.b.c as unknown as { [$fobx]: ObservableObjectAdmin })[$fobx]
        .values.get(
          "a",
        )
    expect(observerCount((originalA as any)[$fobx])).toBe(1)
    const obsField1 = (originalA as any)[$fobx].observers
    const reactionRef = obsField1 instanceof Set
      ? obsField1.values().next().value
      : obsField1

    o.b.c = { a: 1 }
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(reactionFn).not.toHaveBeenCalled()
    expect(observerCount((originalA as any)[$fobx])).toBe(0)
    const secondA =
      (o.b.c as unknown as { [$fobx]: ObservableObjectAdmin })[$fobx]
        .values.get(
          "a",
        )
    expect(observerCount((secondA as any)[$fobx])).toBe(1)
    const obsField2 = (secondA as any)[$fobx].observers
    const n = obsField2 instanceof Set
      ? obsField2.values().next().value
      : obsField2
    expect(n).toBe(reactionRef)

    o.b.c.a = 2
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(2, 1, expect.anything())

    o.b.c = { a: 3 }
    expect(fobx.isObservable(o.b, "c")).toBe(true)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith(3, 2, expect.anything())
    expect(observerCount((secondA as any)[$fobx])).toBe(0)
    const thirdA =
      (o.b.c as unknown as { [$fobx]: ObservableObjectAdmin })[$fobx].values
        .get(
          "a",
        )
    expect(observerCount((thirdA as any)[$fobx])).toBe(1)
    const obsField3 = (thirdA as any)[$fobx].observers
    const name = obsField3 instanceof Set
      ? obsField3.values().next().value
      : obsField3
    expect(name).toBe(reactionRef)

    o.b.c.a = 4
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith(4, 3, expect.anything())
  })
})

test("annotations work as expected in inheritance", () => {
  class GrandParent {
    g = 3
    constructor() {
      fobx.observable(this, { annotations: { g: "observable.ref" } })
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
      fobx.observable(this, { annotations: { p2: "none", pfn: "none" } })
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
  expect(fobx.isTransaction(c.pfn)).toBe(false)
  expect(fobx.isComputed(c, "p2")).toBe(false)
  expect(c.p2).toBe(2)
  expect(fobx.isObservable(c, "g")).toBe(true)
  expect(c.g).toBe(3)
})

test("computed values are correctly applied for each instance of a class, not just the first", () => {
  class Vm extends TestViewModel {
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
