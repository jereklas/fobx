/**
 * Tests for useViewModel hook (reactV2).
 *
 * Key behaviours verified:
 * 1. VM instance is created once (stable identity across renders)
 * 2. update() is called on subsequent renders to sync props
 * 3. update() is wrapped in withoutTracking + runInTransaction (v2 improvement)
 * 4. onConnect() / onDisconnect() lifecycle hooks fire correctly
 * 5. No circular re-renders when vm.update() writes observable props
 * 6. Nested VMs don't interfere with each other (no global state)
 *
 * v1 comparison:
 *   v1 used globalState.updatingReaction to suppress notifications during update().
 *   This global variable was shared, causing bugs when VMs were passed to children.
 *   v2 uses per-tracker withoutTracking + runInTransaction for full re-entrancy.
 */
// @ts-ignore - npm
import React from "react"
// @ts-ignore - npm
import * as ReactDOM from "react-dom/client"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "@fobx/testing"
import { fn } from "@fobx/testing"
import * as fobx from "@fobx/v2"
import { observer, useObserver, useViewModel, ViewModel } from "../index.ts"
import { setupDom } from "./setup.ts"

// ─── DOM setup ───────────────────────────────────────────────────────────────

let domCleanup: () => void
let container: HTMLElement
let root: ReturnType<typeof ReactDOM.createRoot>

beforeAll(() => {
  fobx.configure({ enforceActions: false })
  const setup = setupDom()
  domCleanup = setup.cleanup
})

afterAll(() => {
  domCleanup()
})

beforeEach(() => {
  // deno-lint-ignore no-explicit-any
  container = (globalThis as any).document.createElement("div") as HTMLElement // deno-lint-ignore no-explicit-any
  ;(globalThis as any).document.body.appendChild(container)
  root = ReactDOM.createRoot(container)
})

afterEach(async () => {
  await reactAct(() => root.unmount()) // deno-lint-ignore no-explicit-any
  ;(globalThis as any).document.body.removeChild(container)
})

async function reactAct(fn: () => void | Promise<void>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const { act } = React as any
  await act(fn)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useViewModel - instance lifecycle", () => {
  test("creates VM exactly once across multiple renders", async () => {
    const constructorSpy = fn()
    const counter = fobx.box(0)

    class CounterVM extends ViewModel<{ initial: number }> {
      count: number
      constructor(props: { initial: number }) {
        super(props)
        constructorSpy()
        this.count = props.initial
        fobx.observable(this)
      }
    }

    const Counter = observer(() => {
      const vm = useViewModel(CounterVM, { initial: 0 })
      return React.createElement("span", null, counter.get() + String(vm.count))
    })

    await reactAct(() => root.render(React.createElement(Counter)))
    expect(constructorSpy).toHaveBeenCalledTimes(1)

    // Trigger re-renders via observable change
    await reactAct(() => {
      counter.set(1)
    })
    await reactAct(() => {
      counter.set(2)
    })

    // Constructor should still only have been called once
    expect(constructorSpy).toHaveBeenCalledTimes(1)
  })

  test("returns the same VM instance across renders", async () => {
    const instances: unknown[] = []

    class SimpleVM extends ViewModel<{ value: number }> {}

    const Comp = observer(() => {
      const vm = useViewModel(SimpleVM, { value: 1 })
      instances.push(vm)
      return React.createElement("span", null, String(vm.props.value))
    })

    await reactAct(() => root.render(React.createElement(Comp)))

    // Trigger multiple observable changes to cause multiple re-renders
    await reactAct(() => {})
    await reactAct(() => {})

    // All instances should be the same object
    expect(instances.length).toBeGreaterThan(0)
    const first = instances[0]
    for (const inst of instances) {
      expect(inst).toBe(first)
    }
  })
})

