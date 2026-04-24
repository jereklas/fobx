// TODO: Keep this module out of the main production bundle once the debug API
// moves behind a separate debug-only entrypoint or build target.

import {
  $fobx,
  $scheduler,
  type Any,
  KIND_AUTORUN,
  KIND_BOX,
  KIND_COLLECTION,
  KIND_COMPUTED,
  KIND_REACTION,
  KIND_TRACKER,
  KIND_WHEN,
  NOTIFY_CHANGED,
  type ObservableAdmin,
  observerCount,
  POSSIBLY_STALE,
  type ReactionAdmin,
  STALE,
  UP_TO_DATE,
} from "./global.ts"
import {
  captureCurrentStack,
  type DebugSourceLocation,
  getExternalSourceLocations,
  getFirstExternalSourceLocation,
} from "../utils/debug.ts"

export interface DebugValueSummary {
  type: string
  preview: string
  size?: number
  constructorName?: string
}

export interface DebugNodeSnapshot {
  id: number
  runtimeId: number | null
  kind: string
  name: string
  sourceLocation?: DebugSourceLocation
  sourceGroup?: string
  sourceStack: DebugSourceLocation[]
  parentId?: number
  parentLabel?: string
  propertyKey?: string
  disposed: boolean
  reactionState?: string
  dependencyIds: number[]
  observerIds: number[]
  counts: {
    reads: number
    writes: number
    notifications: number
    schedules: number
    runs: number
    disposals: number
  }
  lastValue?: DebugValueSummary
  lastScheduleReason?: string
  lastWriteReason?: string
  lastEventId?: number
}

export interface DebugEventSnapshot {
  id: number
  kind: string
  nodeId?: number
  sourceId?: number
  targetId?: number
  detail?: string
  notificationType?: "changed" | "indeterminate"
  fromState?: string
  toState?: string
  location?: DebugSourceLocation
  sourceGroup?: string
  value?: DebugValueSummary
  previousValue?: DebugValueSummary
  inTransaction: boolean
  batchDepth: number
}

export interface DebugSnapshot {
  enabled: boolean
  maxEvents: number
  nodes: DebugNodeSnapshot[]
  events: DebugEventSnapshot[]
}

export interface DebugExplanation {
  node: DebugNodeSnapshot
  dependencies: DebugNodeSnapshot[]
  observers: DebugNodeSnapshot[]
  recentEvents: DebugEventSnapshot[]
}

export interface DebugTraceNodeSnapshot {
  id: number
  kind: string
  name: string
  disposed: boolean
  reactionState?: string
  value?: DebugValueSummary
  dependencyIds: number[]
  observerIds: number[]
}

export interface DebugTraceEventSummary {
  id: number
  kind: string
  nodeId?: number
  nodeName?: string
  sourceId?: number
  sourceName?: string
  targetId?: number
  targetName?: string
  detail?: string
  notificationType?: "changed" | "indeterminate"
  fromState?: string
  toState?: string
  value?: DebugValueSummary
  previousValue?: DebugValueSummary
  inTransaction: boolean
  batchDepth: number
}

export interface DebugTraceSummary {
  enabled: boolean
  fromEventId?: number
  toEventId?: number
  snapshot: DebugTraceNodeSnapshot[]
  changes: DebugTraceEventSummary[]
  consequences: DebugTraceEventSummary[]
}

export interface DebugOptions {
  maxEvents?: number
}

export interface DebugTraceOptions {
  target?: object
  maxDepth?: number
  sinceEventId?: number
  limit?: number
}

interface DebugEdgeState {
  targetId: number
  active: boolean
  seenCount: number
  firstEventId: number
  lastEventId: number
  lastRemovedEventId?: number
  rawStack?: string
}

interface DebugNodeState {
  id: number
  runtimeId: number | null
  kind: string
  name: string
  rawStack?: string
  createdEventId: number
  disposed: boolean
  parentId?: number
  parentLabel?: string
  propertyKey?: string
  depIds: Set<number>
  observerIds: Set<number>
  edges: Map<number, DebugEdgeState>
  reads: number
  writes: number
  notifications: number
  schedules: number
  runs: number
  disposals: number
  reactionState?: number
  lastValue?: DebugValueSummary
  lastScheduleReason?: string
  lastWriteReason?: string
  lastEventId?: number
}

interface DebugEventState {
  id: number
  kind: string
  nodeId?: number
  sourceId?: number
  targetId?: number
  detail?: string
  notificationType?: "changed" | "indeterminate"
  fromState?: string
  toState?: string
  rawStack?: string
  value?: DebugValueSummary
  previousValue?: DebugValueSummary
  inTransaction: boolean
  batchDepth: number
}

