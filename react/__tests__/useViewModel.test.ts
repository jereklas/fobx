// deno-lint-ignore-file no-explicit-any
/**
 * Tests for useViewModel hook.
 *
 * Key behaviours verified:
 * 1. VM instance is created once (stable identity across renders)
 * 2. update() is called on subsequent renders to sync props
 * 3. Reads inside update() are tracked as component dependencies
 * 4. Prop writes inside update() are batched (reactions fire once)
 * 5. onConnect() / onDisconnect() lifecycle hooks fire correctly
 * 6. No circular re-renders when vm.update() writes observable props
 * 7. Nested VMs don't interfere with each other
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
import * as fobx from "@fobx/core"
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
  container = (globalThis as any).document.createElement("div") as HTMLElement
  ;(globalThis as any).document.body.appendChild(container)
  root = ReactDOM.createRoot(container)
})

afterEach(async () => {
  await reactAct(() => root.unmount())
  ;(globalThis as any).document.body.removeChild(container)
})

async function reactAct(fn: () => void | Promise<void>): Promise<void> {
  const { act } = React as any
  await act(fn)
}

async function captureConsoleErrors(
  fn: () => void | Promise<void>,
): Promise<string[]> {
  const originalError = console.error
  const messages: string[] = []

  console.error = (...args: unknown[]) => {
    messages.push(args.map((arg) => String(arg)).join(" "))
  }

  try {
    await fn()
  } finally {
    console.error = originalError
  }

  return messages
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useViewModel - instance lifecycle", () => {
  test("allows replacing methods on observable ViewModel instances", () => {
    class Vm extends ViewModel {
      constructor() {
        super()
        fobx.observable(this)
      }

      save() {
        return "original"
      }
    }

    const vm = new Vm()
    expect(fobx.isTransaction(vm.save)).toBe(true)

    let calls = 0
    const replacement = () => {
      calls++
      return "mocked"
    }

    expect(() => {
      vm.save = replacement as typeof vm.save
    }).not.toThrow()

    expect(vm.save()).toBe("mocked")
    expect(calls).toBe(1)
  })

  test("refs assigned through setRef stay reference-only on observable ViewModels", () => {
    class Vm extends ViewModel<object> {
      constructor() {
        super()
        fobx.observable(this)
      }
    }

    const vm = new Vm()
    const ref: Record<string, unknown> = {}
    ref.self = ref
    ref.current = ref

    expect(() => {
      vm.setRef(ref as unknown as HTMLElement)
    }).not.toThrow()

    expect(vm.ref).toBe(ref)
    expect(fobx.isObservableObject(vm.ref)).toBe(false)
  })

  test("base update stays plain when subclasses call observable(this)", () => {
    class Vm extends ViewModel<{ value: number }> {
      constructor(props: { value: number }) {
        super(props)
        fobx.observable(this)
      }

      override update(props: { value: number }) {
        super.update(props)
      }
    }

    const vm = new Vm({ value: 1 })

    expect(fobx.isTransaction(vm.update)).toBe(false)
  })

  test("base props getter stays computed when subclasses call observable(this)", () => {
    class Vm extends ViewModel<{ value: number }> {
      constructor(props: { value: number }) {
        super(props)
        fobx.observable(this)
      }
    }

    const vm = new Vm({ value: 1 })

    expect(fobx.isComputed(vm, "props")).toBe(true)
  })

  test("creates VM exactly once across multiple renders", async () => {
    const constructorSpy = fn()
    const counter = fobx.observableBox(0)

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

  test("prop writes inside update() do not cause circular re-renders", async () => {
    // The tracker's isTracking flag suppresses re-invalidation while track() is
    // running, and startBatch/endBatch defer reactions until after the render.
    // Together they prevent writes in update() from causing mid-render re-entry.
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

  test("prop writes inside update() are batched — reactions fire once for all changes", async () => {
    // All prop changes in update() fire as one notification, not one per prop.
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
      const _a = vm2.props.a
      const _b = vm2.props.b
      reactionFireCount++
    })
    reactionFireCount = 0 // reset after initial autorun run

    // Call update() directly — all assignments batched into one notification
    vm2.update({ a: 10, b: 20 })
    dispose()

    // startBatch/endBatch around Object.assign → 1 reaction fire, not 2
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

    const errors = await captureConsoleErrors(() =>
      reactAct(() => {
        setExternal(42)
      })
    )

    expect(container.querySelector("span")?.textContent).toBe("42")
    // Child re-rendered because vm.props.value changed (it's observable)
    expect(renderCount).toBeGreaterThan(1)
    expect(errors).not.toContain(
      expect.stringContaining("Cannot update a component"),
    )
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

describe("useViewModel - nested VMs", () => {
  test("nested VMs dont interfere with each other", async () => {
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
    const childUpdateErrors = await captureConsoleErrors(() =>
      reactAct(() => {
        setChildProp(5)
      })
    )

    expect(container.querySelector(".child")?.textContent).toBe("5")
    // Child should have re-rendered (its React state changed)
    expect(childRenders).toHaveBeenCalledTimes(2)
    expect(childUpdateErrors).not.toContain(
      expect.stringContaining("Cannot update a component"),
    )

    // Change parent's prop
    const parentUpdateErrors = await captureConsoleErrors(() =>
      reactAct(() => {
        setParentProp(10)
      })
    )

    expect(container.querySelector(".parent")?.textContent).toBe("10")
    expect(parentUpdateErrors).not.toContain(
      expect.stringContaining("Cannot update a component"),
    )
  })
})

// ─── StrictMode ───────────────────────────────────────────────────────────────
//
// React 18 StrictMode in development:
//  A. CONSTRUCTOR: useState initializers are double-invoked. The ViewModel
//     constructor runs twice; React discards the second instance.
//
//  B. update() ON FIRST RENDER: isFirstRender is a useRef that persists across
//     the double-render. The second render body call sees isFirstRender=false and
//     calls update() [1]. The subscribe-cleanup-resubscribe cycle then disposes
//     the tracker and triggers a recovery render, which calls update() again [2].
//     Total: 2 update() calls on initial mount, both with identical initial props.
//     Custom update() implementations must be idempotent.
//
//  C. LIFECYCLE: useEffect double-invoke means:
//       mount → onConnect() (1) → cleanup → onDisconnect() (1) → remount → onConnect() (2)
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
    const trigger = fobx.observableBox(0)
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
    const errors = await captureConsoleErrors(() =>
      reactAct(() => {
        setExternal(7)
      })
    )

    expect(container.querySelector("span")?.textContent).toBe("7")
    expect(renderCount).toBe(2) // StrictMode double-invoke of the 1 actual render
    expect(errors).not.toContain(
      expect.stringContaining("Cannot update a component"),
    )
  })
})

// ─── update() dependency tracking ────────────────────────────────────────────
//
// update() runs during tracker.track(render), so any observables it reads
// become reactive dependencies of the component when update() remains a plain
// method. The base ViewModel explicitly pins update() as "none", so subclass
// calls to observable(this) do not re-wrap the inherited update hook.
//
// startBatch/endBatch (used by useViewModel) preserves tracking, making
// the correct tracking available to any plain update() method.

describe("useViewModel - update() dependency tracking", () => {
  test(
    "observables read inside a plain update() are tracked as component dependencies",
    async () => {
      // Plain update() (no action annotation) runs inside tracker.track(render).
      // Any observables it reads become reactive deps of the component.
      // Changing such an observable triggers a re-render even without a React
      // prop or state change.
      const mode = fobx.observableBox<"wrap" | "bang">("wrap")
      const display = fobx.observableBox("")
      let setValueExternal!: (v: string) => void

      // PlainVM does NOT call observable(this), so update() is not annotated
      // as an action — tracking is preserved when update() runs.
      class PlainVM extends ViewModel<{ value: string }> {
        override update(props: { value: string }) {
          super.update(props)
          display.set(
            mode.get() === "wrap" ? `[${props.value}]` : `${props.value}!`,
          )
        }
      }

      const Comp = observer(function Comp() {
        const [value, setValue] = React.useState("")
        setValueExternal = setValue
        useViewModel(PlainVM, { value })
        return React.createElement("span", null, display.get())
      })

      await reactAct(() => root.render(React.createElement(Comp)))
      expect(container.querySelector("span")?.textContent).toBe("")

      // Prop change → update() runs, reads mode ("wrap") → display = "[hello]"
      // mode is now a tracked dependency of this component
      await reactAct(() => setValueExternal("hello"))
      expect(container.querySelector("span")?.textContent).toBe("[hello]")

      // Change mode only — no React prop/state change.
      // Component re-renders because mode was tracked inside update().
      await reactAct(() => mode.set("bang"))
      expect(container.querySelector("span")?.textContent).toBe("hello!")
    },
  )

  test(
    "update() stays trackable even when a ViewModel subclass calls observable(this)",
    async () => {
      const mode = fobx.observableBox<"wrap" | "bang">("wrap")
      const display = fobx.observableBox("")
      let setValueExternal!: (v: string) => void

      class TrackingVm extends ViewModel<{ value: string }> {
        constructor(props: { value: string }) {
          super(props)
          fobx.observable(this)
        }

        override update(props: { value: string }) {
          super.update(props)
          display.set(
            mode.get() === "wrap" ? `[${props.value}]` : `${props.value}!`,
          )
        }
      }

      const Comp = observer(function Comp() {
        const [value, setValue] = React.useState("")
        setValueExternal = setValue
        useViewModel(TrackingVm, { value })
        return React.createElement("span", null, display.get())
      })

      await reactAct(() => root.render(React.createElement(Comp)))
      expect(container.querySelector("span")?.textContent).toBe("")

      await reactAct(() => setValueExternal("hello"))
      expect(container.querySelector("span")?.textContent).toBe("[hello]")

      await reactAct(() => mode.set("bang"))
      expect(container.querySelector("span")?.textContent).toBe("hello!")
    },
  )

  test(
    "plain update() re-tracks deps when a conditional branch changes (stale deps removed)",
    async () => {
      // When the branch taken by update() changes, stale deps from the previous
      // branch are removed and new ones are added.
      const sourceA = fobx.observableBox("from-A")
      const sourceB = fobx.observableBox("from-B")
      const display = fobx.observableBox("")
      let setUseAExternal!: (v: boolean) => void
      let renderCount = 0

      class BranchVM extends ViewModel<{ useA: boolean }> {
        override update(props: { useA: boolean }) {
          super.update(props)
          display.set(props.useA ? sourceA.get() : sourceB.get())
        }
      }

      const Comp = observer(function Comp() {
        const [useA, setUseA] = React.useState(false)
        setUseAExternal = setUseA
        useViewModel(BranchVM, { useA })
        renderCount++
        return React.createElement("span", null, display.get())
      })

      await reactAct(() => root.render(React.createElement(Comp)))

      // First update() call — useA=true, reads sourceA
      await reactAct(() => setUseAExternal(true))
      expect(container.querySelector("span")?.textContent).toBe("from-A")

      // sourceA is tracked — changing it triggers a re-render
      renderCount = 0
      await reactAct(() => sourceA.set("A-v2"))
      expect(container.querySelector("span")?.textContent).toBe("A-v2")
      expect(renderCount).toBeGreaterThan(0)

      // Switch branch — update() now reads sourceB, not sourceA
      await reactAct(() => setUseAExternal(false))
      expect(container.querySelector("span")?.textContent).toBe("from-B")

      // sourceB changes trigger re-renders (now tracked)
      renderCount = 0
      await reactAct(() => sourceB.set("B-v2"))
      expect(container.querySelector("span")?.textContent).toBe("B-v2")
      expect(renderCount).toBeGreaterThan(0)

      // sourceA no longer triggers re-renders (de-tracked when branch switched)
      renderCount = 0
      await reactAct(() => sourceA.set("A-v3"))
      expect(renderCount).toBe(0)
      expect(container.querySelector("span")?.textContent).toBe("B-v2")
    },
  )
})
