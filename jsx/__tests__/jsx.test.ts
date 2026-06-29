// deno-lint-ignore-file no-explicit-any
/**
 * Tests for @fobx/jsx — JSX rendering with fobx reactivity.
 */

import { assertEquals } from "@std/assert"
import { cleanupDOM, setupDOM } from "../../dom/__tests__/setup.ts"
import { observableArray, observableBox, runInTransaction } from "@fobx/core"
import {
  dispose,
  For,
  Fragment,
  h,
  onCleanup,
  onDispose,
  onMount,
  render,
  unmount,
} from "../index.ts"

// ─── Setup ───────────────────────────────────────────────────────────────────

setupDOM()

// ─── h() — Basic Elements ───────────────────────────────────────────────────

Deno.test("jsx: h() creates a basic div", () => {
  const node = h("div", null, "Hello")
  assertEquals(node.tagName, "DIV")
  assertEquals(node.textContent, "Hello")
})

Deno.test("jsx: h() with props", () => {
  const node = h("div", { class: "container", id: "app" }, "Content")
  assertEquals(node.className, "container")
  assertEquals(node.id, "app")
  assertEquals(node.textContent, "Content")
})

Deno.test("jsx: h() nested elements", () => {
  const node = h("div", null, h("h1", null, "Title"), h("p", null, "Body"))
  assertEquals(node.children.length, 2)
  assertEquals(node.children[0].tagName, "H1")
  assertEquals(node.children[1].tagName, "P")
})

// ─── h() — Functional Components ────────────────────────────────────────────

Deno.test("jsx: functional component", () => {
  const Greeting = (props: { name: string }) => {
    return h("span", null, `Hello, ${props.name}!`)
  }

  const node = h(Greeting, { name: "World" })
  assertEquals(node.tagName, "SPAN")
  assertEquals(node.textContent, "Hello, World!")
})

Deno.test("jsx: functional component with children", () => {
  const Card = (props: { children?: any }) => {
    return h(
      "div",
      { class: "card" },
      ...(Array.isArray(props.children) ? props.children : [props.children]),
    )
  }

  const node = h(Card, null, h("h2", null, "Title"), h("p", null, "Content"))
  assertEquals(node.className, "card")
  assertEquals(node.children.length, 2)
})

Deno.test("jsx: nested functional components", () => {
  const Inner = (props: { text: string }) => h("em", null, props.text)
  const Outer = (props: { label: string }) =>
    h("div", null, h("strong", null, props.label), h(Inner, { text: "inner" }))

  const node = h(Outer, { label: "outer" })
  assertEquals(node.querySelector("strong")?.textContent, "outer")
  assertEquals(node.querySelector("em")?.textContent, "inner")
})

// ─── h() — Reactive Props ───────────────────────────────────────────────────

Deno.test("jsx: reactive class prop via h()", () => {
  const active = observableBox(false)
  const node = h("div", { class: () => active.get() ? "active" : "" })
  assertEquals(node.className, "")

  active.set(true)
  assertEquals(node.className, "active")
})

// ─── h() — Reactive Children ────────────────────────────────────────────────

Deno.test("jsx: reactive text child via h()", () => {
  const name = observableBox("World")
  const node = h("div", null, "Hello ", () => name.get())
  assertEquals(node.textContent, "Hello World")

  name.set("fobx")
  assertEquals(node.textContent, "Hello fobx")
})

Deno.test("jsx: reactive child toggling elements", () => {
  const showA = observableBox(true)
  const node = h(
    "div",
    null,
    () =>
      showA.get()
        ? h("span", { class: "a" }, "A")
        : h("span", { class: "b" }, "B"),
  )

  assertEquals(node.querySelector(".a")?.textContent, "A")
  assertEquals(node.querySelector(".b"), null)

  showA.set(false)
  assertEquals(node.querySelector(".a"), null)
  assertEquals(node.querySelector(".b")?.textContent, "B")
})

// ─── Fragment ────────────────────────────────────────────────────────────────

Deno.test("jsx: Fragment returns children without wrapper", () => {
  const frag = h(Fragment, null, h("span", null, "A"), h("span", null, "B"))
  // Fragment produces a DocumentFragment
  assertEquals(frag instanceof DocumentFragment, true)
  assertEquals(frag.childNodes.length, 2)
})

