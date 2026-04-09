// deno-lint-ignore-file no-explicit-any
// cspell:ignore iterall
import * as iterall from "iterall"
import { deepEqual } from "fast-equals"
import { $fobx, observerCount } from "../../state/global.ts"
import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, fn, grabConsole, test } from "@fobx/testing"

type ObservableSetWithAdmin = fobx.ObservableSet<string> & {
  [$fobx]: { observers: unknown[] }
}

beforeEach(() => {
  fobx.configure({ enforceTransactions: false })
})

test("observable API for sets successfully constructs sets", () => {
  const s = fobx.observable(new Set(["a", "b"]))
  expect(s.values()).toEqual(new Set(["a", "b"]).values())
  expect(fobx.isObservableSet(s)).toBe(true)

  const s2 = fobx.observable(new Set(["a", "b"]))
  expect(s2.values()).toEqual(new Set(["a", "b"]).values())
  expect(fobx.isObservableSet(s2)).toBe(true)

  const s3 = fobx.observable(new Set())
  expect(s3.values()).toEqual(new Set().values())
  expect(fobx.isObservableSet(s3)).toBe(true)

  const s4 = fobx.observable(new Set([1]))
  expect(s4.values()).toEqual(new Set([1]).values())
  expect(fobx.isObservableSet(s4)).toBe(true)

  const s5 = fobx.observable(new Set([true, false]))
  expect(s5.values()).toEqual(new Set([true, false]).values())
  expect(fobx.isObservableSet(s5)).toBe(true)
})

describe("ObservableSet", () => {
  const iterableTC = [
    { name: "entries", expected: ["a", "a"] },
    { name: "values", expected: "a" },
    { name: "keys", expected: "a" },
  ] as const
  iterableTC.forEach(({ name, expected }) => {
    test(`${name}() does not cause reaction unless the iterable next() is called`, () => {
      const m = fobx.observable(new Set()) as unknown as ObservableSetWithAdmin
      fobx.reaction(() => (m as any)[name](), fn())
      expect(observerCount(m[$fobx])).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return (m as any)[name]().next().value
      }, reactionFn)
      expect(observerCount(m[$fobx])).toBe(1)
      m.add("a")
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith(
        expected,
        undefined,
        expect.anything(),
      )
    })
  })

  test("reaction to set as a collection works as expected", () => {
    const m = fobx.observable(new Set())
    const reactionFn = fn()
    fobx.reaction(() => m, reactionFn)
    expect(reactionFn).toHaveBeenCalledTimes(0)

    m.add(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)
    m.add(1)
    expect(reactionFn).toHaveBeenCalledTimes(1)

    m.add(2)
    expect(reactionFn).toHaveBeenCalledTimes(2)
    m.delete(2)
    expect(reactionFn).toHaveBeenCalledTimes(3)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(4)
  })

  test("reaction fires correctly after clear()", () => {
    const m = fobx.observable(new Set("a"))
    const reactionFn = fn()
    fobx.reaction(() => m.has("a"), reactionFn)
    m.clear()
    expect(reactionFn).toHaveBeenCalledTimes(1)
    m.add("a")
  })

  test("issue #2 - size property is correctly observable", () => {
    const set = fobx.observable(new Set())
    const reactionFn = fn()
    fobx.reaction(() => set.size, reactionFn)

    expect(reactionFn).toHaveBeenCalledTimes(0)
    set.add(7)
    expect(reactionFn).toHaveBeenCalledTimes(1)
  })
})

test("ObservableSet makes values observable", () => {
  const set = fobx.observable(new Set([{ a: "a" }]))
  set.add({ a: "b" })
  const values = Array.from(set)

  expect(fobx.isObservable(values[0], "a")).toBe(true)
  expect(fobx.isObservable(values[1], "a")).toBe(true)
})

test("ObservableSet does not make values observable when shallow = true", () => {
  const set = fobx.observable(new Set([{ a: "a" }]), { shallow: true })
  set.add({ a: "b" })
  const values = Array.from(set)

  expect(fobx.isObservable(values[0], "a")).toBe(false)
  expect(fobx.isObservable(values[1], "a")).toBe(false)
})

test("#8 - observable Set only reacts when keys requested change", () => {
  const map = fobx.observable(new Set())
  let counter = 0
  fobx.autorun(() => {
    counter++
    map.has("a")
  })

  map.add("b")
  expect(counter).toBe(1)

  map.add("a")
  expect(counter).toBe(2)
})

