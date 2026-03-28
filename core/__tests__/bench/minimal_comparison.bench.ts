/**
 * V2 vs Production Comparison Benchmark Suite
 *
 * Compares performance across three implementations:
 * - Production fobx (current core dist)
 * - MobX 6.x
 * - V2 rewrite
 *
 * Run with: deno bench v2/__tests__/bench/minimal_comparison.bench.ts
 */

import * as fobx from "../../../core/dist/index.production.js"
import * as mobx from "mobx"
import { observableBox } from "../../observables/observableBox.ts"
import { computed } from "../../observables/computed.ts"
import { autorun } from "../../reactions/autorun.ts"
import { reaction } from "../../reactions/reaction.ts"
import { runInTransaction } from "../../transactions/batch.ts"

// Configure to disable warnings during benchmarks
fobx.configure({ enforceTransactions: false })
mobx.configure({ enforceActions: "never" })

// ============================================================================
// 1. OBSERVABLE BOX - READ/WRITE
// ============================================================================

Deno.bench("fobx", { group: "observable-box-create" }, () => {
  fobx.observableBox(42)
})
Deno.bench("mobx", { group: "observable-box-create" }, () => {
  mobx.observable.box(42)
})
Deno.bench("v2", { group: "observable-box-create", baseline: true }, () => {
  observableBox(42)
})

Deno.bench("fobx", { group: "observable-box-read" }, () => {
  const b = fobx.observableBox(42)
  b.value
})
Deno.bench("mobx", { group: "observable-box-read" }, () => {
  const b = mobx.observable.box(42)
  b.get()
})
Deno.bench("v2", { group: "observable-box-read", baseline: true }, () => {
  const b = observableBox(42)
  b.get()
})

Deno.bench("fobx", { group: "observable-box-write" }, () => {
  const b = fobx.observableBox(0)
  b.value = 42
})
Deno.bench("mobx", { group: "observable-box-write" }, () => {
  const b = mobx.observable.box(0)
  b.set(42)
})
Deno.bench("v2", { group: "observable-box-write", baseline: true }, () => {
  const b = observableBox(0)
  b.set(42)
})

Deno.bench("fobx", { group: "observable-box-read-write" }, () => {
  const b = fobx.observableBox(0)
  const val = b.value
  b.value = val + 1
})
Deno.bench("mobx", { group: "observable-box-read-write" }, () => {
  const b = mobx.observable.box(0)
  const val = b.get()
  b.set(val + 1)
})
Deno.bench("v2", { group: "observable-box-read-write", baseline: true }, () => {
  const b = observableBox(0)
  const val = b.get()
  b.set(val + 1)
})

// ============================================================================
// 2. COMPUTED VALUES
// ============================================================================

Deno.bench("fobx", { group: "computed-simple-create" }, () => {
  const b = fobx.observableBox(5)
  fobx.computed(() => b.value * 2)
})
Deno.bench("mobx", { group: "computed-simple-create" }, () => {
  const b = mobx.observable.box(5)
  mobx.computed(() => b.get() * 2)
})
Deno.bench("v2", { group: "computed-simple-create", baseline: true }, () => {
  const b = observableBox(5)
  computed(() => b.get() * 2)
})

Deno.bench("fobx", { group: "computed-simple-read" }, () => {
  const b = fobx.observableBox(5)
  const doubled = fobx.computed(() => b.value * 2)
  doubled.value
  doubled.value
})
Deno.bench("mobx", { group: "computed-simple-read" }, () => {
  const b = mobx.observable.box(5)
  const doubled = mobx.computed(() => b.get() * 2)
  doubled.get()
  doubled.get()
})
Deno.bench("v2", { group: "computed-simple-read", baseline: true }, () => {
  const b = observableBox(5)
  const doubled = computed(() => b.get() * 2)
  doubled.get()
  doubled.get()
})

Deno.bench("fobx", { group: "computed-invalidate-recompute" }, () => {
  const b = fobx.observableBox(5)
  const doubled = fobx.computed(() => b.value * 2)
  doubled.value
  b.value = 10
  doubled.value
})
Deno.bench("mobx", { group: "computed-invalidate-recompute" }, () => {
  const b = mobx.observable.box(5)
  const doubled = mobx.computed(() => b.get() * 2)
  doubled.get()
  b.set(10)
  doubled.get()
})
Deno.bench(
  "v2",
  { group: "computed-invalidate-recompute", baseline: true },
  () => {
    const b = observableBox(5)
    const doubled = computed(() => b.get() * 2)
    doubled.get()
    b.set(10)
    doubled.get()
  },
)

