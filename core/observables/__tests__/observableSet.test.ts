import type { ObservableSetWithAdmin } from "../observableSet.ts"
import { $fobx } from "../../state/global.ts"
import * as fobx from "@fobx/core"
import { describe, expect, fn, test } from "@fobx/testing"

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
      const m = fobx.observable(new Set()) as ObservableSetWithAdmin
      fobx.reaction(() => m[name](), fn())
      expect(m[$fobx].observers.length).toBe(0)

      const reactionFn = fn()
      fobx.reaction(() => {
        return m[name]().next().value
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
    // assigning something that already is in map doesn't cause reaction
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

  // initial value and set values are observable
  expect(fobx.isObservable(values[0], "a")).toBe(true)
  expect(fobx.isObservable(values[1], "a")).toBe(true)
})

test("ObservableSet does not make values observable when shallow = true", () => {
  const set = fobx.observable(new Set([{ a: "a" }]), { shallow: true })
  set.add({ a: "b" })
  const values = Array.from(set)

  // neither initial values or set values are observable
  expect(fobx.isObservable(values[0], "a")).toBe(false)
  expect(fobx.isObservable(values[1], "a")).toBe(false)
})

test("#8 - observable Set only reacts when keys requested change", () => {
  const map = fobx.observable(new Set())
  let counter = 0
  fobx.autorun(() => {
    counter++
    // Specifically request for a key that does not exist
    map.has("a")
  })

  // Make sure that the reaction does not fire when we set a key that is not requested
  map.add("b")
  expect(counter).toBe(1)

  // Now that the requested key "a" is set, the reaction should fire
  map.add("a")
  expect(counter).toBe(2)
})

// Helper function to test pendingKey solution with replace operations
const testPendingKeyReplace = (
  inputType: "array" | "Set",
  createInput: (values: string[]) => string[] | Set<string>,
) => {
  test(`#8 - pendingKey solution works with replace() using ${inputType}`, () => {
    const set = fobx.observable(new Set<string>())
    let counter = 0
    let hasTargetValue = false

    // Set up autorun that requests a value that doesn't exist yet
    const dispose = fobx.autorun(() => {
      counter++
      hasTargetValue = set.has("targetValue")
    })

    expect(counter).toBe(1)
    expect(hasTargetValue).toBe(false)

    // Add some existing values
    set.add("existingValue1")
    set.add("existingValue2")
    expect(counter).toBe(1) // Should not have changed

    // Now replace the set with a collection that includes the tracked value
    const newValues = createInput(["targetValue", "anotherValue"])
    set.replace(newValues)

    // The autorun should have re-run because "targetValue" now exists
    expect(counter).toBe(2)
    expect(hasTargetValue).toBe(true)

    // Verify that the set now contains the new values and not the old ones
    expect(set.has("targetValue")).toBe(true)
    expect(set.has("anotherValue")).toBe(true)
    expect(set.has("existingValue1")).toBe(false) // Should be removed by replace
    expect(set.has("existingValue2")).toBe(false) // Should be removed by replace

    // Verify that further changes to the tracked value still trigger reactions
    set.delete("targetValue")
    expect(counter).toBe(3)
    expect(hasTargetValue).toBe(false)

    set.add("targetValue")
    expect(counter).toBe(4)
    expect(hasTargetValue).toBe(true)

    // Verify that changes to non-tracked values don't trigger reactions
    set.add("nonTrackedValue")
    expect(counter).toBe(4) // Should not have changed

    dispose()
  })
}

// Test replace with array input
testPendingKeyReplace("array", (values) => values)

// Test replace with Set input
testPendingKeyReplace("Set", (values) => new Set(values))

test("#8 - replace() handles multiple pending values correctly", () => {
  const set = fobx.observable(new Set<string>())
  let counter = 0
  let hasValue1 = false
  let hasValue2 = false
  let hasValue3 = false

  // Set up autorun that requests multiple values that don't exist yet
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

  // Replace with only some of the tracked values
  set.replace(["value1", "value3", "untracked"])

  // Should trigger reaction because value1 and value3 were added
  expect(counter).toBe(2)
  expect(hasValue1).toBe(true)
  expect(hasValue2).toBe(false) // Still false
  expect(hasValue3).toBe(true)

  // Now replace again with value2
  set.replace(["value2", "value1"]) // Keep value1, add value2, remove value3

  // Should trigger another reaction
  expect(counter).toBe(3)
  expect(hasValue1).toBe(true) // Still true
  expect(hasValue2).toBe(true) // Now true
  expect(hasValue3).toBe(false) // Now false (removed)

  dispose()
})

test("#8 - replace() after tracking non-existent values maintains reactivity", () => {
  const set = fobx.observable(new Set<string>())
  let counter = 0
  let trackedValues: boolean[] = []

  // Set up autorun that tracks multiple non-existent values
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

  // Add some other values to verify they don't trigger the reaction
  set.add("other1")
  set.add("other2")
  expect(counter).toBe(1) // Should not have changed

  // Replace with some of the tracked values
  set.replace(["alpha", "gamma", "other3"])

  expect(counter).toBe(2)
  expect(trackedValues).toEqual([true, false, true])

  // Verify the set contains the expected values
  expect(Array.from(set).sort()).toEqual(["alpha", "gamma", "other3"])

  // Replace again to test continued reactivity
  set.replace(["beta", "alpha"]) // Remove gamma, add beta, keep alpha

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

  // Replace all values
  set.replace(["newValue", "anotherNew"])

  expect(counter).toBe(2)
  expect(sizeValue).toBe(2)
  expect(hasExisting1).toBe(false) // Should be removed
  expect(hasNewValue).toBe(true) // Should be added

  // Verify the set only contains the new values
  expect(Array.from(set).sort()).toEqual(["anotherNew", "newValue"])

  dispose()
})
