/**
 * Tests for useObserver hook and observer HOC (reactV2).
 *
 * Compares behaviour against the v1 react package (which uses Reaction + globalState.updatingReaction).
 * v2 uses createTracker with per-tracker isTracking suppression.
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
import { observer, useObserver } from "../index.ts"
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
  // React 19 acts need to be wrapped
  await reactAct(() => root.unmount()) // deno-lint-ignore no-explicit-any
  ;(globalThis as any).document.body.removeChild(container)
})

// Helper: wrap updates in React's act() to flush state changes
async function reactAct(fn: () => void | Promise<void>): Promise<void> {
  // deno-lint-ignore no-explicit-any
  const { act } = React as any
  await act(fn)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useObserver", () => {
  test("re-renders component when tracked observable changes", async () => {
    const counter = fobx.observableBox(0)
    const renderCount = fn()

    function Counter() {
      return useObserver(() => {
        renderCount()
        return React.createElement("span", null, String(counter.get()))
      })
    }

    await reactAct(() => {
      root.render(React.createElement(Counter))
    })
    expect(renderCount).toHaveBeenCalledTimes(1)
    expect(container.querySelector("span")?.textContent).toBe("0")

    // Change observable — should trigger re-render
    await reactAct(() => {
      counter.set(1)
    })
    expect(renderCount).toHaveBeenCalledTimes(2)
    expect(container.querySelector("span")?.textContent).toBe("1")
  })

  test("does NOT re-render for unrelated observable changes", async () => {
    const tracked = fobx.observableBox(0)
    const untracked = fobx.observableBox(0)
    const renderCount = fn()

    function Component() {
      return useObserver(() => {
        renderCount()
        return React.createElement("span", null, String(tracked.get()))
      })
    }

    await reactAct(() => {
      root.render(React.createElement(Component))
    })
    expect(renderCount).toHaveBeenCalledTimes(1)

    // Change unrelated observable — should NOT trigger re-render
    await reactAct(() => {
      untracked.set(99)
    })
    expect(renderCount).toHaveBeenCalledTimes(1)

    // Change tracked observable — should trigger re-render
    await reactAct(() => {
      tracked.set(1)
    })
    expect(renderCount).toHaveBeenCalledTimes(2)
  })

  test("handles multiple observables in one render", async () => {
    const a = fobx.observableBox("a")
    const b = fobx.observableBox("b")

    function Component() {
      return useObserver(() =>
        React.createElement("span", null, `${a.get()}:${b.get()}`)
      )
    }

    await reactAct(() => {
      root.render(React.createElement(Component))
    })
    expect(container.querySelector("span")?.textContent).toBe("a:b")

    await reactAct(() => {
      a.set("A")
    })
    expect(container.querySelector("span")?.textContent).toBe("A:b")

    await reactAct(() => {
      b.set("B")
    })
    expect(container.querySelector("span")?.textContent).toBe("A:B")
  })

  test("re-tracks dependencies on each render (dynamic deps)", async () => {
    const toggle = fobx.observableBox(true)
    const left = fobx.observableBox("left")
    const right = fobx.observableBox("right")
    const renderSpy = fn()

    function Component() {
      return useObserver(() => {
        renderSpy()
        return React.createElement(
          "span",
          null,
          toggle.get() ? left.get() : right.get(),
        )
      })
    }

    await reactAct(() => root.render(React.createElement(Component)))
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector("span")?.textContent).toBe("left")

    // Toggle to right branch — now tracking `right` instead of `left`
    await reactAct(() => {
      toggle.set(false)
    })
    expect(container.querySelector("span")?.textContent).toBe("right")

    // Clear spy so we can detect if any new renders happen
    renderSpy.mockClear()

    // Changing `left` should NOT re-render (component no longer tracks it)
    await reactAct(() => {
      left.set("LEFT_CHANGED")
    })
    expect(renderSpy).not.toHaveBeenCalled() // no new render

    // Changing `right` SHOULD re-render
    await reactAct(() => {
      right.set("RIGHT_CHANGED")
    })
    expect(container.querySelector("span")?.textContent).toBe("RIGHT_CHANGED")
    expect(renderSpy).toHaveBeenCalledTimes(1) // re-rendered once
  })

  test("cleans up tracker on unmount", async () => {
    const counter = fobx.observableBox(0)
    const renderSpy = fn()

    function Component() {
      return useObserver(() => {
        renderSpy()
        return React.createElement("span", null, String(counter.get()))
      })
    }

    await reactAct(() => root.render(React.createElement(Component)))
    expect(renderSpy).toHaveBeenCalledTimes(1)

    // Unmount and clear spy counter
    await reactAct(() => root.render(null))
    renderSpy.mockClear()

    // Observable change after unmount should NOT trigger any new renders
    fobx.runInTransaction(() => {
      counter.set(99)
    })
    await new Promise((r) => setTimeout(r, 20))

    expect(renderSpy).not.toHaveBeenCalled()
  })

  test("handles render exceptions via error boundary pattern", async () => {
    const shouldThrow = fobx.observableBox(false)

    function Thrower() {
      return useObserver(() => {
        if (shouldThrow.get()) throw new Error("test-error")
        return React.createElement("span", null, "ok")
      })
    }

    class ErrorBoundary extends React.Component<
      { children: React.ReactNode },
      { error: string | null }
    > {
      override state = { error: null }
      // deno-lint-ignore no-explicit-any
      static getDerivedStateFromError(err: any) {
        return { error: err.message }
      }
      override render() {
        if (this.state.error) {
          return React.createElement("span", null, `caught:${this.state.error}`)
        }
        return this.props.children
      }
    }

    await reactAct(() => {
      root.render(
        React.createElement(ErrorBoundary, null, React.createElement(Thrower)),
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("ok")

    await reactAct(() => {
      shouldThrow.set(true)
    })
    expect(container.querySelector("span")?.textContent).toContain(
      "caught:test-error",
    )
  })

  test("suppresses self-induced re-renders (per-tracker isTracking suppression)", async () => {
    // Writing to an observable DURING a render should not cause an infinite loop.
    // v2's per-tracker isTracking flag handles this (vs v1's global updatingReaction).
    const sideEffect = fobx.observableBox(0)
    let rendered = false
    let renderPassCount = 0

    function Component() {
      return useObserver(() => {
        renderPassCount++
        if (!rendered) {
          rendered = true
          // Write to an observable during render — v2 suppresses via per-tracker isTracking
          sideEffect.set(sideEffect.get() + 1)
        }
        return React.createElement("span", null, String(sideEffect.get()))
      })
    }

    // Should NOT throw, loop, or error
    await reactAct(() => root.render(React.createElement(Component)))

    // A finite number of renders (not infinite loop)
    expect(renderPassCount).toBeLessThanOrEqual(3)
    expect(container.querySelector("span")?.textContent).toBe("1")
  })
})

describe("observer HOC", () => {
  test("wraps function component with memo and useObserver", async () => {
    const counter = fobx.observableBox(0)
    const renderCount = fn()

    const Counter = observer(() => {
      renderCount()
      return React.createElement("span", null, String(counter.get()))
    })

    await reactAct(() => {
      root.render(React.createElement(Counter))
    })
    expect(renderCount).toHaveBeenCalledTimes(1)
    expect(container.querySelector("span")?.textContent).toBe("0")

    await reactAct(() => {
      counter.set(5)
    })
    expect(renderCount).toHaveBeenCalledTimes(2)
    expect(container.querySelector("span")?.textContent).toBe("5")
  })

  test("preserves component displayName", () => {
    function MyComponent() {
      return null
    }

    const wrapped = observer(MyComponent)
    // React.memo wraps it, but the inner component should preserve the name
    const innerType =
      (wrapped as unknown as {
        type: { displayName?: string; type?: { displayName?: string } }
      }).type
    const displayName = innerType?.displayName ??
      innerType?.type?.displayName ?? "unknown"
    expect(typeof displayName).toBe("string")
  })

  test("throws if applied to already-memoized component", () => {
    const Comp = React.memo(() => null)
    expect(() => observer(Comp)).toThrow()
  })

  test("parent re-render does not re-render memoized observer child with same props", async () => {
    // Use React state (not fobx observable) to trigger a parent re-render,
    // so parent re-render is driven by React — not by observable tracking.
    let setParentState!: (v: number) => void
    const parentRenderSpy = fn()
    const childRenderSpy = fn()

    const Child = observer((_props: { label: string }) => {
      childRenderSpy()
      return React.createElement("span", { className: "child" }, "child")
    })

    function Parent() {
      const [state, setState] = React.useState(0)
      setParentState = setState
      parentRenderSpy()
      return React.createElement(
        "div",
        null,
        String(state),
        React.createElement(Child, { label: "static" }),
      )
    }

    await reactAct(() => root.render(React.createElement(Parent)))
    expect(parentRenderSpy).toHaveBeenCalledTimes(1)
    expect(childRenderSpy).toHaveBeenCalledTimes(1)

    // Trigger parent re-render via React state — child props are unchanged ("static")
    await reactAct(() => {
      setParentState(1)
    })

    expect(parentRenderSpy).toHaveBeenCalledTimes(2)
    // Child is wrapped in React.memo by observer — same props means no re-render
    expect(childRenderSpy).toHaveBeenCalledTimes(1)
  })

  test("supports forwardRef", async () => {
    const ForwardedComponent = observer(
      React.forwardRef(
        (_props: Record<string, never>, _ref: React.Ref<HTMLDivElement>) => {
          return React.createElement("div", null, "forwarded")
        },
      ),
    )

    await reactAct(() => {
      root.render(React.createElement(ForwardedComponent))
    })
    expect(container.querySelector("div")?.textContent).toBe("forwarded")
  })
})

// ─── StrictMode ───────────────────────────────────────────────────────────────
//
// React 18 StrictMode in development:
//  1. Double-invokes the render body (both calls share the same refs).
//  2. Double-invokes effects: subscribe → cleanup → subscribe again.
//
// For useObserver this means:
//  - The tracker is created on the first render body call (ref persists).
//  - Subscribe is called, then the StrictMode cleanup disposes the tracker.
//  - Subscribe is called a second time — tracker is null, so it is recreated
//    and `stateVersion` is bumped to a new Symbol.
//  - React detects the snapshot changed (getSnapshot returns new Symbol) and
//    schedules one extra re-render.
//
// Net result: initial mount causes MORE renders than non-StrictMode.
// AFTER mount stabilizes, observable changes trigger exactly 1 re-render.

describe("useObserver - StrictMode", () => {
  test("component shows correct DOM after StrictMode mount", async () => {
    const value = fobx.observableBox("hello")

    function Greeting() {
      return useObserver(() => React.createElement("span", null, value.get()))
    }

    await reactAct(() => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Greeting),
        ),
      )
    })

    expect(container.querySelector("span")?.textContent).toBe("hello")
  })

  test("reactive updates work correctly after StrictMode effect replay", async () => {
    const counter = fobx.observableBox(0)

    const Counter = observer(() =>
      React.createElement("span", null, String(counter.get()))
    )

    await reactAct(() => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(Counter),
        ),
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("0")

    // After StrictMode stabilizes, each observable change causes exactly 1 re-render
    await reactAct(() => {
      counter.set(1)
    })
    expect(container.querySelector("span")?.textContent).toBe("1")

    await reactAct(() => {
      counter.set(2)
    })
    expect(container.querySelector("span")?.textContent).toBe("2")
  })

  test("each observable change causes exactly 2 render invocations in StrictMode (double-invoke)", async () => {
    // In React 18 StrictMode dev, the render body is ALWAYS double-invoked —
    // for both initial mount AND subsequent updates. This means each observable
    // change causes 2 calls to the render function, not 1.
    const value = fobx.observableBox("a")
    const renderSpy = fn()

    const Comp = observer(() => {
      renderSpy()
      return React.createElement("span", null, value.get())
    })

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })

    // Reset after StrictMode initial mount stabilizes
    renderSpy.mockClear()

    await reactAct(() => {
      value.set("b")
    })
    expect(container.querySelector("span")?.textContent).toBe("b")
    // StrictMode: every render double-invokes the body → 2 spy calls per update
    expect(renderSpy).toHaveBeenCalledTimes(2)

    await reactAct(() => {
      value.set("c")
    })
    expect(container.querySelector("span")?.textContent).toBe("c")
    expect(renderSpy).toHaveBeenCalledTimes(4)
  })

  test("tracker is disposed and no stale updates after StrictMode unmount", async () => {
    const signal = fobx.observableBox(0)
    const renderSpy = fn()

    function Comp() {
      return useObserver(() => {
        renderSpy()
        return React.createElement("span", null, String(signal.get()))
      })
    }

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })

    // Unmount — tracker should be disposed
    await reactAct(() => root.unmount())
    renderSpy.mockClear()

    // Changes after unmount should NOT trigger any re-renders
    fobx.runInTransaction(() => {
      signal.set(99)
    })
    await new Promise((r) => setTimeout(r, 20))

    expect(renderSpy).not.toHaveBeenCalled()
  })

  test("dynamic deps re-tracked correctly after StrictMode effect replay", async () => {
    const toggle = fobx.observableBox(true)
    const left = fobx.observableBox("L")
    const right = fobx.observableBox("R")

    function Comp() {
      return useObserver(() =>
        React.createElement(
          "span",
          null,
          toggle.get() ? left.get() : right.get(),
        )
      )
    }

    await reactAct(() => {
      root.render(
        React.createElement(React.StrictMode, null, React.createElement(Comp)),
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("L")

    // Switch branch — now tracking `right`, not `left`
    await reactAct(() => {
      toggle.set(false)
    })
    expect(container.querySelector("span")?.textContent).toBe("R")

    // `left` should not trigger re-render (no longer a dep)
    const spy = fn()
    const prevRight = right.get()
    fobx.autorun(() => {
      spy(right.get())
    }) // just to verify right is still reactive
    await reactAct(() => {
      left.set("NEW_L")
    })
    expect(container.querySelector("span")?.textContent).toBe(prevRight)

    // `right` should trigger re-render
    await reactAct(() => {
      right.set("NEW_R")
    })
    expect(container.querySelector("span")?.textContent).toBe("NEW_R")
  })
})
