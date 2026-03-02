import { $fobx } from "../../global.ts"
import * as fobx from "../../index.ts"
import { beforeEach, expect, fn, test } from "@fobx/testing"
import { deepEqual } from "fast-equals"

type ObservableMapWithAdmin = fobx.ObservableMap<string, string> & {
  [$fobx]: { observers: unknown[] }
}

beforeEach(() => {
  fobx.configure({ enforceActions: false, comparer: { structural: deepEqual } })
})

test("observable map respects structural option", () => {
  const m = fobx.observable(new Map([["a", { a: 1 }]]), {
    comparer: "structural",
  })
  let runs = -1

  fobx.autorun(() => {
    runs++
    m.get("a")
  })
  expect(runs).toBe(0)

  m.set("a", { a: 1 })
  expect(runs).toBe(0)

  m.set("a", { a: 2 })
  expect(runs).toBe(1)

  m.set("a", { a: 2 })
  expect(runs).toBe(1)
})

test("observable map made through object observable respects structural option", () => {
  fobx.observable({ a: 1 })
  const o = fobx.observable({ m: new Map([["a", { a: 1 }]]) }, {
    annotations: {
      m: ["observable", "structural"],
    },
  })
  let runs = -1

  fobx.autorun(() => {
    runs++
    o.m.get("a")
  })
  expect(runs).toBe(0)

  o.m.set("a", { a: 1 })
  expect(runs).toBe(0)

  o.m.set("a", { a: 2 })
  expect(runs).toBe(1)

  o.m.set("a", { a: 2 })
  expect(runs).toBe(1)
})

test("observable API for maps successfully constructs map", () => {
  const original = new Map([
    [1, 1],
    [2, 2],
  ])
  const m = fobx.observable(original)
  expect(m).not.toBe(original)
  expect(m.entries()).toEqual(original.entries())
  expect(fobx.isObservableMap(m)).toBe(true)

  const m2 = fobx.observable(original)
  expect(m2.entries()).toEqual(original.entries())
  expect(fobx.isObservableMap(m2)).toBe(true)

  const m3 = fobx.observable(new Map())
  expect(m3.entries()).toEqual(new Map().entries())
  expect(fobx.isObservableMap(m3)).toBe(true)

  const m4 = fobx.observable(new Map([["a", true]]))
  expect(m4.entries()).toEqual(new Map([["a", true]]).entries())
  expect(fobx.isObservableMap(m4)).toBe(true)

  const m5 = fobx.observable(new Map([["a", "a"]]))
  expect(m5.entries()).toEqual(new Map([["a", "a"]]).entries())
  expect(fobx.isObservableMap(m5)).toBe(true)

  const m6 = fobx.observable(new Map([["a", "a"]]))
  expect(m6.entries()).toEqual(new Map([["a", "a"]]).entries())
  expect(fobx.isObservableMap(m6)).toBe(true)
})

const noReactionTC = [
  { name: "entries", expected: ["a", "v"] },
  { name: "values", expected: "v" },
  { name: "keys", expected: "a" },
] as const
noReactionTC.forEach(({ name, expected }) => {
  test(`${name} does not cause reaction unless the iterable.next() is called`, () => {
    const m = fobx.observable(new Map()) as unknown as ObservableMapWithAdmin
    fobx.reaction(() => (m as any)[name](), fn())
    expect(m[$fobx].observers.size).toBe(0)

    const reactionFn = fn()
    fobx.reaction(() => {
      return (m as any)[name]().next().value
    }, reactionFn)

    m.set("a", "v")
    expect(reactionFn).toHaveBeenCalledTimes(1)
    expect(reactionFn).toHaveBeenCalledWith(
      expected,
      undefined,
      expect.anything(),
    )
  })
})

test("issue #4 - reaction fires correctly after clear()", () => {
  const m = fobx.observable(new Map([["a", 1]]))
  const reactionFn = fn()
  fobx.reaction(() => m.get("a"), reactionFn)

  m.set("a", 2)
  expect(reactionFn).toHaveBeenCalledTimes(1)
  m.clear()
  expect(reactionFn).toHaveBeenCalledTimes(2)
  m.set("a", 3)
  expect(reactionFn).toHaveBeenCalledTimes(3)

  fobx.runInTransaction(() => {
    m.clear()
    m.set("a", 1)
  })
  expect(reactionFn).toHaveBeenCalledTimes(4)
})

test("size property is correctly observable", () => {
  const map = fobx.observable(new Map())
  const reactionFn = fn()
  fobx.reaction(() => map.size, reactionFn)

  expect(reactionFn).toHaveBeenCalledTimes(0)
  map.set("a", 7)
  expect(reactionFn).toHaveBeenCalledTimes(1)
})

test("reaction to map as a collection work as expected", () => {
  const m = fobx.observable(new Map())
  const reactionFn = fn()
  fobx.reaction(() => m, reactionFn)
  expect(reactionFn).toHaveBeenCalledTimes(0)

  m.set(1, 1)
  expect(reactionFn).toHaveBeenCalledTimes(1)
  m.set(1, 1)
  expect(reactionFn).toHaveBeenCalledTimes(1)

  m.set(1, 2)
  expect(reactionFn).toHaveBeenCalledTimes(2)
  m.set(2, 3)
  expect(reactionFn).toHaveBeenCalledTimes(3)
  m.delete(2)
  expect(reactionFn).toHaveBeenCalledTimes(4)
  m.clear()
  expect(reactionFn).toHaveBeenCalledTimes(5)
})

