---
title: Debug Graph Internals API
navTitle: Debug Graph API
navSection: ["@fobx/core", "Internals"]
navOrder: 1
---

This page documents the current internal-only debug graph helpers exported from
`@fobx/core/internals`.

These APIs are intentionally internal and experimental. They are published so
people can try them, but the exact shape is not yet treated as stable public
API.

## Enabling the runtime

The debug graph runtime is only active when FobX is built with `FOBX_DEBUG=1`.

```sh
FOBX_DEBUG=1 deno test --allow-env --allow-read
cd core && FOBX_DEBUG=1 deno task build
```

Hot-path instrumentation is guarded by literal `if (process.env.FOBX_DEBUG)`
checks. In current builds that strips the debug callsites from hot paths when
debug is off, even though the helper exports themselves still remain part of the
internal surface.

## Exports

```ts
import {
  buildDebugMermaidGraph,
  buildDebugTextReport,
  buildDebugTraceSummary,
  configureDebugTracking,
  explainDebugTarget,
  getDebugSnapshot,
  resetDebugTracking,
} from "@fobx/core/internals"
```

## `configureDebugTracking(options)`

Configure the in-memory event buffer.

```ts
configureDebugTracking({ maxEvents: 2000 })
```

### Options

| Field       | Type     | Default | Meaning                                 |
| ----------- | -------- | ------- | --------------------------------------- |
| `maxEvents` | `number` | `2000`  | Maximum number of retained debug events |

If the buffer is already larger than the new cap, older events are dropped
immediately.

## `resetDebugTracking()`

Clear all current debug graph state.

```ts
resetDebugTracking()
```

Use this before running a focused scenario so the resulting graph and event log
are easier to inspect.

## `getDebugSnapshot()`

Return a serializable snapshot of the currently live debug graph and retained
event log.

```ts
const snapshot = getDebugSnapshot()
```

### High-level shape

```ts
interface DebugSnapshot {
  enabled: boolean
  maxEvents: number
  nodes: DebugNodeSnapshot[]
  events: DebugEventSnapshot[]
}
```

### `nodes`

Each node represents one tracked runtime object, such as a box, computed,
autorun, reaction, tracker, collection admin, object property admin, selector
entry, or subscription.

Relevant fields:

| Field                | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `id`                 | Internal debug-node id                                               |
| `runtimeId`          | Runtime admin id when one exists                                     |
| `kind`               | Box, computed, autorun, observable-object, selector-entry, and so on |
| `name`               | Runtime debug name                                                   |
| `sourceLocation`     | First external source location, when available                       |
| `sourceStack`        | Up to 4 external frames                                              |
| `sourceGroup`        | `file:line:column` grouping key                                      |
| `parentId`           | Parent debug-node id for nested nodes such as object properties      |
| `propertyKey`        | Property or slot label when applicable                               |
| `disposed`           | Whether this node has been disposed                                  |
| `reactionState`      | `up-to-date`, `possibly-stale`, or `stale` for reaction-like nodes   |
| `dependencyIds`      | Current outgoing dependency edges                                    |
| `observerIds`        | Current incoming observer edges                                      |
| `counts`             | Read, write, notify, schedule, run, and disposal counters            |
| `lastValue`          | Shallow value summary                                                |
| `lastScheduleReason` | Most recent scheduling reason                                        |
| `lastWriteReason`    | Most recent write reason                                             |

### `events`

Each event represents a point-in-time debug action such as create, write,
notify, schedule, edge-add, edge-remove, run-start, run-end, observer-add,
observer-remove, or dispose.

Useful fields:

| Field              | Meaning                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `id`               | Monotonic event id                                                 |
| `kind`             | Event type                                                         |
| `nodeId`           | Primary node when the event targets one node                       |
| `sourceId`         | Source node for edge or schedule events                            |
| `targetId`         | Target node for edge events                                        |
| `detail`           | Operation-specific detail string                                   |
| `notificationType` | `changed` or `indeterminate`                                       |
| `fromState`        | Previous reaction state                                            |
| `toState`          | New reaction state                                                 |
| `location`         | First external frame for stack-backed events                       |
| `value`            | Shallow value summary for write events                             |
| `previousValue`    | Previous shallow value summary for tracked writes when available   |
| `inTransaction`    | Whether the event happened while batch depth was greater than zero |
| `batchDepth`       | Scheduler batch depth captured for the event                       |