interface DebugRefBucket {
  refs: WeakRef<object>[]
}

interface DebugGraphState {
  nodes: WeakMap<object, DebugNodeState>
  ids: Map<number, DebugRefBucket>
  nextNodeId: number
  nextEventId: number
  maxEvents: number
  events: DebugEventState[]
}

interface RegisterDebugNodeOptions {
  admin?: { id?: number; kind?: number; name?: string }
  kind: string
  name: string
  aliases?: object[]
  parentTarget?: object
  parentLabel?: string
  propertyKey?: PropertyKey
  stack?: string
}

interface RecordWriteOptions {
  changed: boolean
  operation: string
  value?: unknown
  previousValue?: unknown
  stack?: string
}

interface RecordNotifyOptions {
  notificationType: number
  detail?: string
}

interface RecordScheduleOptions {
  source?: ObservableAdmin
  notificationType?: number
  reason: string
  fromState?: number
  toState?: number
}

const $fobxDebug = Symbol.for("fobx-debug-graph")
const DEFAULT_MAX_EVENTS = 2000

function createDebugGraphState(): DebugGraphState {
  return {
    nodes: new WeakMap(),
    ids: new Map(),
    nextNodeId: 0,
    nextEventId: 0,
    maxEvents: DEFAULT_MAX_EVENTS,
    events: [],
  }
}

function getDebugGraphState(): DebugGraphState {
  const globalObject = globalThis as Any
  const existing = globalObject[$fobxDebug] as DebugGraphState | undefined
  if (existing) return existing

  const created = createDebugGraphState()
  globalObject[$fobxDebug] = created
  return created
}

function isObject(value: unknown): value is object {
  return (typeof value === "object" && value !== null) ||
    typeof value === "function"
}

function notificationTypeToLabel(notificationType: number):
  | "changed"
  | "indeterminate" {
  return notificationType === NOTIFY_CHANGED ? "changed" : "indeterminate"
}

function reactionStateToLabel(state: number | undefined): string | undefined {
  if (state === undefined) return undefined
  if (state === UP_TO_DATE) return "up-to-date"
  if (state === POSSIBLY_STALE) return "possibly-stale"
  if (state === STALE) return "stale"
  return `unknown(${state})`
}

function adminKindToLabel(kind: number | undefined): string {
  switch (kind) {
    case KIND_BOX:
      return "box"
    case KIND_COMPUTED:
      return "computed"
    case KIND_AUTORUN:
      return "autorun"
    case KIND_REACTION:
      return "reaction"
    case KIND_WHEN:
      return "when"
    case KIND_COLLECTION:
      return "collection"
    case KIND_TRACKER:
      return "tracker"
    default:
      return "node"
  }
}

function formatPropertyKey(key: PropertyKey | undefined): string | undefined {
  if (key === undefined) return undefined
  return typeof key === "symbol" ? key.toString() : String(key)
}

function summarizeValue(value: unknown): DebugValueSummary {
  if (value === null) {
    return { type: "null", preview: "null" }
  }

  const valueType = typeof value
  if (valueType === "string") {
    const text = value as string
    const preview = text.length > 60 ? `${text.slice(0, 57)}...` : text
    return { type: "string", preview: JSON.stringify(preview) }
  }
  if (
    valueType === "number" || valueType === "boolean" ||
    valueType === "bigint" || valueType === "undefined"
  ) {
    return { type: valueType, preview: String(value) }
  }
  if (valueType === "symbol") {
    return { type: "symbol", preview: String(value) }
  }
  if (valueType === "function") {
    const fn = value as (...args: unknown[]) => unknown
    return {
      type: "function",
      preview: fn.name === "" ? "<anonymous function>" : fn.name,
    }
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      preview: `Array(${value.length})`,
      size: value.length,
      constructorName: value.constructor?.name,
    }
  }
  if (value instanceof Map) {
    return {
      type: "map",
      preview: `Map(${value.size})`,
      size: value.size,
      constructorName: value.constructor?.name,
    }
  }
  if (value instanceof Set) {
    return {
      type: "set",
      preview: `Set(${value.size})`,
      size: value.size,
      constructorName: value.constructor?.name,
    }
  }

  const constructorName = (value as { constructor?: { name?: string } })
    .constructor?.name
  return {
    type: "object",
    preview: constructorName
      ? `[object ${constructorName}]`
      : "[object Object]",
    constructorName,
  }
}