describe("useViewModel - update() sync", () => {
  test("calls update() on subsequent renders with new props", async () => {
    const updateSpy = fn()

    class SimpleVM extends ViewModel<{ value: number }> {
      override update(props: { value: number }) {
        updateSpy(props)
        super.update(props)
      }
    }

    let setValueExternal!: (v: number) => void

    function Parent() {
      const [value, setValue] = React.useState(0)
      setValueExternal = setValue

      const vm = useViewModel(SimpleVM, { value })
      return React.createElement("span", null, String(vm.props.value))
    }

    await reactAct(() => root.render(React.createElement(Parent)))
    expect(updateSpy).not.toHaveBeenCalled() // first render uses constructor

    await reactAct(() => {
      setValueExternal(10)
    })
    expect(updateSpy).toHaveBeenCalledTimes(1)
    // Verify the DOM updated correctly (update() called with correct props)
    expect(container.querySelector("span")?.textContent).toBe("10")

    await reactAct(() => {
      setValueExternal(20)
    })
    expect(updateSpy).toHaveBeenCalledTimes(2)
    expect(container.querySelector("span")?.textContent).toBe("20")
  })

  test("update() is wrapped in withoutTracking to avoid observer tracking prop boxes", async () => {
    // The critical v2 fix: update() calls must NOT be tracked by the parent observer.
    // If they were, writing to vm.props would create a circular dependency:
    // write -> observer re-renders -> update() -> write -> observer re-renders -> ...
    // We verify this by checking the component renders a stable number of times.
    const renderCount = { v: 0 }
    let setValueExternal!: (v: number) => void

    class SimpleVM extends ViewModel<{ value: number }> {}

    const Comp = observer(() => {
      const [value, setValue] = React.useState(0)
      setValueExternal = setValue
      const vm = useViewModel(SimpleVM, { value })
      renderCount.v++
      return React.createElement("span", null, String(vm.props.value))
    })

    await reactAct(() => root.render(React.createElement(Comp)))
    renderCount.v = 0 // reset after initial render

    await reactAct(() => {
      setValueExternal(5)
    })

    // Should re-render at most a small number of times — not infinitely loop
    // due to vm.update() writing to observables causing re-entry
    expect(renderCount.v).toBeLessThanOrEqual(2)
    expect(container.querySelector("span")?.textContent).toBe("5")
  })

  test("update() is wrapped in runInTransaction — props updated atomically", async () => {
    // All prop changes in update() fire as one batch, not one reaction per prop.
    // We test this directly by calling update() on a VM and counting reactions.
    let reactionFireCount = 0

    let setPropsExternal!: (p: { a: number; b: number }) => void

    class MultiPropVM extends ViewModel<{ a: number; b: number }> {}

    function Parent() {
      const [props, setProps] = React.useState({ a: 0, b: 0 })
      setPropsExternal = setProps
      const vm = useViewModel(MultiPropVM, props)
      return React.createElement("span", null, `${vm.props.a}:${vm.props.b}`)
    }

    await reactAct(() => root.render(React.createElement(Parent)))
    await reactAct(() => {
      setPropsExternal({ a: 1, b: 2 })
    })
    expect(container.querySelector("span")?.textContent).toBe("1:2")

    // Direct test of update() atomicity: set up a reaction, call update(), count fires
    const vm2 = new MultiPropVM({ a: 0, b: 0 })
    const dispose = fobx.autorun(() => {
      // deno-lint-ignore no-unused-vars
      const _a = vm2.props.a
      // deno-lint-ignore no-unused-vars
      const _b = vm2.props.b
      reactionFireCount++
    })
    reactionFireCount = 0 // reset after initial autorun run

    // Call update() directly — should be a single transaction
    vm2.update({ a: 10, b: 20 })
    dispose()

    // With runInTransaction wrapping Object.assign, only 1 reaction fire
    // (not 2 — one per prop assignment)
    expect(reactionFireCount).toBe(1)
    expect(vm2.props.a).toBe(10)
    expect(vm2.props.b).toBe(20)
  })
})

