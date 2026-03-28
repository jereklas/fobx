// deno-lint-ignore-file no-explicit-any
// cspell:ignore iterall
import * as iterall from "iterall"
import { $fobx, observerCount } from "../../state/global.ts"
import * as fobx from "../../index.ts"
import {
  autorun,
  computed,
  observable,
  type ObservableArray,
  reaction,
  when,
} from "../../index.ts"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  fn,
  grabConsole,
  test,
} from "@fobx/testing"
import { deepEqual } from "fast-equals"

type ObservableArrayWithAdmin = fobx.ObservableArray<number> & {
  [$fobx]: { observers: unknown[] }
}

beforeEach(() => {
  fobx.configure({ enforceActions: false, comparer: { structural: deepEqual } })
})

test("observable array respects structural option", () => {
  const a = fobx.observable([{ a: 1 }], { comparer: "structural" })
  let runs = -1

  fobx.autorun(() => {
    runs++
    a[0]
  })
  expect(runs).toBe(0)

  a[0] = { a: 1 }
  expect(runs).toBe(0)

  a[0] = { a: 2 }
  expect(runs).toBe(1)

  a[0] = { a: 2 }
  expect(runs).toBe(1)
})

test("observable array made through object observable respects structural option", () => {
  const o = fobx.observable({ a: [{ a: 1 }] }, {
    annotations: {
      a: ["observable", "structural"],
    },
  })
  let runs = -1

  fobx.autorun(() => {
    runs++
    o.a[0]
  })
  expect(runs).toBe(0)

  o.a[0] = { a: 1 }
  expect(runs).toBe(0)

  o.a[0] = { a: 2 }
  expect(runs).toBe(1)

  o.a[0] = { a: 2 }
  expect(runs).toBe(1)
})

test("observable API for arrays successfully constructs arrays", () => {
  const a = fobx.observable([1, 2, 3])
  expect(a).toEqual([1, 2, 3])
  expect(fobx.isObservableArray(a)).toBe(true)

  const a2 = fobx.observable([true, false])
  expect(a2).toEqual([true, false])
  expect(fobx.isObservableArray(a2)).toBe(true)

  const a3 = fobx.observable([])
  expect(a3).toEqual([])
  expect(fobx.isObservableArray(a3)).toBe(true)

  const a4 = fobx.observable(["a", "b", "c"])
  expect(a4).toEqual(["a", "b", "c"])
  expect(fobx.isObservableArray(a4)).toBe(true)
})