function addRef(state: DebugGraphState, nodeId: number, target: object): void {
  const bucket = state.ids.get(nodeId)
  if (bucket) {
    bucket.refs.push(new WeakRef(target))
    return
  }

  state.ids.set(nodeId, { refs: [new WeakRef(target)] })
}

function pushEvent(
  state: DebugGraphState,
  event: Omit<DebugEventState, "id" | "inTransaction" | "batchDepth">,
): number {
  const id = ++state.nextEventId
  state.events.push({
    ...event,
    id,
    inTransaction: $scheduler.batchDepth > 0,
    batchDepth: $scheduler.batchDepth,
  })
  if (state.events.length > state.maxEvents) {
    state.events.splice(0, state.events.length - state.maxEvents)
  }
  return id
}

function lookupNodeState(target: unknown): DebugNodeState | undefined {
  if (!isObject(target)) return undefined

  const state = getDebugGraphState()
  const direct = state.nodes.get(target)
  if (direct) return direct

  const maybeAdmin = (target as Any)[$fobx]
  if (isObject(maybeAdmin)) {
    return state.nodes.get(maybeAdmin)
  }

  return undefined
}

function ensureNodeState(
  target: object,
  options?: Partial<RegisterDebugNodeOptions>,
): DebugNodeState {
  const state = getDebugGraphState()
  const existing = state.nodes.get(target)
  if (existing) return existing

  const name = options?.name ??
    ("name" in target && typeof (target as { name?: unknown }).name === "string"
      ? (target as { name: string }).name
      : options?.admin?.name ?? adminKindToLabel(options?.admin?.kind))
  const kind = options?.kind ?? adminKindToLabel(options?.admin?.kind)
  const rawStack = options?.stack
  const node: DebugNodeState = {
    id: ++state.nextNodeId,
    runtimeId: options?.admin?.id ?? null,
    kind,
    name,
    rawStack,
    createdEventId: 0,
    disposed: false,
    parentLabel: options?.parentLabel,
    propertyKey: formatPropertyKey(options?.propertyKey),
    depIds: new Set(),
    observerIds: new Set(),
    edges: new Map(),
    reads: 0,
    writes: 0,
    notifications: 0,
    schedules: 0,
    runs: 0,
    disposals: 0,
    reactionState: undefined,
    lastEventId: undefined,
  }
  state.nodes.set(target, node)
  addRef(state, node.id, target)
  if (options?.aliases) {
    for (const alias of options.aliases) {
      state.nodes.set(alias, node)
      addRef(state, node.id, alias)
    }
  }
  if (options?.parentTarget) {
    node.parentId = ensureNodeState(options.parentTarget).id
  }
  const createdEventId = pushEvent(state, {
    kind: "create",
    nodeId: node.id,
    detail: `${node.kind}:${node.name}`,
    rawStack,
  })
  node.createdEventId = createdEventId
  node.lastEventId = createdEventId
  return node
}

export function configureDebugTracking(options: DebugOptions = {}): void {
  const state = getDebugGraphState()
  if (
    options.maxEvents !== undefined && Number.isFinite(options.maxEvents) &&
    options.maxEvents > 0
  ) {
    state.maxEvents = Math.floor(options.maxEvents)
    if (state.events.length > state.maxEvents) {
      state.events.splice(0, state.events.length - state.maxEvents)
    }
  }
}

export function resetDebugTracking(): void {
  const globalObject = globalThis as Any
  globalObject[$fobxDebug] = createDebugGraphState()
}

export function registerDebugNode(
  target: object,
  options: RegisterDebugNodeOptions,
): number {
  return ensureNodeState(target, {
    ...options,
    stack: options.stack ?? captureCurrentStack(),
  }).id
}

export function attachDebugNodeMetadata(
  target: object,
  options: {
    parentTarget?: object
    parentLabel?: string
    propertyKey?: PropertyKey
  },
): void {
  const node = ensureNodeState(target)
  if (options.parentTarget) {
    const parentNode = ensureNodeState(options.parentTarget)
    node.parentId = parentNode.id
    if (getFirstExternalSourceLocation(node.rawStack) === undefined) {
      node.rawStack = parentNode.rawStack
    }
  }
  if (options.parentLabel !== undefined) {
    node.parentLabel = options.parentLabel
  }
  if (options.propertyKey !== undefined) {
    node.propertyKey = formatPropertyKey(options.propertyKey)
  }
}

export function markDebugDisposed(target: object): void {
  const node = lookupNodeState(target)
  if (!node || node.disposed) return

  node.disposed = true
  node.disposals++
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "dispose",
    nodeId: node.id,
  })
  node.lastEventId = eventId
}

