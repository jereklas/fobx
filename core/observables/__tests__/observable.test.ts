// deno-lint-ignore-file no-explicit-any
import * as fobx from "../../index.ts"
import { expect, grabConsole, test } from "@fobx/testing"

type Any = any

test("creating an observable object with shallow=true works correctly", () => {
  const obj = { a: { b: "c" }, arr: [], set: new Set(), map: new Map() }
  const shallow = fobx.observable(obj, {
    annotations: {
      a: "observable.ref",
      arr: "observable.ref",
      set: "observable.ref",
      map: "observable.ref",
    },
  })
  const deep = fobx.observable(obj)

  expect(fobx.isObservable(deep, "a")).toBe(true)
  expect(fobx.isObservable(deep, "arr")).toBe(true)
  expect(fobx.isObservable(deep, "set")).toBe(true)
  expect(fobx.isObservable(deep, "map")).toBe(true)
  expect(fobx.isObservable(shallow, "a")).toBe(true)
  expect(fobx.isObservable(shallow, "arr")).toBe(true)
  expect(fobx.isObservable(shallow, "set")).toBe(true)
  expect(fobx.isObservable(shallow, "map")).toBe(true)

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

  const observed = fobx.observable(obj, {
    annotations: {
      array: "observable.shallow",
      map: "observable.shallow",
      set: "observable.shallow",
    },
  })

  expect(fobx.isObservable(observed, "array")).toBe(true)
  expect(fobx.isObservable(observed, "map")).toBe(true)
  expect(fobx.isObservable(observed, "set")).toBe(true)

  expect(fobx.isObservableArray(observed.array)).toBe(true)
  expect(fobx.isObservableMap(observed.map)).toBe(true)
  expect(fobx.isObservableSet(observed.set)).toBe(true)

  expect(fobx.isObservableObject(observed.array[2])).toBe(false)
  const mapValue = observed.map.get("key")
  expect(fobx.isObservableObject(mapValue)).toBe(false)
  const setValue = Array.from(observed.set)[0]
  expect(fobx.isObservableObject(setValue)).toBe(false)

  const deepObserved = fobx.observable({ array: [{ value: 3 }] })
  expect(fobx.isObservableObject(deepObserved.array[0])).toBe(true)
})

test("observable.shallow tracks collection operations, unlike shallow: true", () => {
  const withShallowOption = fobx.observable({ array: [1, 2, 3] }, {
    annotations: {
      array: "observable.ref",
    },
  })
  const withShallowAnnotation = fobx.observable({ array: [1, 2, 3] }, {
    annotations: {
      array: "observable.shallow",
    },
  })

  expect(fobx.isObservableArray(withShallowOption.array)).toBe(false)
  expect(fobx.isObservableArray(withShallowAnnotation.array)).toBe(true)

  let shallowOptionValue = null
  let shallowAnnotationValue = null

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

  withShallowOption.array.push(4)
  withShallowAnnotation.array.push(4)

  expect(shallowOptionValue).toBe(null)
  expect(shallowAnnotationValue).toEqual([1, 2, 3, 4])

  disposeShallowOption()
  disposeShallowAnnotation()
})

test("observable with observable.ref annotation works correctly", () => {
  const nested = { value: 1 }
  const array = [1, 2, 3]
  const map = new Map([["key", { value: 2 }]])
  const set = new Set([{ value: 3 }])

  const observed = fobx.observable({
    nested,
    array,
    map,
    set,
  }, {
    annotations: {
      nested: "observable.ref",
      array: "observable.ref",
      map: "observable.ref",
      set: "observable.ref",
    },
  })

  expect(fobx.isObservable(observed, "nested")).toBe(true)
  expect(fobx.isObservable(observed, "array")).toBe(true)
  expect(fobx.isObservable(observed, "map")).toBe(true)
  expect(fobx.isObservable(observed, "set")).toBe(true)

  expect(observed.nested).toBe(nested)
  expect(observed.array).toBe(array)
  expect(observed.map).toBe(map)
  expect(observed.set).toBe(set)

  expect(fobx.isObservableObject(observed.nested)).toBe(false)
  expect(fobx.isObservableArray(observed.array)).toBe(false)
  expect(fobx.isObservableMap(observed.map)).toBe(false)
  expect(fobx.isObservableSet(observed.set)).toBe(false)

  let nestedCallCount = 0
  let arrayCallCount = 0

  fobx.reaction(() => observed.nested, () => nestedCallCount++)
  fobx.reaction(() => observed.array, () => arrayCallCount++)

  nested.value = 99
  expect(nestedCallCount).toBe(0)

  array.push(4)
  expect(arrayCallCount).toBe(0)

  observed.nested = { value: 100 }
  expect(nestedCallCount).toBe(1)

  observed.array = [5, 6, 7]
  expect(arrayCallCount).toBe(1)

  const newArray = [10, 20]
  observed.array = newArray
  expect(observed.array).toBe(newArray)
  expect(arrayCallCount).toBe(2)
})

