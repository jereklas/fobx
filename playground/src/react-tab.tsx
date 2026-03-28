// ─── React + v2 ViewModel playground tab ─────────────────────────────────────
//
// Demonstrates:
// 1. observer + useViewModel pattern (Counter with ViewModel)
// 2. Multiple VMs (Todo list with ViewModel)
// 3. Computed values and reactions
// 4. Lifecycle hooks (onConnect / onDisconnect)
// 5. Nested observers

// @ts-types="@types/react"
import React from "react"
// @ts-types="@types/react-dom/client"
import { createRoot } from "react-dom/client"
import {
  autorun,
  computed,
  observable,
  observableArray,
  observableBox,
  runInTransaction,
  runWithoutTracking,
} from "../../core/index.ts"
import { observer, useViewModel, ViewModel } from "../../reactV2/index.ts"

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Counter with ViewModel
// ═══════════════════════════════════════════════════════════════════════════════

class CounterVM extends ViewModel<{ initial: number; step: number }> {
  count: number

  constructor(props: { initial: number; step: number }) {
    super(props)
    this.count = props.initial
    observable(this)
  }

  get double() {
    return this.count * 2
  }

  get isEven() {
    return this.count % 2 === 0
  }

  increment = () => {
    this.count += this.props.step
  }

  decrement = () => {
    this.count -= this.props.step
  }

  reset = () => {
    this.count = this.props.initial
  }

  override onConnect() {
    addLog("[CounterVM] onConnect — mounted")
  }

  override onDisconnect() {
    addLog("[CounterVM] onDisconnect — unmounted")
  }
}

const Counter = observer(function Counter(props: {
  initial: number
  step: number
}) {
  const vm = useViewModel(CounterVM, props)

  return (
    <div className="card">
      <h2>Counter (ViewModel)</h2>
      <div className="counter-row">
        <button onClick={vm.decrement}>−</button>
        <div className="counter-value">{vm.count}</div>
        <button onClick={vm.increment}>+</button>
      </div>
      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
        double: <strong>{vm.double}</strong> · even:{" "}
        <strong>{vm.isEven ? "yes" : "no"}</strong> · step: {vm.props.step}
      </div>
      <button onClick={vm.reset} style={{ marginTop: 8 }}>
        Reset
      </button>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Todo List with ViewModel
// ═══════════════════════════════════════════════════════════════════════════════

interface Todo {
  id: number
  text: string
  done: boolean
}

class TodoVM extends ViewModel {
  items = observableArray<Todo>([])
  nextId = 1
  inputText = ""

  constructor() {
    super({})
    observable(this)
  }

  get remaining() {
    return this.items.filter((t) => !t.done).length
  }

  get total() {
    return this.items.length
  }

  addTodo() {
    const text = this.inputText.trim()
    if (!text) return
    this.items.push({ id: this.nextId++, text, done: false })
    this.inputText = ""
  }

  toggleTodo(id: number) {
    const idx = this.items.findIndex((t) => t.id === id)
    if (idx >= 0) {
      const item = this.items[idx]
      this.items.splice(idx, 1, { ...item, done: !item.done })
    }
  }

  removeTodo(id: number) {
    const idx = this.items.findIndex((t) => t.id === id)
    if (idx >= 0) this.items.splice(idx, 1)
  }

  clearDone() {
    runInTransaction(() => {
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].done) this.items.splice(i, 1)
      }
    })
  }

  override onConnect() {
    addLog("[TodoVM] onConnect")
  }

  override onDisconnect() {
    addLog("[TodoVM] onDisconnect")
  }
}

const TodoList = observer(function TodoList() {
  const vm = useViewModel(TodoVM)

  return (
    <div className="card">
      <h2>Todo List (ViewModel)</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={vm.inputText}
          placeholder="Add a todo..."
          onInput={(
            e: React.ChangeEvent<HTMLInputElement>,
          ) => (vm.inputText = e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") vm.addTodo()
          }}
        />
        <button className="btn-primary" onClick={() => vm.addTodo()}>
          Add
        </button>
        {vm.total > 0 && (
          <button onClick={() => vm.clearDone()}>Clear Done</button>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
        {vm.remaining} remaining / {vm.total} total
      </div>
      {vm.items.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={() => vm.toggleTodo(todo.id)}
          onRemove={() => vm.removeTodo(todo.id)}
        />
      ))}
      {vm.total === 0 && (
        <div style={{ color: "#999", fontStyle: "italic" }}>
          No todos yet. Add one above!
        </div>
      )}
    </div>
  )
})

