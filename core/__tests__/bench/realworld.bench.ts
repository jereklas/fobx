/**
 * Real-World Benchmark Suite
 *
 * Simulates practical usage patterns rather than micro-benchmarks:
 * - Todo list app (observable array + computed + reactions)
 * - Form state (observable object + computed validation)
 * - Data table (large collection + derived views)
 * - Component-like subscription patterns
 * - Diamond dependency graphs
 * - Dynamic dependency switching
 *
 * Run with: deno bench core/__tests__/bench/realworld.bench.ts --allow-env --no-check
 */

import * as mobx from "mobx"
// @deno-types="../../dist/index.d.ts"
import {
  autorun,
  computed,
  observable,
  observableArray,
  observableBox,
  observableMap,
  observableSet,
  reaction,
  runInTransaction,
} from "../../dist/index.production.js"

mobx.configure({ enforceActions: "never" })

// deno-lint-ignore no-explicit-any
type Any = any

// ============================================================================
// 1. TODO LIST — array + computed derived values + reaction watching length
// ============================================================================

Deno.bench("mobx", { group: "todo-list-app" }, () => {
  const todos = mobx.observable.array([] as Any[])
  const filter = mobx.observable.box("all")
  const completedCount = mobx.computed(() =>
    todos.filter((t: Any) => t.done).length
  )
  const activeCount = mobx.computed(() =>
    todos.filter((t: Any) => !t.done).length
  )
  let _rendered = 0
  const dispose = mobx.autorun(() => {
    const f = filter.get()
    _rendered = f === "done"
      ? completedCount.get()
      : f === "active"
      ? activeCount.get()
      : todos.length
  })

  mobx.runInAction(() => {
    todos.push({ text: "Buy milk", done: false })
    todos.push({ text: "Walk dog", done: false })
    todos.push({ text: "Read book", done: true })
    todos.push({ text: "Write code", done: false })
    todos.push({ text: "Cook dinner", done: true })
  })
  mobx.runInAction(() => {
    todos[1].done = true
  })
  filter.set("done")
  filter.set("active")
  filter.set("all")

  dispose()
})

Deno.bench("fobx", { group: "todo-list-app", baseline: true }, () => {
  const todos = observableArray([] as Any[])
  const filter = observableBox("all")
  const completedCount = computed(() => todos.filter((t: Any) => t.done).length)
  const activeCount = computed(() => todos.filter((t: Any) => !t.done).length)
  let _rendered = 0
  const dispose = autorun(() => {
    const f = filter.get()
    _rendered = f === "done"
      ? completedCount.get()
      : f === "active"
      ? activeCount.get()
      : todos.length
  })

  runInTransaction(() => {
    todos.push({ text: "Buy milk", done: false })
    todos.push({ text: "Walk dog", done: false })
    todos.push({ text: "Read book", done: true })
    todos.push({ text: "Write code", done: false })
    todos.push({ text: "Cook dinner", done: true })
  })
  runInTransaction(() => {
    todos[1] = { text: "Walk dog", done: true }
  })
  filter.set("done")
  filter.set("active")
  filter.set("all")

  dispose()
})

// ============================================================================
// 2. FORM VALIDATION — multiple fields + computed validators + error display
// ============================================================================

Deno.bench("mobx", { group: "form-validation" }, () => {
  const name = mobx.observable.box("")
  const email = mobx.observable.box("")
  const age = mobx.observable.box(0)
  const agreed = mobx.observable.box(false)

  const nameError = mobx.computed(() =>
    name.get().length < 2 ? "Name too short" : null
  )
  const emailError = mobx.computed(() =>
    !name.get().includes("@") ? "Invalid email" : null
  )
  const ageError = mobx.computed(() => age.get() < 18 ? "Must be 18+" : null)
  const agreedError = mobx.computed(() => !agreed.get() ? "Must agree" : null)
  const isValid = mobx.computed(() =>
    !nameError.get() && !emailError.get() && !ageError.get() &&
    !agreedError.get()
  )

  let _display: string[] = []
  const dispose = mobx.autorun(() => {
    _display = [
      nameError.get(),
      emailError.get(),
      ageError.get(),
      agreedError.get(),
    ].filter(Boolean) as string[]
  })

  name.set("Jo")
  email.set("jo@test.com")
  age.set(25)
  agreed.set(true)
  isValid.get()
  agreed.set(false)
  isValid.get()

  dispose()
})