Deno.test("jsx: dispose() cleans up mounted fragment bindings", () => {
  const count = observableBox(0)
  const fragment = h(
    Fragment,
    null,
    h("span", { class: "value" }, () => String(count.get())),
  )
  const container = h("div", null) as HTMLElement

  render(fragment, container)
  assertEquals(container.textContent, "0")

  count.set(1)
  assertEquals(container.textContent, "1")

  dispose(fragment)
  count.set(2)
  assertEquals(container.textContent, "1")
})

// ─── Function Lifecycle ─────────────────────────────────────────────────────

Deno.test("jsx: functional component with reactive children", () => {
  const count = observableBox(0)

  const Counter = () => {
    return h(
      "div",
      null,
      h("span", { class: "count" }, () => String(count.get())),
      h("button", {
        onClick: () => count.set(count.get() + 1),
      }, "+"),
    )
  }

  const node = h(Counter, null) as HTMLElement
  assertEquals(node.querySelector(".count")?.textContent, "0")

  count.set(5)
  assertEquals(node.querySelector(".count")?.textContent, "5")
})

Deno.test("jsx: onMount runs after initial render", async () => {
  const lifecycle: string[] = []

  const Widget = (props: { label: string }) => {
    lifecycle.push(`render:${props.label}`)
    onMount(() => {
      lifecycle.push("mounted")
    })
    return h("div", null, props.label)
  }

  const container = h("div", null) as HTMLElement
  render(h(Widget, { label: "A" }), container)

  assertEquals(lifecycle, ["render:A"])

  await Promise.resolve()
  assertEquals(lifecycle, ["render:A", "mounted"])
})

Deno.test("jsx: onMount waits until a component is actually rendered", async () => {
  const lifecycle: string[] = []

  const Widget = () => {
    lifecycle.push("render")
    onMount(() => {
      lifecycle.push("mounted")
    })
    return h("div", null, "Widget")
  }

  const detached = h(Widget, null)

  await Promise.resolve()
  assertEquals(lifecycle, ["render"])

  const container = h("div", null) as HTMLElement
  render(detached, container)

  await Promise.resolve()
  assertEquals(lifecycle, ["render", "mounted"])
})

Deno.test("jsx: onCleanup runs when a functional component is disposed", async () => {
  let cleanupCount = 0
  const count = observableBox(0)

  const Pair = () => {
    onCleanup(() => {
      cleanupCount += 1
    })

    return h(
      Fragment,
      null,
      h("span", { class: "left" }, () => String(count.get())),
      h("span", { class: "right" }, "!"),
    )
  }

  const pair = h(Pair, null)
  const container = h("div", null) as HTMLElement
  render(pair, container)

  await Promise.resolve()
  assertEquals(container.textContent, "0!")

  count.set(1)
  assertEquals(container.textContent, "1!")

  dispose(pair)
  assertEquals(cleanupCount, 1)

  count.set(2)
  assertEquals(container.textContent, "1!")
})

Deno.test("jsx: onCleanup callbacks run in reverse registration order", () => {
  const cleanupOrder: string[] = []

  const Widget = () => {
    onCleanup(() => {
      cleanupOrder.push("first")
    })
    onCleanup(() => {
      cleanupOrder.push("second")
    })
    return h("div", null, "Widget")
  }

  const node = h(Widget, null)
  dispose(node)

  assertEquals(cleanupOrder, ["second", "first"])
})

Deno.test("jsx: lifecycle hooks work for components inserted by reactive children", async () => {
  const lifecycle: string[] = []
  const showChild = observableBox(false)

  const Child = () => {
    lifecycle.push("render")
    onMount(() => {
      lifecycle.push("mount")
    })
    onCleanup(() => {
      lifecycle.push("cleanup")
    })
    return h("span", { class: "child" }, "Child")
  }

  const App = () => h("div", null, () => showChild.get() ? h(Child, null) : null)

  const container = h("div", null) as HTMLElement
  render(h(App, null), container)

  await Promise.resolve()
  assertEquals(lifecycle, [])
  assertEquals(container.textContent, "")

  showChild.set(true)
  assertEquals(container.textContent, "Child")

  await Promise.resolve()
  assertEquals(lifecycle, ["render", "mount"])

  showChild.set(false)
  assertEquals(container.textContent, "")
  assertEquals(lifecycle, ["render", "mount", "cleanup"])
})