const TodoItem = observer(function TodoItem(props: {
  todo: Todo
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div className={`todo-item ${props.todo.done ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={props.todo.done}
        onChange={props.onToggle}
      />
      <span style={{ flex: 1 }}>{props.todo.text}</span>
      <button className="btn-danger" onClick={props.onRemove}>
        ✕
      </button>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Reactive Primitives Demo (box, computed, autorun)
// ═══════════════════════════════════════════════════════════════════════════════

const firstName = observableBox("John")
const lastName = observableBox("Doe")
const fullName = computed(() => `${firstName.get()} ${lastName.get()}`)
const nameLength = computed(() => fullName.get().length)

const logLines = observableArray<string>([])
function addLog(msg: string) {
  runWithoutTracking(() => {
    const ts = new Date().toLocaleTimeString()
    logLines.push(`[${ts}] ${msg}`)
    if (logLines.length > 50) logLines.splice(0, logLines.length - 50)
  })
}

autorun(() => {
  addLog(`autorun: fullName = "${fullName.get()}"`)
})

const PrimitivesDemo = observer(function PrimitivesDemo() {
  return (
    <div className="card">
      <h2>Reactive Primitives (box + computed + autorun)</h2>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>First Name</label>
          <br />
          <input
            type="text"
            value={firstName.get()}
            onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
              firstName.set(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Last Name</label>
          <br />
          <input
            type="text"
            value={lastName.get()}
            onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
              lastName.set(e.target.value)}
          />
        </div>
      </div>
      <div style={{ fontSize: 14 }}>
        Full Name: <strong>{fullName.get()}</strong> ({nameLength.get()} chars)
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Lifecycle & Mount/Unmount Demo
// ═══════════════════════════════════════════════════════════════════════════════

class LifecycleVM extends ViewModel {
  status = "initializing"
  mountCount = 0

  constructor() {
    super({})
    observable(this)
    this.status = "created"
    addLog("[LifecycleVM] constructor")
  }

  override onConnect() {
    this.mountCount++
    this.status = "connected"
    addLog(`[LifecycleVM] onConnect (mount #${this.mountCount})`)
  }

  override onDisconnect() {
    this.status = "disconnected"
    addLog("[LifecycleVM] onDisconnect")
  }
}

const LifecycleDemo = observer(function LifecycleDemo() {
  const [show, setShow] = React.useState(true)

  return (
    <div className="card">
      <h2>Lifecycle Hooks</h2>
      <button onClick={() => setShow((s) => !s)}>
        {show ? "Unmount" : "Mount"} Child
      </button>
      {show && <LifecycleChild />}
    </div>
  )
})

const LifecycleChild = observer(function LifecycleChild() {
  const vm = useViewModel(LifecycleVM)

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: "#f0f8ff",
        borderRadius: 4,
      }}
    >
      Status:{" "}
      <span
        className={`status ${
          vm.status === "connected" ? "connected" : "disconnected"
        }`}
      >
        {vm.status}
      </span>
      <span style={{ marginLeft: 12, fontSize: 12, color: "#666" }}>
        (mounted {vm.mountCount}x)
      </span>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Event Log
// ═══════════════════════════════════════════════════════════════════════════════

const EventLog = observer(function EventLog() {
  const logRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  })

  return (
    <div className="card">
      <h2>
        Event Log{" "}
        <button
          style={{ fontSize: 11, marginLeft: 8 }}
          onClick={() => logLines.clear()}
        >
          Clear
        </button>
      </h2>
      <div className="log" ref={logRef}>
        {logLines.length === 0
          ? "No events yet..."
          : logLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Step Prop Change Demo
// ═══════════════════════════════════════════════════════════════════════════════

const StepController = observer(function StepController() {
  const [step, setStep] = React.useState(1)

  return (
    <div className="card">
      <h2>Prop Sync Demo</h2>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
        Change the "step" prop passed to the Counter above. The ViewModel's
        <code>update()</code> syncs it reactively.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>Step:</span>
        {[1, 2, 5, 10].map((s) => (
          <button
            key={s}
            className={s === step ? "btn-primary" : ""}
            onClick={() => setStep(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Counter initial={0} step={step} />
      </div>
    </div>
  )
})

// ═══════════════════════════════════════════════════════════════════════════════
// Mount the React app
// ═══════════════════════════════════════════════════════════════════════════════

function App() {
  return (
    <>
      <PrimitivesDemo />
      <StepController />
      <TodoList />
      <LifecycleDemo />
      <EventLog />
    </>
  )
}

const container = document.getElementById("tab-react")!
const root = createRoot(container)
root.render(<App />)
