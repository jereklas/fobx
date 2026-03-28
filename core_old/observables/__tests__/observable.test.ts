import * as fobx from "@fobx/core"
import { expect, grabConsole, test } from "@fobx/testing"
import type { Any } from "../../state/global.ts"

test("creating an observable object with shallow=true works correctly", () => {
  const obj = { a: { b: "c" }, arr: [], set: new Set(), map: new Map() }
  const shallow = fobx.observable(obj, {}, { shallowRef: true })
  const deep = fobx.observable(obj)

  // the first level props are always observable
  expect(fobx.isObservable(deep, "a")).toBe(true)
  expect(fobx.isObservable(deep, "arr")).toBe(true)
  expect(fobx.isObservable(deep, "set")).toBe(true)
  expect(fobx.isObservable(deep, "map")).toBe(true)
  expect(fobx.isObservable(shallow, "a")).toBe(true)
  expect(fobx.isObservable(shallow, "arr")).toBe(true)
  expect(fobx.isObservable(shallow, "set")).toBe(true)
  expect(fobx.isObservable(shallow, "map")).toBe(true)

  // the value of those props are not observable on the shallow observable
  expect(fobx.isObservableObject(deep.a)).toBe(true)
  expect(fobx.isObservableArray(deep.arr)).toBe(true)
  expect(fobx.isObservableSet(deep.set)).toBe(true)
  expect(fobx.isObservableMap(deep.map)).toBe(true)
  expect(fobx.isObservableObject(shallow.a)).toBe(false)
  expect(fobx.isObservableArray(shallow.arr)).toBe(false)
  expect(fobx.isObservableSet(shallow.set)).toBe(false)
  expect(fobx.isObservableMap(shallow.map)).toBe(false)
})

test("class with non-extensible field causes console warning", () => {
  class EInner {}
  class E {
    b = Object.preventExtensions(new EInner())
    constructor() {
      fobx.observable(this)
    }
  }

  expect(
    grabConsole(() => {
      new E()
    }),
  ).toMatch(
    /<STDOUT> \[@fobx\/core\] Attempted to make a non-extensible object observable, which is not possible\./,
  )
})

test("classes with populated map injected into constructor get initialize correctly", () => {
  class M {
    map: Map<string, string>
    constructor(map: Map<string, string>) {
      this.map = map
    }
  }

  const a = fobx.observable(
    new M(
      new Map([
        ["a", "a"],
        ["b", "b"],
      ]),
    ),
  )
  expect(a.map.size).toBe(2)
  expect(Array.from(a.map.entries())).toEqual([
    ["a", "a"],
    ["b", "b"],
  ])
})

test("classes with populated array injected into constructor get initialize correctly", () => {
  class A {
    arr: string[]
    constructor(arr: string[]) {
      this.arr = arr
    }
  }

  // deno-lint-ignore no-array-constructor
  const a = fobx.observable(new A(new Array("a", "b")))

  expect(a.arr.length).toBe(2)
  expect(a.arr).toEqual(["a", "b"])
})

test("classes with populated set injected into constructor get initialize correctly", () => {
  class S {
    set: Set<string>
    constructor(set: Set<string>) {
      this.set = set
    }
  }

  const a = fobx.observable(new S(new Set(["a", "b"])))

  expect(a.set.size).toBe(2)
  expect(Array.from(a.set)).toEqual(["a", "b"])
})

test("observable with observable.shallow annotation creates observable collections with non-observable items", () => {
  const obj = {
    array: [1, 2, { value: 3 }],
    map: new Map([["key", { value: 4 }]]),
    set: new Set([{ value: 5 }]),
  }

  // Create an observable with shallow collections
  const observed = fobx.observable(obj, {
    array: "observable.shallow",
    map: "observable.shallow",
    set: "observable.shallow",
  })

  // Verify that collections are observable
  expect(fobx.isObservable(observed, "array")).toBe(true)
  expect(fobx.isObservable(observed, "map")).toBe(true)
  expect(fobx.isObservable(observed, "set")).toBe(true)

  // Collections should be observable collections (unlike with { shallow: true })
  expect(fobx.isObservableArray(observed.array)).toBe(true)
  expect(fobx.isObservableMap(observed.map)).toBe(true)
  expect(fobx.isObservableSet(observed.set)).toBe(true)

  // But items inside collections should not be observable
  expect(fobx.isObservableObject(observed.array[2])).toBe(false)
  const mapValue = observed.map.get("key")
  expect(fobx.isObservableObject(mapValue)).toBe(false)
  const setValue = Array.from(observed.set)[0]
  expect(fobx.isObservableObject(setValue)).toBe(false)

  // Contrast with regular observable behavior
  const deepObserved = fobx.observable({ array: [{ value: 3 }] })
  expect(fobx.isObservableObject(deepObserved.array[0])).toBe(true)
})

