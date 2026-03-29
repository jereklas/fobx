import * as fobx from "../../index.ts"
import { beforeEach, describe, expect, test } from "@fobx/testing"

beforeEach(() => {
  fobx.configure({ enforceActions: false })
})

describe("createSelector", () => {
  test("matches the active tab documentation example", () => {
    const activeTab = fobx.observableBox("dashboard")
    const isActiveTab = fobx.createSelector(() => activeTab.get())

    const tabs = ["dashboard", "settings", "profile", "billing"]
    const logs: string[] = []

    const disposers = tabs.map((tab) =>
      fobx.autorun(() => {
        logs.push(`[${tab}] active=${isActiveTab(tab)}`)
      })
    )

    expect(logs).toEqual([
      "[dashboard] active=true",
      "[settings] active=false",
      "[profile] active=false",
      "[billing] active=false",
    ])

    activeTab.set("settings")
    expect(logs).toEqual([
      "[dashboard] active=true",
      "[settings] active=false",
      "[profile] active=false",
      "[billing] active=false",
      "[dashboard] active=false",
      "[settings] active=true",
    ])

    activeTab.set("profile")
    expect(logs).toEqual([
      "[dashboard] active=true",
      "[settings] active=false",
      "[profile] active=false",
      "[billing] active=false",
      "[dashboard] active=false",
      "[settings] active=true",
      "[settings] active=false",
      "[profile] active=true",
    ])

    disposers.forEach((dispose) => dispose())
    isActiveTab.dispose()
  })
  test("exposes typed helper methods", () => {
    const selectedId = fobx.observableBox("none")
    const isSelected = fobx.createSelector(() => selectedId.get())

    expect(isSelected("none")).toBe(true)
    expect(isSelected.getAdmin("none").value).toBe(true)

    isSelected.dispose()
  })

  test("matches the form field focus tracking example", () => {
    const focusedField = fobx.observableBox("")
    const isFocused = fobx.createSelector(() => focusedField.get())

    const fields = ["email", "password", "name", "address", "phone", "notes"]
    const logs: string[] = []
    const runCounts = new Map<string, number>()

    const disposers = fields.map((field) =>
      fobx.autorun(() => {
        runCounts.set(field, (runCounts.get(field) ?? 0) + 1)
        if (isFocused(field)) {
          logs.push(`→ Show validation hint for "${field}"`)
        }
      })
    )

    expect(logs).toEqual([])

    focusedField.set("email")
    expect(logs).toEqual([
      '→ Show validation hint for "email"',
    ])

    focusedField.set("password")
    expect(logs).toEqual([
      '→ Show validation hint for "email"',
      '→ Show validation hint for "password"',
    ])
    expect(runCounts.get("email")).toBe(3)
    expect(runCounts.get("password")).toBe(2)
    expect(runCounts.get("name")).toBe(1)
    expect(runCounts.get("address")).toBe(1)
    expect(runCounts.get("phone")).toBe(1)
    expect(runCounts.get("notes")).toBe(1)

    disposers.forEach((dispose) => dispose())
    isFocused.dispose()
  })

  test("matches the permission role gate example", () => {
    const currentRole = fobx.observableBox<"viewer" | "editor" | "admin">(
      "viewer",
    )
    const isRole = fobx.createSelector(() => currentRole.get())

    const adminLogs: string[] = []
    const editorLogs: string[] = []

    const stopAdminWatch = fobx.autorun(() => {
      if (isRole("admin")) {
        adminLogs.push("Admin panel: enabled")
      } else {
        adminLogs.push("Admin panel: disabled")
      }
    })

    const stopEditorWatch = fobx.autorun(() => {
      if (isRole("editor")) {
        editorLogs.push("Editor toolbar: visible")
      } else {
        editorLogs.push("Editor toolbar: hidden")
      }
    })

    expect(adminLogs).toEqual(["Admin panel: disabled"])
    expect(editorLogs).toEqual(["Editor toolbar: hidden"])

    currentRole.set("editor")
    expect(adminLogs).toEqual(["Admin panel: disabled"])
    expect(editorLogs).toEqual([
      "Editor toolbar: hidden",
      "Editor toolbar: visible",
    ])

    currentRole.set("admin")
    expect(adminLogs).toEqual([
      "Admin panel: disabled",
      "Admin panel: enabled",
    ])
    expect(editorLogs).toEqual([
      "Editor toolbar: hidden",
      "Editor toolbar: visible",
      "Editor toolbar: hidden",
    ])

    stopAdminWatch()
    stopEditorWatch()
    isRole.dispose()
  })

  test("matches the state-machine step tracker example", () => {
    const currentStep = fobx.observableBox<
      "collect" | "validate" | "transform" | "publish"
    >(
      "collect",
    )
    const isStep = fobx.createSelector(() => currentStep.get())

    const steps = ["collect", "validate", "transform", "publish"] as const
    const logs: string[] = []

    const disposers = steps.map((step) =>
      fobx.reaction(
        () => isStep(step),
        (active) => {
          if (active) logs.push(`▶ Starting step: ${step}`)
          else logs.push(`  Finished step: ${step}`)
        },
      )
    )

    currentStep.set("validate")
    currentStep.set("transform")
    currentStep.set("publish")

    expect(logs).toEqual([
      "  Finished step: collect",
      "▶ Starting step: validate",
      "  Finished step: validate",
      "▶ Starting step: transform",
      "  Finished step: transform",
      "▶ Starting step: publish",
    ])

    disposers.forEach((dispose) => dispose())
    isStep.dispose()
  })

  test("matches the selected row data-table example", () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      label: `Row ${i}`,
    }))

    const selectedRowId = fobx.observableBox(-1)
    const isSelectedRow = fobx.createSelector(() => selectedRowId.get())

    const idsRerun: number[] = []
    const idsNotified: number[] = []

    const disposers = rows.map((row) =>
      fobx.autorun(() => {
        idsRerun.push(row.id)
        const selected = isSelectedRow(row.id)
        if (selected) idsNotified.push(row.id)
      })
    )

    idsRerun.length = 0
    idsNotified.length = 0
    selectedRowId.set(500)
    expect(idsRerun).toEqual([500])
    expect(idsNotified).toEqual([500])

    idsRerun.length = 0
    idsNotified.length = 0
    selectedRowId.set(200)
    expect(idsRerun).toEqual([500, 200])
    expect(idsNotified).toEqual([200])

    disposers.forEach((dispose) => dispose())
    isSelectedRow.dispose()
  })

  test("matches the custom equality example", () => {
    const activeFilter = fobx.observableBox("ERROR")
    const isActiveFilter = fobx.createSelector(
      () => activeFilter.get(),
      (a, b) => a.toLowerCase() === b.toLowerCase(),
    )

    const infoLogs: string[] = []
    const errorLogs: string[] = []

    const stopInfo = fobx.autorun(() => {
      infoLogs.push(`info filter active: ${isActiveFilter("info")}`)
    })
    const stopError = fobx.autorun(() => {
      errorLogs.push(`error filter active: ${isActiveFilter("error")}`)
    })

    expect(infoLogs).toEqual(["info filter active: false"])
    expect(errorLogs).toEqual(["error filter active: true"])

    activeFilter.set("Info")
    expect(infoLogs).toEqual([
      "info filter active: false",
      "info filter active: true",
    ])
    expect(errorLogs).toEqual([
      "error filter active: true",
      "error filter active: false",
    ])

    stopInfo()
    stopError()
    isActiveFilter.dispose()
  })

  test("supports undefined as a selected value", () => {
    const selected = fobx.observableBox<string | undefined>(undefined)
    const isSelected = fobx.createSelector(() => selected.get())

    const undefinedLogs: boolean[] = []
    const alphaLogs: boolean[] = []

    const stopUndefined = fobx.autorun(() => {
      undefinedLogs.push(isSelected(undefined))
    })
    const stopAlpha = fobx.autorun(() => {
      alphaLogs.push(isSelected("alpha"))
    })

    expect(undefinedLogs).toEqual([true])
    expect(alphaLogs).toEqual([false])

    selected.set("alpha")
    expect(undefinedLogs).toEqual([true, false])
    expect(alphaLogs).toEqual([false, true])

    selected.set(undefined)
    expect(undefinedLogs).toEqual([true, false, true])
    expect(alphaLogs).toEqual([false, true, false])

    stopUndefined()
    stopAlpha()
    isSelected.dispose()
  })
})
