export interface DebugSourceLocation {
  source: string
  fileName: string
  line: number
  column: number
  display: string
}

interface ParsedStackLocation extends DebugSourceLocation {
  rawSource: string
}

interface DecodedSourceMapSegment {
  generatedColumn: number
  sourceIndex?: number
  originalLine?: number
  originalColumn?: number
}

interface ParsedSourceMap {
  sources: string[]
  lines: DecodedSourceMapSegment[][]
}

interface SourceMapPayload {
  version: number
  sources: string[]
  sourceRoot?: string
  mappings: string
}

const knownPackageMarkers = [
  "/@fobx/",
  "\\@fobx\\",
  "npm:@fobx/",
  "jsr:@fobx/",
]

const knownInternalSuffixes = [
  "utils/debug.ts",
  "utils/debug.js",
  "dist/core.js",
  "dist/core.cjs",
  "dist/core.production.js",
  "dist/core.production.cjs",
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.production.js",
  "dist/index.production.cjs",
  "dist/internals.js",
  "dist/internals.cjs",
]

const BASE64_VLQ_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const BASE64_VLQ_LOOKUP = Object.fromEntries(
  Array.from(BASE64_VLQ_CHARS).map((char, index) => [char, index]),
) as Record<string, number>
const sourceMapCache = new Map<string, ParsedSourceMap | null>()
const resourceTextCache = new Map<string, string | null>()
const resourceTextPromiseCache = new Map<string, Promise<string | undefined>>()
const sourceMapPromiseCache = new Map<string, Promise<void>>()

