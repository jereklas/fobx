// ─── @fobx/dom playground tab ────────────────────────────────────────────────
//
// Demonstrates the vanillaJS reactive DOM library:
// 1. Element factories (div, span, button, input, etc.)
// 2. Reactive attributes and children
// 3. mountList for reactive lists
// 4. createSelector for O(1) selection
// 5. Disposal / cleanup

import {
  a,
  button,
  dispose,
  div,
  h1,
  h2,
  h3,
  input,
  label,
  li,
  p,
  span,
  ul,
} from "../../dom/index.ts"
import { mountList } from "../../dom/map-array.ts"
import {
  array,
  autorun,
  box,
  computed,
  createSelector,
  runInTransaction,
} from "../../v2/index.ts"

const container = document.getElementById("tab-dom")!

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Counter
// ═══════════════════════════════════════════════════════════════════════════════

const count = box(0)
const doubled = computed(() => count.get() * 2)
const parity = computed(() => (count.get() % 2 === 0 ? "even" : "odd"))

const counterCard = div(
  { class: "card" },
  h2(null, "Counter"),
  div(
    { class: "counter-row" },
    button({ onClick: () => count.set(count.get() - 1) }, "−"),
    div({ class: "counter-value" }, () => String(count.get())),
    button({ onClick: () => count.set(count.get() + 1) }, "+"),
  ),
  p(
    { style: "font-size:13px;color:#666;margin-top:4px" },
    () => `double: ${doubled.get()} · ${parity.get()}`,
  ),
  button({ onClick: () => count.set(0), style: "margin-top:8px" }, "Reset"),
)

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Reactive Text Input
// ═══════════════════════════════════════════════════════════════════════════════

const text = box("Hello fobx")
const textLength = computed(() => text.get().length)
const reversed = computed(() => text.get().split("").reverse().join(""))

const textCard = div(
  { class: "card" },
  h2(null, "Reactive Text"),
  input({
    type: "text",
    value: () => text.get(),
    onInput: (e: Event) => text.set((e.target as HTMLInputElement).value),
    style: "width:300px",
  }),
  p(
    { style: "font-size:13px;color:#666;margin-top:8px" },
    () => `Length: ${textLength.get()} · Reversed: "${reversed.get()}"`,
  ),
)

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Todo List with mountList
// ═══════════════════════════════════════════════════════════════════════════════

interface TodoItem {
  id: number
  text: string
  done: boolean
}

const todos = array<TodoItem>([])
let nextTodoId = 1
const todoInput = box("")
const remaining = computed(
  () => todos.filter((t) => !t.done).length,
)

function addTodo() {
  const t = todoInput.get().trim()
  if (!t) return
  todos.push({ id: nextTodoId++, text: t, done: false })
  todoInput.set("")
}

function toggleTodo(id: number) {
  const t = todos.find((x) => x.id === id)
  if (t) {
    t.done = !t.done
    const idx = todos.findIndex((x) => x.id === id)
    if (idx >= 0) todos.splice(idx, 1, todos[idx])
  }
}

function removeTodo(id: number) {
  const idx = todos.findIndex((x) => x.id === id)
  if (idx >= 0) todos.splice(idx, 1)
}

const todoList = div({ class: "card" })
todoList.append(h2(null, "Todo List (mountList)"))

const todoForm = div(
  { style: "display:flex;gap:8px;margin-bottom:12px" },
  (() => {
    const inp = input({
      type: "text",
      placeholder: "Add a todo...",
      value: () => todoInput.get(),
      onInput: (e: Event) =>
        todoInput.set((e.target as HTMLInputElement).value),
    })
    inp.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") addTodo()
    })
    return inp
  })(),
  button({ class: "btn-primary", onClick: () => addTodo() }, "Add"),
  button(
    {
      onClick: () => {
        runInTransaction(() => {
          for (let i = todos.length - 1; i >= 0; i--) {
            if (todos[i].done) todos.splice(i, 1)
          }
        })
      },
    },
    "Clear Done",
  ),
)
todoList.append(todoForm)

const todoStats = p(
  { style: "font-size:13px;color:#666;margin-bottom:8px" },
  () => `${remaining.get()} remaining / ${todos.length} total`,
)
todoList.append(todoStats)

const todoContainer = div(null)
todoList.append(todoContainer)

mountList(
  todoContainer,
  () => todos,
  (todo) => {
    return div(
      {
        class: () => `todo-item${todo.done ? " done" : ""}`,
        style:
          "display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee",
      },
      (() => {
        const cb = input({ type: "checkbox" }) as HTMLInputElement
        cb.checked = todo.done
        cb.addEventListener("change", () => toggleTodo(todo.id))
        return cb
      })(),
      span({ style: "flex:1" }, todo.text),
      button(
        { class: "btn-danger", onClick: () => removeTodo(todo.id) },
        "✕",
      ),
    )
  },
  (t) => t.id,
)

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Selection Demo (createSelector)
// ═══════════════════════════════════════════════════════════════════════════════

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]
const selectedItem = box("")
const isSelected = createSelector(() => selectedItem.get())

