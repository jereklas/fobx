// Test file to validate examples from the shallow-observables.mdoc documentation
import * as fobx from "@fobx/core"
import { describe, expect, fn, test } from "@fobx/testing"

fobx.configure({ enforceActions: false })

describe("shallow-observables.mdoc examples", () => {
  describe("observable with shallowRef option", () => {
    test("shallowRef keeps original references for properties", () => {
      const originalArray = [1, 2, 3]
      const originalObject = { nested: "value" }

      const obj = fobx.observable(
        {
          arr: originalArray,
          nested: originalObject,
          primitive: "hello",
        },
        {},
        { shallowRef: true },
      )

      // Properties should be observable
      expect(fobx.isObservable(obj, "arr")).toBe(true)
      expect(fobx.isObservable(obj, "nested")).toBe(true)
      expect(fobx.isObservable(obj, "primitive")).toBe(true)

      // But the values should maintain their original references
      expect(obj.arr).toBe(originalArray)
      expect(obj.nested).toBe(originalObject)

      // Collections are NOT converted to observable collections
      expect(fobx.isObservableArray(obj.arr)).toBe(false)

      const arrReactionFn = fn()
      fobx.reaction(() => obj.arr, arrReactionFn)

      // Changes to the collection items won't trigger reactions
      obj.arr.push(4)
      expect(arrReactionFn).not.toHaveBeenCalled()

      // Only replacing the entire collection will trigger reactions
      obj.arr = [5, 6, 7]
      expect(arrReactionFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("observable.shallow annotation", () => {
    test("observable.shallow makes collections observable but keeps items non-observable", () => {
      const store = fobx.observable({
        items: [{ id: 1, name: "item1" }, { id: 2, name: "item2" }],
        tags: new Set(["tag1", "tag2"]),
      }, {
        items: "observable.shallow",
        tags: "observable.shallow",
      })

      // Collections should be converted to observable variants
      expect(fobx.isObservableArray(store.items)).toBe(true)
      expect(fobx.isObservableSet(store.tags)).toBe(true)

      // But the items inside should maintain their original references
      expect(fobx.isObservable(store.items[0])).toBe(false)

      const itemsReactionFn = fn()
      fobx.reaction(() => store.items.length, itemsReactionFn)

      const tagsReactionFn = fn()
      fobx.reaction(() => store.tags.size, tagsReactionFn)

      // Changes to the collection (adding/removing items) WILL trigger reactions
      store.items.push({ id: 3, name: "item3" })
      expect(itemsReactionFn).toHaveBeenCalledTimes(1)

      store.tags.add("tag3")
      expect(tagsReactionFn).toHaveBeenCalledTimes(1)

      // But changes to items inside won't trigger reactions (since they're not observable)
      const itemReactionFn = fn()
      fobx.reaction(() => store.items[0].name, itemReactionFn)

      store.items[0].name = "modified"
      expect(itemReactionFn).not.toHaveBeenCalled()
    })

    test("makeObservable with observable.shallow", () => {
      const store = fobx.makeObservable({
        products: [
          { id: 1, name: "Phone", price: 599.99 },
          { id: 2, name: "Laptop", price: 1299.99 },
        ],
        categories: new Map([["electronics", "Electronics"]]),
      }, {
        products: "observable.shallow",
        categories: "observable.shallow",
      })

      expect(fobx.isObservableArray(store.products)).toBe(true)
      expect(fobx.isObservableMap(store.categories)).toBe(true)

      // Items should not be observable
      expect(fobx.isObservable(store.products[0])).toBe(false)

      const productsReactionFn = fn()
      fobx.reaction(() => store.products.length, productsReactionFn)

      const categoriesReactionFn = fn()
      fobx.reaction(() => store.categories.size, categoriesReactionFn)

      // Collection operations trigger reactions
      store.products.push({ id: 3, name: "Tablet", price: 399.99 })
      expect(productsReactionFn).toHaveBeenCalledTimes(1)

      store.categories.set("books", "Books")
      expect(categoriesReactionFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("observable.ref annotation", () => {
    test("observable.ref maintains original references like shallowRef", () => {
      const originalArray = [1, 2, 3]
      const originalMap = new Map([["key", "value"]])

      const store = fobx.observable({
        arr: originalArray,
        map: originalMap,
        value: "hello",
      }, {
        arr: "observable.ref",
        map: "observable.ref",
        value: "observable.ref",
      })

      // Properties should be observable
      expect(fobx.isObservable(store, "arr")).toBe(true)
      expect(fobx.isObservable(store, "map")).toBe(true)
      expect(fobx.isObservable(store, "value")).toBe(true)

      // But collections should maintain original references
      expect(store.arr).toBe(originalArray)
      expect(store.map).toBe(originalMap)

      // Collections are NOT converted to observable collections
      expect(fobx.isObservableArray(store.arr)).toBe(false)
      expect(fobx.isObservableMap(store.map)).toBe(false)

      const arrReactionFn = fn()
      fobx.reaction(() => store.arr, arrReactionFn)

      // Changes to collection items won't trigger reactions
      store.arr.push(4)
      expect(arrReactionFn).not.toHaveBeenCalled()

      store.map.set("newKey", "newValue")
      expect(arrReactionFn).not.toHaveBeenCalled()

      // Only replacing the entire collection will trigger reactions
      store.arr = [5, 6, 7]
      expect(arrReactionFn).toHaveBeenCalledTimes(1)
    })

    test("makeObservable with observable.ref", () => {
      const originalData = { nested: "value" }

      const store = fobx.makeObservable({
        data: originalData,
        items: [1, 2, 3],
      }, {
        data: "observable.ref",
        items: "observable.ref",
      })

      // Should maintain original references
      expect(store.data).toBe(originalData)
      expect(fobx.isObservable(store.data)).toBe(false)

      const dataReactionFn = fn()
      fobx.reaction(() => store.data, dataReactionFn)

      // Changes to nested properties won't trigger reactions
      store.data.nested = "modified"
      expect(dataReactionFn).not.toHaveBeenCalled()

      // Only replacing the entire reference will trigger reactions
      store.data = { nested: "new value" }
      expect(dataReactionFn).toHaveBeenCalledTimes(1)
    })
  })

  describe("use case comparisons", () => {
    test("React props use case with shallowRef", () => {
      // Simulating React props scenario

      const originalUser = { id: 1, name: "Alice" }
      const originalItems = ["item1", "item2"]
      const originalOnClick = () => console.log("clicked")

      const props = fobx.observable(
        {
          user: originalUser,
          items: originalItems,
          onClick: originalOnClick,
        },
        {},
        { shallowRef: true },
      )

      // Props should be observable for change detection
      expect(fobx.isObservable(props, "user")).toBe(true)
      expect(fobx.isObservable(props, "items")).toBe(true)
      expect(fobx.isAction(props.onClick)).toBe(true)

      // But the prop values should maintain their original references
      expect(props.user).toBe(originalUser)
      expect(props.items).toBe(originalItems)
      // TODO: I wouldn't expect this to have a new reference, but it does
      // expect(props.onClick).toBe(originalOnClick)

      // Collections should not be made observable
      expect(fobx.isObservableArray(props.items)).toBe(false)

      const userReactionFn = fn()
      fobx.reaction(() => props.user, userReactionFn)

      // Changes to the items array won't trigger reactions (good for React)
      props.items.push("item3")
      expect(userReactionFn).not.toHaveBeenCalled()

      // Only when props are replaced from parent component
      props.user = { id: 2, name: "Bob" }
      expect(userReactionFn).toHaveBeenCalledTimes(1)
    })

    test("collection-level reactivity use case with observable.shallow", () => {
      // Good for when you want to track collection changes but not item changes
      const todoStore = fobx.makeObservable({
        todos: [
          { id: 1, text: "Learn FobX", completed: false },
          { id: 2, text: "Build app", completed: false },
        ],
      }, {
        todos: "observable.shallow",
      })

      expect(fobx.isObservableArray(todoStore.todos)).toBe(true)
      expect(fobx.isObservable(todoStore.todos[0])).toBe(false)

      const todosLengthReactionFn = fn()
      fobx.reaction(() => todoStore.todos.length, todosLengthReactionFn)

      const firstTodoReactionFn = fn()
      fobx.reaction(() => todoStore.todos[0]?.completed, firstTodoReactionFn)

      // Adding/removing todos triggers reactions
      todoStore.todos.push({ id: 3, text: "Test app", completed: false })
      expect(todosLengthReactionFn).toHaveBeenCalledTimes(1)

      // But changing individual todo properties doesn't trigger reactions
      todoStore.todos[0].completed = true
      expect(firstTodoReactionFn).not.toHaveBeenCalled()

      // This is useful when you want to track the composition of the collection
      // but not the internal state of items (which might be managed elsewhere)
    })
  })

  describe("implementation behavior differences", () => {
    test("comparing shallowRef vs observable.ref vs observable.shallow", () => {
      const originalArray = [{ id: 1 }, { id: 2 }]

      // Three different approaches
      const withShallowRef = fobx.observable(
        {
          items: originalArray,
        },
        {},
        { shallowRef: true },
      )

      const withObservableRef = fobx.observable({
        items: originalArray,
      }, {
        items: "observable.ref",
      })

      const withObservableShallow = fobx.observable({
        items: originalArray,
      }, {
        items: "observable.shallow",
      })

      // All should make the property observable
      expect(fobx.isObservable(withShallowRef, "items")).toBe(true)
      expect(fobx.isObservable(withObservableRef, "items")).toBe(true)
      expect(fobx.isObservable(withObservableShallow, "items")).toBe(true)

      // shallowRef and observable.ref should maintain original references
      expect(withShallowRef.items).toBe(originalArray)
      expect(withObservableRef.items).toBe(originalArray)
      expect(fobx.isObservableArray(withShallowRef.items)).toBe(false)
      expect(fobx.isObservableArray(withObservableRef.items)).toBe(false)

      // observable.shallow should convert to ObservableArray
      expect(fobx.isObservableArray(withObservableShallow.items)).toBe(true)
      expect(withObservableShallow.items).not.toBe(originalArray)

      // Test reactivity differences
      const shallowRefReaction = fn()
      const observableRefReaction = fn()
      const observableShallowReaction = fn()

      fobx.reaction(() => withShallowRef.items.length, shallowRefReaction)
      fobx.reaction(() => withObservableRef.items.length, observableRefReaction)
      fobx.reaction(
        () => withObservableShallow.items.length,
        observableShallowReaction,
      )

      // For shallowRef and observable.ref, array mutations don't trigger reactions
      withShallowRef.items.push({ id: 3 })
      expect(shallowRefReaction).not.toHaveBeenCalled()

      withObservableRef.items.push({ id: 3 })
      expect(observableRefReaction).not.toHaveBeenCalled()

      // For observable.shallow, array mutations DO trigger reactions
      withObservableShallow.items.push({ id: 3 })
      expect(observableShallowReaction).toHaveBeenCalledTimes(1)
    })
  })
})