export function recordDebugDependencyRead(
  reaction: ReactionAdmin,
  observable: ObservableAdmin,
  options: { added: boolean; stack?: string },
): void {
  const reactionNode = ensureNodeState(reaction, {
    admin: reaction,
    kind: adminKindToLabel(reaction.kind),
    name: reaction.name,
  })
  const observableNode = ensureNodeState(observable, {
    admin: observable,
    kind: adminKindToLabel(observable.kind),
    name: observable.name,
  })
  const rawStack = options.stack ?? captureCurrentStack()

  reactionNode.depIds.add(observableNode.id)
  observableNode.observerIds.add(reactionNode.id)
  reactionNode.reads++

  const edge = reactionNode.edges.get(observableNode.id)
  if (edge) {
    edge.active = true
    edge.seenCount++
    edge.lastEventId = pushEvent(getDebugGraphState(), {
      kind: options.added ? "edge-add" : "edge-confirm",
      sourceId: reactionNode.id,
      targetId: observableNode.id,
      rawStack,
    })
    edge.rawStack = rawStack ?? edge.rawStack
    reactionNode.lastEventId = edge.lastEventId
    observableNode.lastEventId = edge.lastEventId
    return
  }

  const eventId = pushEvent(getDebugGraphState(), {
    kind: "edge-add",
    sourceId: reactionNode.id,
    targetId: observableNode.id,
    rawStack,
  })
  reactionNode.edges.set(observableNode.id, {
    targetId: observableNode.id,
    active: true,
    seenCount: 1,
    firstEventId: eventId,
    lastEventId: eventId,
    rawStack,
  })
  reactionNode.lastEventId = eventId
  observableNode.lastEventId = eventId
}

export function recordDebugDependencyRemoved(
  reaction: ReactionAdmin,
  observable: ObservableAdmin,
): void {
  const reactionNode = lookupNodeState(reaction)
  const observableNode = lookupNodeState(observable)
  if (!reactionNode || !observableNode) return

  reactionNode.depIds.delete(observableNode.id)
  observableNode.observerIds.delete(reactionNode.id)
  const edge = reactionNode.edges.get(observableNode.id)
  if (!edge) return

  edge.active = false
  edge.lastRemovedEventId = pushEvent(getDebugGraphState(), {
    kind: "edge-remove",
    sourceId: reactionNode.id,
    targetId: observableNode.id,
  })
  reactionNode.edges.delete(observableNode.id)
  reactionNode.lastEventId = edge.lastRemovedEventId
  observableNode.lastEventId = edge.lastRemovedEventId
}

export function recordDebugObserverLink(
  observable: ObservableAdmin,
  reaction: ReactionAdmin,
  detail: string,
): void {
  const observableNode = ensureNodeState(observable, {
    admin: observable,
    kind: adminKindToLabel(observable.kind),
    name: observable.name,
  })
  const reactionNode = ensureNodeState(reaction, {
    admin: reaction,
    kind: adminKindToLabel(reaction.kind),
    name: reaction.name,
  })
  observableNode.observerIds.add(reactionNode.id)
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "observer-add",
    sourceId: observableNode.id,
    targetId: reactionNode.id,
    detail,
  })
  observableNode.lastEventId = eventId
  reactionNode.lastEventId = eventId
}

export function recordDebugObserverUnlink(
  observable: ObservableAdmin,
  reaction: ReactionAdmin,
  detail: string,
): void {
  const observableNode = lookupNodeState(observable)
  const reactionNode = lookupNodeState(reaction)
  if (!observableNode || !reactionNode) return

  observableNode.observerIds.delete(reactionNode.id)
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "observer-remove",
    sourceId: observableNode.id,
    targetId: reactionNode.id,
    detail,
  })
  observableNode.lastEventId = eventId
  reactionNode.lastEventId = eventId
}

export function recordDebugWrite(
  observable: ObservableAdmin,
  options: RecordWriteOptions,
): void {
  const node = ensureNodeState(observable, {
    admin: observable,
    kind: adminKindToLabel(observable.kind),
    name: observable.name,
  })
  node.lastValue = summarizeValue(
    options.value === undefined ? observable.value : options.value,
  )
  node.lastWriteReason = options.operation
  if (options.changed) {
    node.writes++
  }
  const eventId = pushEvent(getDebugGraphState(), {
    kind: options.changed ? "write" : "write-skipped",
    nodeId: node.id,
    detail: options.operation,
    rawStack: options.stack ?? captureCurrentStack(),
    value: node.lastValue,
    previousValue: options.previousValue === undefined
      ? undefined
      : summarizeValue(options.previousValue),
  })
  node.lastEventId = eventId
}