Deno.bench("fobx", { group: "form-validation", baseline: true }, () => {
  const name = observableBox("")
  const email = observableBox("")
  const age = observableBox(0)
  const agreed = observableBox(false)

  const nameError = computed(() =>
    name.get().length < 2 ? "Name too short" : null
  )
  const emailError = computed(() =>
    !name.get().includes("@") ? "Invalid email" : null
  )
  const ageError = computed(() => age.get() < 18 ? "Must be 18+" : null)
  const agreedError = computed(() => !agreed.get() ? "Must agree" : null)
  const isValid = computed(() =>
    !nameError.get() && !emailError.get() && !ageError.get() &&
    !agreedError.get()
  )

  let _display: string[] = []
  const dispose = autorun(() => {
    _display = [
      nameError.get(),
      emailError.get(),
      ageError.get(),
      agreedError.get(),
    ].filter(Boolean) as string[]
  })

  name.set("Jo")
  email.set("jo@test.com")
  age.set(25)
  agreed.set(true)
  isValid.get()
  agreed.set(false)
  isValid.get()

  dispose()
})

// ============================================================================
// 3. DATA TABLE — map-backed store + computed derived list + filter + sort
// ============================================================================

Deno.bench("mobx", { group: "data-table-50-rows" }, () => {
  const rows = mobx.observable.map<number, Any>()
  const sortField = mobx.observable.box("name")
  const filterText = mobx.observable.box("")

  mobx.runInAction(() => {
    for (let i = 0; i < 50; i++) {
      rows.set(i, {
        name: `User ${i}`,
        score: Math.floor(i * 1.7),
        active: i % 3 !== 0,
      })
    }
  })

  const filtered = mobx.computed(() => {
    const ft = filterText.get()
    const result: Any[] = []
    rows.forEach((row: Any) => {
      if (!ft || row.name.includes(ft)) result.push(row)
    })
    return result
  })
  const sorted = mobx.computed(() => {
    const field = sortField.get()
    return [...filtered.get()].sort((a, b) =>
      a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0
    )
  })
  const totalScore = mobx.computed(() => {
    let sum = 0
    for (const row of filtered.get()) sum += row.score
    return sum
  })

  let _view: Any
  const dispose = mobx.autorun(() => {
    _view = { rows: sorted.get().length, total: totalScore.get() }
  })

  filterText.set("User 1")
  sortField.set("score")
  mobx.runInAction(() => {
    rows.set(100, { name: "User 100", score: 999, active: true })
    rows.delete(0)
  })

  dispose()
})

Deno.bench("fobx", { group: "data-table-50-rows", baseline: true }, () => {
  const rows = observableMap<number, Any>()
  const sortField = observableBox("name")
  const filterText = observableBox("")

  runInTransaction(() => {
    for (let i = 0; i < 50; i++) {
      rows.set(i, {
        name: `User ${i}`,
        score: Math.floor(i * 1.7),
        active: i % 3 !== 0,
      })
    }
  })

  const filtered = computed(() => {
    const ft = filterText.get()
    const result: Any[] = []
    rows.forEach((row: Any) => {
      if (!ft || row.name.includes(ft)) result.push(row)
    })
    return result
  })
  const sorted = computed(() => {
    const field = sortField.get()
    return [...filtered.get()].sort((a, b) =>
      a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0
    )
  })
  const totalScore = computed(() => {
    let sum = 0
    for (const row of filtered.get()) sum += row.score
    return sum
  })

  let _view: Any
  const dispose = autorun(() => {
    _view = { rows: sorted.get().length, total: totalScore.get() }
  })

  filterText.set("User 1")
  sortField.set("score")
  runInTransaction(() => {
    rows.set(100, { name: "User 100", score: 999, active: true })
    rows.delete(0)
  })

  dispose()
})

// ============================================================================
// 4. DIAMOND DEPENDENCY — A -> B, A -> C, B -> D, C -> D (glitch-free)
// ============================================================================

Deno.bench("mobx", { group: "diamond-4-node" }, () => {
  const a = mobx.observable.box(1)
  const b = mobx.computed(() => a.get() * 2)
  const c = mobx.computed(() => a.get() * 3)
  const d = mobx.computed(() => b.get() + c.get())
  let _runs = 0
  const dispose = mobx.autorun(() => {
    _runs++
    d.get()
  })

  a.set(2)
  a.set(3)
  a.set(4)

  dispose()
})