test("observable with tuple annotation supports custom equality functions", () => {
  const approximateEquality = (a: number, b: number) => Math.abs(a - b) < 0.1

  const observed = fobx.observable(
    { value: 1.0 },
    { annotations: { value: ["observable", approximateEquality] } },
  )

  const reactions: number[] = []
  fobx.reaction(() => observed.value, (value) => reactions.push(value))

  observed.value = 1.05
  expect(reactions.length).toBe(0)

  observed.value = 1.2
  expect(reactions).toEqual([1.2])
})

test("observable with tuple annotation supports structural comparison", () => {
  fobx.configure({
    comparer: { structural: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
    enforceActions: false,
  })

  const observed = fobx.observable(
    { person: { name: "Alice", age: 30 } },
    { annotations: { person: ["observable", "structural"] } },
  )

  const reactions: Array<{ name: string; age: number }> = []
  fobx.reaction(() => observed.person, (person) => reactions.push(person))

  observed.person = { name: "Alice", age: 30 }
  expect(reactions.length).toBe(0)

  observed.person = { name: "Bob", age: 25 }
  expect(reactions).toEqual([{ name: "Bob", age: 25 }])

  // Reset configuration
  fobx.configure({
    comparer: { structural: undefined },
    enforceActions: false,
  })
})

test("observable.shallow with tuple annotation supports custom equality functions", () => {
  const compareImportantProps = (a: Any, b: Any) => {
    return a.theme === b.theme && a.fontSize === b.fontSize
  }

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
      annotations: {
        config: ["observable.shallow", compareImportantProps],
      },
    },
  )

  const reactions = []
  fobx.reaction(() => observed.config, (config) => reactions.push(config))

  observed.config = {
    theme: "dark",
    fontSize: 16,
    cache: { temporaryData: [4, 5, 6] },
    lastUpdated: Date.now(),
  }
  expect(reactions.length).toBe(0)

  observed.config = {
    theme: "light",
    fontSize: 16,
    cache: { temporaryData: [4, 5, 6] },
    lastUpdated: Date.now(),
  }
  expect(reactions.length).toBe(1)
})

test("observable.ref with tuple annotation supports custom equality functions", () => {
  const caseInsensitiveEquality = (a: string, b: string) =>
    typeof a === "string" && typeof b === "string" &&
    a.toLowerCase() === b.toLowerCase()

  const observed = fobx.observable(
    {
      searchQuery: "t-shirt",
    },
    {
      annotations: {
        searchQuery: ["observable.ref", caseInsensitiveEquality],
      },
    },
  )

  const reactions: Any[] = []
  fobx.reaction(() => observed.searchQuery, (query) => reactions.push(query))

  observed.searchQuery = "T-SHIRT"
  expect(reactions.length).toBe(0)

  observed.searchQuery = "pants"
  expect(reactions.length).toBe(1)
  expect(reactions[0]).toBe("pants")
})

test("observable with inPlace=true mutates plain object in place", () => {
  const source = { value: 1 }
  const observed = fobx.observable(source, { inPlace: true })

  expect(observed).toBe(source)
  expect(fobx.isObservableObject(source)).toBe(true)
  expect(fobx.isObservable(source, "value")).toBe(true)
})

test("observable with inPlace=true throws for frozen plain objects", () => {
  const source = Object.freeze({ value: 1 })

  expect(() => {
    fobx.observable(source, { inPlace: true })
  }).toThrow(
    "[@fobx/core] Cannot use inPlace on a non-extensible (frozen/sealed) object",
  )
})

test("observable with inPlace=false returns a new plain object reference", () => {
  const source = { value: 1 }
  const observed = fobx.observable(source)

  expect(observed).not.toBe(source)
  expect(fobx.isObservableObject(observed)).toBe(true)
  expect(fobx.isObservableObject(source)).toBe(false)
})

test("observable ownPropertiesOnly=true installs inherited members on instance", () => {
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
  const observed = fobx.observable(counter, {
    ownPropertiesOnly: true,
    annotations: {
      value: "observable",
      doubled: "computed",
      inc: "transaction",
    },
  })

  expect(observed).toBe(counter)
  expect(Object.hasOwn(observed, "doubled")).toBe(true)
  expect(Object.hasOwn(observed, "inc")).toBe(true)
  expect(fobx.isComputed(observed, "doubled")).toBe(true)
  expect(fobx.isTransaction(observed.inc)).toBe(true)
})

test("observable inPlace + ownPropertiesOnly combination behaves correctly", () => {
  class Counter {
    value = 1

    get doubled() {
      return this.value * 2
    }
  }

  const counter = new Counter()
  const observed = fobx.observable(counter, {
    inPlace: true,
    ownPropertiesOnly: true,
    annotations: {
      value: "observable",
      doubled: "computed",
    },
  })

  expect(observed).toBe(counter)
  expect(Object.hasOwn(observed, "doubled")).toBe(true)
  expect(fobx.isComputed(observed, "doubled")).toBe(true)
})
