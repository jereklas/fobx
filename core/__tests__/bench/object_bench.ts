import * as fobx from "../../dist/index.production.js"
import * as mobx from "mobx/dist/mobx.cjs.production.min.js"

const obj = {
  a: 1,
  get b() {
    return this.a
  },
}

const groups = {
  incObs: "increment observable",
  incObsInactiveComputed: "increment observable with inactive computed",
  incObsReactionInactiveComputed:
    "increment observable with reaction + inactive computed",
  incObsActiveComputed: "increment observable with active computed",
}

const f1 = fobx.observable(obj)
const m1 = mobx.observable(obj)

Deno.bench("fobx", { group: groups.incObs, baseline: true }, () => {
  f1.a += 1
})
Deno.bench("mobx", { group: groups.incObs }, () => {
  m1.a += 1
})

const f2 = fobx.observable(obj)
const m2 = mobx.observable(obj)
Deno.bench(
  "fobx",
  { group: groups.incObsInactiveComputed, baseline: true },
  () => {
    f2.a += 1
    f2.b
  },
)
Deno.bench("mobx", { group: groups.incObsInactiveComputed }, () => {
  m2.a += 1
  m2.b
})

const f3 = fobx.observable(obj)
fobx.reaction(() => f3.a, () => {})
const m3 = mobx.observable(obj)
mobx.reaction(() => m3.a, () => {})
Deno.bench(
  "fobx",
  { group: groups.incObsReactionInactiveComputed, baseline: true },
  () => {
    f3.a += 1
    f3.b
  },
)
Deno.bench("mobx", { group: groups.incObsReactionInactiveComputed }, () => {
  m3.a += 1
  m3.b
})

const f4 = fobx.observable(obj)
fobx.reaction(() => f4.b, () => {})
const m4 = mobx.observable(obj)
mobx.reaction(() => m4.b, () => {})
Deno.bench(
  "fobx",
  { group: groups.incObsActiveComputed, baseline: true },
  () => {
    f4.a += 1
    f4.b
  },
)
Deno.bench("mobx", { group: groups.incObsActiveComputed }, () => {
  m4.a += 1
  m4.b
})