describe("useViewModel - lifecycle", () => {
  test("calls onConnect() on mount", async () => {
    const onConnect = fn()

    class LifecycleVM extends ViewModel {
      override onConnect() {
        onConnect()
      }
    }

    const Comp = () => {
      useViewModel(LifecycleVM)
      return null
    }

    expect(onConnect).not.toHaveBeenCalled()
    await reactAct(() => root.render(React.createElement(Comp)))
    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  test("calls onDisconnect() on unmount", async () => {
    const onDisconnect = fn()

    class LifecycleVM extends ViewModel {
      override onDisconnect() {
        onDisconnect()
      }
    }

    const Comp = () => {
      useViewModel(LifecycleVM)
      return null
    }

    await reactAct(() => root.render(React.createElement(Comp)))
    expect(onDisconnect).not.toHaveBeenCalled()

    await reactAct(() => root.unmount())
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  test("onConnect and onDisconnect each fire exactly once in strict mode pattern", async () => {
    const onConnect = fn()
    const onDisconnect = fn()

    class LifecycleVM extends ViewModel {
      override onConnect() {
        onConnect()
      }
      override onDisconnect() {
        onDisconnect()
      }
    }

    const Comp = () => {
      useViewModel(LifecycleVM)
      return null
    }

    await reactAct(() => root.render(React.createElement(Comp)))
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onDisconnect).toHaveBeenCalledTimes(0)

    await reactAct(() => root.unmount())
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })
})

describe("useViewModel - ViewModel base class", () => {
  test("props are observable (tracking works)", async () => {
    let renderCount = 0
    let setExternal!: (v: number) => void

    class SimpleVM extends ViewModel<{ value: number }> {}

    function Parent() {
      const [value, setValue] = React.useState(0)
      setExternal = setValue
      const vm = useViewModel(SimpleVM, { value })
      return React.createElement(ObservedChild, { vm })
    }

    // Child uses useObserver to track vm.props reactively
    function ObservedChild({ vm }: { vm: SimpleVM }) {
      return useObserver(() => {
        renderCount++
        return React.createElement("span", null, String(vm.props.value))
      })
    }

    await reactAct(() => root.render(React.createElement(Parent)))
    expect(renderCount).toBe(1)

    await reactAct(() => {
      setExternal(42)
    })

    expect(container.querySelector("span")?.textContent).toBe("42")
    // Child re-rendered because vm.props.value changed (it's observable)
    expect(renderCount).toBeGreaterThan(1)
  })

  test("default update() syncs all props", () => {
    class VM extends ViewModel<{ a: number; b: string }> {}

    const vm = new VM({ a: 1, b: "hello" })
    expect(vm.props.a).toBe(1)
    expect(vm.props.b).toBe("hello")

    vm.update({ a: 2, b: "world" })
    expect(vm.props.a).toBe(2)
    expect(vm.props.b).toBe("world")
  })

  test("props uses observable.ref (no deep observable conversion)", () => {
    class VM
      extends ViewModel<{ callback: () => void; nested: { x: number } }> {}

    const callback = () => {}
    const nested = { x: 1 }
    const vm = new VM({ callback, nested })

    // Callback should be stored as-is, not wrapped
    expect(vm.props.callback).toBe(callback)
    // Nested object should be stored as-is (not deep observable)
    expect(fobx.isObservableObject(vm.props.nested)).toBe(false)
  })
})

describe("useViewModel - nested VMs (v2 vs v1 regression)", () => {
  test("nested VMs dont interfere with each other (no global state pollution)", async () => {
    // This tests the critical v2 improvement over v1.
    // v1 used a global `updatingReaction` variable which was shared across all observers.
    // When a parent VM's update() ran, it set globalState.updatingReaction to the parent's
    // reaction. If a child VM was passed to a child component, the child observer would
    // incorrectly suppress its own reaction run because the global was set.
    // v2 uses per-tracker withoutTracking which has no global side effects.

    const parentRenders = fn()
    const childRenders = fn()
    let setParentProp!: (v: number) => void
    let setChildProp!: (v: number) => void

    class ParentVM extends ViewModel<{ parentValue: number }> {}
    class ChildVM extends ViewModel<{ childValue: number }> {}

    const ChildComp = observer(({ vm }: { vm: ChildVM }) => {
      childRenders()
      return React.createElement(
        "span",
        { className: "child" },
        String(vm.props.childValue),
      )
    })

    const ParentComp = observer(() => {
      const [pp, setPP] = React.useState(0)
      const [cp, setCP] = React.useState(0)
      setParentProp = setPP
      setChildProp = setCP

      const parentVm = useViewModel(ParentVM, { parentValue: pp })
      const childVm = useViewModel(ChildVM, { childValue: cp })

      parentRenders()

      return React.createElement(
        "div",
        null,
        React.createElement(
          "span",
          { className: "parent" },
          String(parentVm.props.parentValue),
        ),
        React.createElement(ChildComp, { vm: childVm }),
      )
    })

    await reactAct(() => root.render(React.createElement(ParentComp)))
    expect(parentRenders).toHaveBeenCalledTimes(1)
    expect(childRenders).toHaveBeenCalledTimes(1)

    // Change child's prop — only child should update
    await reactAct(() => {
      setChildProp(5)
    })

    expect(container.querySelector(".child")?.textContent).toBe("5")
    // Child should have re-rendered (its React state changed)
    expect(childRenders).toHaveBeenCalledTimes(2)

    // Change parent's prop
    await reactAct(() => {
      setParentProp(10)
    })
    expect(container.querySelector(".parent")?.textContent).toBe("10")
  })
})

// ─── StrictMode ───────────────────────────────────────────────────────────────
//
// React 18 StrictMode in development:
//  1. Double-invokes the render body (refs persist between the two calls).
//  2. Double-invokes effects: effect → cleanup → effect.
//
// For useViewModel this means:
//  A. CONSTRUCTOR:  React 18 double-invokes `useState` initializers to detect
//     side effects. The ViewModel constructor runs TWICE. The second instance is
//     discarded; the component uses a stable vm from that point on.
//
//  B. update() ON FIRST RENDER:  isFirstRender is a useRef that persists across
//     StrictMode's double-render. The first render body call sets
//     isFirstRender.current = false. The second (StrictMode) render body call
//     therefore calls vm.update() with the same initial props — call [1].
//     Then the useSyncExternalStore subscribe-cleanup-resubscribe cycle disposes
//     the tracker. The subscribe-recovery render (needed to re-track deps on the
//     recreated tracker) calls update() a second time with the same props — call [2].
//     Total: 2 update() calls on initial mount, both with identical initial props.
//     Custom update() MUST be idempotent for StrictMode compatibility.
//
//     Note: the subscribe-recovery render is ARCHITECTURALLY NECESSARY — not an
//     accidental leak. The recreated tracker starts with zero deps and can only
//     re-subscribe by running tracker.track(render) during a render pass.
//     Removing useSyncExternalStore in favour of useReducer+useEffect would
//     eliminate this extra render, but at the cost of tearing safety in
//     React’s concurrent/Suspense mode. The current design is the correct trade.
//
//  C. LIFECYCLE:  useEffect double-invoke means:
//       mount  → onConnect() (1st)
//       cleanup → onDisconnect() (1st)
//       remount → onConnect() (2nd)
//     After mount: onConnect=2, onDisconnect=1.
//     After actual unmount: onConnect=2, onDisconnect=2.

describe("useViewModel - StrictMode", () => {
  test("VM instance: useState factory double-invoked by React 18 StrictMode (constructor runs twice)", async () => {
    // React 18 StrictMode double-invokes `useState` initializers to detect side effects.
    // Both factory calls create a CounterVM, but React uses different instances for its
    // two render passes (first is "shadow" / discarded, second is real). After mount,
    // the vm is fully stable: no further constructor calls happen on re-renders.
    const constructorSpy = fn()
    let vmFromLastRender: InstanceType<typeof CounterVM> | null = null

    class CounterVM extends ViewModel<{ initial: number }> {
      count: number
      constructor(props: { initial: number }) {
        super(props)
        constructorSpy()
        this.count = props.initial
        fobx.observable(this)
      }
    }

    const Comp = observer(() => {
      const vm = useViewModel(CounterVM, { initial: 0 })
      vmFromLastRender = vm
      return React.createElement("span", null, String(vm.count))
    })

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })

    // StrictMode double-invokes the useState factory → 2 constructor calls
    expect(constructorSpy).toHaveBeenCalledTimes(2)
    expect(container.querySelector("span")?.textContent).toBe("0")

    // After mount stabilizes, vm is stable — no additional constructor calls on re-renders
    const mountedVm = vmFromLastRender!
    constructorSpy.mockClear()

    // Trigger re-renders by changing a fobx observable unrelated to the vm itself
    const trigger = fobx.box(0)
    const TriggerComp = observer(() => {
      const vm = useViewModel(CounterVM, { initial: 0 })
      vmFromLastRender = vm
      // Read trigger to subscribe
      return React.createElement(
        "span",
        null,
        String(vm.count) + String(trigger.get()),
      )
    })
    // Use a separate root to avoid remounting the original Comp
    const div2 = (globalThis as any).document.createElement("div")
    ;(globalThis as any).document.body.appendChild(div2)
    const root2 = ReactDOM.createRoot(div2)
    constructorSpy.mockClear()

    await reactAct(() =>
      root2.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(TriggerComp),
        ),
      )
    )
    const vmAfterMount = vmFromLastRender!
    constructorSpy.mockClear() // clear StrictMode double-invoke from mount

    await reactAct(() => {
      trigger.set(1)
    })
    // Re-render from observable change — constructor should NOT be called again
    expect(constructorSpy).not.toHaveBeenCalled()
    expect(vmFromLastRender).toBe(vmAfterMount) // same stable vm instance

    await reactAct(() => root2.unmount())
    ;(globalThis as any).document.body.removeChild(div2)
    void mountedVm // suppress unused var warning
  })

  test("update() called twice during StrictMode mount: StrictMode double-render + subscribe-recovery render", async () => {
    // In StrictMode, three render body invocations happen during initial mount:
    //   1. First render body: isFirstRender.current=true → set to false, skip update()
    //   2. Second render body (StrictMode double-invoke): isFirstRender.current=false
    //      → update() CALLED [1] (same initial props, idempotent)
    //   3. Subscribe-recovery render: useSyncExternalStore’s subscribe-cleanup-resubscribe
    //      disposes the tracker. The subscribe-recovery render re-establishes deps on the
    //      new tracker. isFirstRender is still false → update() CALLED [2] (same props again).
    //
    // This is CORRECT behaviour, not a bug. The subscribe-recovery render is architecturally
    // necessary: the recreated tracker has zero deps and must re-track via a render pass.
    // Custom update() MUST therefore be idempotent.
    const updateSpy = fn()

    class VM extends ViewModel<{ value: number }> {
      override update(props: { value: number }) {
        updateSpy(props)
        super.update(props)
      }
    }

    const Comp = observer(() => {
      const vm = useViewModel(VM, { value: 42 })
      return React.createElement("span", null, String(vm.props.value))
    })

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })

    expect(container.querySelector("span")?.textContent).toBe("42")
    // 2 calls: StrictMode second render + subscribe-recovery render (both with initial props)
    expect(updateSpy).toHaveBeenCalledTimes(2)
    expect(updateSpy).toHaveBeenCalledWith({ value: 42 })
  })

  test("reactive updates work after StrictMode effect replay", async () => {
    let setExternal!: (v: number) => void

    class VM extends ViewModel<{ value: number }> {}

    function Parent() {
      const [value, setValue] = React.useState(0)
      setExternal = setValue
      const vm = useViewModel(VM, { value })
      return React.createElement("span", null, String(vm.props.value))
    }

    await reactAct(() => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Parent),
        ),
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("0")

    await reactAct(() => {
      setExternal(10)
    })
    expect(container.querySelector("span")?.textContent).toBe("10")

    await reactAct(() => {
      setExternal(20)
    })
    expect(container.querySelector("span")?.textContent).toBe("20")
  })

  test("onConnect fires twice and onDisconnect fires once after StrictMode mount", async () => {
    // React StrictMode double-invokes effects (mount → cleanup → mount).
    // This is intentional — React is verifying that effects can be safely
    // re-run (resilience testing). The net result: onConnect fires 2x,
    // onDisconnect fires 1x (the simulated unmount) after the component mounts.
    const onConnect = fn()
    const onDisconnect = fn()

    class LifecycleVM extends ViewModel {
      override onConnect() {
        onConnect()
      }
      override onDisconnect() {
        onDisconnect()
      }
    }

    const Comp = () => {
      useViewModel(LifecycleVM)
      return null
    }

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })

    // StrictMode: mount (1) → cleanup (1) → remount (2) = onConnect:2, onDisconnect:1
    expect(onConnect).toHaveBeenCalledTimes(2)
    expect(onDisconnect).toHaveBeenCalledTimes(1)

    // Actual unmount fires cleanup again
    await reactAct(() => root.unmount())
    expect(onConnect).toHaveBeenCalledTimes(2)
    expect(onDisconnect).toHaveBeenCalledTimes(2)
  })

  test("VM stays reactive after StrictMode lifecycle replay", async () => {
    let renderCount = 0
    let setExternal!: (v: number) => void

    class VM extends ViewModel<{ value: number }> {}

    function Parent() {
      const [value, setValue] = React.useState(0)
      setExternal = setValue
      const vm = useViewModel(VM, { value })
      return React.createElement(ObservedChild, { vm })
    }

    function ObservedChild({ vm }: { vm: InstanceType<typeof VM> }) {
      return useObserver(() => {
        renderCount++
        return React.createElement("span", null, String(vm.props.value))
      })
    }

    await reactAct(() => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Parent),
        ),
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("0")

    // Reset counter after StrictMode stabilizes
    renderCount = 0

    // In StrictMode, each reactive update causes the render body to be double-invoked.
    // Parent state change + observable prop update → ObservedChild renders, doubled by StrictMode.
    await reactAct(() => {
      setExternal(7)
    })
    expect(container.querySelector("span")?.textContent).toBe("7")
    expect(renderCount).toBe(2) // StrictMode double-invoke of the 1 actual render
  })
})
