// ─── @fobx/jsx playground tab ────────────────────────────────────────────────
//
// Uses @fobx/jsx with the automatic JSX runtime — real DOM nodes, no virtual DOM.
// JSX expressions compile to fobx's own jsx() calls (not React.createElement).
//
// Key differences from React JSX:
//   - `class` not `className`
//   - Reactive values are expressed as functions: {() => someBox.get()}
//   - No reconciliation — mutations are surgical effects on real DOM nodes
// deno-lint-ignore-file

/// <reference types="../../jsx/types.ts" />

import { Component, dispose, For, Fragment, render } from "../../jsx/index.ts"
import {
  array,
  box,
  computed,
  observable,
  runInTransaction,
} from "../../v2/index.ts"

const container = document.getElementById("tab-jsx")!

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Counter — Functional Component
// ═══════════════════════════════════════════════════════════════════════════════

const counterValue = box(0)
const counterDoubled = computed(() => counterValue.get() * 2)

function CounterFC() {
  return (
    <div class="card">
      <h2>Counter (Functional Component)</h2>
      <div class="counter-row">
        <button onClick={() => counterValue.set(counterValue.get() - 1)}>
          −
        </button>
        <div class="counter-value">{() => String(counterValue.get())}</div>
        <button onClick={() => counterValue.set(counterValue.get() + 1)}>
          +
        </button>
      </div>
      <p style="font-size:13px;color:#666;margin-top:4px">
        {() =>
          `double: ${counterDoubled.get()} · ${
            counterValue.get() % 2 === 0 ? "even" : "odd"
          }`}
      </p>
      <button onClick={() => counterValue.set(0)} style="margin-top:8px">
        Reset
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Temperature Converter — Class Component
// ═══════════════════════════════════════════════════════════════════════════════

class TempConverter extends Component<{}> {
  celsius = box(0)
  fahrenheit = computed(() => this.celsius.get() * 9 / 5 + 32)
  kelvin = computed(() => this.celsius.get() + 273.15)

  render() {
    return (
      <div class="card">
        <h2>Temperature Converter (Class Component)</h2>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <label style="font-size:13px;color:#666">Celsius:</label>
          <input
            type="number"
            value={() => String(this.celsius.get())}
            onInput={(e: Event) =>
              this.celsius.set(
                Number((e.target as HTMLInputElement).value) || 0,
              )}
            style="width:100px"
          />
        </div>
        <div style="font-size:14px;margin-top:4px">
          <span>{() => `${this.fahrenheit.get().toFixed(1)}°F`}</span>
          <span style="margin:0 12px;color:#ccc">·</span>
          <span>{() => `${this.kelvin.get().toFixed(1)}K`}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button onClick={() => this.celsius.set(0)}>Freezing (0°C)</button>
          <button onClick={() => this.celsius.set(100)}>Boiling (100°C)</button>
          <button onClick={() => this.celsius.set(37)}>Body (37°C)</button>
        </div>
      </div>
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Color Picker — Reactive styles with range sliders
// ═══════════════════════════════════════════════════════════════════════════════

const red = box(100)
const green = box(150)
const blue = box(200)
const colorHex = computed(() => {
  const r = Math.max(0, Math.min(255, red.get()))
  const g = Math.max(0, Math.min(255, green.get()))
  const b = Math.max(0, Math.min(255, blue.get()))
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`
})

function ColorSlider(
  props: { label: string; value: ReturnType<typeof box<number>> },
) {
  return (
    <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <span style="width:20px;font-size:13px;font-weight:600">
        {props.label}
      </span>
      <input
        type="range"
        min="0"
        max="255"
        value={() => String(props.value.get())}
        onInput={(e: Event) =>
          props.value.set(Number((e.target as HTMLInputElement).value))}
        style="width:200px"
      />
      <span style="font-size:12px;font-family:monospace;width:30px">
        {() => String(props.value.get())}
      </span>
    </div>
  )
}

function ColorPicker() {
  return (
    <div class="card">
      <h2>Color Picker (Reactive Styles)</h2>
      <div style="display:flex;gap:20px">
        <div>
          <ColorSlider label="R" value={red} />
          <ColorSlider label="G" value={green} />
          <ColorSlider label="B" value={blue} />
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div
            style={() =>
              `width:80px;height:80px;border-radius:8px;border:1px solid #ddd;background:${colorHex.get()}`}
          />
          <span style="font-family:monospace;font-size:13px">
            {() => colorHex.get()}
          </span>
        </div>
      </div>
      <button
        onClick={() => {
          runInTransaction(() => {
            red.set(Math.floor(Math.random() * 256))
            green.set(Math.floor(Math.random() * 256))
            blue.set(Math.floor(Math.random() * 256))
          })
        }}
        style="margin-top:8px"
      >
        Random Color
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Dynamic List with mountList
// ═══════════════════════════════════════════════════════════════════════════════

interface ListItem {
  id: number
  name: string
}

const listItems = array<ListItem>([
  { id: 1, name: "First item" },
  { id: 2, name: "Second item" },
  { id: 3, name: "Third item" },
])
let listNextId = 4
const listInput = box("")

function DynamicList() {
  const addItem = () => {
    const name = listInput.get().trim()
    if (!name) return
    listItems.push({ id: listNextId++, name })
    listInput.set("")
  }

  return (
    <div class="card">
      <h2>Dynamic List (&lt;For&gt;)</h2>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input
          type="text"
          placeholder="Add item..."
          value={() => listInput.get()}
          onInput={(e: Event) =>
            listInput.set((e.target as HTMLInputElement).value)}
          onKeyDown={(e: KeyboardEvent) => e.key === "Enter" && addItem()}
        />
        <button class="btn-primary" onClick={addItem}>Add</button>
        <button onClick={() => listItems.clear()}>Clear All</button>
      </div>
      <p style="font-size:13px;color:#666;margin-bottom:8px">
        {() => `${listItems.length} items`}
      </p>
      <For each={() => listItems as Iterable<ListItem>} key={(item) => item.id}>
        {(item) => (
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee">
            <span style="flex:1">#{item.id}: {item.name}</span>
            <button
              class="btn-danger"
              onClick={() => {
                const idx = listItems.findIndex((x) => x.id === item.id)
                if (idx >= 0) listItems.splice(idx, 1)
              }}
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Fragment Demo
// ═══════════════════════════════════════════════════════════════════════════════

const showDetails = box(false)

function FragmentDemo() {
  return (
    <div class="card">
      <h2>Fragment Demo</h2>
      <p style="font-size:13px;color:#666;margin-bottom:8px">
        Fragments render children directly into the parent without a wrapper
        element.
      </p>
      <button onClick={() => showDetails.set(!showDetails.get())}>
        {() => showDetails.get() ? "Hide Details" : "Show Details"}
      </button>
      <div style="margin-top:8px">
        {() =>
          showDetails.get()
            ? (
              <>
                <p>Detail line 1: Fragments are great!</p>
                <p>Detail line 2: No extra DOM wrapper node.</p>
                <p style="color:#4cc9f0;font-weight:600">
                  Detail line 3: Reactive functions work inside fragments.
                </p>
              </>
            )
            : (
              <p style="color:#999;font-style:italic">
                Click to show details...
              </p>
            )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Stopwatch — class Component with observable state
// ═══════════════════════════════════════════════════════════════════════════════

class Stopwatch extends Component<{}> {
  elapsed = box(0)
  running = box(false)
  private interval: ReturnType<typeof setInterval> | null = null

  formattedTime = computed(() => {
    const ms = this.elapsed.get()
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    const centis = Math.floor((ms % 1000) / 10)
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${
      String(centis).padStart(2, "0")
    }`
  })

  start() {
    if (this.interval) return
    this.interval = setInterval(
      () => this.elapsed.set(this.elapsed.get() + 10),
      10,
    )
    this.running.set(true)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.running.set(false)
  }

  reset() {
    this.stop()
    this.elapsed.set(0)
  }

  render() {
    return (
      <div class="card">
        <h2>Stopwatch (Class Component)</h2>
        <div style="font-size:36px;font-weight:700;font-family:monospace;margin:8px 0">
          {() => this.formattedTime.get()}
        </div>
        <div style="display:flex;gap:8px">
          <button
            class="btn-primary"
            onClick={() => this.running.get() ? this.stop() : this.start()}
          >
            {() => this.running.get() ? "Stop" : "Start"}
          </button>
          <button onClick={() => this.reset()}>Reset</button>
        </div>
      </div>
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mount using render()
// ═══════════════════════════════════════════════════════════════════════════════

render(
  <>
    <CounterFC />
    <TempConverter />
    <ColorPicker />
    <DynamicList />
    <FragmentDemo />
    <Stopwatch />
  </>,
  container,
)