Deno.bench("fobx", { group: "diamond-4-node", baseline: true }, () => {
  const a = observableBox(1)
  const b = computed(() => a.get() * 2)
  const c = computed(() => a.get() * 3)
  const d = computed(() => b.get() + c.get())
  let _runs = 0
  const dispose = autorun(() => {
    _runs++
    d.get()
  })

  a.set(2)
  a.set(3)
  a.set(4)

  dispose()
})

// Wider diamond: 1 source -> 10 computeds -> 1 aggregator -> autorun
Deno.bench("mobx", { group: "diamond-wide-10" }, () => {
  const source = mobx.observable.box(1)
  const branches = Array.from(
    { length: 10 },
    (_, i) => mobx.computed(() => source.get() * (i + 1)),
  )
  const agg = mobx.computed(() => {
    let s = 0
    for (const b of branches) s += b.get()
    return s
  })
  let _val = 0
  const dispose = mobx.autorun(() => {
    _val = agg.get()
  })

  source.set(2)
  source.set(3)

  dispose()
})

Deno.bench("fobx", { group: "diamond-wide-10", baseline: true }, () => {
  const source = observableBox(1)
  const branches = Array.from(
    { length: 10 },
    (_, i) => computed(() => source.get() * (i + 1)),
  )
  const agg = computed(() => {
    let s = 0
    for (const b of branches) s += b.get()
    return s
  })
  let _val = 0
  const dispose = autorun(() => {
    _val = agg.get()
  })

  source.set(2)
  source.set(3)

  dispose()
})

// Deep diamond: source -> L1a, L1b -> L2a, L2b -> L3a, L3b -> agg -> autorun
Deno.bench("mobx", { group: "diamond-deep-4-levels" }, () => {
  const s = mobx.observable.box(1)
  const l1a = mobx.computed(() => s.get() + 1)
  const l1b = mobx.computed(() => s.get() * 2)
  const l2a = mobx.computed(() => l1a.get() + l1b.get())
  const l2b = mobx.computed(() => l1a.get() * l1b.get())
  const l3a = mobx.computed(() => l2a.get() + l2b.get())
  const l3b = mobx.computed(() => l2a.get() - l2b.get())
  const agg = mobx.computed(() => l3a.get() + l3b.get())
  let _v = 0
  const dispose = mobx.autorun(() => {
    _v = agg.get()
  })
  s.set(2)
  s.set(3)
  s.set(4)
  s.set(5)
  dispose()
})

Deno.bench("fobx", { group: "diamond-deep-4-levels", baseline: true }, () => {
  const s = observableBox(1)
  const l1a = computed(() => s.get() + 1)
  const l1b = computed(() => s.get() * 2)
  const l2a = computed(() => l1a.get() + l1b.get())
  const l2b = computed(() => l1a.get() * l1b.get())
  const l3a = computed(() => l2a.get() + l2b.get())
  const l3b = computed(() => l2a.get() - l2b.get())
  const agg = computed(() => l3a.get() + l3b.get())
  let _v = 0
  const dispose = autorun(() => {
    _v = agg.get()
  })
  s.set(2)
  s.set(3)
  s.set(4)
  s.set(5)
  dispose()
})

// ============================================================================
// 5. DYNAMIC DEPS — reaction reads different observables on each run
// ============================================================================

Deno.bench("mobx", { group: "dynamic-deps-switch" }, () => {
  const toggle = mobx.observable.box(false)
  const a = mobx.observable.box(1)
  const b = mobx.observable.box(2)
  let _v = 0
  const dispose = mobx.autorun(() => {
    _v = toggle.get() ? a.get() : b.get()
  })
  toggle.set(true)
  a.set(10)
  toggle.set(false)
  b.set(20)
  toggle.set(true)
  dispose()
})

Deno.bench("fobx", { group: "dynamic-deps-switch", baseline: true }, () => {
  const toggle = observableBox(false)
  const a = observableBox(1)
  const b = observableBox(2)
  let _v = 0
  const dispose = autorun(() => {
    _v = toggle.get() ? a.get() : b.get()
  })
  toggle.set(true)
  a.set(10)
  toggle.set(false)
  b.set(20)
  toggle.set(true)
  dispose()
})

// ============================================================================
// 6. COMPONENT-LIKE — multiple independent "components" each with own state
// ============================================================================

