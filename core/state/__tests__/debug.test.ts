import { expect, test } from "@fobx/testing"
import * as fobx from "../../index.ts"
import { $fobx } from "../global.ts"
import { $instance } from "../instance.ts"
import { changeObservedBox } from "./fixtures/debug_warning_caller.ts"
import {
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

test("observable write warning includes stack information", () => {
  const prevEnforceActions = $instance.enforceActions
  fobx.configure({ enforceActions: true })

  const box = fobx.observableBox(1)
  const dispose = fobx.autorun(() => box.get())
  const messages: string[] = []
  const originalWarn = console.warn

  try {
    console.warn = (message?: unknown) => {
      messages.push(String(message))
    }

    changeObservedBox(box) // STACK_MARKER_TEST_TRIGGER

    const warning = messages.join("\n")
    const bddFrame = getExternalSourceLocations(new Error().stack).at(-1)
      ?.display

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
    fobx.configure({ enforceActions: prevEnforceActions })
  }
})
