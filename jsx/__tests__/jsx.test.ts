// deno-lint-ignore-file no-explicit-any
/**
 * Tests for @fobx/jsx — JSX rendering with fobx reactivity.
 */

import { assertEquals } from "@std/assert"
import { cleanupDOM, setupDOM } from "../../dom/__tests__/setup.ts"
import { array, box, runInTransaction } from "../../v2/index.ts"
import { Component, dispose, Fragment, h, render, unmount } from "../index.ts"

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
  const active = box(false)
  const node = h("div", { class: () => active.get() ? "active" : "" })
  assertEquals(node.className, "")

  active.set(true)
  assertEquals(node.className, "active")
})

// ─── h() — Reactive Children ────────────────────────────────────────────────

Deno.test("jsx: reactive text child via h()", () => {
  const name = box("World")
  const node = h("div", null, "Hello ", () => name.get())
  assertEquals(node.textContent, "Hello World")

  name.set("fobx")
  assertEquals(node.textContent, "Hello fobx")
})

Deno.test("jsx: reactive child toggling elements", () => {
  const showA = box(true)
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

// ─── Class Component ─────────────────────────────────────────────────────────

Deno.test("jsx: class component renders", () => {
  class MyComp extends Component<{ label: string }> {
    render() {
      return h("div", { class: "my-comp" }, this.props.label)
    }
  }

  const node = h(MyComp, { label: "test" })
  assertEquals(node.tagName, "DIV")
  assertEquals(node.className, "my-comp")
  assertEquals(node.textContent, "test")
})

Deno.test("jsx: class component ref receives instance", () => {
  let ref: any = null

  class MyComp extends Component {
    greeting() {
      return "hello"
    }
    render() {
      return h("div", null, "comp")
    }
  }

  h(MyComp, {
    ref: (inst: any) => {
      ref = inst
    },
  })
  assertEquals(ref?.greeting(), "hello")
})

Deno.test("jsx: class component with reactive children", () => {
  const count = box(0)

  class Counter extends Component {
    render() {
      return h(
        "div",
        null,
        h("span", { class: "count" }, () => String(count.get())),
        h("button", {
          onClick: () => count.set(count.get() + 1),
        }, "+"),
      )
    }
  }

  const node = h(Counter, null)
  assertEquals(node.querySelector(".count")?.textContent, "0")

  count.set(5)
  assertEquals(node.querySelector(".count")?.textContent, "5")
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
  const todos = box<string[]>(["Buy milk", "Write code"])
  const newTodo = box("")

  const TodoApp = () => {
    return h(
      "div",
      { class: "todo-app" },
      h("h1", null, "Todos"),
      h("ul", null, () =>
        todos.get().map((todo, i) =>
          h("li", { "data-index": String(i) }, todo)
        )),
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
  const count = box(0)
  const node = h("div", null, () => String(count.get()))
  assertEquals(node.textContent, "0")

  count.set(1)
  assertEquals(node.textContent, "1")

  dispose(node)
  count.set(99)
  assertEquals(node.textContent, "1") // Should not update
})

Deno.test("jsx: transaction batches reactive UI updates", () => {
  const a = box("A")
  const b = box("B")
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

cleanupDOM()