Deno.bench("mobx", { group: "10-components-lifecycle" }, () => {
  const disposers: (() => void)[] = []
  for (let i = 0; i < 10; i++) {
    const count = mobx.observable.box(0)
    const label = mobx.observable.box(`Item ${i}`)
    const display = mobx.computed(() => `${label.get()}: ${count.get()}`)
    let _rendered = ""
    disposers.push(mobx.autorun(() => {
      _rendered = display.get()
    }))
    count.set(i + 1)
    label.set(`Updated ${i}`)
  }
  disposers.forEach((d) => d())
})

Deno.bench("fobx", { group: "10-components-lifecycle", baseline: true }, () => {
  const disposers: (() => void)[] = []
  for (let i = 0; i < 10; i++) {
    const count = observableBox(0)
    const label = observableBox(`Item ${i}`)
    const display = computed(() => `${label.get()}: ${count.get()}`)
    let _rendered = ""
    disposers.push(autorun(() => {
      _rendered = display.get()
    }))
    count.set(i + 1)
    label.set(`Updated ${i}`)
  }
  disposers.forEach((d) => d())
})

// ============================================================================
// 7. COLLECTION + REACTION — array/map changes triggering derived computation
// ============================================================================

Deno.bench("mobx", { group: "array-reaction-filter-sort" }, () => {
  const items = mobx.observable.array([] as number[])
  const threshold = mobx.observable.box(50)
  let _above: number[] = []
  const dispose = mobx.reaction(
    () => {
      const t = threshold.get()
      return items.filter((x: number) => x > t).sort((a: number, b: number) =>
        a - b
      )
    },
    (val: number[]) => {
      _above = val
    },
    { fireImmediately: true },
  )

  mobx.runInAction(() => {
    for (let i = 0; i < 20; i++) items.push(i * 5)
  })
  threshold.set(30)
  mobx.runInAction(() => {
    items.push(100)
    items.push(35)
  })

  dispose()
})

Deno.bench(
  "fobx",
  { group: "array-reaction-filter-sort", baseline: true },
  () => {
    const items = observableArray([] as number[])
    const threshold = observableBox(50)
    let _above: number[] = []
    const dispose = reaction(
      () => {
        const t = threshold.get()
        return items.filter((x: number) => x > t).sort((a: number, b: number) =>
          a - b
        )
      },
      (val) => {
        _above = val as number[]
      },
      { fireImmediately: true },
    )

    runInTransaction(() => {
      for (let i = 0; i < 20; i++) items.push(i * 5)
    })
    threshold.set(30)
    runInTransaction(() => {
      items.push(100)
      items.push(35)
    })

    dispose()
  },
)

// Map-based key-value store with computed aggregation
Deno.bench("mobx", { group: "map-computed-aggregation" }, () => {
  const scores = mobx.observable.map<string, number>()
  const total = mobx.computed(() => {
    let s = 0
    scores.forEach((v: number) => {
      s += v
    })
    return s
  })
  const avg = mobx.computed(() => {
    const t = total.get()
    const sz = scores.size
    return sz > 0 ? t / sz : 0
  })

  let _display = 0
  const dispose = mobx.autorun(() => {
    _display = avg.get()
  })

  mobx.runInAction(() => {
    for (let i = 0; i < 20; i++) scores.set(`player${i}`, i * 10)
  })
  mobx.runInAction(() => {
    scores.set("player0", 100)
    scores.delete("player19")
  })

  dispose()
})

Deno.bench(
  "fobx",
  { group: "map-computed-aggregation", baseline: true },
  () => {
    const scores = observableMap<string, number>()
    const total = computed(() => {
      let s = 0
      scores.forEach((v: number) => {
        s += v
      })
      return s
    })
    const avg = computed(() => {
      const t = total.get()
      const sz = scores.size
      return sz > 0 ? t / sz : 0
    })

    let _display = 0
    const dispose = autorun(() => {
      _display = avg.get()
    })

    runInTransaction(() => {
      for (let i = 0; i < 20; i++) scores.set(`player${i}`, i * 10)
    })
    runInTransaction(() => {
      scores.set("player0", 100)
      scores.delete("player19")
    })

    dispose()
  },
)

