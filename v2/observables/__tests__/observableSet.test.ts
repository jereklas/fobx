import { $fobx } from "../../global.ts"
import * as fobx from "../../index.ts"
import { describe, expect, fn, test } from "@fobx/testing"

type ObservableSetWithAdmin = fobx.ObservableSet<string> & {
  [$fobx]: { observers: unknown[] }
}

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
      expect(m[$fobx].observers.length).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return (m as any)[name]().next().value
      }, reactionFn)
      expect(m[$fobx].observers.length).toBe(1)
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
