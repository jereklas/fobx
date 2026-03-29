/**
 * Minimal Comparison Benchmark Suite
 *
 * Compares performance across two implementations:
 * - MobX 6.x
 * - FobX
 *
 * Run with: deno bench core/__tests__/bench/minimal_comparison.bench.ts
 */

import * as mobx from "mobx"
// @deno-types="../../dist/index.d.ts"
import {
  autorun,
  computed,
  observableBox,
  reaction,
  runInTransaction,
} from "../../dist/index.production.js"

mobx.configure({ enforceActions: "never" })

// ============================================================================
// 1. OBSERVABLE BOX - READ/WRITE
// ============================================================================

Deno.bench("mobx", { group: "observable-box-create" }, () => {
  mobx.observable.box(42)
})
Deno.bench("fobx", { group: "observable-box-create", baseline: true }, () => {
  observableBox(42)
})

Deno.bench("mobx", { group: "observable-box-read" }, () => {
  const b = mobx.observable.box(42)
  b.get()
})
Deno.bench("fobx", { group: "observable-box-read", baseline: true }, () => {
  const b = observableBox(42)
  b.get()
})

Deno.bench("mobx", { group: "observable-box-write" }, () => {
  const b = mobx.observable.box(0)
  b.set(42)
})
Deno.bench("fobx", { group: "observable-box-write", baseline: true }, () => {
  const b = observableBox(0)
  b.set(42)
})

Deno.bench("mobx", { group: "observable-box-read-write" }, () => {
  const b = mobx.observable.box(0)
  const val = b.get()
  b.set(val + 1)
})
Deno.bench(
  "fobx",
  { group: "observable-box-read-write", baseline: true },
  () => {
    const b = observableBox(0)
    const val = b.get()
    b.set(val + 1)
  },
)

// ============================================================================
// 2. COMPUTED VALUES
// ============================================================================

Deno.bench("mobx", { group: "computed-simple-create" }, () => {
  const b = mobx.observable.box(5)
  mobx.computed(() => b.get() * 2)
})
Deno.bench("fobx", { group: "computed-simple-create", baseline: true }, () => {
  const b = observableBox(5)
  computed(() => b.get() * 2)
})

Deno.bench("mobx", { group: "computed-simple-read" }, () => {
  const b = mobx.observable.box(5)
  const doubled = mobx.computed(() => b.get() * 2)
  doubled.get()
  doubled.get()
})
Deno.bench("fobx", { group: "computed-simple-read", baseline: true }, () => {
  const b = observableBox(5)
  const doubled = computed(() => b.get() * 2)
  doubled.get()
  doubled.get()
})

Deno.bench("mobx", { group: "computed-invalidate-recompute" }, () => {
  const b = mobx.observable.box(5)
  const doubled = mobx.computed(() => b.get() * 2)
  doubled.get()
  b.set(10)
  doubled.get()
})
Deno.bench(
  "fobx",
  { group: "computed-invalidate-recompute", baseline: true },
  () => {
    const b = observableBox(5)
    const doubled = computed(() => b.get() * 2)
    doubled.get()
    b.set(10)
    doubled.get()
  },
)

Deno.bench("mobx", { group: "computed-complex-5-deps" }, () => {
  const a = mobx.observable.box(1)
  const b1 = mobx.observable.box(2)
  const c = mobx.observable.box(3)
  const d = mobx.observable.box(4)
  const e = mobx.observable.box(5)
  const result = mobx.computed(() =>
    a.get() + b1.get() + c.get() + d.get() + e.get()
  )

  result.get()
  a.set(10)
  result.get()
})
Deno.bench("fobx", { group: "computed-complex-5-deps", baseline: true }, () => {
  const a = observableBox(1)
  const b1 = observableBox(2)
  const c = observableBox(3)
  const d = observableBox(4)
  const e = observableBox(5)
  const result = computed(() =>
    a.get() + b1.get() + c.get() + d.get() + e.get()
  )

  result.get()
  a.set(10)
  result.get()
})