describe("ObservableArray", () => {
  test("observing single index of observable array behaves as expected", () => {
    const a = fobx.observable([1, 2, 3, 4])
    const computedFn = fn(() => {
      return a[0]
    })
    const c = fobx.computed(computedFn)
    const reactionSideEffect = fn()
    const reactionDataFn = fn(() => a[0])
    fobx.reaction(reactionDataFn, reactionSideEffect)
    expect(reactionDataFn).toHaveBeenCalledTimes(1)
    reactionDataFn.mockClear()

    const reactionBasedOnComputed = fn()
    const reactionDataFnBasedOnComputed = fn(() => c.get())
    fobx.reaction(reactionDataFnBasedOnComputed, reactionBasedOnComputed)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(computedFn).toHaveBeenCalledTimes(1)
    reactionDataFnBasedOnComputed.mockClear()
    computedFn.mockClear()

    expect(computedFn).toHaveBeenCalledTimes(0)
    expect(reactionSideEffect).toHaveBeenCalledTimes(0)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0)

    a.push(5)
    expect(computedFn).toHaveBeenCalledTimes(1)
    expect(reactionDataFn).toHaveBeenCalledTimes(1)
    expect(reactionSideEffect).toHaveBeenCalledTimes(0)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(0)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(0)

    a[0] = 10
    expect(computedFn).toHaveBeenCalledTimes(2)
    expect(reactionDataFn).toHaveBeenCalledTimes(2)
    expect(reactionSideEffect).toHaveBeenCalledTimes(1)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1)

    a[1] = 11
    expect(computedFn).toHaveBeenCalledTimes(3)
    expect(reactionDataFn).toHaveBeenCalledTimes(3)
    expect(reactionSideEffect).toHaveBeenCalledTimes(1)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(1)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(1)

    a.length = 0
    expect(a.at(0)).toBe(undefined)
    expect(computedFn).toHaveBeenCalledTimes(4)
    expect(reactionDataFn).toHaveBeenCalledTimes(4)
    expect(reactionSideEffect).toHaveBeenCalledTimes(2)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(2)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(2)

    a.push(1)
    expect(a.at(0)).toBe(1)
    expect(computedFn).toHaveBeenCalledTimes(5)
    expect(reactionDataFn).toHaveBeenCalledTimes(5)
    expect(reactionSideEffect).toHaveBeenCalledTimes(3)
    expect(reactionDataFnBasedOnComputed).toHaveBeenCalledTimes(3)
    expect(reactionBasedOnComputed).toHaveBeenCalledTimes(3)
  })

  test("Array.from(observableArray) should always trigger reaction", () => {
    const a = fobx.observable<number>([])
    const reactionFn = fn()
    fobx.reaction(() => Array.from(a), reactionFn)
    a[0] = 1
    a[0] = 2
    expect(reactionFn).toHaveBeenCalledTimes(2)
  })

  test("a reaction returning an observable array should run reaction when mutation occurs", () => {
    const a = fobx.observable([] as number[])
    const reactionFn = fn()
    fobx.reaction(() => a, reactionFn)
    a[0] = 1
    expect(reactionFn).toHaveBeenCalledTimes(1)
    a[0] = 1
    expect(reactionFn).toHaveBeenCalledTimes(1)

    a[0] = 2
    expect(reactionFn).toHaveBeenCalledTimes(2)
    a.push(1)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    a.sort()
    expect(reactionFn).toHaveBeenCalledTimes(4)
  })

  test("multiple observable arrays can exist without state bleeding between them", () => {
    const a = fobx.observable([1, 2, 3])
    const b = fobx.observable([4, 5, 6])

    const reactionFn = fn()
    fobx.reaction(() => {
      return [a.length, b.length]
    }, reactionFn)
    expect(reactionFn).not.toHaveBeenCalled()

    a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith([4, 3], [3, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4])
    expect(b).toEqual([4, 5, 6])

    a.push(5)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    expect(reactionFn).toHaveBeenCalledWith([5, 3], [4, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4, 5])

    b.push(10)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    expect(reactionFn).toHaveBeenCalledWith([5, 4], [5, 3], expect.anything())
    expect(a).toEqual([1, 2, 3, 4, 5])
    expect(b).toEqual([4, 5, 6, 10])
  })

  test("previous and current values on reaction are as expected from change to array", () => {
    const a = fobx.observable([1, 2, 3])
    const reactionFn = fn()
    fobx.reaction(() => {
      return a.map((v) => v * 2)
    }, reactionFn)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    a.push(4)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(
      [2, 4, 6, 8],
      [2, 4, 6],
      expect.anything(),
    )
  })

  test("length property is correctly observable", () => {
    const a = fobx.observable<string>([])
    const reactionFn = fn()
    fobx.reaction(() => a.length, reactionFn)

    expect(reactionFn).toHaveBeenCalledTimes(0)
    a.push("a")
    expect(reactionFn).toHaveBeenCalledTimes(1)
  })

  const iterableTC = [
    { name: "values", expected: 5 },
    { name: "entries", expected: [0, 5] },
    { name: "keys", expected: 0 },
  ]
  iterableTC.forEach(({ name, expected }) => {
    test(`${name} does not cause reaction unless the iterable.next() is called`, () => {
      const a = fobx.observable<number>([]) as ObservableArrayWithAdmin
      fobx.reaction(() => (a as any)[name](), fn())
      expect(observerCount(a[$fobx])).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return (a as any)[name]().next().value
      }, reactionFn)
      a.push(5)
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith(
        expected,
        undefined,
        expect.anything(),
      )
    })
  })

  const nonObservableTC = [
    { name: "concat", args: [] },
    { name: "filter", args: [(v: number) => v] },
    { name: "flat", args: [] },
    { name: "flatMap", args: [(v: number) => v] },
    { name: "map", args: [(v: number) => v] },
    { name: "slice", args: [] },
    { name: "splice", args: [] },
    { name: "toReversed", args: [] },
    { name: "toSorted", args: [] },
    { name: "toSpliced", args: [] },
    { name: "with", args: [] },
  ]
  nonObservableTC.forEach(({ name, args }) => {
    test(`${name} should return non-observable copy of array`, () => {
      const a = fobx.observable([1, 2, 3]) as fobx.ObservableArray<number>
      const result = (a as any)[name](...args)

      expect(result !== a).toBe(true)
      expect(!fobx.isObservable(result)).toBe(true)
    })
  })
})