// ─── render() ────────────────────────────────────────────────────────────────

Deno.test("jsx: render() mounts into container", () => {
  const container = h("div", null) as HTMLElement
  render(h("span", null, "Hello"), container)
  assertEquals(container.children[0].tagName, "SPAN")
  assertEquals(container.textContent, "Hello")
})

Deno.test("jsx: render() clears previous content", () => {
  const container = h("div", null) as HTMLElement
  render(h("span", null, "First"), container)
  assertEquals(container.textContent, "First")

  render(h("span", null, "Second"), container)
  assertEquals(container.textContent, "Second")
  assertEquals(container.children.length, 1)
})

Deno.test("jsx: render() with clear=false appends", () => {
  const container = h("div", null) as HTMLElement
  render(h("span", null, "A"), container)
  render(h("span", null, "B"), container, { clear: false })
  assertEquals(container.children.length, 2)
})

// ─── unmount ─────────────────────────────────────────────────────────────────

Deno.test("jsx: unmount() removes all children", () => {
  const container = h("div", null) as HTMLElement
  render(
    h("div", null, h("span", null, "A"), h("span", null, "B")),
    container,
  )
  assertEquals(container.children.length, 1)

  unmount(container)
  assertEquals(container.children.length, 0)
})

// ─── JSX Runtime ─────────────────────────────────────────────────────────────

Deno.test("jsx: jsx-runtime createNode", async () => {
  const { jsx, jsxs, Fragment: F } = await import("../jsx-runtime.ts")

  // Simple element
  const node = jsx("div", { class: "test", children: "Hello" })
  assertEquals(node.tagName, "DIV")
  assertEquals(node.className, "test")
  assertEquals(node.textContent, "Hello")

  // Multiple children (jsxs)
  const node2 = jsxs("div", {
    children: [
      jsx("span", { children: "A" }),
      jsx("span", { children: "B" }),
    ],
  })
  assertEquals(node2.children.length, 2)

  // Fragment
  const frag = jsx(F, { children: jsx("span", { children: "X" }) })
  assertEquals(frag instanceof DocumentFragment, true)
})

// ─── Complex Integration ─────────────────────────────────────────────────────

Deno.test("jsx: full reactive app scenario", () => {
  const todos = observableBox<string[]>(["Buy milk", "Write code"])
  const newTodo = observableBox("")

  const TodoApp = () => {
    return h(
      "div",
      { class: "todo-app" },
      h("h1", null, "Todos"),
      h(
        "ul",
        null,
        () =>
          todos.get().map((todo, i) =>
            h("li", { "data-index": String(i) }, todo)
          ),
      ),
      h(
        "div",
        { class: "input-row" },
        h("input", {
          value: () => newTodo.get(),
          onInput: (e: any) => newTodo.set(e.target?.value ?? ""),
        }),
        h("button", {
          onClick: () => {
            const val = newTodo.get()
            if (val) {
              todos.set([...todos.get(), val])
              newTodo.set("")
            }
          },
        }, "Add"),
      ),
    )
  }

  const container = h("div", null) as HTMLElement
  render(h(TodoApp, null), container)

  const app = container.querySelector(".todo-app")!
  assertEquals(app.querySelectorAll("li").length, 2)
  assertEquals(app.querySelectorAll("li")[0].textContent, "Buy milk")

  // Add a todo
  todos.set([...todos.get(), "Test reactivity"])
  assertEquals(app.querySelectorAll("li").length, 3)
  assertEquals(app.querySelectorAll("li")[2].textContent, "Test reactivity")
})

Deno.test("jsx: dispose cleans up reactive bindings", () => {
  const count = observableBox(0)
  const node = h("div", null, () => String(count.get()))
  assertEquals(node.textContent, "0")

  count.set(1)
  assertEquals(node.textContent, "1")

  dispose(node)
  count.set(99)
  assertEquals(node.textContent, "1") // Should not update
})