// Set membership tracking with reaction
Deno.bench("mobx", { group: "set-membership-reaction" }, () => {
  const tags = mobx.observable.set<string>()
  const required = ["admin", "editor", "viewer"]
  let _missing: string[] = []
  const dispose = mobx.reaction(
    () => required.filter((r) => !tags.has(r)),
    (val: string[]) => {
      _missing = val
    },
    { fireImmediately: true },
  )

  tags.add("viewer")
  tags.add("editor")
  tags.add("admin")
  tags.delete("editor")
  tags.add("editor")

  dispose()
})

Deno.bench("fobx", { group: "set-membership-reaction", baseline: true }, () => {
  const tags = observableSet<string>()
  const required = ["admin", "editor", "viewer"]
  let _missing: string[] = []
  const dispose = reaction(
    () => required.filter((r) => !tags.has(r)),
    (val) => {
      _missing = val as string[]
    },
    { fireImmediately: true },
  )

  tags.add("viewer")
  tags.add("editor")
  tags.add("admin")
  tags.delete("editor")
  tags.add("editor")

  dispose()
})

// ============================================================================
// 8. LARGE GRAPH — 100 sources -> 50 computeds -> 10 reactions
// ============================================================================

Deno.bench("mobx", { group: "large-graph-100-50-10" }, () => {
  const sources = Array.from({ length: 100 }, (_, i) => mobx.observable.box(i))
  const computeds = Array.from(
    { length: 50 },
    (_, i) =>
      mobx.computed(() => sources[i * 2].get() + sources[i * 2 + 1].get()),
  )
  const disposers: (() => void)[] = []
  for (let r = 0; r < 10; r++) {
    let _sum = 0
    disposers.push(mobx.autorun(() => {
      _sum = 0
      for (let c = r * 5; c < r * 5 + 5; c++) _sum += computeds[c].get()
    }))
  }
  mobx.runInAction(() => {
    for (let i = 0; i < 10; i++) sources[i].set(100 + i)
  })
  mobx.runInAction(() => {
    for (let i = 50; i < 60; i++) sources[i].set(200 + i)
  })
  disposers.forEach((d) => d())
})

Deno.bench("fobx", { group: "large-graph-100-50-10", baseline: true }, () => {
  const sources = Array.from({ length: 100 }, (_, i) => observableBox(i))
  const computeds = Array.from(
    { length: 50 },
    (_, i) => computed(() => sources[i * 2].get() + sources[i * 2 + 1].get()),
  )
  const disposers: (() => void)[] = []
  for (let r = 0; r < 10; r++) {
    let _sum = 0
    disposers.push(autorun(() => {
      _sum = 0
      for (let c = r * 5; c < r * 5 + 5; c++) _sum += computeds[c].get()
    }))
  }
  runInTransaction(() => {
    for (let i = 0; i < 10; i++) sources[i].set(100 + i)
  })
  runInTransaction(() => {
    for (let i = 50; i < 60; i++) sources[i].set(200 + i)
  })
  disposers.forEach((d) => d())
})

// ============================================================================
// 9. SMALL GRAPH — minimal 1-box + 1-computed + 1-autorun lifecycle
// ============================================================================

Deno.bench("mobx", { group: "minimal-lifecycle" }, () => {
  const b = mobx.observable.box(0)
  const c = mobx.computed(() => b.get() * 2)
  let _v = 0
  const dispose = mobx.autorun(() => {
    _v = c.get()
  })
  b.set(1)
  dispose()
})

Deno.bench("fobx", { group: "minimal-lifecycle", baseline: true }, () => {
  const b = observableBox(0)
  const c = computed(() => b.get() * 2)
  let _v = 0
  const dispose = autorun(() => {
    _v = c.get()
  })
  b.set(1)
  dispose()
})

// ============================================================================
// 10. OBSERVABLE OBJECT — mimics real state store with props + computed + actions
// ============================================================================

Deno.bench("mobx", { group: "object-store-pattern" }, () => {
  const store = mobx.observable({
    firstName: "John",
    lastName: "Doe",
    items: [] as string[],
    get fullName() {
      return `${this.firstName} ${this.lastName}`
    },
    get itemCount() {
      return this.items.length
    },
  })

  let _display = ""
  const dispose = mobx.autorun(() => {
    _display = `${store.fullName} (${store.itemCount} items)`
  })

  mobx.runInAction(() => {
    store.firstName = "Jane"
    store.items.push("A")
    store.items.push("B")
  })
  store.lastName = "Smith"

  dispose()
})