// ─── MobX-compat array tests ────────────────────────────────────────────────────

test("test1", function () {
  const a = observable<number>([])
  expect(a.length).toBe(0)
  expect(Object.keys(a)).toEqual([])
  expect(a.slice()).toEqual([])

  a.push(1)
  expect(a.length).toBe(1)
  expect(a.slice()).toEqual([1])

  a[1] = 2
  expect(a.length).toBe(2)
  expect(a.slice()).toEqual([1, 2])

  const sum = computed(function () {
    return a.reduce((a, b) => a + b, 0)
  })

  expect(sum.get()).toBe(3)

  a[1] = 3
  expect(a.length).toBe(2)
  expect(a.slice()).toEqual([1, 3])
  expect(sum.get()).toBe(4)

  a.splice(1, 1, 4, 5)
  expect(a.length).toBe(3)
  expect(a.slice()).toEqual([1, 4, 5])
  expect(sum.get()).toBe(10)

  a.replace([2, 4])
  expect(a).toEqual([2, 4])
  expect(sum.get()).toBe(6)

  a.splice(1, 1)
  expect(sum.get()).toBe(2)
  expect(a.slice()).toEqual([2])

  a.splice(0, 0, 4, 3)
  expect(sum.get()).toBe(9)
  expect(a.slice()).toEqual([4, 3, 2])

  a.length = 0
  expect(sum.get()).toBe(0)
  expect(a.slice()).toEqual([])

  a.length = 4
  expect(sum.get()).toBe(0)
  expect(a.length).toEqual(4)

  expect(a.slice()).toEqual([undefined, undefined, undefined, undefined])

  a.replace([1, 2, 2, 4])
  expect(sum.get()).toBe(9)
  a.length = 4
  expect(sum.get()).toBe(9)

  a.length = 2
  expect(sum.get()).toBe(3)
  expect(a.slice()).toEqual([1, 2])

  expect(a.reverse()).toEqual([2, 1])
  expect(a).toEqual([2, 1])
  expect(a.slice()).toEqual([2, 1])

  a.unshift(3)
  expect(a.sort()).toEqual([1, 2, 3])
  expect(a).toEqual([1, 2, 3])
  expect(a.slice()).toEqual([1, 2, 3])

  expect(JSON.stringify(a)).toBe("[1,2,3]")

  expect(a[1]).toBe(2)
  a[2] = 4
  expect(a[2]).toBe(4)

  expect(Object.keys(a)).toEqual(["0", "1", "2"])
})