Deno.test("jsx: transaction batches reactive UI updates", () => {
  const a = observableBox("A")
  const b = observableBox("B")
  let renders = 0

  const node = h("div", null, () => {
    renders++
    return `${a.get()}-${b.get()}`
  })

  assertEquals(node.textContent, "A-B")
  assertEquals(renders, 1)

  runInTransaction(() => {
    a.set("X")
    b.set("Y")
  })

  assertEquals(node.textContent, "X-Y")
  assertEquals(renders, 2) // Only one re-render for both changes
})

Deno.test("jsx: For is wrapper-free and supports direct iterables", () => {
  const items = observableArray(["A", "B"])
  const list = h(
    "ul",
    null,
    h(
      For,
      { each: items },
      (item: string, index: () => number) =>
        h("li", { "data-index": () => String(index()) }, item),
    ),
  ) as HTMLElement

  assertEquals(list.children.length, 2)
  assertEquals(
    Array.from(list.children).every((child) => child.tagName === "LI"),
    true,
  )
  assertEquals(list.querySelectorAll("div").length, 0)

  items.splice(0, 2, "B", "A")

  assertEquals(
    Array.from(list.querySelectorAll("li")).map((node) => node.textContent),
    ["B", "A"],
  )
  assertEquals(list.querySelectorAll("li")[0].getAttribute("data-index"), "0")
  assertEquals(list.querySelectorAll("li")[1].getAttribute("data-index"), "1")
})

Deno.test("jsx: For fallback bindings are disposed on unmount", () => {
  const fallbackText = observableBox("Empty")
  let cleanupCount = 0

  const fallbackNode = h("span", null, () => fallbackText.get())
  onDispose(fallbackNode, () => {
    cleanupCount++
  })

  const container = h("div", null) as HTMLElement
  render(
    h(
      "ul",
      null,
      h(
        For,
        { each: [] as string[], fallback: fallbackNode },
        (item: string) => h("li", null, item),
      ),
    ),
    container,
  )

  assertEquals(container.textContent, "Empty")

  unmount(container)
  assertEquals(cleanupCount, 1)

  fallbackText.set("Changed")
  assertEquals(cleanupCount, 1)
})

Deno.test("jsx: For disposes hidden fallback bindings and recreates them when shown again", () => {
  const items = observableArray<string>([])
  const fallbackText = observableBox("Empty")
  let cleanupCount = 0

  const container = h(
    "div",
    null,
    h(
      For,
      {
        each: items,
        fallback: h("span", null, () => fallbackText.get()),
      },
      (item: string) => h("span", { class: "item" }, item),
    ),
  ) as HTMLElement

  const initialFallback = container.querySelector("span")
  onDispose(initialFallback!, () => {
    cleanupCount++
  })

  assertEquals(container.textContent, "Empty")

  items.push("x")
  assertEquals(container.textContent, "x")
  assertEquals(cleanupCount, 1)

  fallbackText.set("Hidden update")
  assertEquals(container.textContent, "x")

  items.splice(0, 1)
  assertEquals(container.textContent, "Hidden update")
  assertEquals(cleanupCount, 1)
  assertEquals(container.querySelector("span.item"), null)
})

Deno.test("jsx: lifecycle hooks work for nested functional components", async () => {
  const lifecycle: string[] = []

  const Child = (props: { label: string }) => {
    lifecycle.push(`render:${props.label}`)
    onMount(() => {
      lifecycle.push(`mount:${props.label}`)
    })
    onCleanup(() => {
      lifecycle.push(`cleanup:${props.label}`)
    })
    return h("div", null, props.label)
  }

  const Parent = () => h(Fragment, null, h(Child, { label: "A" }), h(Child, { label: "B" }))

  const container = h("div", null) as HTMLElement
  render(h(Parent, null), container)

  assertEquals(lifecycle, ["render:A", "render:B"])

  await Promise.resolve()
  assertEquals(lifecycle, [
    "render:A",
    "render:B",
    "mount:A",
    "mount:B",
  ])

  unmount(container)
  assertEquals(lifecycle, [
    "render:A",
    "render:B",
    "mount:A",
    "mount:B",
    "cleanup:A",
    "cleanup:B",
  ])
})

cleanupDOM()
