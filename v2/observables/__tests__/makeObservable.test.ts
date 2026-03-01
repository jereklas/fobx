import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, fn, test } from "@fobx/testing"
import { deepEqual } from "fast-equals"

beforeEach(() => {
  fobx.configure({
    enforceActions: false,
    comparer: { structural: deepEqual },
  })
})

describe("makeObservable", () => {
  describe("basic functionality", () => {
    test("makes properties observable", () => {
      const obj = fobx.makeObservable({ x: 1, y: 2 }, {
        annotations: {
          x: "observable",
          y: "observable",
        },
      })

      expect(fobx.isObservableObject(obj)).toBe(true)
      expect(fobx.isObservable(obj, "x")).toBe(true)
      expect(fobx.isObservable(obj, "y")).toBe(true)
    })

    test("only makes explicitly annotated properties observable", () => {
      const obj = fobx.makeObservable({ x: 1, y: 2, z: 3 }, {
        annotations: {
          x: "observable",
        },
      })

      expect(fobx.isObservable(obj, "x")).toBe(true)
      expect(fobx.isObservable(obj, "y")).toBe(false)
      expect(fobx.isObservable(obj, "z")).toBe(false)
    })

    test("returns the same object when called with an already observable object", () => {
      const obj = fobx.makeObservable({ x: 1 }, {
        annotations: { x: "observable" },
      })
      const obj2 = fobx.makeObservable(obj, {
        annotations: { x: "observable" },
      })
      expect(obj2).toBe(obj)
    })
  })

  test("explicit observable declarations", () => {
    const user = fobx.makeObservable({
      name: "Alice",
      age: 30,
      profile: {
        avatar: "alice.jpg",
        settings: {
          theme: "dark",
        },
      },
      hobbies: ["reading", "hiking"],

      get fullName() {
        return `${this.name}, ${this.age} years old`
      },
    }, {
      annotations: {
        name: "observable",
        age: "observable",
        fullName: "computed",
      },
    })

    const nameReactionFn = fn()
    fobx.reaction(() => user.name, nameReactionFn)

    const fullNameReactionFn = fn()
    fobx.reaction(() => user.fullName, fullNameReactionFn)

    const profileReactionFn = fn()
    fobx.reaction(() => user.profile.settings.theme, profileReactionFn)

    const hobbiesReactionFn = fn()
    fobx.reaction(() => user.hobbies.length, hobbiesReactionFn)

    user.name = "Bob"
    expect(nameReactionFn).toHaveBeenCalledTimes(1)
    expect(fullNameReactionFn).toHaveBeenCalledTimes(1)

    user.profile.settings.theme = "light"
    expect(profileReactionFn).not.toHaveBeenCalled()

    user.hobbies.push("swimming")
    expect(hobbiesReactionFn).not.toHaveBeenCalled()
  })

  describe("type validation", () => {
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
        expect(() => fobx.makeObservable(arg, { annotations: {} } as never))
          .toThrow(
            `[@fobx/core] Cannot make an observable object out of type "${expected}"`,
          )
      })
    })
  })

  describe("default behavior compared to observable", () => {
    test("makeObservable with observable creates deeply observable properties like observable()", () => {
      const nested = { a: { b: { c: 1 } } }

      const observedDeep = fobx.observable(nested)
      const explicitDeep = fobx.makeObservable(nested, {
        annotations: {
          a: "observable",
        },
      })

      expect(fobx.isObservable(observedDeep, "a")).toBe(true)
      expect(fobx.isObservableObject(observedDeep.a)).toBe(true)
      expect(fobx.isObservable(observedDeep.a, "b")).toBe(true)

      expect(fobx.isObservable(explicitDeep, "a")).toBe(true)
      expect(fobx.isObservableObject(explicitDeep.a)).toBe(true)
      expect(fobx.isObservable(explicitDeep.a, "b")).toBe(true)
    })

    test("makeObservable with observable.shallow makes properties shallowly observable", () => {
      const nested = { a: { b: { c: 1 } } }

      const observedDeep = fobx.observable(nested)
      const explicitShallow = fobx.makeObservable(nested, {
        annotations: {
          a: "observable.shallow",
        },
      })

      expect(fobx.isObservable(observedDeep, "a")).toBe(true)
      expect(fobx.isObservableObject(observedDeep.a)).toBe(true)
      expect(fobx.isObservable(observedDeep.a, "b")).toBe(true)

      expect(fobx.isObservable(explicitShallow, "a")).toBe(true)
      expect(fobx.isObservableObject(explicitShallow.a)).toBe(false)
    })
  })

  describe("observable (deep)", () => {
    test("makes nested objects deeply observable", () => {
      const nestedObj = { foo: { bar: { baz: 1 } } }
      const obj = fobx.makeObservable(nestedObj, {
        annotations: {
          foo: "observable",
        },
      })

      expect(fobx.isObservable(obj, "foo")).toBe(true)
      expect(fobx.isObservableObject(obj.foo)).toBe(true)
      expect(fobx.isObservable(obj.foo, "bar")).toBe(true)
      expect(fobx.isObservableObject(obj.foo.bar)).toBe(true)
      expect(fobx.isObservable(obj.foo.bar, "baz")).toBe(true)
    })

    test("makes arrays and their contents observable", () => {
      const obj = fobx.makeObservable({ arr: [1, 2, { x: 1 }] }, {
        annotations: {
          arr: "observable",
        },
      })

      expect(fobx.isObservableArray(obj.arr)).toBe(true)
      expect(fobx.isObservableObject(obj.arr[2])).toBe(true)
      expect(fobx.isObservable(obj.arr[2], "x")).toBe(true)
    })

    test("makes Maps and their values observable", () => {
      const map = new Map([["key", { value: 1 }]])
      const obj = fobx.makeObservable({ map }, {
        annotations: {
          map: "observable",
        },
      })

      expect(fobx.isObservableMap(obj.map)).toBe(true)
      const value = obj.map.get("key")
      expect(fobx.isObservableObject(value)).toBe(true)
      expect(fobx.isObservable(value, "value")).toBe(true)
    })

    test("makes Sets and their items observable", () => {
      const objInSet = { value: 1 }
      const set = new Set([objInSet])
      const obj = fobx.makeObservable({ set }, {
        annotations: {
          set: "observable",
        },
      })

      expect(fobx.isObservableSet(obj.set)).toBe(true)
      const values = Array.from(obj.set)
      expect(fobx.isObservableObject(values[0])).toBe(true)
      expect(fobx.isObservable(values[0], "value")).toBe(true)
    })
  })

  describe("observable.shallow", () => {
    test("makes only direct properties observable", () => {
      const nestedObj = { foo: { bar: { baz: 1 } } }
      const obj = fobx.makeObservable(nestedObj, {
        annotations: {
          foo: "observable.shallow",
        },
      })

      expect(fobx.isObservable(obj, "foo")).toBe(true)
      expect(fobx.isObservableObject(obj.foo)).toBe(false)
    })

    test("makes arrays observable but keeps contents non-observable", () => {
      const obj = fobx.makeObservable({ arr: [1, 2, { x: 1 }] }, {
        annotations: {
          arr: "observable.shallow",
        },
      })

      expect(fobx.isObservableArray(obj.arr)).toBe(true)
      expect(fobx.isObservableObject(obj.arr[2])).toBe(false)
    })

    test("makes Maps observable but keeps values non-observable", () => {
      const map = new Map([["key", { value: 1 }]])
      const obj = fobx.makeObservable({ map }, {
        annotations: {
          map: "observable.shallow",
        },
      })

      expect(fobx.isObservableMap(obj.map)).toBe(true)
      const value = obj.map.get("key")
      expect(fobx.isObservableObject(value)).toBe(false)
    })

    test("makes Sets observable but keeps items non-observable", () => {
      const objInSet = { value: 1 }
      const set = new Set([objInSet])
      const obj = fobx.makeObservable({ set }, {
        annotations: {
          set: "observable.shallow",
        },
      })

      expect(fobx.isObservableSet(obj.set)).toBe(true)
      const values = Array.from(obj.set)
      expect(fobx.isObservableObject(values[0])).toBe(false)
    })
  })

  describe("equality checkers", () => {
    test("supports custom equality checkers", () => {
      const customEqualityFn = (a: number, b: number) => Math.abs(a - b) < 0.1

      const obj = fobx.makeObservable({ value: 1.0 }, {
        annotations: {
          value: ["observable", customEqualityFn],
        },
      })

      const reactions: number[] = []
      fobx.reaction(() => obj.value, (value) => reactions.push(value))

      obj.value = 1.05
      expect(reactions.length).toBe(0)

      obj.value = 1.2
      expect(reactions).toEqual([1.2])
    })

    test("supports structural equality", () => {
      const obj = fobx.makeObservable({ person: { name: "Alice" } }, {
        annotations: {
          person: ["observable", "structural"],
        },
      })

      const reactions: Array<{ name: string }> = []
      fobx.reaction(() => obj.person, (value) => reactions.push(value))

      obj.person = { name: "Alice" }
      expect(reactions.length).toBe(0)

      obj.person = { name: "Bob" }
      expect(reactions).toEqual([{ name: "Bob" }])
    })
  })

  describe("computed properties", () => {
    test("makes getter properties computed", () => {
      let callCount = 0
      const obj = fobx.makeObservable({
        x: 1,
        get y() {
          callCount++
          return this.x * 2
        },
      }, {
        annotations: {
          x: "observable",
          y: "computed",
        },
      })

      expect(fobx.isComputed(obj, "y")).toBe(true)

      expect(obj.y).toBe(2)
      expect(callCount).toBe(1)

      expect(obj.y).toBe(2)
      expect(callCount).toBe(2)

      const reactionFn = fn()
      fobx.reaction(() => obj.y, reactionFn)
      expect(callCount).toBe(3)

      expect(obj.y).toBe(2)
      expect(callCount).toBe(3)

      obj.x = 2
      expect(callCount).toBe(4)
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(obj.y).toBe(4)
      expect(callCount).toBe(4)
    })

    test("computed properties can have custom equality checkers", () => {
      const roundingEqualityFn = (a: number, b: number) =>
        Math.floor(a) === Math.floor(b)

      let callCount = 0
      const obj = fobx.makeObservable({
        x: 0,
        get y() {
          callCount++
          return this.x + 0.5
        },
      }, {
        annotations: {
          x: "observable",
          y: ["computed", roundingEqualityFn],
        },
      })

      const reactions: number[] = []
      fobx.reaction(() => obj.y, (value) => reactions.push(value))

      obj.x = 0.3
      expect(reactions.length).toBe(0)
      expect(callCount).toBe(2)

      obj.x = 0.7
      expect(reactions).toEqual([1.2])
      expect(callCount).toBe(3)
    })
  })

  describe("actions", () => {
    test("makes methods into actions", () => {
      const obj = fobx.makeObservable({
        x: 1,
        increment() {
          this.x++
        },
      }, {
        annotations: {
          x: "observable",
          increment: "transaction",
        },
      })

      expect(fobx.isTransaction(obj.increment)).toBe(true)

      obj.increment()
      expect(obj.x).toBe(2)
    })

    test("bound actions keep 'this' context", () => {
      const obj = fobx.makeObservable({
        x: 1,
        increment() {
          this.x++
        },
      }, {
        annotations: {
          x: "observable",
          increment: "transaction.bound",
        },
      })

      const { increment } = obj

      increment()
      expect(obj.x).toBe(2)
    })
  })

  describe("flow", () => {
    test("makes generator methods into flows", () => {
      const obj = fobx.makeObservable({
        x: 1,
        *process() {
          yield Promise.resolve()
          this.x++
        },
      }, {
        annotations: {
          x: "observable",
          process: "flow",
        },
      })

      expect(fobx.isTransaction(obj.process)).toBe(true)
    })

    test("throws when non-generator is marked as flow", () => {
      expect(() => {
        fobx.makeObservable({
          x: 1,
          process() {
            this.x++
          },
        }, {
          annotations: {
            x: "observable",
            process: "flow",
          },
        })
      }).toThrow(
        '[@fobx/core] "process" was marked as a flow but is not a generator function.',
      )
    })
  })

  describe("reactive behavior", () => {
    test("changes to observed properties trigger reactions", () => {
      const obj = fobx.makeObservable({ x: 1, y: 2 }, {
        annotations: {
          x: "observable",
          y: "observable",
        },
      })

      const xReactions: number[] = []
      fobx.reaction(() => obj.x, (value) => xReactions.push(value))

      const yReactions: number[] = []
      fobx.reaction(() => obj.y, (value) => yReactions.push(value))

      obj.x = 10
      expect(xReactions).toEqual([10])
      expect(yReactions).toEqual([])

      obj.y = 20
      expect(xReactions).toEqual([10])
      expect(yReactions).toEqual([20])
    })

    test("replacing observed objects preserves reactions", () => {
      const obj = fobx.makeObservable({
        nested: { value: 1 },
      }, {
        annotations: {
          nested: "observable",
        },
      })

      const reactions: number[] = []
      const reactionFn = fn((value: number) => reactions.push(value))
      fobx.reaction(() => obj.nested.value, reactionFn)

      obj.nested.value = 2
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactions).toEqual([2])

      obj.nested = { value: 3 }
      expect(fobx.isObservableObject(obj.nested)).toBe(true)
      expect(reactionFn).toHaveBeenCalledTimes(2)
      expect(reactions).toEqual([2, 3])

      obj.nested.value = 4
      expect(reactionFn).toHaveBeenCalledTimes(3)
      expect(reactions).toEqual([2, 3, 4])
    })
  })

  describe("classes and inheritance", () => {
    test("works with class instances", () => {
      class Person {
        name: string
        age: number

        constructor(name: string, age: number) {
          this.name = name
          this.age = age
        }

        get description() {
          return `${this.name} (${this.age})`
        }

        incrementAge() {
          this.age++
        }
      }

      const p = new Person("Alice", 30)
      fobx.makeObservable(p, {
        annotations: {
          name: "observable",
          age: "observable",
          description: "computed",
          incrementAge: "transaction",
        },
      })

      expect(fobx.isObservable(p, "name")).toBe(true)
      expect(fobx.isObservable(p, "age")).toBe(true)
      expect(fobx.isComputed(p, "description")).toBe(true)
      expect(fobx.isTransaction(p.incrementAge)).toBe(true)

      expect(p.description).toBe("Alice (30)")

      const descriptions: string[] = []
      fobx.reaction(() => p.description, (desc) => descriptions.push(desc))

      p.incrementAge()
      expect(p.age).toBe(31)
      expect(p.description).toBe("Alice (31)")
      expect(descriptions).toEqual(["Alice (31)"])
    })

    test("handles inheritance correctly", () => {
      class Base {
        baseValue = 10

        constructor() {
          fobx.makeObservable(this, {
            annotations: {
              baseValue: "observable",
              baseComputed: "computed",
            },
          })
        }
        get baseComputed() {
          return this.baseValue * 2
        }
      }

      class Derived extends Base {
        derivedValue = 5

        constructor() {
          super()
          fobx.makeObservable(this, {
            annotations: {
              derivedValue: "observable",
              derivedComputed: "computed",
            },
          })
        }

        get derivedComputed() {
          return this.baseValue + this.derivedValue
        }
      }

      const d = new Derived()

      expect(fobx.isObservable(d, "baseValue")).toBe(true)
      expect(fobx.isObservable(d, "derivedValue")).toBe(true)
      expect(fobx.isComputed(d, "baseComputed")).toBe(true)
      expect(fobx.isComputed(d, "derivedComputed")).toBe(true)

      const computedValues: number[] = []
      fobx.reaction(
        () => d.derivedComputed,
        (value) => computedValues.push(value),
      )

      d.baseValue = 20
      expect(computedValues).toEqual([25])

      d.derivedValue = 10
      expect(computedValues).toEqual([25, 30])
    })

    test("makeObservable installs inherited members on prototype by default", () => {
      class Counter {
        value = 1

        get doubled() {
          return this.value * 2
        }

        inc() {
          this.value++
        }
      }

      const counter = new Counter()
      fobx.makeObservable(counter, {
        annotations: {
          value: "observable",
          doubled: "computed",
          inc: "transaction",
        },
      })

      expect(Object.hasOwn(counter, "doubled")).toBe(false)
      expect(Object.hasOwn(counter, "inc")).toBe(false)
      expect(fobx.isComputed(counter, "doubled")).toBe(true)
      expect(fobx.isTransaction(counter.inc)).toBe(true)
    })

    test("makeObservable ownPropertiesOnly=true installs inherited members on instance", () => {
      class Counter {
        value = 1

        get doubled() {
          return this.value * 2
        }

        inc() {
          this.value++
        }
      }

      const counter = new Counter()
      fobx.makeObservable(counter, {
        ownPropertiesOnly: true,
        annotations: {
          value: "observable",
          doubled: "computed",
          inc: "transaction",
        },
      })

      expect(Object.hasOwn(counter, "doubled")).toBe(true)
      expect(Object.hasOwn(counter, "inc")).toBe(true)
      expect(fobx.isComputed(counter, "doubled")).toBe(true)
      expect(fobx.isTransaction(counter.inc)).toBe(true)
    })

    test("makeObservable ownPropertiesOnly=true works on re-entrant calls", () => {
      class Counter {
        value = 1

        inc() {
          this.value++
        }
      }

      const counter = new Counter()

      fobx.makeObservable(counter, {
        annotations: {
          value: "observable",
        },
      })

      fobx.makeObservable(counter, {
        ownPropertiesOnly: true,
        annotations: {
          inc: "transaction",
        },
      })

      expect(Object.hasOwn(counter, "inc")).toBe(true)
      expect(fobx.isTransaction(counter.inc)).toBe(true)
    })
  })

  describe("dynamically added properties", () => {
    test("doesn't make dynamically added properties observable", () => {
      const obj = fobx.makeObservable({ x: 1 }, {
        annotations: {
          x: "observable",
        },
      }) // deno-lint-ignore no-explicit-any
      ;(obj as any).y = 2

      expect(fobx.isObservable(obj, "x")).toBe(true)
      expect(fobx.isObservable(obj, "y")).toBe(false)
    })
  })

  test("can make functions observable instead of an action", () => {
    const obj = fobx.makeObservable({
      x: 1,
      y() {
        return this.x + 1
      },
    }, { annotations: { x: "observable", y: "observable" } })

    expect(fobx.isObservable(obj, "y")).toBe(true)
    expect(fobx.isTransaction(obj.y)).toBe(false)
    expect(obj.y()).toBe(2)
  })

  describe("error cases", () => {
    test("throws when using observable annotation on getter/setter", () => {
      expect(() => {
        fobx.makeObservable({
          get x() {
            return 1
          },
        }, {
          annotations: {
            x: "observable",
          },
        })
      }).toThrow(
        '[@fobx/core] "observable" cannot be used on getter/setter properties',
      )
    })

    test("throws when using computed annotation on property without getter", () => {
      expect(() => {
        fobx.makeObservable({
          x: 1,
        }, {
          annotations: {
            x: "computed",
          },
        })
      }).toThrow(
        'x must be a getter to use "computed" annotation',
      )
    })

    test("throws when using action annotation on non-function property", () => {
      expect(() => {
        fobx.makeObservable({
          x: 1,
        }, {
          annotations: {
            x: "transaction",
          },
        })
      }).toThrow(
        'x must be a function to use "transaction" annotation',
      )
    })

    test("throws when using invalid annotation", () => {
      expect(() => {
        fobx.makeObservable({
          x: 1,
        }, {
          annotations: {
            // deno-lint-ignore no-explicit-any
            x: "invalid" as any,
          },
        })
      }).toThrow("Unknown annotation: invalid")
    })

    test("warns when attempting to make non-extensible object observable", () => {
      const nonExtensibleObj = Object.preventExtensions({ x: 1 })
      const result = fobx.makeObservable(nonExtensibleObj, {
        annotations: { x: "observable" },
      })
      expect(fobx.isObservableObject(result)).toBe(true)
      expect(fobx.isObservable(result, "x")).toBe(true)
    })
  })

  describe("observable.ref", () => {
    test("keeps original references for property values", () => {
      const obj = { a: { b: 1 } }
      const observed = fobx.makeObservable(obj, {
        annotations: {
          a: "observable.ref",
        },
      })

      expect(fobx.isObservable(observed, "a")).toBe(true)
      expect(fobx.isObservableObject(observed.a)).toBe(false)
      expect(observed.a).toBe(obj.a)
    })

    test("behaves like observable with shallow: true", () => {
      const array = [1, 2, { value: 3 }]
      const map = new Map([["key", { value: 4 }]])
      const set = new Set([{ value: 5 }])

      const objWithRef = fobx.makeObservable({ array, map, set }, {
        annotations: {
          array: "observable.ref",
          map: "observable.ref",
          set: "observable.ref",
        },
      })

      const objWithShallow = fobx.observable({ array, map, set }, {
        annotations: {
          array: "observable.ref",
          map: "observable.ref",
          set: "observable.ref",
        },
      })

      expect(objWithRef.array).toBe(array)
      expect(objWithRef.map).toBe(map)
      expect(objWithRef.set).toBe(set)
      expect(objWithShallow.array).toBe(array)
      expect(objWithShallow.map).toBe(map)
      expect(objWithShallow.set).toBe(set)

      let refReactionCount = 0
      let shallowReactionCount = 0

      fobx.reaction(() => objWithRef.array, () => refReactionCount++)
      fobx.reaction(() => objWithShallow.array, () => shallowReactionCount++)

      refReactionCount = 0
      shallowReactionCount = 0

      array.push(4)
      expect(refReactionCount).toBe(0)
      expect(shallowReactionCount).toBe(0)

      objWithRef.array = [1, 2, 3]
      objWithShallow.array = [1, 2, 3]
      expect(refReactionCount).toBe(1)
      expect(shallowReactionCount).toBe(1)
    })

    test("throws when used on getter/setter", () => {
      expect(() => {
        fobx.makeObservable({
          get x() {
            return 1
          },
        }, {
          annotations: {
            x: "observable.ref",
          },
        })
      }).toThrow(
        '[@fobx/core] "observable.ref" cannot be used on getter/setter properties',
      )
    })

    test("observable.ref with custom equality functions work when used in reactions", () => {
      const alwaysEqual = () => true
      const neverEqual = () => false

      const obj = fobx.makeObservable({
        x: 1,
        y: 2,
      }, {
        annotations: {
          x: ["observable.ref", alwaysEqual],
          y: ["observable.ref", neverEqual],
        },
      })

      const xValues = []
      const yValues = []

      fobx.reaction(
        () => obj.x,
        (value) => xValues.push(value),
        { comparer: alwaysEqual },
      )

      fobx.reaction(
        () => obj.y,
        (value) => yValues.push(value),
        { comparer: neverEqual },
      )

      xValues.length = 0
      yValues.length = 0

      obj.x = 100
      expect(xValues.length).toBe(0)

      obj.y = 2
      expect(yValues.length).toBe(1)
    })
  })
})