test("observable.shallow tracks collection operations, unlike shallow: true", () => {
  // Set up test objects
  const withShallowOption = fobx.observable({ array: [1, 2, 3] }, {}, {
    shallowRef: true,
  })
  const withShallowAnnotation = fobx.observable({ array: [1, 2, 3] }, {
    array: "observable.shallow",
  })

  // Verify arrays have expected characteristics
  expect(fobx.isObservableArray(withShallowOption.array)).toBe(false) // Regular array with shallow: true
  expect(fobx.isObservableArray(withShallowAnnotation.array)).toBe(true) // Observable array with observable.shallow

  // Set up reaction trackers
  let shallowOptionValue = null
  let shallowAnnotationValue = null

  // Set up reactions with actions that update our trackers
  const disposeShallowOption = fobx.reaction(
    () => withShallowOption.array,
    (value) => {
      shallowOptionValue = [...value]
    },
  )

  const disposeShallowAnnotation = fobx.reaction(
    () => withShallowAnnotation.array,
    (value) => {
      shallowAnnotationValue = [...value]
    },
  )

  // Perform collection operations
  withShallowOption.array.push(4)
  withShallowAnnotation.array.push(4)

  // With { shallow: true }, the array isn't an ObservableArray, so push doesn't trigger reactions
  expect(shallowOptionValue).toBe(null) // No reaction triggered

  // With "observable.shallow", the array is an ObservableArray, so push does trigger reactions
  expect(shallowAnnotationValue).toEqual([1, 2, 3, 4]) // Reaction triggered by push

  // Clean up
  disposeShallowOption()
  disposeShallowAnnotation()
})

test("observable with observable.ref annotation works correctly", () => {
  // Prepare test objects
  const nested = { value: 1 }
  const array = [1, 2, 3]
  const map = new Map([["key", { value: 2 }]])
  const set = new Set([{ value: 3 }])

  // Create observables with observable.ref annotation
  const observed = fobx.observable({
    nested,
    array,
    map,
    set,
  }, {
    nested: "observable.ref",
    array: "observable.ref",
    map: "observable.ref",
    set: "observable.ref",
  })

  // Verify properties are observable
  expect(fobx.isObservable(observed, "nested")).toBe(true)
  expect(fobx.isObservable(observed, "array")).toBe(true)
  expect(fobx.isObservable(observed, "map")).toBe(true)
  expect(fobx.isObservable(observed, "set")).toBe(true)

  // Verify references are maintained (not made observable)
  expect(observed.nested).toBe(nested)
  expect(observed.array).toBe(array)
  expect(observed.map).toBe(map)
  expect(observed.set).toBe(set)

  // Verify objects are not converted to observable variants
  expect(fobx.isObservableObject(observed.nested)).toBe(false)
  expect(fobx.isObservableArray(observed.array)).toBe(false)
  expect(fobx.isObservableMap(observed.map)).toBe(false)
  expect(fobx.isObservableSet(observed.set)).toBe(false)

  // Test that only property replacement triggers reactions, not mutations
  let nestedCallCount = 0
  let arrayCallCount = 0

  // Set up reactions
  fobx.reaction(() => observed.nested, () => nestedCallCount++)
  fobx.reaction(() => observed.array, () => arrayCallCount++)

  // Mutate nested - should not trigger reaction
  nested.value = 99
  expect(nestedCallCount).toBe(0)

  // Mutate array - should not trigger reaction
  array.push(4)
  expect(arrayCallCount).toBe(0)

  // Replace objects - should trigger reaction
  observed.nested = { value: 100 }
  expect(nestedCallCount).toBe(1)

  observed.array = [5, 6, 7]
  expect(arrayCallCount).toBe(1)

  // Verify references are maintained with replacements too
  const newArray = [10, 20]
  observed.array = newArray
  expect(observed.array).toBe(newArray)
  expect(arrayCallCount).toBe(2)
})

