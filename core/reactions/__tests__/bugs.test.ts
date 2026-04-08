import * as fobx from "@fobx/core"
import { expect } from "../../../testing/index.ts"

Deno.test("bug: 1", () => {
  const options = fobx.observable({}) as { type?: string }
  const type = fobx.computed(() => options.type ?? "border-box")
  const read = fobx.transaction(() => type.get())

  expect(type.get()).toBe("border-box")
  expect(read()).toBe("border-box")

  options.type = "content-box"

  expect(type.get()).toBe("content-box")
  expect(read()).toBe("content-box")
})

Deno.test("computed with no dependencies is not observable", () => {
  // This observable object does not have a 'type' key defined at the point of creation so
  // there are no fields that are actually observable. This is showcasing a potential user error.
  const options = fobx.observable({}) as { type?: string }

  // At face value, this look like it would re-run when 'type' is changed, but due to the "error"
  // in how the object was made observable, this doesn't actually have any dependencies and will
  // never act as "observable"
  const type = fobx.computed(() => options.type ?? "border-box")

  const values: string[] = []
  fobx.autorun(() => {
    values.push(type.get())
  })

  // If the object was constructed as `observable({type: undefined})`, this update to the type
  // field would cause the computeds to re-run as expected, but since this is actually adding 'type'
  // to the observable for the first time, nothing happens.
  options.type = "content-box"

  expect(values).toEqual(["border-box"])
})

Deno.test("bug: 2", () => {
  const value = fobx.observableBox(0)

  const inner = fobx.computed(() => value.get() >= 0)

  const outer = fobx.computed(() => !inner.get() || value.get() !== 0)

  const seen: boolean[] = []
  const dispose = fobx.reaction(() => outer.get(), (next) => seen.push(next))

  try {
    expect({ value: value.get(), inner: inner.get(), outer: outer.get(), seen })
      .toEqual({
        value: 0,
        inner: true,
        outer: false,
        seen: [],
      })

    fobx.runInTransaction(() => {
      value.set(1)
    })

    expect({ value: value.get(), inner: inner.get(), outer: outer.get(), seen })
      .toEqual({
        value: 1,
        inner: true,
        outer: true,
        seen: [true],
      })
  } finally {
    dispose()
  }
})

Deno.test("bug: 3", () => {
  const value = fobx.observableBox(0)

  const inner = fobx.computed(() => value.get() >= 0)
  const middle1 = fobx.computed(() => inner.get())
  const middle2 = fobx.computed(() => middle1.get())

  const outer = fobx.computed(() => !middle2.get() || value.get() !== 0)

  const seen: boolean[] = []
  const dispose = fobx.reaction(() => outer.get(), (next) => seen.push(next))

  try {
    expect({
      value: value.get(),
      inner: inner.get(),
      middle1: middle1.get(),
      middle2: middle2.get(),
      outer: outer.get(),
      seen,
    }).toEqual({
      value: 0,
      inner: true,
      middle1: true,
      middle2: true,
      outer: false,
      seen: [],
    })

    fobx.runInTransaction(() => {
      value.set(1)
    })

    expect({
      value: value.get(),
      inner: inner.get(),
      middle1: middle1.get(),
      middle2: middle2.get(),
      outer: outer.get(),
      seen,
    }).toEqual({
      value: 1,
      inner: true,
      middle1: true,
      middle2: true,
      outer: true,
      seen: [true],
    })
  } finally {
    dispose()
  }
})