## `buildDebugTraceSummary(options)`

Build a transaction-oriented view of the current debug state: current values,
recent writes, and the downstream notify or run sequence.

```ts
const trace = buildDebugTraceSummary({
  target: myComputed,
  maxDepth: 2,
  limit: 40,
})
```

### Options

| Field          | Type     | Default | Meaning                                                |
| -------------- | -------- | ------- | ------------------------------------------------------ |
| `target`       | `object` | none    | Optional root object to summarize a reachable subgraph |
| `maxDepth`     | `number` | `2`     | Traversal depth when `target` is provided              |
| `sinceEventId` | `number` | none    | Ignore older events before this id                     |
| `limit`        | `number` | `40`    | Maximum number of retained relevant events to include  |

### High-level shape

```ts
interface DebugTraceSummary {
  enabled: boolean
  fromEventId?: number
  toEventId?: number
  snapshot: DebugTraceNodeSnapshot[]
  changes: DebugTraceEventSummary[]
  consequences: DebugTraceEventSummary[]
}
```

Use this when the question is not “what is the graph?” but “what changed, was it
inside a transaction, and what ran because of it?”

## `buildDebugTextReport(options)`

Build a terminal-oriented report that prints the local dependency graph first,
then current values, then writes, then downstream consequences.

```ts
const report = buildDebugTextReport({
  target: myComputed,
  maxDepth: 2,
  limit: 40,
})
```

This helper uses the same filtering options as `buildDebugTraceSummary()`. It is
usually the most practical format for:

- terminal sessions
- CI logs
- PR comments
- bug reports pasted into issues or chat

Use it when you want one human-readable summary instead of multiple separate
exports.

## `explainDebugTarget(target)`

Return a focused explanation for one live node.

```ts
const explanation = explainDebugTarget(myComputed)
```

### Shape

```ts
interface DebugExplanation {
  node: DebugNodeSnapshot
  dependencies: DebugNodeSnapshot[]
  observers: DebugNodeSnapshot[]
  recentEvents: DebugEventSnapshot[]
}
```

This is the fastest way to answer questions such as:

- what does this reaction currently depend on?
- who is observing this computed?
- what were the most recent events involving this node?

## `buildDebugMermaidGraph(options)`

Build Mermaid markup from the current debug graph.

```ts
const mermaid = buildDebugMermaidGraph({
  target: myComputed,
  maxDepth: 2,
})
```

### Options

| Field      | Type     | Default | Meaning                                             |
| ---------- | -------- | ------- | --------------------------------------------------- |
| `target`   | `object` | none    | Optional root object to render a reachable subgraph |
| `maxDepth` | `number` | `2`     | Traversal depth when `target` is provided           |

The output is Mermaid `graph LR` markup with nodes labeled by name, kind, and
source location when one is available. The graph uses different styles for the
three main runtime categories:

- observables: green rectangular nodes
- computeds: amber rounded nodes
- reactions and reaction-like controllers: blue double-rectangle nodes

Edges point from dependency to consumer, so the graph reads left-to-right as
data or invalidation flow.

## Practical workflow

```ts
resetDebugTracking()
configureDebugTracking({ maxEvents: 500 })

// Run the scenario you care about here.

const snapshot = getDebugSnapshot()
const report = buildDebugTextReport({ target: someReaction, maxDepth: 3 })
const trace = buildDebugTraceSummary({ target: someReaction, maxDepth: 3 })
const explanation = explainDebugTarget(someReaction)
const mermaid = buildDebugMermaidGraph({ target: someReaction, maxDepth: 3 })
```

If you want to compare those outputs side by side for the same concrete
scenario, the guide at `/core/guides/debugging-reactions/` now includes an
explicit same-scenario comparison section.

For a step-by-step reaction debugging workflow and concrete export examples, see
the guide at `/core/guides/debugging-reactions/`.
