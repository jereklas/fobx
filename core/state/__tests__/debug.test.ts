import { expect, test } from "@fobx/testing"
import * as fobx from "../../index.ts"
import { $fobx } from "../global.ts"
import { $instance } from "../instance.ts"
import { changeObservedBox } from "./fixtures/debug_warning_caller.ts"
import {
  debug,
  formatWarningMessage,
  getExternalSourceLocations,
  getFirstExternalSourceLocation,
} from "../../utils/debug.ts"

const testFileUrl = new URL(import.meta.url)
const testFileSource = Deno.readTextFileSync(testFileUrl)
const fixtureFileUrl = new URL(
  "./fixtures/debug_warning_caller.ts",
  import.meta.url,
)
const fixtureFileSource = Deno.readTextFileSync(fixtureFileUrl)
const BASE64_VLQ_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
let bundleSequence = 0

function displayForMarker(
  source: string,
  fileName: string,
  marker: string,
  code?: string,
): string {
  const lines = source.split("\n")
  const index = lines.findIndex((line) => line.includes(marker))
  if (index === -1) {
    throw new Error(`Unable to find marker: ${marker}`)
  }
  const column = code === undefined
    ? lines[index].search(/\S/)
    : lines[index].indexOf(code)
  if (column === -1) {
    throw new Error(`Unable to find code for marker: ${marker}`)
  }
  return `${fileName}:${index + 1}:${column + 1}`
}

function encodeVlqValue(value: number): string {
  let encoded = ""
  let vlq = value < 0 ? ((-value) << 1) + 1 : value << 1

  do {
    let digit = vlq & 31
    vlq >>= 5
    if (vlq > 0) digit |= 32
    encoded += BASE64_VLQ_CHARS[digit]
  } while (vlq > 0)

  return encoded
}

function encodeMappings(
  lines: Array<Array<[number, number, number, number]>>,
): string {
  let previousSource = 0
  let previousOriginalLine = 0
  let previousOriginalColumn = 0

  return lines.map((segments) => {
    let previousGeneratedColumn = 0

    return segments.map(
      ([generatedColumn, source, originalLine, originalColumn]) => {
        const encoded = [
          generatedColumn - previousGeneratedColumn,
          source - previousSource,
          originalLine - previousOriginalLine,
          originalColumn - previousOriginalColumn,
        ].map(encodeVlqValue).join("")

        previousGeneratedColumn = generatedColumn
        previousSource = source
        previousOriginalLine = originalLine
        previousOriginalColumn = originalColumn
        return encoded
      },
    ).join(",")
  }).join(";")
}

function createSourceMappedBundleResponses(options: { inline: boolean }): {
  bundleUrl: string
  responses: Record<string, string>
} {
  const bundleId = bundleSequence++
  const bundleUrl = options.inline
    ? `http://example.test/assets/bundle-inline-${bundleId}.js`
    : `http://example.test/assets/bundle-linked-${bundleId}.js`
  const mapUrl = `${bundleUrl}.map`
  const sourceMap = {
    version: 3,
    file: "bundle.js",
    sources: [
      "../node_modules/@fobx/core/utils/debug.ts",
      "../src/store.ts",
      "../src/view.ts",
    ],
    mappings: encodeMappings([
      [[0, 0, 9, 1]],
      [[0, 0, 139, 4]],
      [[0, 1, 41, 6]],
      [[0, 2, 17, 1]],
    ]),
  }

  const sourceMappingUrl = options.inline
    ? `data:application/json;base64,${btoa(JSON.stringify(sourceMap))}`
    : mapUrl

  const responses: Record<string, string> = {
    [bundleUrl]: [
      "console.warn('fobx')",
      "set()",
      "updateThing()",
      "handleClick()",
      `//# sourceMappingURL=${sourceMappingUrl}`,
    ].join("\n"),
  }

  if (!options.inline) {
    responses[mapUrl] = JSON.stringify(sourceMap)
  }

  return { bundleUrl, responses }
}