test("cannot reverse or sort an array in a derivation", () => {
  const ar = observable([3, 2, 1])
  let msg

  msg = grabConsole(() => {
    reaction(
      () => {
        ar.sort()
      },
      () => {},
    )()
  })

  expect(ar).toEqual([3, 2, 1])
  console.log(msg)
  expect(msg).toMatch(
    /<STDERR> \[@fobx\/core\] "Reaction@.*" threw an exception/,
  )

  msg = grabConsole(() => {
    reaction(
      () => {
        ar.reverse()
      },
      () => {},
    )()
  })
  expect(ar).toEqual([3, 2, 1])
  expect(msg).toMatch(
    /<STDERR> \[@fobx\/core\] "Reaction@.*" threw an exception/,
  )

  const c = computed(() => {
    ar.sort()
  })
  msg = grabConsole(() => {
    autorun(() => {
      c.get()
    })()
  })
  expect(ar).toEqual([3, 2, 1])
  expect(msg).toMatch(
    /<STDERR> \[@fobx\/core\] "Computed@.*" threw an exception/,
  )
})

test("array should support iterall / iterable ", () => {
  const a = observable([1, 2, 3])

  expect(iterall.isIterable(a)).toBe(true)

  const values: number[] = []
  iterall.forEach(a, (v) => values.push(v))

  expect(values).toEqual([1, 2, 3])

  let iter = iterall.getIterator(a)
  expect(iter.next()).toEqual({ value: 1, done: false })
  expect(iter.next()).toEqual({ value: 2, done: false })
  expect(iter.next()).toEqual({ value: 3, done: false })
  expect(iter.next()).toEqual({ value: undefined, done: true })

  a.replace([])
  iter = iterall.getIterator(a)
  expect(iter.next()).toEqual({ value: undefined, done: true })
})

test("find(findIndex) and remove", function () {
  const a = observable([10, 20, 20])
  function predicate(item: number) {
    return item === 20
  }
  expect(a.find(predicate)).toBe(20)
  expect(a.findIndex(predicate)).toBe(1)
  expect(a.remove(20)).toBe(1)

  expect(a.find(predicate)).toBe(20)
  expect(a.findIndex(predicate)).toBe(1)
  expect(a.remove(20)).toBe(1)

  expect(a.find(predicate)).toBe(undefined)
  expect(a.findIndex(predicate)).toBe(-1)
  expect(a.remove(20)).toBe(-1)
})

test("concat should automatically slice observable arrays", () => {
  const a1 = observable([1, 2])
  const a2 = observable([3, 4])
  expect(a1.concat(a2)).toEqual([1, 2, 3, 4])
})

test("observe", function () {
  const a = observable<any>([1, 4])
  const changes: number[][] = []

  const d = reaction(
    () => a,
    (curr) => {
      changes.push([...curr])
    },
  )

  a[1] = 3 // 1,3
  a[2] = 0 // 1, 3, 0
  a.shift() // 3, 0
  a.push(1, 2) // 3, 0, 1, 2
  a.splice(1, 2, 3, 4) // 3, 3, 4, 2
  expect(a.slice()).toEqual([3, 3, 4, 2])
  a.splice(6)
  a.splice(6, 2)
  a.replace(["a"])
  a.pop()
  a.pop() // does not fire anything

  const result = [
    [1, 3],
    [1, 3, 0],
    [3, 0],
    [3, 0, 1, 2],
    [3, 3, 4, 2],
    ["a"],
    [],
  ]
  expect(changes).toEqual(result)

  d()
  a[0] = 5
  expect(changes).toEqual(result)
})

test("array modification1", function () {
  const a = observable([1, 2, 3])
  const r = a.splice(-10, 5, 4, 5, 6)
  expect(a.slice()).toEqual([4, 5, 6])
  expect(r).toEqual([1, 2, 3])
})

test("serialize", function () {
  let a = [1, 2, 3]
  const m = observable(a)

  expect(JSON.stringify(m)).toEqual(JSON.stringify(a))

  expect(a).toEqual(m.slice())

  a = [4]
  m.replace(a)
  expect(JSON.stringify(m)).toEqual(JSON.stringify(a))
  expect(a).toEqual(m.toJSON())
})