test("issue #8 - map.has when looking at a non-existant key only gets notified when that key changes", () => {
  const m = fobx.observable(new Map())

  let runs = -1
  fobx.autorun(() => {
    runs++
    m.has("a")
  })

  m.set("b", 1)
  expect(runs).toBe(0)

  m.set("a", 2)
  expect(runs).toBe(1)
})

test("issue #8 - pending keys need to support case where value assigned is undefined", () => {
  const m = fobx.observable(new Map())

  let runs = -1
  fobx.autorun(() => {
    runs++
    m.get("a")
  })

  m.set("a", undefined)
  expect(runs).toBe(1)
})

test("#8 - observable map only reacts when keys requested change", () => {
  const map = fobx.observable(new Map())
  let counter = 0
  fobx.autorun(() => {
    counter++
    map.get("a")
  })

  map.set("b", 2)
  expect(counter).toBe(1)

  map.set("a", 1)
  expect(counter).toBe(2)
})

const testPendingKeyOperation = (
  operationName: "replace" | "merge",
  operation: (
    map: fobx.ObservableMap<string, string>,
    entries:
      | [string, string][]
      | Map<string, string>
      | Record<string, string>,
  ) => void,
  preservesExisting: boolean = false,
) => {
  const inputTypes = [
    {
      name: "array",
      data: [["targetKey", "arrayValue"], ["otherKey", "otherValue"]] as [
        string,
        string,
      ][],
      expectedValue: "arrayValue",
    },
    {
      name: "Map object",
      data: new Map([["targetKey", "mapValue"], ["otherKey", "otherValue"]]),
      expectedValue: "mapValue",
    },
    {
      name: "object",
      data: { targetKey: "objectValue", otherKey: "otherValue" },
      expectedValue: "objectValue",
    },
  ]

  inputTypes.forEach(({ name, data, expectedValue }) => {
    test(`#8 - pendingKey solution works with ${operationName}() using ${name}`, () => {
      const map = fobx.observable(new Map())
      let counter = 0
      let retrievedValue: unknown

      const dispose = fobx.autorun(() => {
        counter++
        retrievedValue = map.get("targetKey")
      })

      expect(counter).toBe(1)
      expect(retrievedValue).toBe(undefined)

      if (preservesExisting) {
        map.set("existingKey", "existingValue")
        expect(counter).toBe(1)
      }

      operation(map, data)

      expect(counter).toBe(2)
      expect(retrievedValue).toBe(expectedValue)

      if (preservesExisting) {
        expect(map.get("existingKey")).toBe("existingValue")
      }

      dispose()
    })
  })

  test(`#8- pendingKey solution works with ${operationName}() after requesting non-existent key`, () => {
    const map = fobx.observable(new Map())
    let counter = 0
    let retrievedValue: unknown

    const dispose = fobx.autorun(() => {
      counter++
      retrievedValue = map.get("targetKey")
    })

    expect(counter).toBe(1)
    expect(retrievedValue).toBe(undefined)

    map.set("otherKey1", "value1")
    map.set("otherKey2", "value2")
    expect(counter).toBe(1)

    if (preservesExisting) {
      expect(map.get("otherKey1")).toBe("value1")
      expect(map.get("otherKey2")).toBe("value2")
    }

    operation(
      map,
      [["targetKey", "targetValue"], ["anotherKey", "anotherValue"]] as [
        string,
        string,
      ][],
    )

    expect(counter).toBe(2)
    expect(retrievedValue).toBe("targetValue")

    map.set("targetKey", "newTargetValue")
    expect(counter).toBe(3)
    expect(retrievedValue).toBe("newTargetValue")

    map.set("anotherKey", "newAnotherValue")
    expect(counter).toBe(3)

    dispose()
  })
}

testPendingKeyOperation(
  "replace",
  (map, entries) => map.replace(entries),
  false,
)

testPendingKeyOperation("merge", (map, entries) => map.merge(entries), true)

test("#8 - merge() preserves existing values and only adds/updates specified keys", () => {
  const map = fobx.observable(
    new Map([
      ["existing1", "value1"],
      ["existing2", "value2"],
    ]),
  )

  let counter = 0
  let targetValue: unknown
  let existing1Value: unknown

  const dispose = fobx.autorun(() => {
    counter++
    targetValue = map.get("targetKey")
    existing1Value = map.get("existing1")
  })

  expect(counter).toBe(1)
  expect(targetValue).toBe(undefined)
  expect(existing1Value).toBe("value1")

  map.merge({
    targetKey: "newTarget",
    existing1: "updatedValue1",
    newKey: "newValue",
  })

  expect(counter).toBe(2)
  expect(targetValue).toBe("newTarget")
  expect(existing1Value).toBe("updatedValue1")
  expect(map.get("existing2")).toBe("value2")
  expect(map.get("newKey")).toBe("newValue")

  dispose()
})

test("#8 - merge() handles multiple pending keys correctly", () => {
  const map = fobx.observable(new Map())
  let counter = 0
  let key1Value: unknown
  let key2Value: unknown
  let key3Value: unknown

  const dispose = fobx.autorun(() => {
    counter++
    key1Value = map.get("key1")
    key2Value = map.get("key2")
    key3Value = map.get("key3")
  })

  expect(counter).toBe(1)
  expect(key1Value).toBe(undefined)
  expect(key2Value).toBe(undefined)
  expect(key3Value).toBe(undefined)

  map.merge({
    key1: "value1",
    key3: "value3",
    untracked: "untrackedValue",
  })

  expect(counter).toBe(2)
  expect(key1Value).toBe("value1")
  expect(key2Value).toBe(undefined)
  expect(key3Value).toBe("value3")

  map.merge({ key2: "value2" })

  expect(counter).toBe(3)
  expect(key2Value).toBe("value2")

  dispose()
})
