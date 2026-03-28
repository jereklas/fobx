import { getPropertyDescriptions } from "../helpers.ts"
import { expect, test } from "@fobx/testing"

test("property descriptor", () => {
  class Base {
    baseValue = 100
    baseMethod() {
      return this.baseValue
    }

    get getter() {
      return 10
    }
  }

  class TestClass extends Base {
    value = 42
    method() {
      return this.value
    }
    // @ts-expect-error - purposefully testing a re-defined property descriptor
    get getter() {
      return this.value * 2
    }
    set setter(val: number) {
      this.value = val
    }
    *generator() {
      yield this.value
    }
  }

  const instance = new TestClass()
  const testClassProto = Object.getPrototypeOf(instance)
  const baseProto = Object.getPrototypeOf(testClassProto)

  const descriptions = getPropertyDescriptions(instance, "class")
  expect(descriptions.map((d) => d.key).toSorted()).toEqual([
    "baseMethod",
    "baseValue",
    "generator",
    "getter",
    "method",
    "setter",
    "value",
  ])

  // instance descriptors
  expect(
    descriptions.filter((d) => d.level === 0).map((d) => ({
      key: d.key,
      proto: d.prototype,
    })),
  ).toStrictEqual([
    { key: "baseValue", proto: null },
    { key: "value", proto: null },
  ])

  // TestClass descriptors
  expect(
    descriptions.filter((d) => d.level === 1).map((d) => ({
      key: d.key,
      proto: d.prototype,
    })),
  ).toStrictEqual([
    { key: "method", proto: testClassProto },
    { key: "getter", proto: testClassProto },
    { key: "setter", proto: testClassProto },
    { key: "generator", proto: testClassProto },
  ])

  // Base descriptors
  expect(
    descriptions.filter((d) => d.level === 2).map((d) => ({
      key: d.key,
      proto: d.prototype,
    })),
  ).toStrictEqual([
    { key: "baseMethod", proto: baseProto },
    // Note: "getter" is not included here because it was found earlier in the prototype chain
  ])
})
