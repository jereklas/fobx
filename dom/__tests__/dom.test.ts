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
  createScope,
  dispose,
  div,
  el,
  h1,
  input,
  li,
  mapArray,
  onCleanup,
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

Deno.test("dom: falsy class does not serialize to literal text", () => {
  const node = div({ class: false as unknown as string })
  assertEquals(node.getAttribute("class"), null)
  assertEquals(node.className, "")
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

Deno.test("dom: special setters clear nullish values", () => {
  const label = el("label", { htmlFor: "field-1", textContent: "Name" })
  assertEquals(label.getAttribute("for"), "field-1")
  assertEquals(label.textContent, "Name")

  label.textContent = "stale"
  label.innerHTML = "<span>stale</span>"

  const clearedLabel = el("label", {
    htmlFor: null,
    textContent: null,
    innerHTML: null,
  })

  assertEquals(clearedLabel.getAttribute("for"), null)
  assertEquals(clearedLabel.textContent, "")
  assertEquals(clearedLabel.innerHTML, "")

  const field = input({ value: null }) as HTMLInputElement
  assertEquals(field.value, "")
})

Deno.test("dom: namespaced prop attr and bool bindings", () => {
  const node = input({
    type: "checkbox",
    "prop:indeterminate": true,
    "attr:data-state": "ready",
    "bool:data-open": true,
  })

  assertEquals((node as HTMLInputElement).indeterminate, true)
  assertEquals(node.getAttribute("data-state"), "ready")
  assertEquals(node.getAttribute("data-open"), "")
})

Deno.test("dom: svg elements use the svg namespace", () => {
  const icon = el(
    "svg",
    { viewBox: "0 0 16 16" },
    el("use", { "attr:xlink:href": "#icon-check" }),
  )

  assertEquals(icon.namespaceURI, "http://www.w3.org/2000/svg")
  assertEquals(
    icon.firstElementChild?.namespaceURI,
    "http://www.w3.org/2000/svg",
  )
  assertEquals(
    icon.firstElementChild?.getAttribute("xlink:href"),
    "#icon-check",
  )
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

Deno.test("dom: tuple event handlers receive data before event", () => {
  const calls: unknown[] = []
  const node = button({
    onClick: [
      (id: string, event: Event) => {
        calls.push(id, event.type)
      },
      "todo-1",
    ],
  }, "Click me")

  node.dispatchEvent(new Event("click"))
  assertEquals(calls, ["todo-1", "click"])
})

Deno.test("dom: listener objects support once and abort signals", () => {
  let onceCalls = 0
  const onceNode = button({
    onClick: {
      once: true,
      handleEvent() {
        onceCalls++
      },
    },
  }, "Once")

  onceNode.dispatchEvent(new Event("click"))
  onceNode.dispatchEvent(new Event("click"))
  assertEquals(onceCalls, 1)

  let abortCalls = 0
  const controller = new AbortController()
  const abortNode = button({
    onClick: {
      signal: controller.signal,
      handleEvent() {
        abortCalls++
      },
    },
  }, "Abort")

  controller.abort()
  abortNode.dispatchEvent(new Event("click"))
  assertEquals(abortCalls, 0)
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

Deno.test("dom: ref callback sees appended children", () => {
  let childCount = -1
  let text = ""

  const node = div({
    ref: (el: HTMLElement) => {
      childCount = el.childNodes.length
      text = el.textContent ?? ""
    },
  }, span(null, "child"), " tail")

  assertEquals(childCount, 2)
  assertEquals(text, "child tail")
  assertEquals(node.childNodes.length, 2)
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

Deno.test("dom: class and classList merge without duplicates", () => {
  const active = observableBox(false)
  const node = div({
    class: "base",
    classList: () => ({
      base: true,
      active: active.get(),
    }),
  })

  assertEquals(node.className, "base")

  active.set(true)
  assertEquals(node.className, "base active")
})

Deno.test("dom: reactive style can switch between string and object modes", () => {
  const useObject = observableBox(false)
  const node = div({
    style: () =>
      useObject.get()
        ? { color: "blue", paddingTop: "4px" }
        : "color: red; margin-top: 8px;",
  })

  assertEquals(node.style.color, "red")
  assertEquals(node.style.marginTop, "8px")

  useObject.set(true)

  assertEquals(node.style.color, "blue")
  assertEquals(node.style.marginTop, "")
  assertEquals(node.style.paddingTop, "4px")
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

Deno.test("dom: createScope captures onCleanup and scoped disposers", () => {
  let cleanupCount = 0
  let outsideScopeTriggered = false

  assertEquals(
    onCleanup(() => {
      outsideScopeTriggered = true
    }),
    false,
  )
  assertEquals(outsideScopeTriggered, false)

  const [node, disposeScope] = createScope(() => {
    const scopedNode = div(null, "scoped")
    assertEquals(
      onCleanup(() => {
        cleanupCount += 1
      }),
      true,
    )
    onDispose(scopedNode, () => {
      cleanupCount += 10
    })
    return scopedNode
  })

  dispose(node)
  assertEquals(cleanupCount, 0)

  disposeScope()
  assertEquals(cleanupCount, 11)
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

Deno.test("dom: mountList preserves surrounding siblings and duplicate keys", () => {
  const first = { id: 1, label: "A" }
  const second = { id: 1, label: "B" }
  const items = observableArray([first, second])
  const container = div(null)

  container.appendChild(span({ class: "before" }, "before"))
  mountList(
    container,
    () => items,
    (item) => span({ class: "item" }, item.label),
    (item) => item.id,
  )
  container.appendChild(span({ class: "after" }, "after"))

  assertEquals(
    Array.from(container.querySelectorAll(".item")).map((node) =>
      node.textContent
    ),
    ["A", "B"],
  )
  assertEquals(container.querySelector(".before")?.textContent, "before")
  assertEquals(container.querySelector(".after")?.textContent, "after")

  items.splice(0, 2, second, first)

  assertEquals(
    Array.from(container.querySelectorAll(".item")).map((node) =>
      node.textContent
    ),
    ["B", "A"],
  )
  assertEquals(container.querySelector(".before")?.textContent, "before")
  assertEquals(container.querySelector(".after")?.textContent, "after")
})

Deno.test("dom: mountList refreshes index-derived content after reorder", () => {
  const first = { id: 1, label: "A" }
  const second = { id: 2, label: "B" }
  const items = observableArray([first, second])
  const container = ul(null)

  mountList(
    container,
    () => items,
    (item, index) => li(null, `${index}:${item.label}`),
    (item) => item.id,
  )

  assertEquals(
    Array.from(container.querySelectorAll("li")).map((node) => node.textContent),
    ["0:A", "1:B"],
  )

  items.splice(0, 2, second, first)

  assertEquals(
    Array.from(container.querySelectorAll("li")).map((node) => node.textContent),
    ["0:B", "1:A"],
  )
})

Deno.test("dom: mapArray updates nodes and disposes removed entries", () => {
  const first = { id: 1, label: observableBox("A") }
  const second = { id: 2, label: observableBox("B") }
  const items = observableArray([first, second])
  let cleanupCount = 0

  const mapped = mapArray(
    () => items,
    (item) => {
      const node = span(null, () => item.label.get())
      onDispose(node, () => {
        cleanupCount++
      })
      return node
    },
    (item) => item.id,
  )

  assertEquals(mapped.nodes.length, 2)
  assertEquals(mapped.nodes[0].textContent, "A")
  assertEquals(mapped.nodes[1].textContent, "B")

  first.label.set("A+")
  assertEquals(mapped.nodes[0].textContent, "A+")

  items.splice(0, 1)
  assertEquals(mapped.nodes.length, 1)
  assertEquals(mapped.nodes[0].textContent, "B")
  assertEquals(cleanupCount, 2)

  mapped.dispose()
  assertEquals(cleanupCount, 3)
  assertEquals(mapped.nodes.length, 0)
})

Deno.test("dom: mapArray refreshes index-derived content after reorder", () => {
  const first = { id: 1, label: "A" }
  const second = { id: 2, label: "B" }
  const items = observableArray([first, second])

  const mapped = mapArray(
    () => items,
    (item, index) => span(null, `${index}:${item.label}`),
    (item) => item.id,
  )

  assertEquals(mapped.nodes.map((node) => node.textContent), ["0:A", "1:B"])

  items.splice(0, 2, second, first)

  assertEquals(mapped.nodes.map((node) => node.textContent), ["0:B", "1:A"])

  mapped.dispose()
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