Deno.bench("mobx", { group: "computed-chained-3-levels" }, () => {
  const base = mobx.observable.box(5)
  const level1 = mobx.computed(() => base.get() * 2)
  const level2 = mobx.computed(() => level1.get() + 10)
  const level3 = mobx.computed(() => level2.get() * 3)

  level3.get()
  base.set(10)
  level3.get()
})
Deno.bench(
  "fobx",
  { group: "computed-chained-3-levels", baseline: true },
  () => {
    const base = observableBox(5)
    const level1 = computed(() => base.get() * 2)
    const level2 = computed(() => level1.get() + 10)
    const level3 = computed(() => level2.get() * 3)

    level3.get()
    base.set(10)
    level3.get()
  },
)

Deno.bench("mobx", { group: "computed-with-autorun" }, () => {
  const b = mobx.observable.box(5)
  const doubled = mobx.computed(() => b.get() * 2)
  let runs = 0
  const dispose = mobx.autorun(() => {
    runs++
    doubled.get()
  })

  b.set(10)
  b.set(15)
  dispose()
})
Deno.bench("fobx", { group: "computed-with-autorun", baseline: true }, () => {
  const b = observableBox(5)
  const doubled = computed(() => b.get() * 2)
  let runs = 0
  const dispose = autorun(() => {
    runs++
    doubled.get()
  })

  b.set(10)
  b.set(15)
  dispose()
})

// Change propagation blocking test - tests eager recomputation optimization!
Deno.bench("mobx", { group: "computed-blocking-propagation" }, () => {
  const b = mobx.observable.box(5)
  const isPositive = mobx.computed(() => b.get() > 0)
  let runs = 0
  const dispose = mobx.autorun(() => {
    runs++
    isPositive.get()
  })

  b.set(10)
  b.set(15)
  b.set(20)
  dispose()
})
Deno.bench(
  "fobx",
  { group: "computed-blocking-propagation", baseline: true },
  () => {
    const b = observableBox(5)
    const isPositive = computed(() => b.get() > 0)
    let runs = 0
    const dispose = autorun(() => {
      runs++
      isPositive.get()
    })

    b.set(10)
    b.set(15)
    b.set(20)
    dispose()
  },
)

// ============================================================================
// 3. REACTIONS - AUTORUN
// ============================================================================

Deno.bench("mobx", { group: "autorun-create" }, () => {
  const b = mobx.observable.box(0)
  const dispose = mobx.autorun(() => {
    b.get()
  })
  dispose()
})
Deno.bench("fobx", { group: "autorun-create", baseline: true }, () => {
  const b = observableBox(0)
  const dispose = autorun(() => {
    b.get()
  })
  dispose()
})

Deno.bench("mobx", { group: "autorun-trigger" }, () => {
  const b = mobx.observable.box(0)
  let runs = 0
  const dispose = mobx.autorun(() => {
    runs++
    b.get()
  })

  b.set(1)
  b.set(2)
  b.set(3)
  dispose()
})
Deno.bench("fobx", { group: "autorun-trigger", baseline: true }, () => {
  const b = observableBox(0)
  let runs = 0
  const dispose = autorun(() => {
    runs++
    b.get()
  })

  b.set(1)
  b.set(2)
  b.set(3)
  dispose()
})

// ============================================================================
// 3. REACTIONS - REACTION
// ============================================================================

Deno.bench("mobx", { group: "reaction-create" }, () => {
  const b = mobx.observable.box(0)
  const dispose = mobx.reaction(
    () => b.get(),
    () => {},
  )
  dispose()
})
Deno.bench("fobx", { group: "reaction-create", baseline: true }, () => {
  const b = observableBox(0)
  const dispose = reaction(
    () => b.get(),
    () => {},
  )
  dispose()
})

