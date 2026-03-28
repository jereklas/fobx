/**
 * Collection Benchmark Suite — Observable Array, Map, Set
 *
 * Compares performance across three implementations:
 * - Production fobx (current core dist)
 * - MobX 6.x
 * - V2 rewrite
 *
 * Run with: deno bench v2/__tests__/bench/collections.bench.ts --allow-env --no-check
 */

import * as fobx from "../../../core/dist/index.production.js"
import * as mobx from "mobx"
import { observableArray } from "../../observables/observableArray.ts"
import { observableMap } from "../../observables/observableMap.ts"
import { observableSet } from "../../observables/observableSet.ts"
import { autorun } from "../../reactions/autorun.ts"
import { runInTransaction } from "../../transactions/batch.ts"

// Suppress warnings
fobx.configure({ enforceTransactions: false })
mobx.configure({ enforceActions: "never" })

// ============================================================================
// OBSERVABLE ARRAY
// ============================================================================

Deno.bench("fobx", { group: "array-create-empty" }, () => {
  fobx.observable([])
})
Deno.bench("mobx", { group: "array-create-empty" }, () => {
  mobx.observable.array([])
})
Deno.bench("v2", { group: "array-create-empty", baseline: true }, () => {
  observableArray([])
})

Deno.bench("fobx", { group: "array-create-1000" }, () => {
  const items = new Array(1000)
  for (let i = 0; i < 1000; i++) items[i] = i
  fobx.observable(items)
})
Deno.bench("mobx", { group: "array-create-1000" }, () => {
  const items = new Array(1000)
  for (let i = 0; i < 1000; i++) items[i] = i
  mobx.observable.array(items)
})
Deno.bench("v2", { group: "array-create-1000", baseline: true }, () => {
  const items = new Array(1000)
  for (let i = 0; i < 1000; i++) items[i] = i
  observableArray(items)
})

// Read operations
const fobxArr = fobx.observable([1, 2, 3, 4, 5])
const mobxArr = mobx.observable.array([1, 2, 3, 4, 5])
const v2Arr = observableArray([1, 2, 3, 4, 5])

Deno.bench("fobx", { group: "array-read-index" }, () => {
  const _a = fobxArr[0]
  const _b = fobxArr[2]
  const _c = fobxArr[4]
})
Deno.bench("mobx", { group: "array-read-index" }, () => {
  const _a = mobxArr[0]
  const _b = mobxArr[2]
  const _c = mobxArr[4]
})
Deno.bench("v2", { group: "array-read-index", baseline: true }, () => {
  const _a = v2Arr[0]
  const _b = v2Arr[2]
  const _c = v2Arr[4]
})

Deno.bench("fobx", { group: "array-read-length" }, () => {
  const _len = fobxArr.length
})
Deno.bench("mobx", { group: "array-read-length" }, () => {
  const _len = mobxArr.length
})
Deno.bench("v2", { group: "array-read-length", baseline: true }, () => {
  const _len = v2Arr.length
})

// Write operations
Deno.bench("fobx", { group: "array-push" }, () => {
  const a = fobx.observable([1, 2, 3])
  a.push(4)
  a.push(5)
})
Deno.bench("mobx", { group: "array-push" }, () => {
  const a = mobx.observable.array([1, 2, 3])
  a.push(4)
  a.push(5)
})
Deno.bench("v2", { group: "array-push", baseline: true }, () => {
  const a = observableArray([1, 2, 3])
  a.push(4)
  a.push(5)
})

Deno.bench("fobx", { group: "array-pop" }, () => {
  const a = fobx.observable([1, 2, 3, 4, 5])
  a.pop()
  a.pop()
})
Deno.bench("mobx", { group: "array-pop" }, () => {
  const a = mobx.observable.array([1, 2, 3, 4, 5])
  a.pop()
  a.pop()
})
Deno.bench("v2", { group: "array-pop", baseline: true }, () => {
  const a = observableArray([1, 2, 3, 4, 5])
  a.pop()
  a.pop()
})

Deno.bench("fobx", { group: "array-splice" }, () => {
  const a = fobx.observable([1, 2, 3, 4, 5])
  a.splice(1, 2, 10, 20, 30)
})
Deno.bench("mobx", { group: "array-splice" }, () => {
  const a = mobx.observable.array([1, 2, 3, 4, 5])
  a.splice(1, 2, 10, 20, 30)
})
Deno.bench("v2", { group: "array-splice", baseline: true }, () => {
  const a = observableArray([1, 2, 3, 4, 5])
  a.splice(1, 2, 10, 20, 30)
})

