import { expect, test } from "@fobx/testing"
import process from "node:process"
import {
  autorun,
  computed,
  createSelector,
  observable,
  observableArray,
  observableBox,
  reaction,
  runInTransaction,
} from "../../index.ts"
import {
  buildDebugMermaidGraph,
  buildDebugTextReport,
  buildDebugTraceSummary,
  configureDebugTracking,
  explainDebugTarget,
  getDebugSnapshot,
  resetDebugTracking,
  subscribe,
} from "../../internals.ts"

function withDebugTracking<T>(run: () => T): T {
  const previousDebug = Deno.env.get("FOBX_DEBUG")
  const previousProcessDebug = process.env.FOBX_DEBUG

  Deno.env.set("FOBX_DEBUG", "1")
  process.env.FOBX_DEBUG = "1"
  resetDebugTracking()
  configureDebugTracking({ maxEvents: 256 })

  try {
    return run()
  } finally {
    resetDebugTracking()
    if (previousDebug === undefined) {
      Deno.env.delete("FOBX_DEBUG")
    } else {
      Deno.env.set("FOBX_DEBUG", previousDebug)
    }

    if (previousProcessDebug === undefined) {
      delete process.env.FOBX_DEBUG
    } else {
      process.env.FOBX_DEBUG = previousProcessDebug
    }
  }
}

test("debug snapshot captures live dependencies and observers", () => {
  withDebugTracking(() => {
    const count = observableBox(1, { name: "count" })
    const doubled = computed(() => count.get() * 2, { name: "doubled" })
    let latest = 0

    const dispose = autorun(() => {
      latest = doubled.get()
    }, { name: "watch-doubled" })

    expect(latest).toBe(2)

    const snapshot = getDebugSnapshot()
    const countNode = snapshot.nodes.find((node) => node.name === "count")
    const doubledNode = snapshot.nodes.find((node) => node.name === "doubled")
    const autorunNode = snapshot.nodes.find((node) =>
      node.name === "watch-doubled"
    )

    expect(countNode).toBeDefined()
    expect(doubledNode).toBeDefined()
    expect(autorunNode).toBeDefined()
    expect(doubledNode?.dependencyIds).toEqual([countNode!.id])
    expect(autorunNode?.dependencyIds).toEqual([doubledNode!.id])
    expect(countNode?.observerIds.includes(doubledNode!.id)).toBe(true)
    expect(doubledNode?.observerIds.includes(autorunNode!.id)).toBe(true)
    expect(snapshot.events.some((event) => event.kind === "edge-add")).toBe(
      true,
    )
    expect(snapshot.events.some((event) => event.kind === "run-start")).toBe(
      true,
    )
    expect(snapshot.events.some((event) => event.kind === "run-end")).toBe(true)

    dispose()
  })
})

test("debug event log captures skipped writes and computed updates", () => {
  withDebugTracking(() => {
    const count = observableBox(1, { name: "count" })
    const doubled = computed(() => count.get() * 2, { name: "doubled" })
    const dispose = autorun(() => {
      doubled.get()
    }, { name: "watch-doubled" })

    runInTransaction(() => {
      count.set(1)
      count.set(2)
    })

    const snapshot = getDebugSnapshot()
    expect(
      snapshot.events.some((event) =>
        event.kind === "write-skipped" && event.detail === "set-box:no-op"
      ),
    ).toBe(true)
    expect(
      snapshot.events.some((event) =>
        event.kind === "write" && event.detail === "computed:update"
      ),
    ).toBe(true)

    dispose()
  })
})