async function withMockFetch<T>(
  responses: Record<string, string>,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url
    const body = responses[url]
    if (body === undefined) {
      return Promise.resolve(new Response("not found", { status: 404 }))
    }
    return Promise.resolve(new Response(body, { status: 200 }))
  }) as typeof fetch

  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function flushSourceMapFetches(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

async function waitFor(
  predicate: () => boolean,
  attempts = 10,
): Promise<void> {
  for (let index = 0; index < attempts; index++) {
    if (predicate()) return
    await flushSourceMapFetches()
  }

  throw new Error("Timed out waiting for async debug work to complete")
}

test("getFirstExternalSourceLocation skips fobx frames and finds first external source", () => {
  const stack = [
    "Error",
    `    at warn (${
      new URL("../../utils/debug.ts", import.meta.url).href
    }:10:2)`,
    `    at warnIfObservedWriteOutsideTransaction (${
      new URL("../notifications.ts", import.meta.url).href
    }:140:5)`,
    `    at set (${
      new URL("../../observables/observableBox.ts", import.meta.url).href
    }:58:9)`,
    "    at updateThing (file:///workspace/src/store.ts:42:7)",
  ].join("\n")

  expect(getFirstExternalSourceLocation(stack)?.display).toBe("store.ts:42:7")
})

test("getExternalSourceLocations returns all non-fobx frames in order", () => {
  const stack = [
    "Error",
    `    at warn (${
      new URL("../../utils/debug.ts", import.meta.url).href
    }:10:2)`,
    `    at warnIfObservedWriteOutsideTransaction (${
      new URL("../notifications.ts", import.meta.url).href
    }:140:5)`,
    `    at set (${
      new URL("../../observables/observableBox.ts", import.meta.url).href
    }:58:9)`,
    "    at updateThing (file:///workspace/src/store.ts:42:7)",
    "    at handleClick (file:///workspace/src/view.ts:18:2)",
  ].join("\n")

  expect(getExternalSourceLocations(stack).map((location) => location.display))
    .toEqual([
      "store.ts:42:7",
      "view.ts:18:2",
    ])
})

test("getExternalSourceLocations skips dist bundle frames in browser-style stacks", () => {
  const stack = [
    "Error",
    "warn@http://localhost:3000/node_modules/@fobx/core/dist/core.js:200:2",
    "set@http://localhost:3000/node_modules/@fobx/core/dist/core.js:320:7",
    "updateThing@http://localhost:3000/src/store.ts:42:7",
    "handleClick@http://localhost:3000/src/view.ts:18:2",
  ].join("\n")

  expect(getExternalSourceLocations(stack).map((location) => location.display))
    .toEqual([
      "store.ts:42:7",
      "view.ts:18:2",
    ])
})

test("getExternalSourceLocations resolves inline sourcemaps for bundled frames", async () => {
  const { bundleUrl, responses } = createSourceMappedBundleResponses({
    inline: true,
  })
  const stack = [
    "Error",
    `    at warn (${bundleUrl}:1:1)`,
    `    at set (${bundleUrl}:2:1)`,
    `    at updateThing (${bundleUrl}:3:1)`,
    `    at handleClick (${bundleUrl}:4:1)`,
  ].join("\n")

  await withMockFetch(responses, async () => {
    getExternalSourceLocations(stack)
    await flushSourceMapFetches()

    expect(
      getExternalSourceLocations(stack).map((location) => location.display),
    )
      .toEqual([
        "store.ts:42:7",
        "view.ts:18:2",
      ])
  })
})

test("getExternalSourceLocations resolves linked sourcemaps for bundled frames", async () => {
  const { bundleUrl, responses } = createSourceMappedBundleResponses({
    inline: false,
  })
  const stack = [
    "Error",
    `    at warn (${bundleUrl}:1:1)`,
    `    at set (${bundleUrl}:2:1)`,
    `    at updateThing (${bundleUrl}:3:1)`,
    `    at handleClick (${bundleUrl}:4:1)`,
  ].join("\n")

  await withMockFetch(responses, async () => {
    getExternalSourceLocations(stack)
    await flushSourceMapFetches()

    expect(
      getExternalSourceLocations(stack).map((location) => location.display),
    )
      .toEqual([
        "store.ts:42:7",
        "view.ts:18:2",
      ])
  })
})

test("debug.warn waits for sourcemap fetch before logging", async () => {
  const { bundleUrl, responses } = createSourceMappedBundleResponses({
    inline: false,
  })
  const messages: string[] = []
  const originalWarn = console.warn
  const originalError = globalThis.Error

  class MockError extends Error {
    static override captureStackTrace(target: { stack?: string }) {
      target.stack = [
        "Error",
        `    at warn (${bundleUrl}:1:1)`,
        `    at set (${bundleUrl}:2:1)`,
        `    at updateThing (${bundleUrl}:3:1)`,
        `    at handleClick (${bundleUrl}:4:1)`,
      ].join("\n")
    }

    constructor() {
      super("mock")
      this.stack = [
        "Error",
        `    at warn (${bundleUrl}:1:1)`,
        `    at set (${bundleUrl}:2:1)`,
        `    at updateThing (${bundleUrl}:3:1)`,
        `    at handleClick (${bundleUrl}:4:1)`,
      ].join("\n")
    }
  }

  try {
    console.warn = (message?: unknown) => {
      messages.push(String(message))
    }
    globalThis.Error = MockError as ErrorConstructor

    await withMockFetch(responses, async () => {
      debug.warn("warning")
      expect(messages).toEqual([])

      await waitFor(() => messages.length === 1)

      expect(messages).toEqual([
        "warning\nSources:\n- store.ts:42:7\n- view.ts:18:2",
      ])
    })
  } finally {
    console.warn = originalWarn
    globalThis.Error = originalError
  }
})

test("getExternalSourceLocations preserves line info for query and hash suffixed urls", () => {
  const stack = [
    "Error",
    "warn@http://localhost:3000/node_modules/@fobx/core/dist/core.js?v=123:200:2",
    "set@http://localhost:3000/src/store.ts?v=456:42:7",
    "handleClick@http://localhost:3000/src/view.ts#dev:18:2",
  ].join("\n")

  expect(getExternalSourceLocations(stack).map((location) => location.display))
    .toEqual([
      "store.ts:42:7",
      "view.ts:18:2",
    ])
})

test("getExternalSourceLocations skips generic @fobx package paths on windows", () => {
  const stack = [
    "Error",
    String
      .raw`    at warn (C:\repo\node_modules\@fobx\core\dist\core.cjs:200:2)`,
    String
      .raw`    at set (C:\repo\node_modules\@fobx\react\dist\index.cjs:320:7)`,
    String.raw`    at updateThing (C:\repo\src\store.ts:42:7)`,
    String.raw`    at handleClick (C:\repo\src\view.ts:18:2)`,
  ].join("\n")

  expect(getExternalSourceLocations(stack).map((location) => location.display))
    .toEqual([
      "store.ts:42:7",
      "view.ts:18:2",
    ])
})

test("formatWarningMessage includes all external source info from the stack", () => {
  const stack = [
    "Error",
    `    at warn (${
      new URL("../../utils/debug.ts", import.meta.url).href
    }:10:2)`,
    "    at runScriptInThisContext (node:internal/vm:219:10)",
    `    at setComputedValue (${
      new URL("../../observables/computed.ts", import.meta.url).href
    }:167:7)`,
    "    at updateStore (file:///workspace/src/app.ts:11:3)",
    "    at commitChange (file:///workspace/src/model.ts:27:9)",
  ].join("\n")

  expect(formatWarningMessage("warning", stack)).toBe(
    "warning\nSources:\n- app.ts:11:3\n- model.ts:27:9",
  )
})

test("observable write warning includes stack information", async () => {
  const prevEnforceTransactions = $instance.enforceTransactions
  fobx.configure({ enforceTransactions: true })

  const box = fobx.observableBox(1)
  const dispose = fobx.autorun(() => box.get())
  const messages: string[] = []
  const originalWarn = console.warn

  try {
    console.warn = (message?: unknown) => {
      messages.push(String(message))
    }

    const bddFrame = getExternalSourceLocations(new Error().stack).at(-1)
      ?.display

    changeObservedBox(box) // STACK_MARKER_TEST_TRIGGER
    await flushSourceMapFetches()

    const warning = messages.join("\n")

    expect(warning).toBe([
      `[@fobx/core] Changing tracked observable values (${
        box[$fobx].name
      }) outside of a transaction is discouraged as reactions run more frequently than necessary.`,
      "Sources:",
      `- ${
        displayForMarker(
          fixtureFileSource,
          "debug_warning_caller.ts",
          "STACK_MARKER_FIXTURE_SET",
          "set(2)",
        )
      }`,
      `- ${
        displayForMarker(
          fixtureFileSource,
          "debug_warning_caller.ts",
          "STACK_MARKER_FIXTURE_CHANGE",
        )
      }`,
      `- ${
        displayForMarker(
          testFileSource,
          "debug.test.ts",
          "STACK_MARKER_TEST_TRIGGER",
        )
      }`,
      `- ${bddFrame}`,
    ].join("\n"))
  } finally {
    console.warn = originalWarn
    dispose()
    fobx.configure({ enforceTransactions: prevEnforceTransactions })
  }
})