const testPendingKeyReplace = (
  inputType: "array" | "Set",
  createInput: (values: string[]) => string[] | Set<string>,
) => {
  test(`#8 - pendingKey solution works with replace() using ${inputType}`, () => {
    const set = fobx.observable(new Set<string>())
    let counter = 0
    let hasTargetValue = false

    const dispose = fobx.autorun(() => {
      counter++
      hasTargetValue = set.has("targetValue")
    })

    expect(counter).toBe(1)
    expect(hasTargetValue).toBe(false)

    set.add("existingValue1")
    set.add("existingValue2")
    expect(counter).toBe(1)

    const newValues = createInput(["targetValue", "anotherValue"])
    set.replace(newValues)

    expect(counter).toBe(2)
    expect(hasTargetValue).toBe(true)

    expect(set.has("targetValue")).toBe(true)
    expect(set.has("anotherValue")).toBe(true)
    expect(set.has("existingValue1")).toBe(false)
    expect(set.has("existingValue2")).toBe(false)

    set.delete("targetValue")
    expect(counter).toBe(3)
    expect(hasTargetValue).toBe(false)

    set.add("targetValue")
    expect(counter).toBe(4)
    expect(hasTargetValue).toBe(true)

    set.add("nonTrackedValue")
    expect(counter).toBe(4)

    dispose()
  })
}

testPendingKeyReplace("array", (values) => values)
testPendingKeyReplace("Set", (values) => new Set(values))

test("#8 - replace() handles multiple pending values correctly", () => {
  const set = fobx.observable(new Set<string>())
  let counter = 0
  let hasValue1 = false
  let hasValue2 = false
  let hasValue3 = false

  const dispose = fobx.autorun(() => {
    counter++
    hasValue1 = set.has("value1")
    hasValue2 = set.has("value2")
    hasValue3 = set.has("value3")
  })

  expect(counter).toBe(1)
  expect(hasValue1).toBe(false)
  expect(hasValue2).toBe(false)
  expect(hasValue3).toBe(false)

  set.replace(["value1", "value3", "untracked"])

  expect(counter).toBe(2)
  expect(hasValue1).toBe(true)
  expect(hasValue2).toBe(false)
  expect(hasValue3).toBe(true)

  set.replace(["value2", "value1"])

  expect(counter).toBe(3)
  expect(hasValue1).toBe(true)
  expect(hasValue2).toBe(true)
  expect(hasValue3).toBe(false)

  dispose()
})

test("#8 - replace() after tracking non-existent values maintains reactivity", () => {
  const set = fobx.observable(new Set<string>())
  let counter = 0
  let trackedValues: boolean[] = []

  const dispose = fobx.autorun(() => {
    counter++
    trackedValues = [
      set.has("alpha"),
      set.has("beta"),
      set.has("gamma"),
    ]
  })

  expect(counter).toBe(1)
  expect(trackedValues).toEqual([false, false, false])

  set.add("other1")
  set.add("other2")
  expect(counter).toBe(1)

  set.replace(["alpha", "gamma", "other3"])

  expect(counter).toBe(2)
  expect(trackedValues).toEqual([true, false, true])

  expect(Array.from(set).sort()).toEqual(["alpha", "gamma", "other3"])

  set.replace(["beta", "alpha"])

  expect(counter).toBe(3)
  expect(trackedValues).toEqual([true, true, false])

  dispose()
})

test("#8 - replace() clears all existing values and replaces with new ones", () => {
  const set = fobx.observable(new Set(["existing1", "existing2", "existing3"]))
  let counter = 0
  let sizeValue = 0
  let hasExisting1 = false
  let hasNewValue = false

  const dispose = fobx.autorun(() => {
    counter++
    sizeValue = set.size
    hasExisting1 = set.has("existing1")
    hasNewValue = set.has("newValue")
  })

  expect(counter).toBe(1)
  expect(sizeValue).toBe(3)
  expect(hasExisting1).toBe(true)
  expect(hasNewValue).toBe(false)

  set.replace(["newValue", "anotherNew"])

  expect(counter).toBe(2)
  expect(sizeValue).toBe(2)
  expect(hasExisting1).toBe(false)
  expect(hasNewValue).toBe(true)

  expect(Array.from(set).sort()).toEqual(["anotherNew", "newValue"])

  dispose()
})

// ─── MobX-compat set tests ──────────────────────────────────────────────────────