test("debug trace summary shows values, transactional writes, and downstream runs", () => {
  withDebugTracking(() => {
    const count = observableBox(1, { name: "count" })
    const doubled = computed(() => count.get() * 2, { name: "doubled" })
    let latest = 0

    const dispose = autorun(() => {
      latest = doubled.get()
    }, { name: "watch-doubled" })

    expect(latest).toBe(2)

    runInTransaction(() => {
      count.set(3)
    })

    expect(latest).toBe(6)

    const trace = buildDebugTraceSummary({ target: doubled, maxDepth: 2 })
    const countSnapshot = trace.snapshot.find((node) => node.name === "count")
    const countWrite = trace.changes.find((event) =>
      event.kind === "write" && event.nodeName === "count"
    )
    const computedWrite = trace.changes.find((event) =>
      event.kind === "write" && event.nodeName === "doubled"
    )

    expect(countSnapshot?.value?.preview).toBe("3")
    expect(countWrite?.previousValue?.preview).toBe("1")
    expect(countWrite?.value?.preview).toBe("3")
    expect(countWrite?.inTransaction).toBe(true)
    expect(countWrite?.batchDepth).toBeGreaterThan(0)
    expect(computedWrite?.previousValue?.preview).toBe("2")
    expect(computedWrite?.value?.preview).toBe("6")
    expect(
      trace.consequences.some((event) =>
        event.kind === "schedule" && event.nodeName === "watch-doubled" &&
        event.inTransaction
      ),
    ).toBe(true)
    expect(
      trace.consequences.some((event) =>
        event.kind === "run-start" && event.nodeName === "watch-doubled" &&
        !event.inTransaction
      ),
    ).toBe(true)

    dispose()
  })
})

test("debug text report prints graph first and scales the causal view into terminal output", () => {
  withDebugTracking(() => {
    const count = observableBox(2, { name: "count" })
    const total = computed(() => count.get() * 3, { name: "total" })
    const state = observable({ flag: true }, { name: "state" })

    const dispose = autorun(() => {
      total.get()
      state.flag
    }, { name: "watch-state" })

    runInTransaction(() => {
      count.set(4)
      state.flag = false
    })

    const report = buildDebugTextReport({ target: total, maxDepth: 2 })

    expect(report.includes("FOBX DEBUG REPORT")).toBe(true)
    expect(report.includes("GRAPH\n  count -> total")).toBe(true)
    expect(report.includes("  state.flag -> watch-state")).toBe(true)
    expect(report.includes("CURRENT VALUES\n  count [box] = 4")).toBe(true)
    expect(report.includes("CHANGES")).toBe(true)
    expect(report.includes("count: 2 -> 4 (set-box)")).toBe(true)
    expect(report.includes("state.flag: true -> false (set-box)")).toBe(true)
    expect(report.includes("CONSEQUENCES")).toBe(true)
    expect(
      report.includes(
        "schedule total from count -> stale (observer-notified, changed)",
      ),
    ).toBe(true)
    expect(report.indexOf("GRAPH")).toBeLessThan(report.indexOf("CHANGES"))

    dispose()
  })
})

test("debug metadata captures object property parentage and source info", () => {
  withDebugTracking(() => {
    const state = observable({
      first: 1,
      second: 2,
    }, { name: "state" })

    const snapshot = getDebugSnapshot()
    const objectNode = snapshot.nodes.find((node) => node.name === "state")
    const firstNode = snapshot.nodes.find((node) => node.name === "state.first")

    expect(objectNode).toBeDefined()
    expect(firstNode).toBeDefined()
    expect(firstNode?.parentId).toBe(objectNode?.id)
    expect(firstNode?.propertyKey).toBe("first")
    expect(firstNode?.sourceLocation?.fileName).toBe("debugTracking.test.ts")
    expect(state.first).toBe(1)
  })
})