export function recordDebugNotify(
  observable: ObservableAdmin,
  options: RecordNotifyOptions,
): void {
  const node = ensureNodeState(observable, {
    admin: observable,
    kind: adminKindToLabel(observable.kind),
    name: observable.name,
  })
  node.notifications++
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "notify",
    nodeId: node.id,
    detail: options.detail ?? `observers=${observerCount(observable)}`,
    notificationType: notificationTypeToLabel(options.notificationType),
  })
  node.lastEventId = eventId
}

export function recordDebugSchedule(
  reaction: ReactionAdmin,
  options: RecordScheduleOptions,
): void {
  const reactionNode = ensureNodeState(reaction, {
    admin: reaction,
    kind: adminKindToLabel(reaction.kind),
    name: reaction.name,
  })
  reactionNode.schedules++
  reactionNode.lastScheduleReason = options.reason
  reactionNode.reactionState = options.toState ?? reaction.state
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "schedule",
    nodeId: reactionNode.id,
    sourceId: options.source
      ? ensureNodeState(options.source, {
        admin: options.source,
        kind: adminKindToLabel(options.source.kind),
        name: options.source.name,
      }).id
      : undefined,
    detail: options.reason,
    notificationType: options.notificationType === undefined
      ? undefined
      : notificationTypeToLabel(options.notificationType),
    fromState: reactionStateToLabel(options.fromState),
    toState: reactionStateToLabel(options.toState),
  })
  reactionNode.lastEventId = eventId
}

export function recordDebugRunStart(reaction: ReactionAdmin): void {
  const node = ensureNodeState(reaction, {
    admin: reaction,
    kind: adminKindToLabel(reaction.kind),
    name: reaction.name,
  })
  node.runs++
  node.reactionState = reaction.state
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "run-start",
    nodeId: node.id,
    fromState: reactionStateToLabel(reaction.state),
  })
  node.lastEventId = eventId
}

export function recordDebugRunEnd(
  reaction: ReactionAdmin,
  detail: string,
): void {
  const node = lookupNodeState(reaction)
  if (!node) return
  node.reactionState = reaction.state
  const eventId = pushEvent(getDebugGraphState(), {
    kind: "run-end",
    nodeId: node.id,
    detail,
    toState: reactionStateToLabel(reaction.state),
  })
  node.lastEventId = eventId
}

function toLocation(
  rawStack: string | undefined,
): DebugSourceLocation | undefined {
  return getFirstExternalSourceLocation(rawStack)
}

function toLocationStack(rawStack: string | undefined): DebugSourceLocation[] {
  return getExternalSourceLocations(rawStack).slice(0, 4)
}

function toSourceGroup(location: DebugSourceLocation | undefined):
  | string
  | undefined {
  if (!location) return undefined
  return `${location.fileName}:${location.line}:${location.column}`
}

function snapshotNode(node: DebugNodeState): DebugNodeSnapshot {
  const location = toLocation(node.rawStack)
  return {
    id: node.id,
    runtimeId: node.runtimeId,
    kind: node.kind,
    name: node.name,
    sourceLocation: location,
    sourceGroup: toSourceGroup(location),
    sourceStack: toLocationStack(node.rawStack),
    parentId: node.parentId,
    parentLabel: node.parentLabel,
    propertyKey: node.propertyKey,
    disposed: node.disposed,
    reactionState: reactionStateToLabel(node.reactionState),
    dependencyIds: Array.from(node.depIds).sort((a, b) => a - b),
    observerIds: Array.from(node.observerIds).sort((a, b) => a - b),
    counts: {
      reads: node.reads,
      writes: node.writes,
      notifications: node.notifications,
      schedules: node.schedules,
      runs: node.runs,
      disposals: node.disposals,
    },
    lastValue: node.lastValue,
    lastScheduleReason: node.lastScheduleReason,
    lastWriteReason: node.lastWriteReason,
    lastEventId: node.lastEventId,
  }
}

function snapshotEvent(event: DebugEventState): DebugEventSnapshot {
  const location = toLocation(event.rawStack)
  return {
    id: event.id,
    kind: event.kind,
    nodeId: event.nodeId,
    sourceId: event.sourceId,
    targetId: event.targetId,
    detail: event.detail,
    notificationType: event.notificationType,
    fromState: event.fromState,
    toState: event.toState,
    location,
    sourceGroup: toSourceGroup(location),
    value: event.value,
    previousValue: event.previousValue,
    inTransaction: event.inTransaction,
    batchDepth: event.batchDepth,
  }
}