Deno.bench("fobx", { group: "computed-complex-5-deps" }, () => {
  const a = fobx.observableBox(1)
  const b1 = fobx.observableBox(2)
  const c = fobx.observableBox(3)
  const d = fobx.observableBox(4)
  const e = fobx.observableBox(5)
  const result = fobx.computed(() =>
    a.value + b1.value + c.value + d.value + e.value
  )

  result.value
  a.value = 10
  result.value
})
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
Deno.bench("v2", { group: "computed-complex-5-deps", baseline: true }, () => {
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

Deno.bench("fobx", { group: "computed-chained-3-levels" }, () => {
  const base = fobx.observableBox(5)
  const level1 = fobx.computed(() => base.value * 2)
  const level2 = fobx.computed(() => level1.value + 10)
  const level3 = fobx.computed(() => level2.value * 3)

  level3.value
  base.value = 10
  level3.value
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
  "v2",
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

Deno.bench("fobx", { group: "computed-with-autorun" }, () => {
  const b = fobx.observableBox(5)
  const doubled = fobx.computed(() => b.value * 2)
  let runs = 0
  const dispose = fobx.autorun(() => {
    runs++
    doubled.value
  })

  b.value = 10
  b.value = 15
  dispose()
})
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
Deno.bench("v2", { group: "computed-with-autorun", baseline: true }, () => {
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
Deno.bench("fobx", { group: "computed-blocking-propagation" }, () => {
  const b = fobx.observableBox(5)
  const isPositive = fobx.computed(() => b.value > 0)
  let runs = 0
  const dispose = fobx.autorun(() => {
    runs++
    isPositive.value
  })

  // Changes box but isPositive stays true - should block
  b.value = 10
  b.value = 15
  b.value = 20
  dispose()
})
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
  "v2",
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

Deno.bench("fobx", { group: "autorun-create" }, () => {
  const b = fobx.observableBox(0)
  const dispose = fobx.autorun(() => {
    b.value
  })
  dispose()
})
Deno.bench("mobx", { group: "autorun-create" }, () => {
  const b = mobx.observable.box(0)
  const dispose = mobx.autorun(() => {
    b.get()
  })
  dispose()
})
Deno.bench("v2", { group: "autorun-create", baseline: true }, () => {
  const b = observableBox(0)
  const dispose = autorun(() => {
    b.get()
  })
  dispose()
})

Deno.bench("fobx", { group: "autorun-trigger" }, () => {
  const b = fobx.observableBox(0)
  let runs = 0
  const dispose = fobx.autorun(() => {
    runs++
    b.value
  })

  b.value = 1
  b.value = 2
  b.value = 3
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
Deno.bench("v2", { group: "autorun-trigger", baseline: true }, () => {
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

Deno.bench("fobx", { group: "reaction-create" }, () => {
  const b = fobx.observableBox(0)
  const dispose = fobx.reaction(
    () => b.value,
    () => {},
  )
  dispose()
})
Deno.bench("mobx", { group: "reaction-create" }, () => {
  const b = mobx.observable.box(0)
  const dispose = mobx.reaction(
    () => b.get(),
    () => {},
  )
  dispose()
})
Deno.bench("v2", { group: "reaction-create", baseline: true }, () => {
  const b = observableBox(0)
  const dispose = reaction(
    () => b.get(),
    () => {},
  )
  dispose()
})

Deno.bench("fobx", { group: "reaction-trigger" }, () => {
  const b = fobx.observableBox(0)
  let runs = 0
  const dispose = fobx.reaction(
    () => b.value,
    () => {
      runs++
    },
  )

  b.value = 1
  b.value = 2
  b.value = 3
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
Deno.bench("v2", { group: "reaction-trigger", baseline: true }, () => {
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

Deno.bench("fobx", { group: "multiple-reactions-10" }, () => {
  const b = fobx.observableBox(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 10; i++) {
    disposers.push(fobx.autorun(() => {
      b.value
    }))
  }

  b.value = 1
  b.value = 2

  disposers.forEach((d) => d())
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
Deno.bench("v2", { group: "multiple-reactions-10", baseline: true }, () => {
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

Deno.bench("fobx", { group: "dep-graph-wide-1-to-50" }, () => {
  const source = fobx.observableBox(0)
  const disposers: Array<() => void> = []

  for (let i = 0; i < 50; i++) {
    disposers.push(fobx.autorun(() => {
      source.value
    }))
  }

  source.value = 1
  source.value = 2

  disposers.forEach((d) => d())
})
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
Deno.bench("v2", { group: "dep-graph-wide-1-to-50", baseline: true }, () => {
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

Deno.bench("fobx", { group: "rapid-box-100-writes" }, () => {
  const b = fobx.observableBox(0)

  for (let i = 0; i < 100; i++) {
    b.value = i
  }
})
Deno.bench("mobx", { group: "rapid-box-100-writes" }, () => {
  const b = mobx.observable.box(0)

  for (let i = 0; i < 100; i++) {
    b.set(i)
  }
})
Deno.bench("v2", { group: "rapid-box-100-writes", baseline: true }, () => {
  const b = observableBox(0)

  for (let i = 0; i < 100; i++) {
    b.set(i)
  }
})

Deno.bench("fobx", { group: "rapid-box-with-reaction-100" }, () => {
  const b = fobx.observableBox(0)
  let runs = 0
  const dispose = fobx.autorun(() => {
    runs++
    b.value
  })

  for (let i = 0; i < 100; i++) {
    b.value = i
  }
  dispose()
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
  "v2",
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

Deno.bench("fobx", { group: "action-simple" }, () => {
  const b = fobx.observableBox(0)
  fobx.action(() => {
    b.value = 1
    b.value = 2
    b.value = 3
  })()
})
Deno.bench("mobx", { group: "action-simple" }, () => {
  const b = mobx.observable.box(0)
  mobx.action(() => {
    b.set(1)
    b.set(2)
    b.set(3)
  })()
})
Deno.bench("v2", { group: "action-simple", baseline: true }, () => {
  const b = observableBox(0)
  runInTransaction(() => {
    b.set(1)
    b.set(2)
    b.set(3)
  })
})

Deno.bench("fobx", { group: "action-batching-reactions" }, () => {
  const b = fobx.observableBox(0)
  let runs = 0
  const dispose = fobx.autorun(() => {
    runs++
    b.value
  })

  fobx.action(() => {
    b.value = 1
    b.value = 2
    b.value = 3
  })()
  dispose()
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
  "v2",
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