const selectionCard = div(
  { class: "card" },
  h2(null, "Selection (createSelector — O(1))"),
  p(
    { style: "font-size:13px;color:#666;margin-bottom:8px" },
    () =>
      selectedItem.get()
        ? `Selected: ${selectedItem.get()}`
        : "Click an item to select it",
  ),
  ...items.map((item) =>
    div(
      {
        style: () =>
          `padding:8px 12px;margin:2px 0;border-radius:4px;cursor:pointer;transition:all 0.1s;${
            isSelected(item)
              ? "background:#4cc9f0;color:#fff;font-weight:600"
              : "background:#f8f8f8"
          }`,
        onClick: () =>
          selectedItem.set(
            selectedItem.get() === item ? "" : item,
          ),
      },
      item,
    )
  ),
)

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Batch / Transaction Demo
// ═══════════════════════════════════════════════════════════════════════════════

const batchA = box(0)
const batchB = box(0)
const batchSum = computed(() => batchA.get() + batchB.get())
let batchRunCount = 0
const batchRenderCount = box(0)

// Track how many times the sum is observed changing
autorun(() => {
  batchSum.get()
  batchRunCount++
  batchRenderCount.set(batchRunCount)
})

const batchCard = div(
  { class: "card" },
  h2(null, "Transaction Batching"),
  p(
    { style: "font-size:13px;color:#666;margin-bottom:8px" },
    "Without transaction: 2 notifications. With transaction: 1 notification.",
  ),
  p(
    null,
    () =>
      `A=${batchA.get()} B=${batchB.get()} Sum=${batchSum.get()} · Autorun ran ${batchRenderCount.get()}x`,
  ),
  div(
    { style: "display:flex;gap:8px;margin-top:8px" },
    button(
      {
        onClick: () => {
          batchA.set(batchA.get() + 1)
          batchB.set(batchB.get() + 1)
        },
      },
      "Increment Both (no batch)",
    ),
    button(
      {
        class: "btn-primary",
        onClick: () => {
          runInTransaction(() => {
            batchA.set(batchA.get() + 1)
            batchB.set(batchB.get() + 1)
          })
        },
      },
      "Increment Both (batched)",
    ),
    button(
      {
        onClick: () => {
          runInTransaction(() => {
            batchA.set(0)
            batchB.set(0)
            batchRunCount = 0
            batchRenderCount.set(0)
          })
        },
      },
      "Reset",
    ),
  ),
)

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Dispose Demo
// ═══════════════════════════════════════════════════════════════════════════════

const ticker = box(0)
let tickInterval: ReturnType<typeof setInterval> | null = null
const tickerRunning = box(false)

function startTicker() {
  if (tickInterval) return
  tickInterval = setInterval(() => ticker.set(ticker.get() + 1), 100)
  tickerRunning.set(true)
}

function stopTicker() {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
  tickerRunning.set(false)
}

// Capture element refs so we can manipulate them non-reactively after dispose
const tickDisplay = p({ style: "font-size:24px;font-weight:700" }, () => `Tick: ${ticker.get()}`)
const startStopBtn = button(
  {
    class: "btn-primary",
    onClick: () => (tickerRunning.get() ? stopTicker() : startTicker()),
  },
  () => (tickerRunning.get() ? "Stop" : "Start"),
)
const disposeBtn = button({ class: "btn-danger" }, "Dispose (detach reactivity)")
const resetBtn = button({ onClick: () => ticker.set(0) }, "Reset Ticker")

disposeBtn.addEventListener("click", () => {
  const frozenAt = ticker.get()
  dispose(tickerDisplay)  // detaches all reactive bindings in this subtree
  stopTicker()

  // Manually update DOM now that reactivity is gone
  tickDisplay.textContent = `Tick: ${frozenAt} — frozen`
  tickDisplay.style.color = "#999"

  ;[startStopBtn, disposeBtn, resetBtn].forEach((b) => {
    b.setAttribute("disabled", "true")
    b.style.opacity = "0.4"
    b.style.cursor = "not-allowed"
  })

  const notice = document.createElement("p")
  notice.style.cssText =
    "margin-top:10px;padding:8px 12px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:13px;color:#856404"
  notice.textContent =
    "✓ Reactivity disposed — all reactive bindings removed. The DOM no longer reacts to observable changes. Reload to restore."
  tickerDisplay.appendChild(notice)
})

const tickerDisplay = div(
  { class: "card" },
  h2(null, "Reactive Ticker (dispose demo)"),
  p(
    { style: "font-size:13px;color:#666;margin-bottom:8px" },
    "Start the ticker, then click 'Dispose' to detach all reactive bindings from this card. The DOM freezes at the last value.",
  ),
  tickDisplay,
  div({ style: "display:flex;gap:8px" }, startStopBtn, disposeBtn, resetBtn),
)

// ═══════════════════════════════════════════════════════════════════════════════
// Mount everything
// ═══════════════════════════════════════════════════════════════════════════════

container.append(
  counterCard,
  textCard,
  todoList,
  selectionCard,
  batchCard,
  tickerDisplay,
)
