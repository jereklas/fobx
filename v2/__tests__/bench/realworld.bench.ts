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
 * Run with: deno bench v2/__tests__/bench/realworld.bench.ts --allow-env --no-check
 */

import * as fobx from "../../../core/dist/index.production.js"
import * as mobx from "mobx"
import { box } from "../../box.ts"
import { computed } from "../../computed.ts"
import { autorun } from "../../autorun.ts"
import { reaction } from "../../reaction.ts"
import { runInTransaction } from "../../batch.ts"
import { observable } from "../../object.ts"
import { array } from "../../array.ts"
import { map } from "../../map.ts"
import { set } from "../../set.ts"

fobx.configure({ enforceTransactions: false })
mobx.configure({ enforceActions: "never" })

// deno-lint-ignore no-explicit-any
type Any = any

// ============================================================================
// 1. TODO LIST — array + computed derived values + reaction watching length
// ============================================================================

Deno.bench("fobx", { group: "todo-list-app" }, () => {
  const todos = fobx.observable([] as Any[])
  const filter = fobx.observableBox("all")
  const completedCount = fobx.computed(() =>
    todos.filter((t: Any) => t.done).length
  )
  const activeCount = fobx.computed(() =>
    todos.filter((t: Any) => !t.done).length
  )
  let _rendered = 0
  const dispose = fobx.autorun(() => {
    const f = filter.value
    _rendered = f === "done"
      ? completedCount.value
      : f === "active"
      ? activeCount.value
      : todos.length
  })

  fobx.runInAction(() => {
    todos.push({ text: "Buy milk", done: false })
    todos.push({ text: "Walk dog", done: false })
    todos.push({ text: "Read book", done: true })
    todos.push({ text: "Write code", done: false })
    todos.push({ text: "Cook dinner", done: true })
  })
  fobx.runInAction(() => {
    todos[1].done = true
  })
  filter.value = "done"
  filter.value = "active"
  filter.value = "all"

  dispose()
})

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

