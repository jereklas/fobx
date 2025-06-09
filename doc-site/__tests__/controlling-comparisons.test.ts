// Test file to validate examples from the controlling-comparisons.mdoc documentation
import * as fobx from "@fobx/core"
import { deepEqual } from "fast-equals"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  fn,
  test,
} from "@fobx/testing"
import { runInAction } from "../../core/transactions/action.ts"

beforeEach(() => {
  // Configure with structural comparer for all tests
  fobx.configure({
    comparer: { structural: deepEqual },
    enforceActions: false,
  })
})

afterEach(() => {
  // Reset configuration after each test
  fobx.configure({
    comparer: { structural: undefined },
    enforceActions: false,
  })
})

describe("controlling-comparisons.mdoc examples", () => {
  describe("structural comparison", () => {
    test("makeObservable with structural comparison", () => {
      const user = fobx.makeObservable({
        profile: { name: "Alice", age: 25 },
      }, {
        profile: ["observable", "structural"],
      })

      const reactionFn = fn()
      fobx.reaction(() => user.profile, reactionFn)

      // Same structure shouldn't trigger reaction
      user.profile = { name: "Alice", age: 25 }
      expect(reactionFn).not.toHaveBeenCalled()

      // Different structure should trigger reaction
      user.profile = { name: "Bob", age: 30 }
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith({ name: "Bob", age: 30 }, {
        name: "Alice",
        age: 25,
      }, expect.anything())
    })

    test("computed with structural comparison", () => {
      // In this test we'll demonstrate that with structural comparison,
      // a computed value doesn't trigger reactions when the structure stays the same
      const items = fobx.observable([1, 2, 3])
      let computedRunCount = 0

      const total = fobx.computed(
        () => {
          computedRunCount++
          // Return a new object each time with the same structure
          return { sum: items.reduce((acc, val) => acc + val, 0) }
        },
        { comparer: "structural" },
      )

      // Initially the computed won't run until it's tracked by a reaction
      expect(computedRunCount).toBe(0)

      // Create a reaction to track the computed
      const reactionFn = fn()
      const dispose = fobx.reaction(
        () => total.value,
        (newValue) => {
          reactionFn(newValue)
        },
      )

      // computed has been observed by the reaction's tracking function but hasn't changed yet so no reaction
      expect(computedRunCount).toBe(1)
      expect(total.value).toEqual({ sum: 6 })
      expect(reactionFn).not.toHaveBeenCalled()

      // First, make a change that affects the underlying array but keeps the sum the same]
      runInAction(() => {
        items[0] = 0
        items[1] = 3
        items[2] = 3
      })

      // The computed runs again because items changed, but since the result is structurally the same,
      // the reaction doesn't trigger
      expect(computedRunCount).toBe(2)
      expect(total.value).toEqual({ sum: 6 })
      expect(reactionFn).not.toHaveBeenCalled()

      // Now make a change that changes the sum
      items.push(4)

      expect(computedRunCount).toBe(3)
      expect(reactionFn).toHaveBeenCalledTimes(1)
      expect(reactionFn).toHaveBeenCalledWith({ sum: 10 })

      dispose()
    })
  })

  describe("custom equality functions", () => {
    test("observableBox with custom equality function", () => {
      const caseInsensitiveObservable = fobx.observableBox("hello", {
        equals: (oldValue, newValue) =>
          typeof oldValue === "string" &&
          typeof newValue === "string" &&
          oldValue.toLowerCase() === newValue.toLowerCase(),
      })

      const reactionFn = fn()
      fobx.reaction(() => caseInsensitiveObservable.value, reactionFn)

      // Case changes shouldn't trigger reaction
      caseInsensitiveObservable.value = "HELLO"
      expect(reactionFn).not.toHaveBeenCalled()

      caseInsensitiveObservable.value = "Hello"
      expect(reactionFn).not.toHaveBeenCalled()

      // Different value should trigger reaction
      caseInsensitiveObservable.value = "world"
      expect(reactionFn).toHaveBeenCalledTimes(1)
      // In FobX, reactions compare with the initial value, not the immediately previous value
      expect(reactionFn).toHaveBeenCalledWith(
        "world",
        "hello",
        expect.anything(),
      )
    })

    test("makeObservable with custom equality function", () => {
      const roundingEqualityFn = (a: number, b: number) =>
        Math.floor(a) === Math.floor(b)

      const stats = fobx.makeObservable({
        score: 10.2,
      }, {
        score: ["observable", roundingEqualityFn],
      })

      const reactionFn = fn()
      fobx.reaction(() => stats.score, reactionFn)

      // Changes that round to the same number shouldn't trigger reaction
      stats.score = 10.8
      expect(reactionFn).not.toHaveBeenCalled()

      // Changes that round to different numbers should trigger reaction
      stats.score = 11.2
      expect(reactionFn).toHaveBeenCalledTimes(1)
      // In FobX, reactions compare with the initial value, not the immediately previous value
      expect(reactionFn).toHaveBeenCalledWith(11.2, 10.2, expect.anything())
    })
  })

  describe("form data validation", () => {
    test("email normalization equality function", () => {
      const formData = fobx.makeObservable({
        email: "user@example.com",
      }, {
        email: [
          "observable",
          (oldValue, newValue) =>
            oldValue.trim().toLowerCase() === newValue.trim().toLowerCase(),
        ],
      })

      const reactionFn = fn()
      fobx.reaction(() => formData.email, reactionFn)

      // Adding spaces shouldn't trigger reaction
      formData.email = "  user@example.com  "
      expect(reactionFn).not.toHaveBeenCalled()

      // Changing case shouldn't trigger reaction
      formData.email = "USER@EXAMPLE.COM"
      expect(reactionFn).not.toHaveBeenCalled()

      // Actually changing the email should trigger reaction
      formData.email = "newuser@example.com"
      expect(reactionFn).toHaveBeenCalledTimes(1)
    })

    test("phone number normalization equality function", () => {
      const formData = fobx.makeObservable({
        phoneNumber: "5551234567",
      }, {
        phoneNumber: [
          "observable",
          (oldValue, newValue) =>
            oldValue.replace(/\D/g, "") === newValue.replace(/\D/g, ""),
        ],
      })

      const reactionFn = fn()
      fobx.reaction(() => formData.phoneNumber, reactionFn)

      // Adding formatting shouldn't trigger reaction
      formData.phoneNumber = "(555) 123-4567"
      expect(reactionFn).not.toHaveBeenCalled()

      // Different formatting but same digits shouldn't trigger reaction
      formData.phoneNumber = "555.123.4567"
      expect(reactionFn).not.toHaveBeenCalled()

      // Actually changing the phone number should trigger reaction
      formData.phoneNumber = "5559876543"
      expect(reactionFn).toHaveBeenCalledTimes(1)
    })

    test("search query normalization equality function", () => {
      const normalize = (str: string) =>
        str.trim().toLowerCase()
          .replace(/\s+/g, " ") // normalize spaces
          .replace(/[^a-z0-9 ]/g, " ") // remove special chars

      const formData = fobx.makeObservable({
        searchQuery: "t-shirt blue",
      }, {
        searchQuery: [
          "observable",
          (oldValue, newValue) => {
            return normalize(oldValue) === normalize(newValue)
          },
        ],
      })

      const reactionFn = fn()
      fobx.reaction(() => formData.searchQuery, reactionFn)

      // Extra spaces shouldn't trigger reaction - combine with runInAction to avoid side effects
      formData.searchQuery = "  t-shirt   blue  "
      expect(reactionFn).not.toHaveBeenCalled()

      // Special characters shouldn't trigger reaction
      formData.searchQuery = "t shirt-blue"
      expect(reactionFn).not.toHaveBeenCalled()

      // Different case shouldn't trigger reaction
      formData.searchQuery = "T-SHIRT BLUE"
      expect(reactionFn).not.toHaveBeenCalled()

      // Actually changing the search query should trigger reaction
      formData.searchQuery = "red pants"
      expect(reactionFn).toHaveBeenCalledTimes(1)
    })

    describe("observable.shallow with comparison functions", () => {
      test("observable.shallow with structural comparison", () => {
        // An array of users that we want to remain shallow (not make user objects observable)
        // but we still want structural comparison for the array itself
        const users = fobx.makeObservable({
          list: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
        }, {
          // The issue might be that combining observable.shallow with structural
          // requires special handling in FobX
          list: ["observable.shallow", "structural"],
        })

        const reactionFn = fn()
        fobx.reaction(() => users.list, reactionFn)

        // Verify the array is observable but its contents aren't
        expect(fobx.isObservable(users, "list")).toBe(true)
        expect(fobx.isObservable(users.list[0])).toBe(false)

        // Replacing with structurally identical array shouldn't trigger reaction
        users.list = [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]

        expect(reactionFn).not.toHaveBeenCalled()

        // Replacing with structurally different array should trigger reaction
        users.list = [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Charlie" },
        ]
        expect(reactionFn).toHaveBeenCalled()

        // Individual mutations to array should still be tracked because it's observable
        reactionFn.mockClear()
        users.list.push({ id: 4, name: "Dave" })
        expect(reactionFn).toHaveBeenCalled()
      })
      test("observable.shallow with custom equality function", () => {
        // A settings object that we want to keep shallow, but compare based on
        // certain important keys, ignoring others
        const settings = fobx.makeObservable({
          config: {
            theme: "dark",
            fontSize: 16,
            cache: { temporaryData: [1, 2, 3] }, // We don't care about comparing this
            lastUpdated: Date.now(), // We don't care about comparing this
          },
        }, {
          config: [
            "observable.shallow",
            (oldValue, newValue) => {
              // Only compare the keys we care about
              return oldValue.theme === newValue.theme &&
                oldValue.fontSize === newValue.fontSize
            },
          ],
        })

        const reactionFn = fn()
        fobx.reaction(() => settings.config, reactionFn)

        // Verify the config is observable but its nested objects aren't
        expect(fobx.isObservable(settings, "config")).toBe(true)
        expect(fobx.isObservable(settings.config.cache)).toBe(false)

        // Replacing with object that has same important keys shouldn't trigger reaction
        settings.config = {
          theme: "dark",
          fontSize: 16,
          cache: { temporaryData: [4, 5, 6] }, // Different but we don't care
          lastUpdated: Date.now(), // Different but we don't care
        }
        expect(reactionFn).not.toHaveBeenCalled()

        // Replacing with object that changes important keys should trigger reaction
        settings.config = {
          theme: "light", // Changed!
          fontSize: 16,
          cache: { temporaryData: [4, 5, 6] },
          lastUpdated: Date.now(),
        }
        expect(reactionFn).toHaveBeenCalledTimes(1)
      })

      test("observable.shallow for API data", () => {
        // A more accurate example for API data using observable.shallow without
        // incorrectly combining it with structural comparison
        const productStore = fobx.makeObservable({
          products: [
            { id: 1, name: "Phone", price: 599.99 },
            { id: 2, name: "Laptop", price: 1299.99 },
          ],
          selectedProductId: 1,
          get selectedProduct() {
            return this.products.find((p) => p.id === this.selectedProductId) ||
              null
          },
        }, {
          products: "observable.shallow", // Just shallow observable
          selectedProductId: "observable",
          selectedProduct: "computed",
        })

        const productsReaction = fn()
        const selectedProductReaction = fn()

        fobx.reaction(() => productStore.products, productsReaction)
        fobx.reaction(
          () => productStore.selectedProduct,
          selectedProductReaction,
        )

        // Reset reaction counts
        productsReaction.mockClear()
        selectedProductReaction.mockClear()

        // Even with identical content, replacing the array will trigger reaction
        // because shallow observables use reference equality
        productStore.products = [
          { id: 1, name: "Phone", price: 599.99 },
          { id: 2, name: "Laptop", price: 1299.99 },
        ]
        expect(productsReaction).toHaveBeenCalledTimes(1)
        // selectedProduct depends on products, so it will also update
        expect(selectedProductReaction).toHaveBeenCalledTimes(1)

        productsReaction.mockClear()
        selectedProductReaction.mockClear()

        // Change selected product
        productStore.selectedProductId = 2
        // Only selectedProduct reaction should trigger
        expect(productsReaction).not.toHaveBeenCalled()
        expect(selectedProductReaction).toHaveBeenCalledTimes(1)
      })
    })

    describe("complete example", () => {
      test("dashboard with mixed comparison strategies", () => {
        const dashboard = fobx.makeObservable({
          userData: { name: "Alice", preferences: { theme: "dark" } },
          approximateScore: 75,
        }, {
          userData: ["observable", "structural"],
          approximateScore: [
            "observable",
            (a, b) => Math.floor(a / 5) === Math.floor(b / 5),
          ],
        })

        const userDataChanged = fn()
        const scoreChanged = fn()

        fobx.reaction(() => dashboard.userData, userDataChanged)
        fobx.reaction(() => dashboard.approximateScore, scoreChanged)

        // Structurally equal object shouldn't trigger reaction
        dashboard.userData = { name: "Alice", preferences: { theme: "dark" } }
        expect(userDataChanged).not.toHaveBeenCalled()

        // Structurally different object should trigger reaction
        dashboard.userData = { name: "Alice", preferences: { theme: "light" } }
        expect(userDataChanged).toHaveBeenCalledTimes(1)

        // Score in same 5-point range shouldn't trigger reaction
        dashboard.approximateScore = 79
        expect(scoreChanged).not.toHaveBeenCalled()

        // Score in different 5-point range should trigger reaction
        dashboard.approximateScore = 80
        expect(scoreChanged).toHaveBeenCalledTimes(1)
      })
    })
  })
})