test("observable with tuple annotation supports custom equality functions", () => {
  // Create a custom equality function that considers numbers equal if they're within 0.1 of each other
  const approximateEquality = (a: number, b: number) => Math.abs(a - b) < 0.1

  // Create an observable with the custom equality function
  const observed = fobx.observable(
    { value: 1.0 },
    { value: ["observable", approximateEquality] },
  )

  // Set up reaction to track changes
  const reactions: number[] = []
  fobx.reaction(() => observed.value, (value) => reactions.push(value))

  // Small change shouldn't trigger reaction
  observed.value = 1.05
  expect(reactions.length).toBe(0)

  // Larger change should trigger reaction
  observed.value = 1.2
  expect(reactions).toEqual([1.2])
})

test("observable with tuple annotation supports structural comparison", () => {
  // First, configure structural comparison
  fobx.configure({
    comparer: { structural: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
    enforceActions: false,
  })

  // Create an observable with structural comparison
  const observed = fobx.observable(
    { person: { name: "Alice", age: 30 } },
    { person: ["observable", "structural"] },
  )

  // Set up reaction to track changes
  const reactions: Array<{ name: string; age: number }> = []
  fobx.reaction(() => observed.person, (person) => reactions.push(person))

  // Replace with structurally identical object - should not trigger reaction
  observed.person = { name: "Alice", age: 30 }
  expect(reactions.length).toBe(0)

  // Replace with structurally different object - should trigger reaction
  observed.person = { name: "Bob", age: 25 }
  expect(reactions).toEqual([{ name: "Bob", age: 25 }])

  // Reset configuration
  fobx.configure({
    comparer: { structural: undefined },
    enforceActions: false,
  })
})

test("observable.shallow with tuple annotation supports custom equality functions", () => {
  // Custom equality function that only compares specific properties
  const compareImportantProps = (a: Any, b: Any) => {
    return a.theme === b.theme && a.fontSize === b.fontSize
  }

  // Create an observable with shallow and custom equality
  const observed = fobx.observable(
    {
      config: {
        theme: "dark",
        fontSize: 16,
        cache: { temporaryData: [1, 2, 3] },
        lastUpdated: Date.now(),
      },
    },
    {
      config: ["observable.shallow", compareImportantProps],
    },
  )

  // Set up reaction to track changes
  const reactions = []
  fobx.reaction(() => observed.config, (config) => reactions.push(config))

  // Replace with object having different non-important properties - should not trigger reaction
  observed.config = {
    theme: "dark",
    fontSize: 16,
    cache: { temporaryData: [4, 5, 6] }, // Different but we don't care
    lastUpdated: Date.now(), // Different but we don't care
  }
  expect(reactions.length).toBe(0)

  // Replace with object that differs in important properties - should trigger reaction
  observed.config = {
    theme: "light", // Changed!
    fontSize: 16,
    cache: { temporaryData: [4, 5, 6] },
    lastUpdated: Date.now(),
  }
  expect(reactions.length).toBe(1)
})

test("observable.ref with tuple annotation supports custom equality functions", () => {
  // Custom equality function for case-insensitive string comparison
  const caseInsensitiveEquality = (a: string, b: string) =>
    typeof a === "string" && typeof b === "string" &&
    a.toLowerCase() === b.toLowerCase()

  // Create an observable with ref and custom equality
  const observed = fobx.observable(
    {
      searchQuery: "t-shirt",
    },
    {
      searchQuery: ["observable.ref", caseInsensitiveEquality],
    },
  )

  // Set up reaction to track changes
  const reactions: Any[] = []
  fobx.reaction(() => observed.searchQuery, (query) => reactions.push(query))

  // Change case only - should not trigger reaction
  observed.searchQuery = "T-SHIRT"
  expect(reactions.length).toBe(0)

  // Change to different text - should trigger reaction
  observed.searchQuery = "pants"
  expect(reactions.length).toBe(1)
  expect(reactions[0]).toBe("pants")
})