Deno.bench("v2", { group: "todo-list-app", baseline: true }, () => {
  const todos = array([] as Any[])
  const filter = box("all")
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

Deno.bench("fobx", { group: "form-validation" }, () => {
  const name = fobx.observableBox("")
  const email = fobx.observableBox("")
  const age = fobx.observableBox(0)
  const agreed = fobx.observableBox(false)

  const nameError = fobx.computed(() =>
    name.value.length < 2 ? "Name too short" : null
  )
  const emailError = fobx.computed(() =>
    !name.value.includes("@") ? "Invalid email" : null
  )
  const ageError = fobx.computed(() => age.value < 18 ? "Must be 18+" : null)
  const agreedError = fobx.computed(() => !agreed.value ? "Must agree" : null)
  const isValid = fobx.computed(() =>
    !nameError.value && !emailError.value && !ageError.value &&
    !agreedError.value
  )

  let _display: string[] = []
  const dispose = fobx.autorun(() => {
    _display = [
      nameError.value,
      emailError.value,
      ageError.value,
      agreedError.value,
    ].filter(Boolean) as string[]
  })

  name.value = "Jo"
  email.value = "jo@test.com"
  age.value = 25
  agreed.value = true
  // Check all valid
  isValid.value
  // Toggle back
  agreed.value = false
  isValid.value

  dispose()
})

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

Deno.bench("v2", { group: "form-validation", baseline: true }, () => {
  const name = box("")
  const email = box("")
  const age = box(0)
  const agreed = box(false)

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

Deno.bench("fobx", { group: "data-table-50-rows" }, () => {
  const rows = fobx.observable(new Map<number, Any>())
  const sortField = fobx.observableBox("name")
  const filterText = fobx.observableBox("")

  fobx.runInAction(() => {
    for (let i = 0; i < 50; i++) {
      rows.set(i, {
        name: `User ${i}`,
        score: Math.floor(i * 1.7),
        active: i % 3 !== 0,
      })
    }
  })

  const filtered = fobx.computed(() => {
    const ft = filterText.value
    const result: Any[] = []
    rows.forEach((row: Any) => {
      if (!ft || row.name.includes(ft)) result.push(row)
    })
    return result
  })
  const sorted = fobx.computed(() => {
    const field = sortField.value
    return [...filtered.value].sort((a, b) =>
      a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0
    )
  })
  const totalScore = fobx.computed(() => {
    let sum = 0
    for (const row of filtered.value) sum += row.score
    return sum
  })

  let _view: Any
  const dispose = fobx.autorun(() => {
    _view = { rows: sorted.value.length, total: totalScore.value }
  })

  filterText.value = "User 1"
  sortField.value = "score"
  fobx.runInAction(() => {
    rows.set(100, { name: "User 100", score: 999, active: true })
    rows.delete(0)
  })

  dispose()
})

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

Deno.bench("v2", { group: "data-table-50-rows", baseline: true }, () => {
  const rows = map<number, Any>()
  const sortField = box("name")
  const filterText = box("")

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

Deno.bench("fobx", { group: "diamond-4-node" }, () => {
  const a = fobx.observableBox(1)
  const b = fobx.computed(() => a.value * 2)
  const c = fobx.computed(() => a.value * 3)
  const d = fobx.computed(() => b.value + c.value)
  let _runs = 0
  const dispose = fobx.autorun(() => {
    _runs++
    d.value
  })

  a.value = 2
  a.value = 3
  a.value = 4

  dispose()
})
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
Deno.bench("v2", { group: "diamond-4-node", baseline: true }, () => {
  const a = box(1)
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
Deno.bench("fobx", { group: "diamond-wide-10" }, () => {
  const source = fobx.observableBox(1)
  const branches = Array.from(
    { length: 10 },
    (_, i) => fobx.computed(() => source.value * (i + 1)),
  )
  const agg = fobx.computed(() => {
    let s = 0
    for (const b of branches) s += b.value
    return s
  })
  let _val = 0
  const dispose = fobx.autorun(() => {
    _val = agg.value
  })

  source.value = 2
  source.value = 3

  dispose()
})
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
Deno.bench("v2", { group: "diamond-wide-10", baseline: true }, () => {
  const source = box(1)
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
Deno.bench("fobx", { group: "diamond-deep-4-levels" }, () => {
  const s = fobx.observableBox(1)
  const l1a = fobx.computed(() => s.value + 1)
  const l1b = fobx.computed(() => s.value * 2)
  const l2a = fobx.computed(() => l1a.value + l1b.value)
  const l2b = fobx.computed(() => l1a.value * l1b.value)
  const l3a = fobx.computed(() => l2a.value + l2b.value)
  const l3b = fobx.computed(() => l2a.value - l2b.value)
  const agg = fobx.computed(() => l3a.value + l3b.value)
  let _v = 0
  const dispose = fobx.autorun(() => {
    _v = agg.value
  })
  s.value = 2
  s.value = 3
  s.value = 4
  s.value = 5
  dispose()
})
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
Deno.bench("v2", { group: "diamond-deep-4-levels", baseline: true }, () => {
  const s = box(1)
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

Deno.bench("fobx", { group: "dynamic-deps-switch" }, () => {
  const toggle = fobx.observableBox(false)
  const a = fobx.observableBox(1)
  const b = fobx.observableBox(2)
  let _v = 0
  const dispose = fobx.autorun(() => {
    _v = toggle.value ? a.value : b.value
  })
  // Flip deps 5 times
  toggle.value = true
  a.value = 10
  toggle.value = false
  b.value = 20
  toggle.value = true
  dispose()
})
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
Deno.bench("v2", { group: "dynamic-deps-switch", baseline: true }, () => {
  const toggle = box(false)
  const a = box(1)
  const b = box(2)
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

Deno.bench("fobx", { group: "10-components-lifecycle" }, () => {
  const disposers: (() => void)[] = []
  for (let i = 0; i < 10; i++) {
    const count = fobx.observableBox(0)
    const label = fobx.observableBox(`Item ${i}`)
    const display = fobx.computed(() => `${label.value}: ${count.value}`)
    let _rendered = ""
    disposers.push(fobx.autorun(() => {
      _rendered = display.value
    }))
    count.value = i + 1
    label.value = `Updated ${i}`
  }
  disposers.forEach((d) => d())
})
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
Deno.bench("v2", { group: "10-components-lifecycle", baseline: true }, () => {
  const disposers: (() => void)[] = []
  for (let i = 0; i < 10; i++) {
    const count = box(0)
    const label = box(`Item ${i}`)
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

Deno.bench("fobx", { group: "array-reaction-filter-sort" }, () => {
  const items = fobx.observable([] as number[])
  const threshold = fobx.observableBox(50)
  let _above: number[] = []
  const dispose = fobx.reaction(
    () => {
      const t = threshold.value
      return items.filter((x: number) => x > t).sort((a: number, b: number) =>
        a - b
      )
    },
    (val: number[]) => {
      _above = val
    },
    { fireImmediately: true },
  )

  fobx.runInAction(() => {
    for (let i = 0; i < 20; i++) items.push(i * 5)
  })
  threshold.value = 30
  fobx.runInAction(() => {
    items.push(100)
    items.push(35)
  })

  dispose()
})
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
  "v2",
  { group: "array-reaction-filter-sort", baseline: true },
  () => {
    const items = array([] as number[])
    const threshold = box(50)
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
Deno.bench("fobx", { group: "map-computed-aggregation" }, () => {
  const scores = fobx.observable(new Map<string, number>())
  const total = fobx.computed(() => {
    let s = 0
    scores.forEach((v: number) => {
      s += v
    })
    return s
  })
  const avg = fobx.computed(() => {
    const t = total.value
    const sz = scores.size
    return sz > 0 ? t / sz : 0
  })

  let _display = 0
  const dispose = fobx.autorun(() => {
    _display = avg.value
  })

  fobx.runInAction(() => {
    for (let i = 0; i < 20; i++) scores.set(`player${i}`, i * 10)
  })
  fobx.runInAction(() => {
    scores.set("player0", 100)
    scores.delete("player19")
  })

  dispose()
})
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
Deno.bench("v2", { group: "map-computed-aggregation", baseline: true }, () => {
  const scores = map<string, number>()
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
})

// Set membership tracking with reaction
Deno.bench("fobx", { group: "set-membership-reaction" }, () => {
  const tags = fobx.observable(new Set<string>())
  const required = ["admin", "editor", "viewer"]
  let _missing: string[] = []
  const dispose = fobx.reaction(
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
Deno.bench("v2", { group: "set-membership-reaction", baseline: true }, () => {
  const tags = set<string>()
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

Deno.bench("fobx", { group: "large-graph-100-50-10" }, () => {
  const sources = Array.from({ length: 100 }, (_, i) => fobx.observableBox(i))
  // 50 computeds, each depending on 2 consecutive sources
  const computeds = Array.from(
    { length: 50 },
    (_, i) =>
      fobx.computed(() => sources[i * 2].value + sources[i * 2 + 1].value),
  )
  // 10 reactions, each depending on 5 computeds
  const disposers: (() => void)[] = []
  for (let r = 0; r < 10; r++) {
    let _sum = 0
    disposers.push(fobx.autorun(() => {
      _sum = 0
      for (let c = r * 5; c < r * 5 + 5; c++) _sum += computeds[c].value
    }))
  }
  // Mutate 10 sources
  fobx.runInAction(() => {
    for (let i = 0; i < 10; i++) sources[i].value = 100 + i
  })
  // Mutate 10 more
  fobx.runInAction(() => {
    for (let i = 50; i < 60; i++) sources[i].value = 200 + i
  })
  disposers.forEach((d) => d())
})
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
Deno.bench("v2", { group: "large-graph-100-50-10", baseline: true }, () => {
  const sources = Array.from({ length: 100 }, (_, i) => box(i))
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

Deno.bench("fobx", { group: "minimal-lifecycle" }, () => {
  const b = fobx.observableBox(0)
  const c = fobx.computed(() => b.value * 2)
  let _v = 0
  const dispose = fobx.autorun(() => {
    _v = c.value
  })
  b.value = 1
  dispose()
})
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
Deno.bench("v2", { group: "minimal-lifecycle", baseline: true }, () => {
  const b = box(0)
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

Deno.bench("fobx", { group: "object-store-pattern" }, () => {
  const store = fobx.observable({
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
  const dispose = fobx.autorun(() => {
    _display = `${store.fullName} (${store.itemCount} items)`
  })

  fobx.runInAction(() => {
    store.firstName = "Jane"
    store.items.push("A")
    store.items.push("B")
  })
  store.lastName = "Smith"

  dispose()
})
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
Deno.bench("v2", { group: "object-store-pattern", baseline: true }, () => {
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

Deno.bench("fobx", { group: "cascading-collections" }, () => {
  const users = fobx.observable([
    { id: 1, role: "admin" },
    { id: 2, role: "user" },
    { id: 3, role: "user" },
  ] as Any[])

  const byRole = fobx.computed(() => {
    const m = new Map<string, number[]>()
    users.forEach((u: Any) => {
      const ids = m.get(u.role) || []
      ids.push(u.id)
      m.set(u.role, ids)
    })
    return m
  })

  const roleNames = fobx.computed(() => new Set(byRole.value.keys()))

  let _roles = 0
  const dispose = fobx.autorun(() => {
    _roles = roleNames.value.size
  })

  fobx.runInAction(() => {
    users.push({ id: 4, role: "editor" })
    users.push({ id: 5, role: "admin" })
  })
  fobx.runInAction(() => {
    users[0] = { id: 1, role: "superadmin" }
  })

  dispose()
})
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
Deno.bench("v2", { group: "cascading-collections", baseline: true }, () => {
  const users = array([
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
const _fobxSS = (() => {
  const a = fobx.observableBox(0)
  const b = fobx.observableBox(0)
  const c = fobx.observableBox(0)
  const sum = fobx.computed(() => a.value + b.value + c.value)
  const doubled = fobx.computed(() => sum.value * 2)
  let _v = 0
  const dispose = fobx.autorun(() => {
    _v = doubled.value
  })
  return { a, b, c, dispose }
})()
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
const _v2SS = (() => {
  const a = box(0)
  const b = box(0)
  const c = box(0)
  const sum = computed(() => a.get() + b.get() + c.get())
  const doubled = computed(() => sum.get() * 2)
  let _v = 0
  const dispose = autorun(() => {
    _v = doubled.get()
  })
  return { a, b, c, dispose }
})()

let _ssCounter = 0

Deno.bench("fobx", { group: "steady-state-single-write" }, () => {
  _fobxSS.a.value = ++_ssCounter
})
Deno.bench("mobx", { group: "steady-state-single-write" }, () => {
  _mobxSS.a.set(++_ssCounter)
})
Deno.bench("v2", { group: "steady-state-single-write", baseline: true }, () => {
  _v2SS.a.set(++_ssCounter)
})

Deno.bench("fobx", { group: "steady-state-batch-3-writes" }, () => {
  fobx.runInAction(() => {
    _fobxSS.a.value = ++_ssCounter
    _fobxSS.b.value = ++_ssCounter
    _fobxSS.c.value = ++_ssCounter
  })
})
Deno.bench("mobx", { group: "steady-state-batch-3-writes" }, () => {
  mobx.runInAction(() => {
    _mobxSS.a.set(++_ssCounter)
    _mobxSS.b.set(++_ssCounter)
    _mobxSS.c.set(++_ssCounter)
  })
})
Deno.bench(
  "v2",
  { group: "steady-state-batch-3-writes", baseline: true },
  () => {
    runInTransaction(() => {
      _v2SS.a.set(++_ssCounter)
      _v2SS.b.set(++_ssCounter)
      _v2SS.c.set(++_ssCounter)
    })
  },
)