test("debug explanation and mermaid export use live runtime data", () => {
  withDebugTracking(() => {
    const count = observableBox(3, { name: "count" })
    const doubled = computed(() => count.get() * 2, { name: "doubled" })
    const dispose = autorun(() => {
      doubled.get()
    }, { name: "watch-doubled" })

    const snapshot = getDebugSnapshot()
    const countNode = snapshot.nodes.find((node) => node.name === "count")
    const doubledNode = snapshot.nodes.find((node) => node.name === "doubled")
    const autorunNode = snapshot.nodes.find((node) =>
      node.name === "watch-doubled"
    )

    const explanation = explainDebugTarget(doubled)
    expect(explanation?.node.name).toBe("doubled")
    expect(explanation?.dependencies.map((node) => node.name)).toEqual([
      "count",
    ])
    expect(
      explanation?.observers.map((node) => node.name).includes("watch-doubled"),
    ).toBe(true)

    const mermaid = buildDebugMermaidGraph({ target: doubled, maxDepth: 2 })
    expect(mermaid.startsWith("graph LR")).toBe(true)
    expect(mermaid.includes("doubled")).toBe(true)
    expect(mermaid.includes("count")).toBe(true)
    expect(mermaid.includes("<br/>computed")).toBe(true)
    expect(mermaid.includes("classDef observable")).toBe(true)
    expect(mermaid.includes("classDef computed")).toBe(true)
    expect(mermaid.includes("classDef reaction")).toBe(true)
    expect(
      mermaid.includes(`N${countNode!.id} --> N${doubledNode!.id}`),
    ).toBe(true)
    expect(
      mermaid.includes(`N${doubledNode!.id} --> N${autorunNode!.id}`),
    ).toBe(true)

    dispose()
  })
})

test("debug records dependency removal when tracked branches change", () => {
  withDebugTracking(() => {
    const useLeft = observableBox(true, { name: "useLeft" })
    const left = observableBox(1, { name: "left" })
    const right = observableBox(2, { name: "right" })
    const value = computed(
      () => useLeft.get() ? left.get() : right.get(),
      { name: "branch-value" },
    )

    const dispose = autorun(() => {
      value.get()
    }, { name: "watch-branch" })

    runInTransaction(() => {
      useLeft.set(false)
    })

    const snapshot = getDebugSnapshot()
    const valueNode = snapshot.nodes.find((node) =>
      node.name === "branch-value"
    )
    const leftNode = snapshot.nodes.find((node) => node.name === "left")
    const rightNode = snapshot.nodes.find((node) => node.name === "right")

    expect(valueNode?.dependencyIds.includes(leftNode!.id)).toBe(false)
    expect(valueNode?.dependencyIds.includes(rightNode!.id)).toBe(true)
    expect(
      snapshot.events.some((event) =>
        event.kind === "edge-remove" && event.targetId === leftNode?.id
      ),
    ).toBe(true)

    dispose()
  })
})

test("debug tracks selector and subscription disposal", () => {
  withDebugTracking(() => {
    const selected = observableBox("a", { name: "selected" })
    const isSelected = createSelector(() => selected.get())
    const entryAdmin = isSelected.getAdmin("a")
    const disposeSubscription = subscribe(entryAdmin, () => {})

    isSelected("a")
    disposeSubscription()
    isSelected.dispose()

    const snapshot = getDebugSnapshot()
    const selectorNode = snapshot.nodes.find((node) => node.kind === "selector")
    const entryNode = snapshot.nodes.find((node) => node.name === "selector(a)")
    const subscriptionNode = snapshot.nodes.find((node) =>
      node.kind === "subscription"
    )

    expect(selectorNode?.disposed).toBe(true)
    expect(entryNode?.disposed).toBe(true)
    expect(subscriptionNode?.disposed).toBe(true)
    expect(
      snapshot.events.some((event) => event.kind === "observer-add"),
    ).toBe(true)
    expect(
      snapshot.events.some((event) => event.kind === "observer-remove"),
    ).toBe(true)
  })
})

test("debug tracks collection-result reactions and caps the event buffer", () => {
  withDebugTracking(() => {
    const items = observableArray([1, 2, 3], { name: "items" })
    configureDebugTracking({ maxEvents: 12 })

    const dispose = reaction(
      () => items,
      () => {},
      { name: "watch-items", fireImmediately: true },
    )

    runInTransaction(() => {
      items.push(4)
      items.push(5)
      items.push(6)
      items.push(7)
    })

    const snapshot = getDebugSnapshot()
    const itemsNode = snapshot.nodes.find((node) => node.name === "items")
    const reactionNode = snapshot.nodes.find((node) =>
      node.name === "watch-items"
    )

    expect(reactionNode?.dependencyIds.includes(itemsNode!.id)).toBe(true)
    expect(snapshot.events.length <= 12).toBe(true)
    expect(snapshot.events.at(-1)?.id).toBeGreaterThan(snapshot.events.length)

    dispose()
  })
})
