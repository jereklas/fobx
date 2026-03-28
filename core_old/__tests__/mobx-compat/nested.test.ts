// deno-lint-ignore-file
import * as fobx from "@fobx/core"
import { beforeAll, expect, FakeTime, test } from "@fobx/testing"

beforeAll(() => {
  fobx.configure({ enforceActions: false })
})

//cspell:ignore computeds
test("nested computeds should not run unnecessary", () => {
  function Item(this: object, name: string) {
    fobx.extendObservable(this, {
      name: name,
      get index() {
        const i = store.items.indexOf(this)
        if (i === -1) {
          throw "not found"
        }
        return i
      },
    })
  }

  const store = fobx.observable({
    items: [] as unknown as fobx.ObservableArray<any>,
    get asString(): string {
      return this.items.map((item) => item.index + ":" + item.name).join(",")
    },
  })
  //@ts-expect-error - testing
  store.items.push(new Item("item1"))

  const values: string[] = []
  fobx.autorun(() => {
    values.push(store.asString)
  })
  //@ts-expect-error - testing
  store.items.replace([new Item("item2")])

  expect(values).toEqual(["0:item1", "0:item2"])
})

test("fix #1535: stale observables", () => {
  using time = new FakeTime()
  // see https://codesandbox.io/s/k92o2jmz63
  const snapshots: string[] = []

  const x = fobx.observableBox(1)

  // Depends on observable x
  const derived1 = fobx.computed(() => {
    return x.value + 1
  })

  // Depends on computed derived1
  const derived2 = fobx.computed(() => {
    return derived1.value + 1
  })

  function increment() {
    fobx.runInAction(() => {
      x.value += 1
      // No problems here
      derived1.value
      derived2.value
    })
  }

  function brokenIncrement() {
    fobx.runInAction(() => (x.value += 1))
    // Accessing computed outside of action causes staleness
    // NOTE IT DOESN'T MATTER WHICH COMPUTED IS ACCESSED
    derived1.value
    derived2.value
  }

  fobx.autorun(() => {
    snapshots.push(`${x.value}, ${derived1.value}, ${derived2.value}`)
  })

  increment()
  setTimeout(() => {
    brokenIncrement()
  }, 50)
  setTimeout(() => {
    expect(snapshots).toEqual(["1, 2, 3", "2, 3, 4", "3, 4, 5"])
  }, 100)
  time.tick(100)
})
