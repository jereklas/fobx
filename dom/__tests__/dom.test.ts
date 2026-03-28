// deno-lint-ignore-file no-explicit-any
/**
 * Tests for @fobx/dom — the reactive DOM element library.
 */

import { assertEquals } from "@std/assert"
import { cleanupDOM, setupDOM } from "./setup.ts"
import { observableArray, observableBox, runInTransaction } from "@fobx/core"
import {
  a,
  button,
  dispose,
  div,
  el,
  h1,
  input,
  li,
  onDispose,
  p,
  span,
  ul,
} from "../index.ts"
import { mountList } from "../map-array.ts"

// ─── Setup ───────────────────────────────────────────────────────────────────

Deno.test({
  name: "dom: setup",
  fn() {
    setupDOM()
  },
  sanitizeOps: false,
  sanitizeResources: false,
})

// ─── Basic Element Creation ──────────────────────────────────────────────────

Deno.test("dom: el() creates a basic div", () => {
  const node = el("div", null, "Hello")
  assertEquals(node.tagName, "DIV")
  assertEquals(node.textContent, "Hello")
})

Deno.test("dom: div() factory creates a <div>", () => {
  const node = div(null, "Hello World")
  assertEquals(node.tagName, "DIV")
  assertEquals(node.textContent, "Hello World")
})

Deno.test("dom: nested elements", () => {
  const node = div(
    { class: "container" },
    h1(null, "Title"),
    p(null, "Paragraph"),
  )
  assertEquals(node.className, "container")
  assertEquals(node.children.length, 2)
  assertEquals(node.children[0].tagName, "H1")
  assertEquals(node.children[0].textContent, "Title")
  assertEquals(node.children[1].tagName, "P")
  assertEquals(node.children[1].textContent, "Paragraph")
})

Deno.test("dom: multiple text children", () => {
  const node = span(null, "Hello", " ", "World")
  assertEquals(node.textContent, "Hello World")
})

// ─── Attributes ──────────────────────────────────────────────────────────────

Deno.test("dom: static class attribute", () => {
  const node = div({ class: "foo bar" })
  assertEquals(node.className, "foo bar")
})

Deno.test("dom: static data attribute", () => {
  const node = div({ "data-id": "42" })
  assertEquals(node.getAttribute("data-id"), "42")
})

Deno.test("dom: static style string", () => {
  const node = div({ style: "color: red" })
  assertEquals(node.style.cssText.replace(/\s/g, ""), "color:red;")
})

Deno.test("dom: static style object", () => {
  const node = div({ style: { color: "red", fontSize: "16px" } })
  const css = node.style.cssText.replace(/\s/g, "")
  assertEquals(css.includes("color:red"), true)
  assertEquals(css.includes("font-size:16px"), true)
})

Deno.test("dom: boolean attribute true", () => {
  const node = input({ disabled: true })
  assertEquals(node.getAttribute("disabled"), "")
})

Deno.test("dom: boolean attribute false removes it", () => {
  const node = input({ disabled: false })
  assertEquals(node.getAttribute("disabled"), null)
})

Deno.test("dom: null attribute removes it", () => {
  const node = div({ "data-x": null })
  assertEquals(node.getAttribute("data-x"), null)
})

// ─── Event Handlers ──────────────────────────────────────────────────────────

Deno.test("dom: onClick event handler", () => {
  let clicked = false
  const node = button({
    onClick: () => {
      clicked = true
    },
  }, "Click me")
  node.dispatchEvent(new Event("click"))
  assertEquals(clicked, true)
})

Deno.test("dom: onInput event handler", () => {
  let fired = false
  const node = input({
    onInput: () => {
      fired = true
    },
  })
  node.dispatchEvent(new Event("input"))
  assertEquals(fired, true)
})

// ─── Ref ─────────────────────────────────────────────────────────────────────

Deno.test("dom: ref callback is called with element", () => {
  let refEl: HTMLElement | null = null
  const node = div({
    ref: (el: HTMLElement) => {
      refEl = el
    },
  }, "Hello")
  assertEquals(refEl, node)
})

// ─── Reactive Props ──────────────────────────────────────────────────────────