function summarizeTraceNode(node: DebugNodeState): DebugTraceNodeSnapshot {
  return {
    id: node.id,
    kind: node.kind,
    name: node.name,
    disposed: node.disposed,
    reactionState: reactionStateToLabel(node.reactionState),
    value: node.lastValue,
    dependencyIds: Array.from(node.depIds).sort((a, b) => a - b),
    observerIds: Array.from(node.observerIds).sort((a, b) => a - b),
  }
}

function summarizeTraceEvent(
  event: DebugEventState,
  nodesById: Map<number, DebugNodeState>,
): DebugTraceEventSummary {
  return {
    id: event.id,
    kind: event.kind,
    nodeId: event.nodeId,
    nodeName: event.nodeId === undefined
      ? undefined
      : nodesById.get(event.nodeId)?.name,
    sourceId: event.sourceId,
    sourceName: event.sourceId === undefined
      ? undefined
      : nodesById.get(event.sourceId)?.name,
    targetId: event.targetId,
    targetName: event.targetId === undefined
      ? undefined
      : nodesById.get(event.targetId)?.name,
    detail: event.detail,
    notificationType: event.notificationType,
    fromState: event.fromState,
    toState: event.toState,
    value: event.value,
    previousValue: event.previousValue,
    inTransaction: event.inTransaction,
    batchDepth: event.batchDepth,
  }
}

function isTraceChangeEvent(event: DebugEventState): boolean {
  return event.kind === "write" || event.kind === "write-skipped"
}

function isTraceConsequenceEvent(event: DebugEventState): boolean {
  return event.kind === "notify" || event.kind === "schedule" ||
    event.kind === "run-start" || event.kind === "run-end"
}

function isTraceRelevantToIds(
  event: DebugEventState,
  selectedIds: Set<number>,
): boolean {
  return (event.nodeId !== undefined && selectedIds.has(event.nodeId)) ||
    (event.sourceId !== undefined && selectedIds.has(event.sourceId)) ||
    (event.targetId !== undefined && selectedIds.has(event.targetId))
}

function collectLiveNodes(): DebugNodeState[] {
  const state = getDebugGraphState()
  const nodes = new Map<number, DebugNodeState>()
  for (const [id, bucket] of state.ids) {
    let hasLiveRef = false
    for (let index = bucket.refs.length - 1; index >= 0; index--) {
      const target = bucket.refs[index].deref()
      if (!target) {
        bucket.refs.splice(index, 1)
        continue
      }
      hasLiveRef = true
      const node = state.nodes.get(target)
      if (node) {
        nodes.set(id, node)
      }
    }
    if (!hasLiveRef) {
      state.ids.delete(id)
    }
  }
  return Array.from(nodes.values()).sort((a, b) => a.id - b.id)
}

function resolveAdminFromTarget(target: object): ObservableAdmin | undefined {
  if ("observers" in target && "value" in target && "kind" in target) {
    return target as ObservableAdmin
  }

  const maybeAdmin = (target as Any)[$fobx]
  if (
    isObject(maybeAdmin) && "observers" in maybeAdmin &&
    "value" in maybeAdmin &&
    "kind" in maybeAdmin
  ) {
    return maybeAdmin as ObservableAdmin
  }

  return undefined
}

function getCurrentNodeValue(nodeId: number): DebugValueSummary | undefined {
  const state = getDebugGraphState()
  const bucket = state.ids.get(nodeId)
  if (!bucket) return undefined

  for (let index = bucket.refs.length - 1; index >= 0; index--) {
    const target = bucket.refs[index].deref()
    if (!target) continue
    const admin = resolveAdminFromTarget(target)
    if (admin) return summarizeValue(admin.value)
  }

  return undefined
}

export function getDebugSnapshot(): DebugSnapshot {
  const state = getDebugGraphState()
  const nodes = collectLiveNodes().map(snapshotNode)
  return {
    // deno-lint-ignore no-process-global
    enabled: Boolean(process.env.FOBX_DEBUG),
    maxEvents: state.maxEvents,
    nodes,
    events: state.events.map(snapshotEvent),
  }
}

export function explainDebugTarget(
  target: object,
): DebugExplanation | undefined {
  const node = lookupNodeState(target)
  if (!node) return undefined

  const snapshot = getDebugSnapshot()
  const snapshotMap = new Map(snapshot.nodes.map((entry) => [entry.id, entry]))
  const current = snapshotMap.get(node.id)
  if (!current) return undefined

  return {
    node: current,
    dependencies: current.dependencyIds.map((id) => snapshotMap.get(id))
      .filter((entry): entry is DebugNodeSnapshot => entry !== undefined),
    observers: current.observerIds.map((id) => snapshotMap.get(id)).filter(
      (entry): entry is DebugNodeSnapshot => entry !== undefined,
    ),
    recentEvents: snapshot.events.filter((event) =>
      event.nodeId === current.id || event.sourceId === current.id ||
      event.targetId === current.id
    ).slice(-20),
  }
}

