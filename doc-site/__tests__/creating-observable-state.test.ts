// Test file to validate examples from the creating-observable-state.mdoc documentation
import * as fobx from "@fobx/core"
import { describe, expect, fn, test } from "@fobx/testing"

fobx.configure({ enforceActions: false })

describe("creating-observable-state.mdoc examples", () => {
  describe("observable function: automatic observability", () => {
    test("basic observable with deep observability", () => {
      const user = fobx.observable({
        name: "Alice",
        age: 30,
        profile: {
          avatar: "alice.jpg",
          settings: {
            theme: "dark",
          },
        },
        hobbies: ["reading", "hiking"],
      })

      const reactionFn = fn()
      fobx.reaction(() => user.name, reactionFn)

      const profileReactionFn = fn()
      fobx.reaction(() => user.profile.settings.theme, profileReactionFn)

      const hobbiesReactionFn = fn()
      fobx.reaction(() => user.hobbies.length, hobbiesReactionFn)

      // Changes to any property (including nested ones) should trigger reactions
      user.name = "Bob"
      expect(reactionFn).toHaveBeenCalledTimes(1)

      user.profile.settings.theme = "light"
      expect(profileReactionFn).toHaveBeenCalledTimes(1)

      user.hobbies.push("swimming")
      expect(hobbiesReactionFn).toHaveBeenCalledTimes(1)
    })

    test("overriding default behavior with annotations", () => {
      const store = fobx.observable({
        user: { name: "Alice", age: 30 },
        settings: { theme: "dark" },
        metaData: { lastUpdated: new Date() },
      }, {
        // Override specific properties:
        metaData: "observable.ref", // Make metaData reference-observable only
        settings: "observable.shallow", // Make settings a shallow observable
        user: ["observable", "structural"], // Observable with structural comparison
      })

      // Verify the observability types
      expect(fobx.isObservable(store, "user")).toBe(true)
      expect(fobx.isObservable(store, "settings")).toBe(true)
      expect(fobx.isObservable(store, "metaData")).toBe(true)

      // Test shallow observable behavior for settings
      const settingsReactionFn = fn()
      fobx.reaction(() => store.settings, settingsReactionFn)

      // Direct property changes should trigger reaction
      store.settings = { theme: "light" }
      expect(settingsReactionFn).toHaveBeenCalledTimes(1)

      // Test reference observable behavior for metaData
      const metaDataReactionFn = fn()
      fobx.reaction(() => store.metaData, metaDataReactionFn)

      const originalMetaData = store.metaData
      store.metaData = { lastUpdated: new Date() }
      expect(metaDataReactionFn).toHaveBeenCalledTimes(1)

      // Verify the metaData object itself isn't deeply observable
      expect(fobx.isObservable(store.metaData.lastUpdated)).toBe(false)
    })
  })

  describe("makeObservable function: explicit declarations", () => {
    test("explicit observable declarations", () => {
      const user = fobx.makeObservable({
        name: "Alice",
        age: 30,
        profile: {
          avatar: "alice.jpg",
          settings: {
            theme: "dark",
          },
        },
        hobbies: ["reading", "hiking"],

        get fullName() {
          return `${this.name}, ${this.age} years old`
        },
      }, {
        name: "observable", // Only name is observable
        age: "observable", // Only age is observable
        fullName: "computed", // Declare computed property
        // profile and hobbies are NOT observable because they're not declared
      })

      const nameReactionFn = fn()
      fobx.reaction(() => user.name, nameReactionFn)

      const fullNameReactionFn = fn()
      fobx.reaction(() => user.fullName, fullNameReactionFn)

      const profileReactionFn = fn()
      fobx.reaction(() => user.profile.settings.theme, profileReactionFn)

      const hobbiesReactionFn = fn()
      fobx.reaction(() => user.hobbies.length, hobbiesReactionFn)

      // Changes to declared properties should trigger reactions
      user.name = "Bob"
      expect(nameReactionFn).toHaveBeenCalledTimes(1)
      expect(fullNameReactionFn).toHaveBeenCalledTimes(1) // computed depends on name

      // Changes to undeclared properties shouldn't trigger reactions
      user.profile.settings.theme = "light"
      expect(profileReactionFn).not.toHaveBeenCalled()

      user.hobbies.push("swimming")
      expect(hobbiesReactionFn).not.toHaveBeenCalled()
    })

    test("class example with makeObservable", () => {
      class UserStore {
        name = "Alice"
        age = 30
        hobbies = ["reading", "hiking"]

        constructor() {
          // Must be called in constructor
          fobx.makeObservable(this, {
            name: "observable",
            age: "observable",
            hobbies: "observable",
            fullName: "computed",
            updateUser: "action",
          })
        }

        get fullName() {
          return `${this.name}, ${this.age} years old`
        }

        updateUser(name: string, age: number) {
          this.name = name
          this.age = age
        }
      }

      const userStore = new UserStore()

      const nameReactionFn = fn()
      fobx.reaction(() => userStore.name, nameReactionFn)

      const fullNameReactionFn = fn()
      fobx.reaction(() => userStore.fullName, fullNameReactionFn)

      // Test that observable properties work
      userStore.name = "Bob"
      expect(nameReactionFn).toHaveBeenCalledTimes(1)
      expect(fullNameReactionFn).toHaveBeenCalledTimes(1)

      // Test action method
      userStore.updateUser("Charlie", 35)
      expect(nameReactionFn).toHaveBeenCalledTimes(2)
      expect(fullNameReactionFn).toHaveBeenCalledTimes(2)
      expect(userStore.fullName).toBe("Charlie, 35 years old")
    })
  })

  describe("advanced configurations", () => {
    test("custom comparison behavior", () => {
      const user = fobx.makeObservable({
        name: "Alice",
        score: 75,
      }, {
        name: "observable",
        // Custom comparison function - only react when score changes by 5 or more
        score: ["observable", (a: number, b: number) => Math.abs(a - b) < 5],
      })

      const scoreReactionFn = fn()
      fobx.reaction(() => user.score, scoreReactionFn)

      // Changes within threshold shouldn't trigger reaction
      user.score = 78 // difference of 3, should not trigger
      expect(scoreReactionFn).not.toHaveBeenCalled()

      user.score = 75 // reset
      // Changes beyond threshold should trigger reaction
      user.score = 80 // difference of 5, should trigger
      expect(scoreReactionFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("choosing between observable and makeObservable", () => {
    test("observable() for simple state objects", () => {
      // Good for quick setup with minimal boilerplate
      const simpleState = fobx.observable({
        count: 0,
        items: [] as string[],
        settings: { theme: "dark" },
      })

      const reactionFn = fn()
      fobx.reaction(() => simpleState.count, reactionFn)

      simpleState.count++
      expect(reactionFn).toHaveBeenCalledTimes(1)

      // All properties are deeply observable by default
      expect(fobx.isObservable(simpleState, "count")).toBe(true)
      expect(fobx.isObservable(simpleState, "items")).toBe(true)
      expect(fobx.isObservable(simpleState, "settings")).toBe(true)
      expect(fobx.isObservable(simpleState.settings, "theme")).toBe(true)
    })

    test("makeObservable() for explicit control", () => {
      // Good for classes and explicit control over observability
      const explicitState = fobx.makeObservable({
        count: 0,
        items: [] as string[],
        settings: { theme: "dark" },
        metadata: { created: new Date() },
      }, {
        count: "observable",
        items: "observable.shallow",
        // settings and metadata are not observable
      })

      const countReactionFn = fn()
      fobx.reaction(() => explicitState.count, countReactionFn)

      const itemsReactionFn = fn()
      fobx.reaction(() => explicitState.items.length, itemsReactionFn)

      const settingsReactionFn = fn()
      fobx.reaction(() => explicitState.settings.theme, settingsReactionFn)

      explicitState.count++
      expect(countReactionFn).toHaveBeenCalledTimes(1)

      explicitState.items.push("item")
      expect(itemsReactionFn).toHaveBeenCalledTimes(1)

      // Settings is not observable, so no reaction
      explicitState.settings.theme = "light"
      expect(settingsReactionFn).not.toHaveBeenCalled()

      // Verify observability
      expect(fobx.isObservable(explicitState, "count")).toBe(true)
      expect(fobx.isObservable(explicitState, "items")).toBe(true)
      expect(fobx.isObservable(explicitState, "settings")).toBe(false)
      expect(fobx.isObservable(explicitState, "metadata")).toBe(false)
    })
  })
})