Deno.test("dom: reactive class attribute", () => {
  const active = observableBox(false)
  const node = div({ class: () => active.get() ? "active" : "inactive" })
  assertEquals(node.className, "inactive")

  active.set(true)
  assertEquals(node.className, "active")

  active.set(false)
  assertEquals(node.className, "inactive")
})

Deno.test("dom: reactive data attribute", () => {
  const count = observableBox(0)
  const node = div({ "data-count": () => String(count.get()) })
  assertEquals(node.getAttribute("data-count"), "0")

  count.set(5)
  assertEquals(node.getAttribute("data-count"), "5")
})

Deno.test("dom: reactive style string", () => {
  const color = observableBox("red")
  const node = div({ style: () => `color: ${color.get()}` })
  assertEquals(
    node.style.cssText.replace(/\s/g, "").includes("color:red"),
    true,
  )

  color.set("blue")
  assertEquals(
    node.style.cssText.replace(/\s/g, "").includes("color:blue"),
    true,
  )
})

Deno.test("dom: reactive style object", () => {
  const size = observableBox(16)
  const node = div({ style: () => ({ fontSize: `${size.get()}px` }) })
  assertEquals(
    node.style.cssText.replace(/\s/g, "").includes("font-size:16px"),
    true,
  )

  size.set(24)
  assertEquals(
    node.style.cssText.replace(/\s/g, "").includes("font-size:24px"),
    true,
  )
})

// ─── Reactive Children ───────────────────────────────────────────────────────

Deno.test("dom: reactive text child", () => {
  const name = observableBox("World")
  const node = div(null, "Hello ", () => name.get())
  assertEquals(node.textContent, "Hello World")

  name.set("fobx")
  assertEquals(node.textContent, "Hello fobx")
})

Deno.test("dom: reactive child returning element", () => {
  const showBold = observableBox(true)
  const node = div(
    null,
    () =>
      showBold.get() ? span({ class: "bold" }, "Bold!") : span(null, "Normal"),
  )
  assertEquals(node.querySelector(".bold")?.textContent, "Bold!")

  showBold.set(false)
  assertEquals(node.querySelector(".bold"), null)
  assertEquals(node.textContent?.includes("Normal"), true)
})

Deno.test("dom: reactive child returning array", () => {
  const items = observableBox(["a", "b", "c"])
  const node = ul(null, () => items.get().map((i) => li(null, i)))
  assertEquals(node.children.length, 3)
  assertEquals(node.children[0].textContent, "a")
  assertEquals(node.children[2].textContent, "c")

  items.set(["x", "y"])
  assertEquals(node.children.length, 2)
  assertEquals(node.children[0].textContent, "x")
  assertEquals(node.children[1].textContent, "y")
})

Deno.test("dom: reactive child returning null", () => {
  const show = observableBox(false)
  const node = div(null, () => show.get() ? span(null, "Visible") : null, "End")
  assertEquals(node.textContent, "End")

  show.set(true)
  assertEquals(node.textContent?.includes("Visible"), true)
})

Deno.test("dom: multiple reactive children", () => {
  const first = observableBox("A")
  const second = observableBox("B")
  const node = div(null, () => first.get(), " - ", () => second.get())
  assertEquals(node.textContent, "A - B")

  first.set("X")
  assertEquals(node.textContent, "X - B")

  second.set("Y")
  assertEquals(node.textContent, "X - Y")
})

// ─── Dispose ─────────────────────────────────────────────────────────────────

Deno.test("dom: dispose stops reactive updates", () => {
  const count = observableBox(0)
  const node = div(null, () => String(count.get()))
  assertEquals(node.textContent, "0")

  count.set(1)
  assertEquals(node.textContent, "1")

  dispose(node)

  count.set(2)
  // Should still be "1" because reactions are disposed
  assertEquals(node.textContent, "1")
})

Deno.test("dom: onDispose registers custom cleanup", () => {
  let cleaned = false
  const node = div(null, "test")
  onDispose(node, () => {
    cleaned = true
  })

  assertEquals(cleaned, false)
  dispose(node)
  assertEquals(cleaned, true)
})

