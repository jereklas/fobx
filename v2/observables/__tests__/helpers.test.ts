import * as fobx from "../../index.ts"
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
  fobx.observable(instance)

  expect(fobx.isObservable(instance, "baseValue")).toBe(true)
  expect(fobx.isObservable(instance, "value")).toBe(true)
  expect(fobx.isComputed(instance, "getter")).toBe(true)
  expect(fobx.isTransaction(instance.baseMethod)).toBe(true)
  expect(fobx.isTransaction(instance.method)).toBe(true)
  expect(fobx.isTransaction(instance.generator)).toBe(true)

  expect(instance.getter).toBe(84)
  instance.value = 10
  expect(instance.value).toBe(10)
  expect(instance.getter).toBe(20)
})