export function buildDebugTraceSummary(
  options: DebugTraceOptions = {},
): DebugTraceSummary {
  const liveNodes = collectLiveNodes()
  const nodesById = new Map(liveNodes.map((node) => [node.id, node]))
  const selectedIds = options.target
    ? (() => {
      const node = lookupNodeState(options.target)
      return node
        ? collectReachableIds(node.id, options.maxDepth ?? 2)
        : new Set<number>()
    })()
    : new Set(liveNodes.map((node) => node.id))

  const relevantEvents = getDebugGraphState().events.filter((event) => {
    if (options.sinceEventId !== undefined && event.id < options.sinceEventId) {
      return false
    }
    if (!isTraceRelevantToIds(event, selectedIds)) {
      return false
    }
    return isTraceChangeEvent(event) || isTraceConsequenceEvent(event)
  })

  const limitedEvents = relevantEvents.slice(-(options.limit ?? 40))
  const snapshot = liveNodes.filter((node) => selectedIds.has(node.id)).map((
    node,
  ) => ({
    ...summarizeTraceNode(node),
    value: getCurrentNodeValue(node.id) ?? node.lastValue,
  }))
  const changes = limitedEvents.filter(isTraceChangeEvent).map((event) =>
    summarizeTraceEvent(event, nodesById)
  )
  const consequences = limitedEvents.filter(isTraceConsequenceEvent).map((
    event,
  ) => summarizeTraceEvent(event, nodesById))

  return {
    // deno-lint-ignore no-process-global
    enabled: Boolean(process.env.FOBX_DEBUG),
    fromEventId: limitedEvents[0]?.id,
    toEventId: limitedEvents.at(-1)?.id,
    snapshot,
    changes,
    consequences,
  }
}

function formatTextValue(value: DebugValueSummary | undefined): string {
  return value?.preview ?? "<unknown>"
}

function formatTextContext(event: {
  inTransaction: boolean
  batchDepth: number
}): string {
  return event.inTransaction ? `tx depth=${event.batchDepth}` : "post-tx"
}

function formatTextNodeLine(node: DebugTraceNodeSnapshot): string {
  const stateSuffix = node.reactionState ? `, ${node.reactionState}` : ""
  const valueSuffix = node.value ? ` = ${formatTextValue(node.value)}` : ""
  return `  ${node.name} [${node.kind}${stateSuffix}]${valueSuffix}`
}

function formatTextChangeLine(event: DebugTraceEventSummary): string {
  const changeType = event.kind === "write-skipped" ? ", no-op" : ""
  return `  [${formatTextContext(event)}] ${event.nodeName}: ${
    formatTextValue(event.previousValue)
  } -> ${formatTextValue(event.value)} (${event.detail}${changeType})`
}

function formatTextConsequenceLine(event: DebugTraceEventSummary): string {
  const context = `[${formatTextContext(event)}]`

  if (event.kind === "schedule") {
    const source = event.sourceName ? ` from ${event.sourceName}` : ""
    const transition = event.toState ? ` -> ${event.toState}` : ""
    const notification = event.notificationType
      ? `, ${event.notificationType}`
      : ""
    return `  ${context} schedule ${event.nodeName}${source}${transition} (${event.detail}${notification})`
  }

  if (event.kind === "notify") {
    const notification = event.notificationType
      ? ` ${event.notificationType}`
      : ""
    return `  ${context} notify ${event.nodeName}${notification} (${event.detail})`
  }

  if (event.kind === "run-start") {
    const state = event.fromState ? ` from ${event.fromState}` : ""
    return `  ${context} run-start ${event.nodeName}${state}`
  }

  const state = event.toState ? ` -> ${event.toState}` : ""
  const detail = event.detail ? ` (${event.detail})` : ""
  return `  ${context} run-end ${event.nodeName}${state}${detail}`
}

