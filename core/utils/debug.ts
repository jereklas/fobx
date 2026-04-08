export interface DebugSourceLocation {
  source: string
  fileName: string
  line: number
  column: number
  display: string
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

  return stripQueryAndHash(source)
}

function captureStack(): string | undefined {
  const error = new Error()
  const captureStackTrace = (Error as unknown as {
    captureStackTrace?: (target: Error) => void
  }).captureStackTrace

  captureStackTrace?.(error)
  return error.stack
}

function discoverRuntimeInternalMarkers(): string[] {
  const markers = new Set(knownPackageMarkers)
  const stack = captureStack()
  if (!stack) return Array.from(markers)

  const lines = stack.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseStackLine(lines[i])
    const source = parsed?.source ?? parseStackSource(lines[i])
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

function parseStackLine(line: string): DebugSourceLocation | undefined {
  const source = parseStackSource(line)
  if (!source) return undefined

  const match = /^(.*):(\d+):(\d+)$/.exec(source)
  if (!match) return undefined

  const lineNumber = Number(match[2])
  const columnNumber = Number(match[3])
  if (!Number.isFinite(lineNumber) || !Number.isFinite(columnNumber)) {
    return undefined
  }

  const fileName = formatFileName(match[1])
  return {
    source: match[1],
    fileName,
    line: lineNumber,
    column: columnNumber,
    display: `${fileName}:${lineNumber}:${columnNumber}`,
  }
}

export function getExternalSourceLocations(
  stack: string | undefined,
): DebugSourceLocation[] {
  if (!stack) return []

  const locations: DebugSourceLocation[] = []
  const lines = stack.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseStackLine(lines[i])
    if (!parsed) continue
    if (isRuntimeFrame(parsed.source) || isInternalFrame(parsed.source)) {
      continue
    }
    locations.push(parsed)
  }

  return locations
}

export function getFirstExternalSourceLocation(
  stack: string | undefined,
): DebugSourceLocation | undefined {
  return getExternalSourceLocations(stack)[0]
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
  console.warn(formatWarningMessage(message, captureStack()))
}

export const debug = { warn }