test("array modification functions", function () {
  const ars = [[], [1, 2, 3]]
  const funcs = ["push", "pop", "shift", "unshift"] as const
  funcs.forEach(function (f) {
    ars.forEach(function (ar: number[]) {
      const a = ar.slice()
      const b = observable(a)
      const res1 = a[f](4)
      const res2 = b[f](4)
      expect(res1).toEqual(res2)
      expect(a).toEqual(b.slice())
    })
  })
})

test("array modifications", function () {
  const a2 = observable<number | undefined>([])
  const inputs = [undefined, -10, -4, -3, -1, 0, 1, 3, 4, 10]
  const arrays: (number | undefined)[][] = [
    [],
    [1],
    [1, 2, 3, 4],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, undefined],
    [undefined],
  ]
  for (let i = 0; i < inputs.length; i++) {
    for (let j = 0; j < inputs.length; j++) {
      for (let k = 0; k < arrays.length; k++) {
        for (let l = 0; l < arrays.length; l++) {
          ;[
            "array mod: [",
            arrays[k].toString(),
            "] i: ",
            inputs[i],
            " d: ",
            inputs[j],
            " [",
            arrays[l].toString(),
            "]",
          ].join(" ")
          const a1 = arrays[k].slice()
          a2.replace(a1)
          const res1 = a1.splice.apply(
            a1,
            //@ts-expect-error - testing
            [inputs[i], inputs[j]].concat(arrays[l]),
          )
          const res2 = a2.splice.apply(
            a2,
            //@ts-expect-error - testing
            [inputs[i], inputs[j]].concat(arrays[l]),
          )
          expect(a1.slice()).toEqual(a2.slice())
          expect(res1).toEqual(res2)
          expect(a1.length).toBe(a2.length)
        }
      }
    }
  }
})

test("is array", function () {
  const x = observable([])
  expect(x instanceof Array).toBe(true)

  // would be cool if this would return true...
  expect(Array.isArray(x)).toBe(true)
})

test("stringifies same as ecma array", function () {
  const x = observable<number>([])
  expect(x instanceof Array).toBe(true)

  // would be cool if these two would return true...
  expect(x.toString()).toBe("")
  expect(x.toLocaleString()).toBe("")
  x.push(1, 2)
  expect(x.toString()).toBe("1,2")
  expect(x.toLocaleString()).toBe("1,2")
})

test("observes when stringified", function () {
  const x = observable<number>([])
  let c = 0
  autorun(function () {
    x.toString()
    c++
  })
  x.push(1)
  expect(c).toBe(2)
})

test("observes when stringified to locale", function () {
  const x = observable<number>([])
  let c = 0
  autorun(function () {
    x.toLocaleString()
    c++
  })
  x.push(1)
  expect(c).toBe(2)
})

test("react to sort changes", function () {
  const x = observable([4, 2, 3])
  const sortedX = computed(function () {
    return x.slice().sort()
  })
  let sorted

  autorun(function () {
    sorted = sortedX.get()
  })

  expect(x.slice()).toEqual([4, 2, 3])
  expect(sorted).toEqual([2, 3, 4])
  x.push(1)
  expect(x.slice()).toEqual([4, 2, 3, 1])
  expect(sorted).toEqual([1, 2, 3, 4])
  x.shift()
  expect(x.slice()).toEqual([2, 3, 1])
  expect(sorted).toEqual([1, 2, 3])
})

test("autoextend buffer length", function () {
  const ar = observable(Array.from({ length: 1000 }))
  let changesCount = -1
  autorun(() => {
    ar.length
    ++changesCount
  })

  ar[ar.length] = 0
  ar.push(0)

  expect(changesCount).toBe(2)
})

test("array exposes correct keys", () => {
  const keys: string[] = []
  const ar = observable([1, 2])
  for (const key in ar) keys.push(key)

  expect(keys).toEqual(["0", "1"])
})