// Iteration
Deno.bench("fobx", { group: "array-forEach-100" }, () => {
  const a = fobx.observable(Array.from({ length: 100 }, (_, i) => i))
  let sum = 0
  a.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("mobx", { group: "array-forEach-100" }, () => {
  const a = mobx.observable.array(Array.from({ length: 100 }, (_, i) => i))
  let sum = 0
  a.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("v2", { group: "array-forEach-100", baseline: true }, () => {
  const a = observableArray(Array.from({ length: 100 }, (_, i) => i))
  let sum = 0
  a.forEach((v: number) => {
    sum += v
  })
})

// Array with autorun
Deno.bench("fobx", { group: "array-autorun-push" }, () => {
  const a = fobx.observable([1, 2, 3])
  let _count = 0
  const dispose = fobx.autorun(() => {
    _count = a.length
  })
  a.push(4)
  a.push(5)
  dispose()
})
Deno.bench("mobx", { group: "array-autorun-push" }, () => {
  const a = mobx.observable.array([1, 2, 3])
  let _count = 0
  const dispose = mobx.autorun(() => {
    _count = a.length
  })
  a.push(4)
  a.push(5)
  dispose()
})
Deno.bench("v2", { group: "array-autorun-push", baseline: true }, () => {
  const a = observableArray([1, 2, 3])
  let _count = 0
  const dispose = autorun(() => {
    _count = a.length
  })
  a.push(4)
  a.push(5)
  dispose()
})

// Batch write
Deno.bench("fobx", { group: "array-batch-write-100" }, () => {
  const a = fobx.observable([])
  fobx.runInAction(() => {
    for (let i = 0; i < 100; i++) a.push(i)
  })
})
Deno.bench("mobx", { group: "array-batch-write-100" }, () => {
  const a = mobx.observable.array<number>([])
  mobx.runInAction(() => {
    for (let i = 0; i < 100; i++) a.push(i)
  })
})
Deno.bench("v2", { group: "array-batch-write-100", baseline: true }, () => {
  const a = observableArray<number>([])
  runInTransaction(() => {
    for (let i = 0; i < 100; i++) a.push(i)
  })
})

// ============================================================================
// OBSERVABLE MAP
// ============================================================================

Deno.bench("fobx", { group: "map-create-empty" }, () => {
  fobx.observable(new Map())
})
Deno.bench("mobx", { group: "map-create-empty" }, () => {
  mobx.observable.map()
})
Deno.bench("v2", { group: "map-create-empty", baseline: true }, () => {
  observableMap()
})

Deno.bench("fobx", { group: "map-create-100" }, () => {
  const entries = new Map<string, number>()
  for (let i = 0; i < 100; i++) entries.set(`key${i}`, i)
  fobx.observable(entries)
})
Deno.bench("mobx", { group: "map-create-100" }, () => {
  const entries: [string, number][] = []
  for (let i = 0; i < 100; i++) entries.push([`key${i}`, i])
  mobx.observable.map(entries)
})
Deno.bench("v2", { group: "map-create-100", baseline: true }, () => {
  const entries = new Map<string, number>()
  for (let i = 0; i < 100; i++) entries.set(`key${i}`, i)
  observableMap(entries)
})

// Map read/write
Deno.bench("fobx", { group: "map-get" }, () => {
  const m = fobx.observable(new Map([["a", 1], ["b", 2], ["c", 3]]))
  m.get("a")
  m.get("b")
  m.get("c")
})
Deno.bench("mobx", { group: "map-get" }, () => {
  const m = mobx.observable.map([["a", 1], ["b", 2], ["c", 3]])
  m.get("a")
  m.get("b")
  m.get("c")
})
Deno.bench("v2", { group: "map-get", baseline: true }, () => {
  const m = observableMap(new Map([["a", 1], ["b", 2], ["c", 3]]))
  m.get("a")
  m.get("b")
  m.get("c")
})

Deno.bench("fobx", { group: "map-set" }, () => {
  const m = fobx.observable(new Map())
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
})
Deno.bench("mobx", { group: "map-set" }, () => {
  const m = mobx.observable.map()
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
})
Deno.bench("v2", { group: "map-set", baseline: true }, () => {
  const m = observableMap<string, number>()
  m.set("a", 1)
  m.set("b", 2)
  m.set("c", 3)
})

Deno.bench("fobx", { group: "map-has" }, () => {
  const m = fobx.observable(new Map([["a", 1], ["b", 2]]))
  m.has("a")
  m.has("b")
  m.has("c")
})
Deno.bench("mobx", { group: "map-has" }, () => {
  const m = mobx.observable.map([["a", 1], ["b", 2]])
  m.has("a")
  m.has("b")
  m.has("c")
})
Deno.bench("v2", { group: "map-has", baseline: true }, () => {
  const m = observableMap(new Map<string, number>([["a", 1], ["b", 2]]))
  m.has("a")
  m.has("b")
  m.has("c")
})

Deno.bench("fobx", { group: "map-delete" }, () => {
  const m = fobx.observable(new Map([["a", 1], ["b", 2], ["c", 3]]))
  m.delete("a")
  m.delete("b")
})
Deno.bench("mobx", { group: "map-delete" }, () => {
  const m = mobx.observable.map([["a", 1], ["b", 2], ["c", 3]])
  m.delete("a")
  m.delete("b")
})
Deno.bench("v2", { group: "map-delete", baseline: true }, () => {
  const m = observableMap(
    new Map<string, number>([["a", 1], ["b", 2], ["c", 3]]),
  )
  m.delete("a")
  m.delete("b")
})

// Map iteration
Deno.bench("fobx", { group: "map-forEach-100" }, () => {
  const entries = new Map<string, number>()
  for (let i = 0; i < 100; i++) entries.set(`key${i}`, i)
  const m = fobx.observable(entries)
  let sum = 0
  m.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("mobx", { group: "map-forEach-100" }, () => {
  const entries: [string, number][] = []
  for (let i = 0; i < 100; i++) entries.push([`key${i}`, i])
  const m = mobx.observable.map(entries)
  let sum = 0
  m.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("v2", { group: "map-forEach-100", baseline: true }, () => {
  const entries = new Map<string, number>()
  for (let i = 0; i < 100; i++) entries.set(`key${i}`, i)
  const m = observableMap(entries)
  let sum = 0
  m.forEach((v: number) => {
    sum += v
  })
})

// Map with autorun
Deno.bench("fobx", { group: "map-autorun-set" }, () => {
  const m = fobx.observable(new Map<string, number>())
  let _count = 0
  const dispose = fobx.autorun(() => {
    _count = m.size
  })
  m.set("a", 1)
  m.set("b", 2)
  dispose()
})
Deno.bench("mobx", { group: "map-autorun-set" }, () => {
  const m = mobx.observable.map<string, number>()
  let _count = 0
  const dispose = mobx.autorun(() => {
    _count = m.size
  })
  m.set("a", 1)
  m.set("b", 2)
  dispose()
})
Deno.bench("v2", { group: "map-autorun-set", baseline: true }, () => {
  const m = observableMap<string, number>()
  let _count = 0
  const dispose = autorun(() => {
    _count = m.size
  })
  m.set("a", 1)
  m.set("b", 2)
  dispose()
})

// Map batch writes
Deno.bench("fobx", { group: "map-batch-write-100" }, () => {
  const m = fobx.observable(new Map<string, number>())
  fobx.runInAction(() => {
    for (let i = 0; i < 100; i++) m.set(`key${i}`, i)
  })
})
Deno.bench("mobx", { group: "map-batch-write-100" }, () => {
  const m = mobx.observable.map<string, number>()
  mobx.runInAction(() => {
    for (let i = 0; i < 100; i++) m.set(`key${i}`, i)
  })
})
Deno.bench("v2", { group: "map-batch-write-100", baseline: true }, () => {
  const m = observableMap<string, number>()
  runInTransaction(() => {
    for (let i = 0; i < 100; i++) m.set(`key${i}`, i)
  })
})

// ============================================================================
// OBSERVABLE SET
// ============================================================================

Deno.bench("fobx", { group: "set-create-empty" }, () => {
  fobx.observable(new Set())
})
Deno.bench("mobx", { group: "set-create-empty" }, () => {
  mobx.observable.set()
})
Deno.bench("v2", { group: "set-create-empty", baseline: true }, () => {
  observableSet()
})

Deno.bench("fobx", { group: "set-create-100" }, () => {
  const values = new Set<number>()
  for (let i = 0; i < 100; i++) values.add(i)
  fobx.observable(values)
})
Deno.bench("mobx", { group: "set-create-100" }, () => {
  const values: number[] = []
  for (let i = 0; i < 100; i++) values.push(i)
  mobx.observable.set(values)
})
Deno.bench("v2", { group: "set-create-100", baseline: true }, () => {
  const values = new Set<number>()
  for (let i = 0; i < 100; i++) values.add(i)
  observableSet(values)
})

// Set read/write
Deno.bench("fobx", { group: "set-add" }, () => {
  const s = fobx.observable(new Set<number>())
  s.add(1)
  s.add(2)
  s.add(3)
})
Deno.bench("mobx", { group: "set-add" }, () => {
  const s = mobx.observable.set<number>()
  s.add(1)
  s.add(2)
  s.add(3)
})
Deno.bench("v2", { group: "set-add", baseline: true }, () => {
  const s = observableSet<number>()
  s.add(1)
  s.add(2)
  s.add(3)
})

Deno.bench("fobx", { group: "set-has" }, () => {
  const s = fobx.observable(new Set([1, 2, 3]))
  s.has(1)
  s.has(2)
  s.has(4)
})
Deno.bench("mobx", { group: "set-has" }, () => {
  const s = mobx.observable.set([1, 2, 3])
  s.has(1)
  s.has(2)
  s.has(4)
})
Deno.bench("v2", { group: "set-has", baseline: true }, () => {
  const s = observableSet(new Set([1, 2, 3]))
  s.has(1)
  s.has(2)
  s.has(4)
})

Deno.bench("fobx", { group: "set-delete" }, () => {
  const s = fobx.observable(new Set([1, 2, 3, 4, 5]))
  s.delete(1)
  s.delete(3)
})
Deno.bench("mobx", { group: "set-delete" }, () => {
  const s = mobx.observable.set([1, 2, 3, 4, 5])
  s.delete(1)
  s.delete(3)
})
Deno.bench("v2", { group: "set-delete", baseline: true }, () => {
  const s = observableSet(new Set([1, 2, 3, 4, 5]))
  s.delete(1)
  s.delete(3)
})

// Set iteration
Deno.bench("fobx", { group: "set-forEach-100" }, () => {
  const values = new Set<number>()
  for (let i = 0; i < 100; i++) values.add(i)
  const s = fobx.observable(values)
  let sum = 0
  s.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("mobx", { group: "set-forEach-100" }, () => {
  const values: number[] = []
  for (let i = 0; i < 100; i++) values.push(i)
  const s = mobx.observable.set(values)
  let sum = 0
  s.forEach((v: number) => {
    sum += v
  })
})
Deno.bench("v2", { group: "set-forEach-100", baseline: true }, () => {
  const values = new Set<number>()
  for (let i = 0; i < 100; i++) values.add(i)
  const s = observableSet(values)
  let sum = 0
  s.forEach((v: number) => {
    sum += v
  })
})

// Set with autorun
Deno.bench("fobx", { group: "set-autorun-add" }, () => {
  const s = fobx.observable(new Set<number>())
  let _count = 0
  const dispose = fobx.autorun(() => {
    _count = s.size
  })
  s.add(1)
  s.add(2)
  dispose()
})
Deno.bench("mobx", { group: "set-autorun-add" }, () => {
  const s = mobx.observable.set<number>()
  let _count = 0
  const dispose = mobx.autorun(() => {
    _count = s.size
  })
  s.add(1)
  s.add(2)
  dispose()
})
Deno.bench("v2", { group: "set-autorun-add", baseline: true }, () => {
  const s = observableSet<number>()
  let _count = 0
  const dispose = autorun(() => {
    _count = s.size
  })
  s.add(1)
  s.add(2)
  dispose()
})

// Set batch write
Deno.bench("fobx", { group: "set-batch-write-100" }, () => {
  const s = fobx.observable(new Set<number>())
  fobx.runInAction(() => {
    for (let i = 0; i < 100; i++) s.add(i)
  })
})
Deno.bench("mobx", { group: "set-batch-write-100" }, () => {
  const s = mobx.observable.set<number>()
  mobx.runInAction(() => {
    for (let i = 0; i < 100; i++) s.add(i)
  })
})
Deno.bench("v2", { group: "set-batch-write-100", baseline: true }, () => {
  const s = observableSet<number>()
  runInTransaction(() => {
    for (let i = 0; i < 100; i++) s.add(i)
  })
})