export function buildDebugTextReport(
  options: DebugTraceOptions = {},
): string {
  const trace = buildDebugTraceSummary(options)
  const nodesById = new Map(trace.snapshot.map((node) => [node.id, node]))
  const graphLines = trace.snapshot.flatMap((node) =>
    node.dependencyIds.map((depId) => ({
      from: nodesById.get(depId)?.name ?? String(depId),
      to: node.name,
    }))
  ).sort((left, right) => {
    if (left.from === right.from) return left.to.localeCompare(right.to)
    return left.from.localeCompare(right.from)
  })

  const lines = [
    "FOBX DEBUG REPORT",
    `  events: ${trace.fromEventId ?? "-"}..${trace.toEventId ?? "-"}`,
    `  nodes: ${trace.snapshot.length}, changes: ${trace.changes.length}, consequences: ${trace.consequences.length}`,
    "",
    "GRAPH",
  ]

  if (graphLines.length === 0) {
    lines.push("  <no dependency edges>")
  } else {
    for (const edge of graphLines) {
      lines.push(`  ${edge.from} -> ${edge.to}`)
    }
  }

  lines.push("", "CURRENT VALUES")
  if (trace.snapshot.length === 0) {
    lines.push("  <no live nodes>")
  } else {
    for (const node of trace.snapshot) {
      lines.push(formatTextNodeLine(node))
    }
  }

  lines.push("", "CHANGES")
  if (trace.changes.length === 0) {
    lines.push("  <no matching writes>")
  } else {
    for (const event of trace.changes) {
      lines.push(formatTextChangeLine(event))
    }
  }

  lines.push("", "CONSEQUENCES")
  if (trace.consequences.length === 0) {
    lines.push("  <no downstream consequences>")
  } else {
    for (const event of trace.consequences) {
      lines.push(formatTextConsequenceLine(event))
    }
  }

  return lines.join("\n")
}

function escapeMermaid(text: string): string {
  return text.replaceAll('"', "'")
}

function getMermaidNodeKind(kind: string):
  | "observable"
  | "computed"
  | "reaction" {
  switch (kind) {
    case "computed":
      return "computed"
    case "autorun":
    case "effect":
    case "reaction":
    case "subscription":
    case "tracker":
    case "when":
    case "selector":
      return "reaction"
    default:
      return "observable"
  }
}

function formatMermaidLabel(node: DebugNodeState): string {
  const location = toLocation(node.rawStack)
  const parts = [node.name, node.kind]
  if (location) {
    parts.push(location.display)
  }
  return escapeMermaid(parts.join("<br/>"))
}

function formatMermaidNode(node: DebugNodeState): string {
  const label = formatMermaidLabel(node)
  const kind = getMermaidNodeKind(node.kind)

  if (kind === "computed") {
    return `  N${node.id}(\"${label}\")`
  }
  if (kind === "reaction") {
    return `  N${node.id}[[\"${label}\"]]`
  }
  return `  N${node.id}[\"${label}\"]`
}

function collectReachableIds(rootId: number, maxDepth: number): Set<number> {
  const nodes = collectLiveNodes()
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visited = new Set<number>()
  const queue: Array<{ id: number; depth: number }> = [{ id: rootId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    if (current.depth >= maxDepth) continue

    const node = byId.get(current.id)
    if (!node) continue

    for (const depId of node.depIds) {
      if (!visited.has(depId)) {
        queue.push({ id: depId, depth: current.depth + 1 })
      }
    }
    for (const observerId of node.observerIds) {
      if (!visited.has(observerId)) {
        queue.push({ id: observerId, depth: current.depth + 1 })
      }
    }
  }

  return visited
}

export function buildDebugMermaidGraph(options: {
  target?: object
  maxDepth?: number
} = {}): string {
  const liveNodes = collectLiveNodes()
  const selectedIds = options.target
    ? (() => {
      const node = lookupNodeState(options.target)
      return node
        ? collectReachableIds(node.id, options.maxDepth ?? 2)
        : new Set<number>()
    })()
    : new Set(liveNodes.map((node) => node.id))

  const lines = [
    "graph LR",
    "  classDef observable fill:#DCFCE7,stroke:#15803D,color:#14532D,stroke-width:1.5px;",
    "  classDef computed fill:#FEF3C7,stroke:#B45309,color:#78350F,stroke-width:1.5px;",
    "  classDef reaction fill:#DBEAFE,stroke:#1D4ED8,color:#1E3A8A,stroke-width:1.5px;",
  ]
  for (const node of liveNodes) {
    if (!selectedIds.has(node.id)) continue
    lines.push(formatMermaidNode(node))
    lines.push(`  class N${node.id} ${getMermaidNodeKind(node.kind)}`)
  }
  for (const node of liveNodes) {
    if (!selectedIds.has(node.id)) continue
    for (const depId of node.depIds) {
      if (!selectedIds.has(depId)) continue
      lines.push(`  N${depId} --> N${node.id}`)
    }
  }
  return lines.join("\n")
}