test("replace can handle large arrays", () => {
  const a = observable<number>([])
  const b: number[] = []
  b.length = 1000 * 1000
  expect(() => {
    a.replace(b)
  }).not.toThrow()

  expect(a.length).toBe(1000000)
})

test("can iterate arrays", () => {
  const x = observable<string>([])
  const y: string[][] = []
  const d = reaction(
    () => Array.from(x),
    (items) => y.push(items),
    { fireImmediately: true },
  )

  x.push("a")
  x.push("b")
  expect(y).toEqual([[], ["a"], ["a", "b"]])
  d()
})

test("array is concat spreadable", () => {
  const x = observable([1, 2, 3, 4])
  const y = [5].concat(x)
  expect(y.length).toBe(5)
  expect(y).toEqual([5, 1, 2, 3, 4])
})

test("array is spreadable", () => {
  const x = observable([1, 2, 3, 4])
  expect([5, ...x]).toEqual([5, 1, 2, 3, 4])

  const y = observable([])
  expect([5, ...y]).toEqual([5])
})

test("array supports toStringTag", () => {
  // N.B. on old environments this requires polyfills for these symbols *and* Object.prototype.toString.
  // core-js provides both
  const a = observable([])
  expect(Object.prototype.toString.call(a)).toBe("[object Array]")
})

test("slice works", () => {
  const a = observable([1, 2, 3])
  expect(a.slice(0, 2)).toEqual([1, 2])
})

test("slice is reactive", () => {
  const a = observable([1, 2, 3])
  let ok = false
  when(
    () => a.slice().length === 4,
    () => (ok = true),
  )
  expect(ok).toBe(false)
  a.push(1)
  expect(ok).toBe(true)
})

test("toString", () => {
  expect(observable([1, 2]).toString()).toEqual([1, 2].toString())
  expect(observable([1, 2]).toLocaleString()).toEqual(
    [1, 2].toLocaleString(),
  )
})

test("can define properties on arrays", () => {
  const ar = observable([1, 2])
  Object.defineProperty(ar, "toString", {
    enumerable: false,
    configurable: true,
    value: function () {
      return "hoi"
    },
  })

  expect(ar.toString()).toBe("hoi")
  expect("" + ar).toBe("hoi")
})

test("concats correctly", () => {
  const x = observable({ data: [] as object[] })

  function generate(count: number) {
    const d: object[] = []
    for (let i = 0; i < count; i++) d.push({})
    return d
  }

  x.data = generate(10000)
  const first = x.data[0]
  expect(Array.isArray(x.data)).toBe(true)

  x.data = x.data.concat(generate(1000))
  expect(Array.isArray(x.data)).toBe(true)
  expect(x.data[0]).toBe(first)
  expect(x.data.length).toBe(11000)
})

test("symbol key on array", () => {
  const s = Symbol("test")
  const x = observable([1, 2]) as ObservableArray<number> & { [s]: number }
  x[s] = 3
  expect(x[s]).toBe(3)

  let reacted = false
  const d = reaction(
    () => x[s],
    () => {
      reacted = true
    },
  )

  x[s] = 4
  expect(x[s]).toBe(4)

  // although x[s] can be stored, it won't be reactive!
  expect(reacted).toBe(false)
  d()
})

test("non-symbol key on array", () => {
  const x = observable([1, 2]) as ObservableArray<number> & { test: number }
  const s = "test"
  x[s] = 3
  expect(x[s]).toBe(3)

  let reacted = false
  const d = reaction(
    () => x[s],
    () => {
      reacted = true
    },
  )

  x[s] = 4
  expect(x[s]).toBe(4)

  // although x[s] can be stored, it won't be reactive!
  expect(reacted).toBe(false)
  d()
})