Deno.bench("fobx", { group: "object-store-pattern", baseline: true }, () => {
  const store = observable({
    firstName: "John",
    lastName: "Doe",
    items: [] as string[],
    get fullName() {
      return `${this.firstName} ${this.lastName}`
    },
    get itemCount() {
      return this.items.length
    },
  })

  let _display = ""
  const dispose = autorun(() => {
    _display = `${store.fullName} (${store.itemCount} items)`
  })

  runInTransaction(() => {
    store.firstName = "Jane"
    store.items.push("A")
    store.items.push("B")
  })
  store.lastName = "Smith"

  dispose()
})

// ============================================================================
// 11. CASCADING COLLECTION UPDATES — array drives map drives set
// ============================================================================

Deno.bench("mobx", { group: "cascading-collections" }, () => {
  const users = mobx.observable.array([
    { id: 1, role: "admin" },
    { id: 2, role: "user" },
    { id: 3, role: "user" },
  ] as Any[])

  const byRole = mobx.computed(() => {
    const m = new Map<string, number[]>()
    users.forEach((u: Any) => {
      const ids = m.get(u.role) || []
      ids.push(u.id)
      m.set(u.role, ids)
    })
    return m
  })

  const roleNames = mobx.computed(() => new Set(byRole.get().keys()))

  let _roles = 0
  const dispose = mobx.autorun(() => {
    _roles = roleNames.get().size
  })

  mobx.runInAction(() => {
    users.push({ id: 4, role: "editor" })
    users.push({ id: 5, role: "admin" })
  })
  mobx.runInAction(() => {
    users[0] = { id: 1, role: "superadmin" }
  })

  dispose()
})

Deno.bench("fobx", { group: "cascading-collections", baseline: true }, () => {
  const users = observableArray([
    { id: 1, role: "admin" },
    { id: 2, role: "user" },
    { id: 3, role: "user" },
  ] as Any[])

  const byRole = computed(() => {
    const m = new Map<string, number[]>()
    users.forEach((u: Any) => {
      const ids = m.get(u.role) || []
      ids.push(u.id)
      m.set(u.role, ids)
    })
    return m
  })

  const roleNames = computed(() => new Set(byRole.get().keys()))

  let _roles = 0
  const dispose = autorun(() => {
    _roles = roleNames.get().size
  })

  runInTransaction(() => {
    users.push({ id: 4, role: "editor" })
    users.push({ id: 5, role: "admin" })
  })
  runInTransaction(() => {
    users[0] = { id: 1, role: "superadmin" } as Any
  })

  dispose()
})

// ============================================================================
// 12. STEADY-STATE UPDATES — pre-built graph, measure just mutation cost
// ============================================================================

// Build graphs once outside the bench
const _mobxSS = (() => {
  const a = mobx.observable.box(0)
  const b = mobx.observable.box(0)
  const c = mobx.observable.box(0)
  const sum = mobx.computed(() => a.get() + b.get() + c.get())
  const doubled = mobx.computed(() => sum.get() * 2)
  let _v = 0
  const dispose = mobx.autorun(() => {
    _v = doubled.get()
  })
  return { a, b, c, dispose }
})()

const _fobxSS = (() => {
  const a = observableBox(0)
  const b = observableBox(0)
  const c = observableBox(0)
  const sum = computed(() => a.get() + b.get() + c.get())
  const doubled = computed(() => sum.get() * 2)
  let _v = 0
  const dispose = autorun(() => {
    _v = doubled.get()
  })
  return { a, b, c, dispose }
})()

let _ssCounter = 0

Deno.bench("mobx", { group: "steady-state-single-write" }, () => {
  _mobxSS.a.set(++_ssCounter)
})

Deno.bench(
  "fobx",
  { group: "steady-state-single-write", baseline: true },
  () => {
    _fobxSS.a.set(++_ssCounter)
  },
)

Deno.bench("mobx", { group: "steady-state-batch-3-writes" }, () => {
  mobx.runInAction(() => {
    _mobxSS.a.set(++_ssCounter)
    _mobxSS.b.set(++_ssCounter)
    _mobxSS.c.set(++_ssCounter)
  })
})

Deno.bench(
  "fobx",
  { group: "steady-state-batch-3-writes", baseline: true },
  () => {
    runInTransaction(() => {
      _fobxSS.a.set(++_ssCounter)
      _fobxSS.b.set(++_ssCounter)
      _fobxSS.c.set(++_ssCounter)
    })
  },
)