Deno.bench("mobx", { group: "reaction-trigger" }, () => {
  const b = mobx.observable.box(0)
  let runs = 0
  const dispose = mobx.reaction(
    () => b.get(),
    () => {
      runs++
    },
  )

  b.set(1)
  b.set(2)
  b.set(3)
  dispose()
})
Deno.bench("fobx", { group: "reaction-trigger", baseline: true }, () => {
  const b = observableBox(0)
  let runs = 0
  const dispose = reaction(
    () => b.get(),
    () => {
      runs++
    },
  )

  b.set(1)
  b.set(2)
  b.set(3)
  dispose()
})

Deno.bench("mobx", { group: "multiple-reactions-10" }, () => {
  const b = mobx.observable.box(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 10; i++) {
    disposers.push(mobx.autorun(() => {
      b.get()
    }))
  }

  b.set(1)
  b.set(2)

  disposers.forEach((d) => d())
})
Deno.bench("fobx", { group: "multiple-reactions-10", baseline: true }, () => {
  const b = observableBox(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 10; i++) {
    disposers.push(autorun(() => {
      b.get()
    }))
  }

  b.set(1)
  b.set(2)

  disposers.forEach((d) => d())
})

// ============================================================================
// 4. LARGE DEPENDENCY GRAPHS (Box-based only)
// ============================================================================

Deno.bench("mobx", { group: "dep-graph-wide-1-to-50" }, () => {
  const source = mobx.observable.box(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 50; i++) {
    disposers.push(mobx.autorun(() => {
      source.get()
    }))
  }

  source.set(1)
  source.set(2)

  disposers.forEach((d) => d())
})
Deno.bench("fobx", { group: "dep-graph-wide-1-to-50", baseline: true }, () => {
  const source = observableBox(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 50; i++) {
    disposers.push(autorun(() => {
      source.get()
    }))
  }

  source.set(1)
  source.set(2)

  disposers.forEach((d) => d())
})

// ============================================================================
// 5. RAPID MUTATIONS
// ============================================================================

Deno.bench("mobx", { group: "rapid-box-100-writes" }, () => {
  const b = mobx.observable.box(0)

  for (let i = 0; i < 100; i++) {
    b.set(i)
  }
})
Deno.bench("fobx", { group: "rapid-box-100-writes", baseline: true }, () => {
  const b = observableBox(0)

  for (let i = 0; i < 100; i++) {
    b.set(i)
  }
})

Deno.bench("mobx", { group: "rapid-box-with-reaction-100" }, () => {
  const b = mobx.observable.box(0)
  let runs = 0
  const dispose = mobx.autorun(() => {
    runs++
    b.get()
  })

  for (let i = 0; i < 100; i++) {
    b.set(i)
  }
  dispose()
})
Deno.bench(
  "fobx",
  { group: "rapid-box-with-reaction-100", baseline: true },
  () => {
    const b = observableBox(0)
    let runs = 0
    const dispose = autorun(() => {
      runs++
      b.get()
    })

    for (let i = 0; i < 100; i++) {
      b.set(i)
    }
    dispose()
  },
)

// ============================================================================
// 6. ACTIONS (Transaction Batching)
// ============================================================================

Deno.bench("mobx", { group: "action-simple" }, () => {
  const b = mobx.observable.box(0)
  mobx.action(() => {
    b.set(1)
    b.set(2)
    b.set(3)
  })()
})
Deno.bench("fobx", { group: "action-simple", baseline: true }, () => {
  const b = observableBox(0)
  runInTransaction(() => {
    b.set(1)
    b.set(2)
    b.set(3)
  })
})

Deno.bench("mobx", { group: "action-batching-reactions" }, () => {
  const b = mobx.observable.box(0)
  let runs = 0
  const dispose = mobx.autorun(() => {
    runs++
    b.get()
  })

  mobx.action(() => {
    b.set(1)
    b.set(2)
    b.set(3)
  })()
  dispose()
})
Deno.bench(
  "fobx",
  { group: "action-batching-reactions", baseline: true },
  () => {
    const b = observableBox(0)
    let runs = 0
    const dispose = autorun(() => {
      runs++
      b.get()
    })

    runInTransaction(() => {
      b.set(1)
      b.set(2)
      b.set(3)
    })
    dispose()
  },
)