describe("extended array prototype", () => {
  const extensionKey = "__extension"

  // A single setup/teardown for all tests because we're pretending to do a
  // singular global (dirty) change to the "environment".
  beforeAll(() => {
    // @ts-expect-error - testing
    Array.prototype[extensionKey] = () => {}
  })
  afterAll(() => {
    // @ts-expect-error - testing
    delete Array.prototype[extensionKey]
  })

  test("creating an observable should work", () => {
    observable({ b: "b" })
  })

  test("extending an observable should work", () => {
    const a = { b: "b" }
    observable(a)
  })
})

test("reproduce", () => {
  expect.assertions(1)
  try {
    // @ts-expect-error - test
    Array.prototype.extension = function () {
      console.log("I'm the extension!", this.length)
    }

    class Test {
      data = null as null | { someStr: string }

      constructor() {
        const obs = observable(this)
        this.data = obs.data
      }
    }

    const test = new Test()

    autorun(() => {
      if (test.data) expect(test.data.someStr).toBe("123")
    })

    test.data = { someStr: "123" }
  } finally {
    // @ts-expect-error - test
    delete Array.prototype.extension
  }
})

// TODO: MobX is potentially more correct here by passing back the proxied array, but that tanks my proxy implementation
test("correct array should be passed to callbacks (DIFF from MobX)", () => {
  const array = observable([1, 2, 3])

  function callback() {
    const lastArg = arguments[arguments.length - 1]
    expect(lastArg).toEqual(array)
  }

  const TC = [
    "every",
    "filter",
    "find",
    "findIndex",
    "flatMap",
    "forEach",
    "map",
    "reduce",
    "reduceRight",
    "some",
  ] as const
  TC.forEach(
    (method) => {
      if (typeof array[method] === "function") {
        // deno-lint-ignore ban-types
        ;(array[method] as Function).call(array, callback)
      } else {
        console.warn("SKIPPING: " + method)
      }
    },
  )
})

test("very long arrays can be safely passed to nativeArray.concat", () => {
  const nativeArray = ["a", "b"]
  const longNativeArray: any[] = [...Array(10000).keys()] // MAX_SPLICE_SIZE seems to be the threshold
  const longObservableArray = observable(longNativeArray)
  expect(longObservableArray.length).toBe(10000)
  expect(longObservableArray).toEqual(longNativeArray)
  expect(longObservableArray[9000]).toBe(longNativeArray[9000])
  expect(longObservableArray[9999]).toBe(longNativeArray[9999])
  expect(longObservableArray[10000]).toBe(longNativeArray[10000])

  const expectedArray = nativeArray.concat(longNativeArray)
  const actualArray = nativeArray.concat(longObservableArray)

  expect(actualArray).toEqual(expectedArray)

  const anotherArray = [0, 1, 2, 3, 4, 5]
  const observableArray = observable(anotherArray)
  const r1 = anotherArray.splice(2, 2, ...longNativeArray)
  const r2 = observableArray.splice(2, 2, ...longNativeArray)
  expect(r2).toEqual(r1)
  expect(observableArray).toEqual(anotherArray)
})

test("reduce without initial value", () => {
  const array = [1, 2, 3]
  const observableArray = observable<any>(array)

  const arrayReducerArgs: any[] = []
  const observableArrayReducerArgs: any[] = []

  const arraySum = array.reduce((...args) => {
    arrayReducerArgs.push(args)
    return args[0] + args[1]
  })
  const observableArraySum = observableArray.reduce((...args) => {
    observableArrayReducerArgs.push(args)
    return args[0] + args[1]
  })

  expect(arraySum).toEqual(1 + 2 + 3)
  expect(observableArraySum).toEqual(arraySum)
  expect(arrayReducerArgs).toEqual(observableArrayReducerArgs)
})

test("accessing out of bound indices is supported", () => {
  const array = observable<any>([])

  array[1]
  array[2]
  array[1001] = "foo"
  expect(array.length).toBe(1002)
  expect(array[1001]).toBe("foo")
})