// ─── Transaction Batching ────────────────────────────────────────────────────

Deno.test("dom: batch updates with runInTransaction", () => {
  const first = observableBox("A")
  const last = observableBox("B")
  let renderCount = 0

  const node = div(null, () => {
    renderCount++
    return `${first.get()} ${last.get()}`
  })

  assertEquals(node.textContent, "A B")
  assertEquals(renderCount, 1)

  runInTransaction(() => {
    first.set("X")
    last.set("Y")
  })

  assertEquals(node.textContent, "X Y")
  // Should have rendered only once more due to batching
  assertEquals(renderCount, 2)
})

// ─── mountList ───────────────────────────────────────────────────────────────

Deno.test("dom: mountList renders initial items", () => {
  const items = observableArray(["Apple", "Banana", "Cherry"])
  const container = ul(null)

  mountList(
    container,
    () => items,
    (item) => li(null, item),
  )

  // 2 comment markers + 3 li elements
  assertEquals(container.querySelectorAll("li").length, 3)
  assertEquals(container.querySelectorAll("li")[0].textContent, "Apple")
  assertEquals(container.querySelectorAll("li")[2].textContent, "Cherry")
})

Deno.test("dom: mountList reacts to push", () => {
  const items = observableArray(["Apple", "Banana"])
  const container = ul(null)

  mountList(
    container,
    () => items,
    (item) => li(null, item),
  )

  assertEquals(container.querySelectorAll("li").length, 2)

  items.push("Cherry")
  assertEquals(container.querySelectorAll("li").length, 3)
  assertEquals(container.querySelectorAll("li")[2].textContent, "Cherry")
})

Deno.test("dom: mountList reacts to splice/remove", () => {
  const items = observableArray(["A", "B", "C"])
  const container = ul(null)

  mountList(
    container,
    () => items,
    (item) => li(null, item),
  )

  assertEquals(container.querySelectorAll("li").length, 3)

  items.splice(1, 1) // Remove "B"
  assertEquals(container.querySelectorAll("li").length, 2)
  assertEquals(container.querySelectorAll("li")[0].textContent, "A")
  assertEquals(container.querySelectorAll("li")[1].textContent, "C")
})

// ─── Complex Scenarios ───────────────────────────────────────────────────────

Deno.test("dom: nested reactive elements", () => {
  const title = observableBox("Hello")
  const bodyText = observableBox("World")

  const node = div(
    { class: "card" },
    h1(null, () => title.get()),
    p(null, () => bodyText.get()),
  )

  assertEquals(node.querySelector("h1")?.textContent, "Hello")
  assertEquals(node.querySelector("p")?.textContent, "World")

  title.set("Goodbye")
  bodyText.set("fobx")

  assertEquals(node.querySelector("h1")?.textContent, "Goodbye")
  assertEquals(node.querySelector("p")?.textContent, "fobx")
})

Deno.test("dom: anchor element with reactive href", () => {
  const url = observableBox("https://example.com")
  const node = a({ href: () => url.get() }, "Link")
  assertEquals(node.getAttribute("href"), "https://example.com")

  url.set("https://fobx.dev")
  assertEquals(node.getAttribute("href"), "https://fobx.dev")
})

Deno.test("dom: input with reactive value", () => {
  const text = observableBox("initial")
  const node = input({ value: () => text.get() })

  assertEquals((node as any).value, "initial")

  text.set("updated")
  assertEquals((node as any).value, "updated")
})

Deno.test("dom: conditional class with multiple reactive props", () => {
  const visible = observableBox(true)
  const highlighted = observableBox(false)

  const node = div({
    class: () => {
      const classes = []
      if (visible.get()) classes.push("visible")
      if (highlighted.get()) classes.push("highlighted")
      return classes.join(" ")
    },
  })

  assertEquals(node.className, "visible")

  highlighted.set(true)
  assertEquals(node.className, "visible highlighted")

  visible.set(false)
  assertEquals(node.className, "highlighted")
})

Deno.test({
  name: "dom: cleanup",
  fn() {
    cleanupDOM()
  },
  sanitizeOps: false,
  sanitizeResources: false,
})