test("set crud", function () {
  const s = fobx.observable(new Set<any>([1]))
  const changes: Set<any>[] = []

  fobx.reaction(
    () => s,
    (val) => {
      expect(val).toBe(s)
      changes.push(new Set(val))
    },
  )

  expect(s.has(1)).toBe(true)
  expect(s.has("1")).toBe(false)
  expect(s.size).toBe(1)

  s.add("2")

  expect(s.has("2")).toBe(true)
  expect(s.size).toBe(2)
  expect(Array.from(s.keys())).toEqual([1, "2"])
  expect(Array.from(s.values())).toEqual([1, "2"])
  expect(Array.from(s.entries())).toEqual([
    [1, 1],
    ["2", "2"],
  ])
  expect(Array.from(s)).toEqual([1, "2"])
  expect(s.toJSON()).toEqual([1, "2"])
  expect(s.toString()).toBe("[object ObservableSet]")

  s.replace(new Set([3]))

  expect(Array.from(s.keys())).toEqual([3])
  expect(Array.from(s.values())).toEqual([3])
  expect(s.size).toBe(1)
  expect(s.has(1)).toBe(false)
  expect(s.has("2")).toBe(false)
  expect(s.has(3)).toBe(true)

  s.replace(fobx.observable(new Set([4])))

  expect(Array.from(s.keys())).toEqual([4])
  expect(Array.from(s.values())).toEqual([4])
  expect(s.size).toBe(1)
  expect(s.has(1)).toBe(false)
  expect(s.has("2")).toBe(false)
  expect(s.has(3)).toBe(false)
  expect(s.has(4)).toBe(true)

  expect(() => {
    s.replace("")
  }).toThrow("[@fobx/core] Supplied entries was not a Set or an Array.")

  s.clear()
  expect(Array.from(s.keys())).toEqual([])
  expect(Array.from(s.values())).toEqual([])
  expect(s.size).toBe(0)
  expect(s.has(1)).toBe(false)
  expect(s.has("2")).toBe(false)
  expect(s.has(3)).toBe(false)
  expect(s.has(4)).toBe(false)

  s.add(5)
  s.delete(5)

  expect(changes).toEqual([
    new Set([1, "2"]),
    new Set([3]),
    new Set([4]),
    new Set(),
    new Set([5]),
    new Set(),
  ])
})

test("observe value", function () {
  const s = fobx.observable(new Set())
  let hasX = false
  let hasY = false

  fobx.autorun(function () {
    hasX = s.has("x")
  })
  fobx.autorun(function () {
    hasY = s.has("y")
  })

  expect(hasX).toBe(false)

  s.add("x")
  expect(hasX).toBe(true)

  s.delete("x")
  expect(hasX).toBe(false)

  s.replace(["y"])
  expect(hasX).toBe(false)
  expect(hasY).toBe(true)
  expect(Array.from(s.values())).toEqual(["y"])
})

test("observe collections", function () {
  const x = fobx.observable(new Set())
  let keys, values, entries

  fobx.autorun(function () {
    keys = Array.from(x.keys())
  })
  fobx.autorun(function () {
    values = Array.from(x.values())
  })
  fobx.autorun(function () {
    entries = Array.from(x.entries())
  })

  x.add("a")
  expect(keys).toEqual(["a"])
  expect(values).toEqual(["a"])
  expect(entries).toEqual([["a", "a"]])

  x.forEach((value) => {
    expect(x.has(value)).toBe(true)
  })

  // should not retrigger:
  keys = null
  values = null
  entries = null
  x.add("a")
  expect(keys).toEqual(null)
  expect(values).toEqual(null)
  expect(entries).toEqual(null)

  x.add("b")
  expect(keys).toEqual(["a", "b"])
  expect(values).toEqual(["a", "b"])
  expect(entries).toEqual([
    ["a", "a"],
    ["b", "b"],
  ])

  x.delete("a")
  expect(keys).toEqual(["b"])
  expect(values).toEqual(["b"])
  expect(entries).toEqual([["b", "b"]])
})

test("set modifier", () => {
  const x = fobx.observable(new Set([{ a: 1 }]))
  const y = fobx.observable({ a: x })

  expect(fobx.isObservableSet(x)).toBe(true)
  expect(fobx.isObservableObject(y)).toBe(true)
  expect(fobx.isObservableObject(y.a)).toBe(false)
  expect(fobx.isObservableSet(y.a)).toBe(true)
})

