import * as fobx from "../../index.ts"
import * as internals from "../../internals.ts"
import { beforeAll, describe, expect, fn, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

describe("createTracker", () => {
  test("tracks dependencies and fires onInvalidate when they change", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const counter = fobx.observableBox(0)

    // First track — establishes deps
    const result = tracker.track(() => counter.get())
    expect(result).toBe(0)
    expect(invalidate).not.toHaveBeenCalled()

    // Change the dep — should fire invalidate
    counter.set(1)
    expect(invalidate).toHaveBeenCalledTimes(1)

    // Change again
    counter.set(2)
    expect(invalidate).toHaveBeenCalledTimes(2)

    tracker.dispose()
  })

  test("re-tracking refreshes deps", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const a = fobx.observableBox(0)
    const b = fobx.observableBox(0)

    // First track: read a only
    tracker.track(() => a.get())
    expect(invalidate).not.toHaveBeenCalled()

    // Change b — should NOT trigger (not tracked)
    b.set(1)
    expect(invalidate).not.toHaveBeenCalled()

    // Change a — should trigger
    a.set(1)
    expect(invalidate).toHaveBeenCalledTimes(1)

    // Re-track: read b only
    tracker.track(() => b.get())

    // Change a — should NOT trigger anymore (no longer tracked)
    a.set(2)
    expect(invalidate).toHaveBeenCalledTimes(1)

    // Change b — should trigger
    b.set(2)
    expect(invalidate).toHaveBeenCalledTimes(2)

    tracker.dispose()
  })

  test("suppresses run during tracking (isTracking flag)", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const counter = fobx.observableBox(0)

    // First track: establish dep
    tracker.track(() => counter.get())

    // Track again while writing to the same observable inside track.
    // The write should NOT trigger onInvalidate because we're currently tracking.
    tracker.track(() => {
      counter.set(99)
      return counter.get()
    })

    // onInvalidate should NOT have fired — writes during tracking are suppressed
    expect(invalidate).not.toHaveBeenCalled()

    // After tracking ends, a normal change should fire
    counter.set(100)
    expect(invalidate).toHaveBeenCalledTimes(1)

    tracker.dispose()
  })

  test("suppresses run when runWithoutTracking + runInTransaction is used during track", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const name = fobx.observableBox("Alice")

    // Establish deps
    tracker.track(() => name.get())

    // Simulate useViewModel pattern: track the render, but update observable
    // props inside runWithoutTracking + runInTransaction
    const renderResult = tracker.track(() => {
      // This simulates vm.update(props) inside tracking
      fobx.runWithoutTracking(() => {
        fobx.runInTransaction(() => {
          name.set("Bob")
        })
      })
      return name.get()
    })

    expect(renderResult).toBe("Bob")
    // Should NOT have fired — write happened during our tracking pass
    expect(invalidate).not.toHaveBeenCalled()

    // Normal change after tracking ends should fire
    name.set("Charlie")
    expect(invalidate).toHaveBeenCalledTimes(1)

    tracker.dispose()
  })

  test("dispose removes all subscriptions", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const counter = fobx.observableBox(0)

    tracker.track(() => counter.get())
    tracker.dispose()

    // Change should NOT fire — tracker is disposed
    counter.set(1)
    expect(invalidate).not.toHaveBeenCalled()
  })

  test("dispose is idempotent", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const counter = fobx.observableBox(0)
    tracker.track(() => counter.get())

    tracker.dispose()
    tracker.dispose() // should not throw
    tracker.dispose()

    counter.set(1)
    expect(invalidate).not.toHaveBeenCalled()
  })

  test("works with computed values", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const firstName = fobx.observableBox("John")
    const lastName = fobx.observableBox("Doe")
    const fullName = fobx.computed(() => `${firstName.get()} ${lastName.get()}`)

    const result = tracker.track(() => fullName.get())
    expect(result).toBe("John Doe")

    // Change first name — computed changes — tracker fires
    firstName.set("Jane")
    expect(invalidate).toHaveBeenCalledTimes(1)

    // Re-track to get new value
    const result2 = tracker.track(() => fullName.get())
    expect(result2).toBe("Jane Doe")

    // Change last name
    lastName.set("Smith")
    expect(invalidate).toHaveBeenCalledTimes(2)

    tracker.dispose()
  })

  test("works with observable objects", () => {
    const invalidate = fn()
    const tracker = internals.createTracker(invalidate)

    const person = fobx.observable({ name: "Alice", age: 30 })

    const result = tracker.track(() => person.name)
    expect(result).toBe("Alice")

    person.name = "Bob"
    expect(invalidate).toHaveBeenCalledTimes(1)

    // Re-track
    tracker.track(() => person.age)

    // name is no longer tracked
    person.name = "Charlie"
    expect(invalidate).toHaveBeenCalledTimes(1)

    // age is tracked
    person.age = 25
    expect(invalidate).toHaveBeenCalledTimes(2)

    tracker.dispose()
  })

  test("nested trackers work independently", () => {
    const invalidate1 = fn()
    const invalidate2 = fn()
    const tracker1 = internals.createTracker(invalidate1)
    const tracker2 = internals.createTracker(invalidate2)

    const a = fobx.observableBox(0)
    const b = fobx.observableBox(0)

    tracker1.track(() => a.get())
    tracker2.track(() => b.get())

    a.set(1)
    expect(invalidate1).toHaveBeenCalledTimes(1)
    expect(invalidate2).not.toHaveBeenCalled()

    b.set(1)
    expect(invalidate1).toHaveBeenCalledTimes(1)
    expect(invalidate2).toHaveBeenCalledTimes(1)

    tracker1.dispose()
    tracker2.dispose()
  })

  test("tracker inside another tracker's track works correctly", () => {
    const invalidate1 = fn()
    const invalidate2 = fn()
    const tracker1 = internals.createTracker(invalidate1)
    const tracker2 = internals.createTracker(invalidate2)

    const a = fobx.observableBox(0)
    const b = fobx.observableBox(0)

    // Simulate parent rendering child: parent tracks, and inside the tracked
    // function, child also tracks (nested withTracking)
    tracker1.track(() => {
      const parentVal = a.get()
      // Child's track runs inside parent's track
      tracker2.track(() => {
        b.get()
      })
      return parentVal
    })

    // a is tracked by tracker1
    a.set(1)
    expect(invalidate1).toHaveBeenCalledTimes(1)
    expect(invalidate2).not.toHaveBeenCalled()

    // b is tracked by tracker2
    b.set(1)
    expect(invalidate1).toHaveBeenCalledTimes(1)
    expect(invalidate2).toHaveBeenCalledTimes(1)

    tracker1.dispose()
    tracker2.dispose()
  })
})