function stripQueryAndHash(source: string): string {
  const lineColumnMatch = /:(\d+):(\d+)$/.exec(source)
  if (!lineColumnMatch) {
    return source.replace(/[?#].*$/, "")
  }

  const baseSource = source.slice(0, lineColumnMatch.index).replace(
    /[?#].*$/,
    "",
  )
  return `${baseSource}${source.slice(lineColumnMatch.index)}`
}

function parseStackSource(line: string): string | undefined {
  const trimmed = line.trim().replace(/^at\s+/, "")
  if (!trimmed) return undefined

  const source = trimmed.endsWith(")") && trimmed.includes("(")
    ? trimmed.slice(trimmed.lastIndexOf("(") + 1, -1)
    : trimmed.startsWith("@")
    ? trimmed.slice(1)
    : trimmed.includes("@")
    ? trimmed.slice(trimmed.indexOf("@") + 1)
    : trimmed

  return source
}

function captureStack(): string | undefined {
  const error = new Error()
  const captureStackTrace = (Error as unknown as {
    captureStackTrace?: (target: Error) => void
  }).captureStackTrace

  captureStackTrace?.(error)
  return error.stack
}

export function captureCurrentStack(): string | undefined {
  return captureStack()
}

function discoverRuntimeInternalMarkers(): string[] {
  const markers = new Set(knownPackageMarkers)
  const stack = captureStack()
  if (!stack) return Array.from(markers)

  const lines = stack.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseStackLine(lines[i])
    const source = parsed?.source ?? normalizeSource(parseStackSource(lines[i]))
    if (!source || isRuntimeFrame(source)) continue

    for (const suffix of knownInternalSuffixes) {
      const normalizedSuffix = source.includes("\\")
        ? suffix.replaceAll("/", "\\")
        : suffix

      if (source.endsWith(normalizedSuffix)) {
        markers.add(source.slice(0, -normalizedSuffix.length))
      }
    }

    for (const packageMarker of knownPackageMarkers) {
      const index = source.indexOf(packageMarker)
      if (index !== -1) {
        markers.add(source.slice(0, index + packageMarker.length))
      }
    }

    break
  }

  return Array.from(markers)
}

const internalMarkers = discoverRuntimeInternalMarkers()

function isRuntimeFrame(source: string): boolean {
  return source === "<anonymous>" ||
    source.startsWith("node:") ||
    source.startsWith("ext:") ||
    source.startsWith("[eval]") ||
    source.startsWith("evalmachine.") ||
    source === "native"
}

function isInternalFrame(source: string): boolean {
  if (source.includes("/__tests__/") || source.includes("\\__tests__\\")) {
    return false
  }
  return internalMarkers.some((marker) => source.includes(marker))
}

function formatFileName(source: string): string {
  const sanitized = stripQueryAndHash(source)
  const segments = sanitized.split(/[\\/]/)
  return segments[segments.length - 1] || sanitized
}

function normalizeSource(source: string | undefined): string | undefined {
  if (!source) return undefined
  return stripQueryAndHash(source)
}

function parseStackLine(line: string): ParsedStackLocation | undefined {
  const rawSource = parseStackSource(line)
  if (!rawSource) return undefined

  const source = normalizeSource(rawSource)
  if (!source) return undefined

  const match = /^(.*):(\d+):(\d+)$/.exec(source)
  const rawMatch = /^(.*):(\d+):(\d+)$/.exec(rawSource)
  if (!match) return undefined

  const lineNumber = Number(match[2])
  const columnNumber = Number(match[3])
  if (!Number.isFinite(lineNumber) || !Number.isFinite(columnNumber)) {
    return undefined
  }

  const fileName = formatFileName(match[1])
  return {
    source: match[1],
    rawSource: rawMatch?.[1] ?? match[1],
    fileName,
    line: lineNumber,
    column: columnNumber,
    display: `${fileName}:${lineNumber}:${columnNumber}`,
  }
}

function readTextResourceSync(resource: string): string | undefined {
  const cached = resourceTextCache.get(resource)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  const candidates = [resource]
  const stripped = stripQueryAndHash(resource)
  if (stripped !== resource) {
    candidates.push(stripped)
  }

  for (const candidate of candidates) {
    const text = readTextResourceSyncUncached(candidate)
    if (text !== undefined) {
      resourceTextCache.set(resource, text)
      if (candidate !== resource) {
        resourceTextCache.set(candidate, text)
      }
      return text
    }
  }

  resourceTextCache.set(resource, null)
  return undefined
}

function readTextResourceSyncUncached(resource: string): string | undefined {
  if (resource.startsWith("data:")) {
    return decodeDataUrl(resource)
  }

  return undefined
}

function fetchTextResource(
  resource: string,
): Promise<string | undefined> | undefined {
  const cached = readTextResourceSync(resource)
  if (cached !== undefined) {
    return Promise.resolve(cached)
  }

  const existing = resourceTextPromiseCache.get(resource)
  if (existing) return existing

  if (typeof fetch !== "function") return undefined

  const promise = fetch(resource)
    .then((response) => {
      if (!response.ok) return undefined
      return response.text()
    })
    .then((text) => {
      const stripped = stripQueryAndHash(resource)
      resourceTextCache.set(resource, text ?? null)
      if (stripped !== resource) {
        resourceTextCache.set(stripped, text ?? null)
      }
      return text
    })
    .catch(() => {
      resourceTextCache.set(resource, null)
      return undefined
    })
    .finally(() => {
      resourceTextPromiseCache.delete(resource)
    })

  resourceTextPromiseCache.set(resource, promise)
  return promise
}

function hasScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
}

function shouldAttemptSourceMapLookup(source: string): boolean {
  const normalized = stripQueryAndHash(source).toLowerCase()
  return normalized.endsWith(".js") || normalized.endsWith(".mjs") ||
    normalized.endsWith(".cjs") || normalized.endsWith(".jsx")
}

function decodeDataUrl(resource: string): string | undefined {
  const match = /^data:([^,]*?),(.*)$/s.exec(resource)
  if (!match) return undefined

  const isBase64 = /;base64/i.test(match[1])
  if (!isBase64) {
    try {
      return decodeURIComponent(match[2])
    } catch {
      return undefined
    }
  }

  if (typeof atob !== "function") return undefined

  try {
    const decoded = atob(match[2])
    const bytes = Uint8Array.from(
      decoded,
      (char) => char.charCodeAt(0),
    )
    return new TextDecoder().decode(bytes)
  } catch {
    return undefined
  }
}

function extractSourceMappingUrl(sourceText: string): string | undefined {
  const lineMatches = Array.from(
    sourceText.matchAll(/\/\/[#@]\s*sourceMappingURL=([^\s]+)\s*$/gm),
  )
  const blockMatches = Array.from(
    sourceText.matchAll(/\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//g),
  )
  const match = lineMatches.at(-1) ?? blockMatches.at(-1)
  return match?.[1]
}

function resolveSpecifier(base: string, specifier: string): string {
  if (specifier.startsWith("data:")) return specifier

  try {
    return new URL(specifier, base).href
  } catch {
    if (
      hasScheme(specifier) || specifier.startsWith("/") ||
      specifier.startsWith("\\") || /^[a-zA-Z]:[\\/]/.test(specifier)
    ) {
      return specifier
    }

    const normalizedBase = stripQueryAndHash(base)
    const lastSlash = Math.max(
      normalizedBase.lastIndexOf("/"),
      normalizedBase.lastIndexOf("\\"),
    )
    if (lastSlash === -1) return specifier
    return `${normalizedBase.slice(0, lastSlash + 1)}${specifier}`
  }
}

function decodeVlqSegment(segmentText: string): number[] {
  const values: number[] = []
  let index = 0

  while (index < segmentText.length) {
    let value = 0
    let shift = 0
    let digit = 0

    do {
      digit = BASE64_VLQ_LOOKUP[segmentText[index++] ?? ""] ?? -1
      if (digit === -1) {
        return []
      }
      value += (digit & 31) << shift
      shift += 5
    } while ((digit & 32) !== 0)

    const isNegative = (value & 1) === 1
    values.push(isNegative ? -(value >> 1) : value >> 1)
  }

  return values
}

function decodeMappings(mappings: string): DecodedSourceMapSegment[][] {
  let sourceIndex = 0
  let originalLine = 0
  let originalColumn = 0
  let nameIndex = 0

  return mappings.split(";").map((line) => {
    let generatedColumn = 0
    const segments: DecodedSourceMapSegment[] = []

    if (!line) return segments

    for (const segmentText of line.split(",")) {
      if (!segmentText) continue

      const values = decodeVlqSegment(segmentText)
      if (values.length === 0) continue

      generatedColumn += values[0]
      const segment: DecodedSourceMapSegment = { generatedColumn }

      if (values.length >= 4) {
        sourceIndex += values[1]
        originalLine += values[2]
        originalColumn += values[3]
        segment.sourceIndex = sourceIndex
        segment.originalLine = originalLine
        segment.originalColumn = originalColumn
      }

      if (values.length >= 5) {
        nameIndex += values[4]
      }

      segments.push(segment)
    }

    return segments
  })
}

function parseSourceMap(
  mapText: string,
  mapUrl: string,
): ParsedSourceMap | undefined {
  let payload: SourceMapPayload
  try {
    payload = JSON.parse(mapText) as SourceMapPayload
  } catch {
    return undefined
  }

  if (
    payload.version !== 3 || !Array.isArray(payload.sources) ||
    typeof payload.mappings !== "string"
  ) {
    return undefined
  }

  const sourceRoot = payload.sourceRoot === undefined
    ? undefined
    : resolveSpecifier(mapUrl, payload.sourceRoot)

  return {
    sources: payload.sources.map((source) =>
      sourceRoot
        ? resolveSpecifier(sourceRoot, source)
        : resolveSpecifier(mapUrl, source)
    ),
    lines: decodeMappings(payload.mappings),
  }
}

function resolveSourceMapFromText(
  source: string,
  sourceText: string,
): ParsedSourceMap | undefined {
  const sourceMappingUrl = extractSourceMappingUrl(sourceText)
  if (!sourceMappingUrl) return undefined

  const mapUrl = resolveSpecifier(source, sourceMappingUrl)
  const mapText = readTextResourceSync(mapUrl)
  return mapText ? parseSourceMap(mapText, mapUrl) : undefined
}

function scheduleSourceMapFetch(source: string): void {
  if (sourceMapCache.has(source) || sourceMapPromiseCache.has(source)) {
    return
  }

  const cachedSourceText = readTextResourceSync(source)
  if (cachedSourceText !== undefined) {
    sourceMapCache.set(
      source,
      resolveSourceMapFromText(source, cachedSourceText) ?? null,
    )
    return
  }

  const sourceTextPromise = fetchTextResource(source)
  if (!sourceTextPromise) {
    sourceMapCache.set(source, null)
    return
  }

  const promise = sourceTextPromise
    .then(async (sourceText) => {
      if (!sourceText) {
        sourceMapCache.set(source, null)
        return
      }

      const sourceMappingUrl = extractSourceMappingUrl(sourceText)
      if (!sourceMappingUrl) {
        sourceMapCache.set(source, null)
        return
      }

      const mapUrl = resolveSpecifier(source, sourceMappingUrl)
      const mapText = readTextResourceSync(mapUrl) ??
        await fetchTextResource(mapUrl)
      sourceMapCache.set(
        source,
        mapText ? parseSourceMap(mapText, mapUrl) ?? null : null,
      )
    })
    .catch(() => {
      sourceMapCache.set(source, null)
    })
    .finally(() => {
      sourceMapPromiseCache.delete(source)
    })

  sourceMapPromiseCache.set(source, promise)
}

function getStackLocations(stack: string | undefined): ParsedStackLocation[] {
  if (!stack) return []

  const locations: ParsedStackLocation[] = []
  const lines = stack.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseStackLine(lines[i])
    if (!parsed) continue
    locations.push(parsed)
  }

  return locations
}

function queueSourceMapFetchesForStack(
  stack: string | undefined,
): Promise<void> | undefined {
  const pending: Promise<void>[] = []

  for (const parsed of getStackLocations(stack)) {
    if (isRuntimeFrame(parsed.source) || isInternalFrame(parsed.source)) {
      continue
    }
    if (!shouldAttemptSourceMapLookup(parsed.rawSource)) {
      continue
    }

    scheduleSourceMapFetch(parsed.rawSource)
    const promise = sourceMapPromiseCache.get(parsed.rawSource)
    if (promise) {
      pending.push(promise)
    }
  }

  if (pending.length === 0) return undefined
  return Promise.allSettled(pending).then(() => undefined)
}

function getSourceMap(source: string): ParsedSourceMap | undefined {
  const cached = sourceMapCache.get(source)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  scheduleSourceMapFetch(source)
  return undefined
}

function resolveMappedLocation(
  location: ParsedStackLocation,
): ParsedStackLocation {
  if (!shouldAttemptSourceMapLookup(location.rawSource)) {
    return location
  }

  const sourceMap = getSourceMap(location.rawSource)
  if (!sourceMap) return location

  const segments = sourceMap.lines[location.line - 1]
  if (!segments || segments.length === 0) return location

  const generatedColumn = Math.max(0, location.column - 1)
  let match: DecodedSourceMapSegment | undefined

  for (const segment of segments) {
    if (segment.generatedColumn > generatedColumn) break
    if (
      segment.sourceIndex !== undefined && segment.originalLine !== undefined &&
      segment.originalColumn !== undefined
    ) {
      match = segment
    }
  }

  if (
    !match || match.sourceIndex === undefined ||
    match.originalLine === undefined ||
    match.originalColumn === undefined
  ) {
    return location
  }

  const source = sourceMap.sources[match.sourceIndex]
  if (!source) return location

  const line = match.originalLine + 1
  const column = match.originalColumn + 1
  const fileName = formatFileName(source)

  return {
    source,
    rawSource: source,
    fileName,
    line,
    column,
    display: `${fileName}:${line}:${column}`,
  }
}

export function getExternalSourceLocations(
  stack: string | undefined,
): DebugSourceLocation[] {
  if (!stack) return []

  const locations: DebugSourceLocation[] = []
  for (const parsed of getStackLocations(stack)) {
    if (isRuntimeFrame(parsed.source) || isInternalFrame(parsed.source)) {
      continue
    }

    const resolved = resolveMappedLocation(parsed)
    if (isRuntimeFrame(resolved.source) || isInternalFrame(resolved.source)) {
      continue
    }
    locations.push(resolved)
  }

  return locations
}

export function getFirstExternalSourceLocation(
  stack: string | undefined,
): DebugSourceLocation | undefined {
  return getExternalSourceLocations(stack)[0]
}

export function getCurrentExternalSourceLocation():
  | DebugSourceLocation
  | undefined {
  return getFirstExternalSourceLocation(captureStack())
}

export function getCurrentExternalSourceLocations(
  limit = 4,
): DebugSourceLocation[] {
  return getExternalSourceLocations(captureStack()).slice(0, limit)
}

export function formatWarningMessage(
  message: string,
  stack: string | undefined,
): string {
  const locations = getExternalSourceLocations(stack)
  if (locations.length === 0) return message

  return `${message}\nSources:\n${
    locations.map((location) => `- ${location.display}`).join("\n")
  }`
}

function warn(message: string): void {
  const stack = captureStack()
  const pending = queueSourceMapFetchesForStack(stack)
  if (!pending) {
    console.warn(formatWarningMessage(message, stack))
    return
  }

  pending.finally(() => {
    console.warn(formatWarningMessage(message, stack))
  })
}

export const debug = { warn }
