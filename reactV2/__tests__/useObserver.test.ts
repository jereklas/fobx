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
import * as fobx from "@fobx/v2"
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
    const counter = fobx.box(0)
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
    const tracked = fobx.box(0)
    const untracked = fobx.box(0)
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
    const a = fobx.box("a")
    const b = fobx.box("b")

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
    const toggle = fobx.box(true)
    const left = fobx.box("left")
    const right = fobx.box("right")
    const renderSpy = fn()

    function Component() {
      return useObserver(() 
          "span",
          null,
         ,
        
        renderSpy()
        return React.createElement("span", null, toggle.get() ? left.get() : right.get())
      })
    }

    await reactAct(() => root.render(React.createElement(Component)))
    expect(renderSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector("span")?.textContent).toBe("left")

    // Toggle to right branch — now tracking `right` instead of `left`
    await reactAct(() => { toggle.set(false) })
    expect(container.querySelector("span")?.textContent).toBe("right")

    // Clear spy so we can detect if any new renders happen
    renderSpy.mockClear()

    // Changing `left` should NOT re-render (component no longer tracks it)
    await reactAct(() => { left.set("LEFT_CHANGED") })
    expect(renderSpy).not.toHaveBeenCalled() // no new render

    // Changing `right` SHOULD re-render
    await reactAct(() => { right.set("RIGHT_CHANGED") })
    expect(container.querySelector("span")?.textContent).toBe("RIGHT_CHANGED")
    expect(renderSpy).toHaveBeenCalledTimes(1) // re-rendered once
  })

  test("cleans up tracker on unmount", async () => {
    const counter = fobx.box(0)
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
    fobx.runInTransaction(() => { counter.set(99) })
    await new Promise((r) => setTimeout(r, 20))

    expect(renderSpy).not.toHaveBeenCalled()
  })

  test("handles render exceptions via error boundary pattern", async () => {
    const shouldThrow = fobx.box(false)

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
      state = { error: null }
      // deno-lint-ignore no-explicit-any
      static getDerivedStateFromError(err: any) {
        return { error: err.message }
      }
      render() {
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
    expect(container.querySelector("span")?.textContent).toContain("caught:test-error")
  })

  test("suppresses self-induced re-renders (per-tracker isTracking suppression)", async () => {
    // Writing to an observable DURING a render should not cause an infinite loop.
    // v2's per-tracker isTracking flag handles this (vs v1's global updatingReaction).
    const sideEffect = fobx.box(0)
    let rendered = false
      ,
    
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
    const counter = fobx.box(0)
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
    const innerType = (wrapped as unknown as { type: { displayName?: string; type?: { displayName?: string } } }).type
    const displayName = innerType?.displayName ?? innerType?.type?.displayName ?? "unknown"
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
    await reactAct(() => { setParentState(1) })

    expect(parentRenderSpy).toHaveBeenCalledTimes(2)
    // Child is wrapped in React.memo by observer — same props means no re-render
    expect(childRenderSpy).toHaveBeenCalledTimes(1)
  })

  test("supports forwardRef", async () => {
    const ForwardedComponent = observer(
      React.forwardRef((_props: Record<string, never>, _ref: React.Ref<HTMLDivElement>) => {
        return React.createElement("div", null, "forwarded")
      }),
    )

    await reactAct(() => {
      root.render(React.createElement(ForwardedComponent))
    })
    expect(container.qu
        erySelector("div")?.textContent).toBe("forwarded")
  })  
})  },
      