test("cleanup", function () {
  const s = fobx.observable(new Set(["a"]))

  let hasA

  fobx.autorun(function () {
    hasA = s.has("a")
  })

  expect(hasA).toBe(true)
  expect(s.delete("a")).toBe(true)
  expect(s.delete("not-existing")).toBe(false)
  expect(hasA).toBe(false)
})

test("set should support iterall / iterable ", () => {
  const a = fobx.observable(new Set([1, 2]))

  function leech(iter: any) {
    const values: number[] = []
    let v
    do {
      v = iter.next()
      if (!v.done) values.push(v.value)
    } while (!v.done)
    return values
  }

  expect(iterall.isIterable(a)).toBe(true)

  expect(leech(iterall.getIterator(a))).toEqual([1, 2])

  expect(leech(a.entries())).toEqual([
    [1, 1],
    [2, 2],
  ])

  expect(leech(a.keys())).toEqual([1, 2])
  expect(leech(a.values())).toEqual([1, 2])
})

test("support for ES6 Set", () => {
  const x = new Set()
  x.add(1)
  x.add(2)

  const s = fobx.observable(x)
  expect(fobx.isObservableSet(s)).toBe(true)
  expect(Array.from(s)).toEqual([1, 2])
})

test("deepEqual set", () => {
  const x = new Set()
  x.add(1)
  x.add({ z: 1 })

  const x2 = fobx.observable(new Set())
  x2.add(1)
  x2.add({ z: 2 })

  expect(deepEqual(x, x2)).toBe(false)
  x2.replace([1, { z: 1 }])
  expect(deepEqual(x, x2)).toBe(true)
})

test("set.clear should not be tracked", () => {
  const x = fobx.observable(new Set([1]))
  let c = 0
  const d = fobx.autorun(() => {
    c++
    x.clear()
  })

  expect(c).toBe(1)
  x.add(2)
  expect(c).toBe(1)

  d()
})

test("toStringTag", () => {
  const x = fobx.observable(new Set())
  expect(x[Symbol.toStringTag]).toBe("Set")
  expect(Object.prototype.toString.call(x)).toBe("[object Set]")
})

test("observe", () => {
  const changes: Set<number>[] = []
  const x = fobx.observable(new Set([1]))
  fobx.reaction(
    () => x,
    (s) => {
      expect(s).toBe(x)
      changes.push(new Set(s))
    },
  )
  x.add(2)
  x.add(1)
  expect(changes).toEqual([new Set([1, 2])])
})

test("set.forEach is reactive", () => {
  let c = 0
  const s = fobx.observable(new Set())

  fobx.autorun(() => {
    s.forEach(() => {})
    c++
  })

  s.add(1)
  s.add(2)
  expect(c).toBe(3)
})

describe("warns when mutating observed set outside of a transaction", () => {
  const warnPattern =
    /<STDOUT> \[@fobx\/core\] Changing tracked observable value \(Set@.*\) outside of a transaction is discouraged/

  beforeEach(() => {
    fobx.configure({ enforceTransactions: true })
  })

  test("add", () => {
    const s = fobx.observable(new Set([1, 2]))
    const d = fobx.autorun(() => s.forEach(() => {}))
    expect(grabConsole(() => s.add(3))).toMatch(warnPattern)
    d()
  })

  test("delete", () => {
    const s = fobx.observable(new Set([1, 2]))
    const d = fobx.autorun(() => s.forEach(() => {}))
    expect(grabConsole(() => s.delete(1))).toMatch(warnPattern)
    d()
  })

  test("clear", () => {
    const s = fobx.observable(new Set([1, 2]))
    const d = fobx.autorun(() => s.forEach(() => {}))
    expect(grabConsole(() => s.clear())).toMatch(warnPattern)
    d()
  })

  test("replace", () => {
    const s = fobx.observable(new Set([1, 2])) as fobx.ObservableSet<number>
    const d = fobx.autorun(() => s.forEach(() => {}))
    expect(grabConsole(() => s.replace([3, 4]))).toMatch(warnPattern)
    d()
  })

  test("does not warn when unobserved", () => {
    const s = fobx.observable(new Set([1, 2]))
    expect(grabConsole(() => s.add(3))).toBe("")
  })

  test("does not warn inside a transaction", () => {
    const s = fobx.observable(new Set([1, 2]))
    const d = fobx.autorun(() => s.forEach(() => {}))
    expect(grabConsole(() => fobx.runInTransaction(() => s.add(3)))).toBe("")
    d()
  })
})
