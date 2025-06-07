import{a}from"./chunks/chunk-DGGAD2MO.js";import{f as e,i as t}from"./chunks/chunk-VP5LKBKE.js";e(t(a,{siteInfo:{title:"FobX Documentation",description:"Documentation for FobX state management library",version:"1.0.0",baseUrl:"/fobx"},route:{slug:"core-docs-controlling-comparisons",path:"/core-docs-controlling-comparisons",title:"Controlling Comparisons in FobX",sourcePath:"/fobx/core/docs/controlling-comparisons.mdoc",parentSlug:"core",lastModified:"2025-06-03T04:18:05.748Z",readingTime:{minutes:10,words:1973},frontmatter:{description:"# Controlling Comparisons in FobX",showEditButton:!0,title:"Controlling Comparisons in FobX"},content:{ast:{$$mdtype:"Tag",name:"article",attributes:{},children:[{name:"Heading",attributes:{level:1,id:"controlling-comparisons-in-fobx"},children:["Controlling Comparisons in FobX"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["This document explains how to control when FobX considers observable values to"," ","have changed by using different comparison strategies."]},{name:"Heading",attributes:{level:2,id:"structural-comparison"},children:["Structural Comparison"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["FobX supports structural comparison of observable values. This is useful when"," ","you want to compare objects by their structure rather than by reference"," ","equality."]},{name:"Heading",attributes:{level:3,id:"configuring-structural-comparison"},children:["Configuring Structural Comparison"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Before using structural comparison, you need to configure it globally:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { configure } from "@fobx/core"
import { deepEqual } from "fast-equals"

// Configure FobX to use deepEqual for structural comparisons
configure({
  comparer: { structural: deepEqual },
})
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["The ",{$$mdtype:"Tag",name:"code",attributes:{},children:["structural"]}," comparer can be any function that takes two arguments and"," ","returns a boolean indicating if they are equal. In the example above, we use"," ",{$$mdtype:"Tag",name:"code",attributes:{},children:["deepEqual"]}," from the ",{$$mdtype:"Tag",name:"code",attributes:{},children:["fast-equals"]}," library."]},{name:"Heading",attributes:{level:3,id:"making-observables-use-structural-comparison"},children:["Making Observables Use Structural Comparison"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Once configured, you can create observables that use structural comparison in"," ","several ways:"]},{name:"Heading",attributes:{level:4,id:"_1-using-makeobservable-with-structural-annotation"},children:["1. Using ",{$$mdtype:"Tag",name:"code",attributes:{},children:["makeObservable"]}," with ",{$$mdtype:"Tag",name:"code",attributes:{},children:['"structural"']}," annotation"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable } from "@fobx/core"

const user = makeObservable({
  profile: { name: "Alice", age: 25 },
}, {
  profile: ["observable", "structural"],
})

// Changes that are structurally equivalent won't trigger reactions
user.profile = { name: "Alice", age: 25 } // No reaction triggered

// Changes that are structurally different will trigger reactions
user.profile = { name: "Bob", age: 30 } // Reaction triggered
`]},{name:"Heading",attributes:{level:4,id:"_2-using-computed-with-structural-comparison"},children:["2. Using ",{$$mdtype:"Tag",name:"code",attributes:{},children:["computed"]}," with structural comparison"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { computed, observable, reaction, runInAction } from "@fobx/core"

const items = observable([1, 2, 3])
const total = computed(
  () => {
    // Return a new object each time
    return { sum: items.reduce((acc, val) => acc + val, 0) }
  },
  { comparer: "structural" },
)

// Note: Computed values in FobX are lazily evaluated and only run
// when they're being tracked by a reaction
reaction(
  () => total.value,
  (sum) => console.log("Sum changed:", sum),
)

// IMPORTANT: When making multiple changes that should be treated as one transaction,
// use runInAction to batch them together
runInAction(() => {
  // Modifying the array but keeping the same sum won't trigger the reaction
  items[0] = 0
  items[1] = 3
  items[2] = 3
})
// total.value is still { sum: 6 }, reaction doesn't fire

// Changing the sum will trigger the reaction
items.push(4)
// total.value is now { sum: 10 }, reaction fires
`]},{name:"Heading",attributes:{level:2,id:"custom-equality-functions"},children:["Custom Equality Functions"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Besides structural comparison, FobX allows defining custom equality functions"," ","for fine-grained control over when to consider values equal."]},{name:"Heading",attributes:{level:3,id:"using-custom-equality-function-with-observable"},children:["Using Custom Equality Function with ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable"]}]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { observableBox } from "@fobx/core"

// Custom equality function that ignores case for strings
const caseInsensitiveObservable = observableBox("hello", {
  equals: (oldValue, newValue) =>
    typeof oldValue === "string" &&
    typeof newValue === "string" &&
    oldValue.toLowerCase() === newValue.toLowerCase(),
})

// These won't trigger reactions because the case-insensitive values are equal
caseInsensitiveObservable.value = "HELLO"
caseInsensitiveObservable.value = "Hello"

// This will trigger reactions because the value is different case-insensitively
caseInsensitiveObservable.value = "world"
`]},{name:"Heading",attributes:{level:3,id:"using-custom-equality-function-with-makeobservable"},children:["Using Custom Equality Function with ",{$$mdtype:"Tag",name:"code",attributes:{},children:["makeObservable"]}]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable } from "@fobx/core"

// Custom equality function for numeric values
const roundingEqualityFn = (a, b) => Math.floor(a) === Math.floor(b)

const stats = makeObservable({
  score: 10.2,
}, {
  score: ["observable", roundingEqualityFn],
})

// Won't trigger reactions because floor values are equal
stats.score = 10.8

// Will trigger reactions because floor values differ
stats.score = 11.2
`]},{name:"Heading",attributes:{level:2,id:"combining-shallow-observables-with-comparison-functions"},children:["Combining Shallow Observables with Comparison Functions"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["FobX allows you to combine ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable.shallow"]}," with custom equality functions"," ","for even more control over reactivity."]},{name:"Heading",attributes:{level:3,id:"understanding-observableshallow-behavior"},children:["Understanding ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable.shallow"]}," Behavior"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["When using ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable.shallow"]}," annotation, observable collections are created"," ","but their items remain non-observable, and reference equality is used by"," ","default:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable, reaction } from "@fobx/core"

// An array of users that we want to remain shallow (not make user objects observable)
const users = makeObservable({
  list: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ],
}, {
  list: "observable.shallow",
})

// You can also use observable() the same way:
const usersAlt = observable({
  list: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ],
}, {
  list: "observable.shallow",
})

reaction(
  () => users.list,
  (userList) => console.log("User list changed:", userList),
)

// Operations on the collection trigger reactions
users.list.push({ id: 3, name: "Charlie" })

// Replacing the entire collection will also trigger a reaction
users.list = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
]
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Unlike regular deep observables which can use structural comparison, shallow"," ","observables rely on reference equality by default, so replacing a collection"," ","with a structurally identical one will still trigger reactions."]},{name:"Heading",attributes:{level:3,id:"using-observableshallow-with-custom-equality-function"},children:["Using ",{$$mdtype:"Tag",name:"code",attributes:{},children:["observable.shallow"]}," with Custom Equality Function"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["You can override the default reference equality by providing a custom equality"," ","function:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable, reaction } from "@fobx/core"

// A settings object where we only care about specific properties
const settings = makeObservable({
  config: {
    theme: "dark",
    fontSize: 16,
    cache: { temporaryData: [1, 2, 3] }, // We don't care about comparing this
    lastUpdated: Date.now(), // We don't care about comparing this
  },
}, {
  config: [
    "observable.shallow",
    (oldValue, newValue) => {
      // Only compare the keys we care about
      return oldValue.theme === newValue.theme &&
        oldValue.fontSize === newValue.fontSize
    },
  ],
})

reaction(
  () => settings.config,
  (config) => console.log("Important settings changed:", config),
)

// Won't trigger reaction (important keys unchanged)
settings.config = {
  theme: "dark",
  fontSize: 16,
  cache: { temporaryData: [4, 5, 6] }, // Different but we don't care
  lastUpdated: Date.now(), // Different but we don't care
}

// Will trigger reaction (theme property changed)
settings.config = {
  theme: "light", // Changed!
  fontSize: 16,
  cache: { temporaryData: [4, 5, 6] },
  lastUpdated: Date.now(),
}
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["This pattern is excellent for configuration objects where you want to ignore"," ","changes to volatile or non-important properties."]},{name:"Heading",attributes:{level:3,id:"best-practices-for-api-data"},children:["Best Practices for API Data"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["When working with API data, here are some approaches to consider:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { makeObservable, reaction } from "@fobx/core"

class ProductStore {
  constructor() {
    makeObservable(this, {
      // Use shallow observables for collections of data objects
      // to avoid making each item observable
      products: "observable.shallow",
      selectedProductId: "observable",
      selectedProduct: "computed",
    })
  }

  products = [
    { id: 1, name: "Phone", price: 599.99 },
    { id: 2, name: "Laptop", price: 1299.99 },
  ]

  selectedProductId = 1

  get selectedProduct() {
    return this.products.find((p) => p.id === this.selectedProductId) || null
  }

  // When refetching products, consider implementing your own comparison
  // to avoid unnecessary reactions
  updateProducts(newProducts) {
    // Option 1: Simple reference check (default behavior)
    this.products = newProducts

    // Option 2: Custom implementation to avoid unnecessary updates
    // if you need structural comparison
    /*
    if (!areProductListsEqual(this.products, newProducts)) {
      this.products = newProducts;
    }
    */
  }

  selectProduct(id) {
    this.selectedProductId = id
  }
}

// Helper function (not part of FobX)
function areProductListsEqual(list1, list2) {
  if (list1.length !== list2.length) return false
  return list1.every((item, i) =>
    item.id === list2[i].id &&
    item.name === list2[i].name &&
    item.price === list2[i].price
  )
}

const store = new ProductStore()

// Setup reactions
reaction(
  () => store.products,
  (products) => console.log("Products list changed, updating UI..."),
)

reaction(
  () => store.selectedProduct,
  (product) => console.log("Selected product changed:", product?.name),
)
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["With this approach:"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["Products remain shallow observables so the individual product objects aren't"," ","made observable"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["If you need structural comparison, you can implement it in your methods before"," ","updating the observable value"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["The computed ",{$$mdtype:"Tag",name:"code",attributes:{},children:["selectedProduct"]}," property efficiently derives from the"," ","observable state"]}]},{name:"Heading",attributes:{level:2,id:"important-behavior-notes"},children:["Important Behavior Notes"]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!0},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Computed Value Optimization"]},": Computed values in FobX are optimized and"," ","only calculate when they're being tracked by a reaction. If a computed isn't"," ","being observed, it won't recalculate until it's accessed."]}]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Reaction Comparisons"]},": When a reaction fires, it compares the new value"," ","with the initial value from when the reaction was created, not with the most"," ","recently seen value. This behavior is important to understand when designing"," ","custom equality functions."]}]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:[{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Transactions Matter"]},": When making multiple changes that should be treated"," ","as a single update, always wrap them in ",{$$mdtype:"Tag",name:"code",attributes:{},children:["runInAction"]},". Without this, each"," ","individual change might trigger unnecessary computed recalculations, leading"," ","to unexpected behavior with comparison functions."]}]}]},{name:"Heading",attributes:{level:2,id:"practical-use-cases"},children:["Practical Use Cases"]},{name:"Heading",attributes:{level:3,id:"performance-optimization"},children:["Performance Optimization"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Structural comparison involves trade-offs that should be carefully considered:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`// Consider this scenario:
const userData = observable({
  profile: {
    personal: { name: "Alice", age: 30 },
    preferences: { theme: "dark", notifications: true },
    statistics: {/* possibly large nested data */},
  },
})
`]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Benefits:"]}]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["Prevents unnecessary reactions when objects are recreated but structurally"," ","identical"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["Particularly valuable when reactions are expensive (DOM updates, re-renders,"," ","network calls)"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["Works well with immutable data patterns where new objects are created"," ","frequently"]}]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["Costs:"]}]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["The structural comparison itself is more expensive than reference equality"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["The larger and more nested the objects being compared, the more costly the"," ","comparison"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["For very frequent updates to large objects, the comparison cost may outweigh"," ","the benefits"]}]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["When to use:"]}]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When the cost of running the reaction (e.g., a component re-render) is higher"," ","than the cost of the comparison"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When working with immutable data patterns where objects are frequently"," ","recreated"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["For objects of moderate size that don't change extremely frequently"]}]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:[{$$mdtype:"Tag",name:"strong",attributes:{},children:["When to avoid:"]}]},{$$mdtype:"Tag",name:"List",attributes:{ordered:!1},children:[{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When comparing very large, deeply nested objects"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When the observable updates extremely frequently (many times per second)"]},{$$mdtype:"Tag",name:"ListItem",attributes:{},children:["When the reaction is simple and inexpensive to run"]}]},{name:"Heading",attributes:{level:3,id:"form-data-validation"},children:["Form Data Validation"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["Custom equality functions are useful for form validation where you might want to"," ","consider values equal if they're within a certain range or match a particular"," ","pattern:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`const formData = makeObservable({
  email: "",
  phoneNumber: "",
  searchQuery: "",
}, {
  // Only consider email changed if the normalized version is different
  email: [
    "observable",
    (oldValue, newValue) =>
      oldValue.trim().toLowerCase() === newValue.trim().toLowerCase(),
  ],

  // Only consider phone numbers different if the actual digits change
  // (ignores formatting differences like (555) 123-4567 vs 5551234567)
  phoneNumber: [
    "observable",
    (oldValue, newValue) =>
      oldValue.replace(/\\D/g, "") === newValue.replace(/\\D/g, ""),
  ],

  // Only trigger reactions for search queries with meaningful differences
  // (ignores extra spaces, treats "t-shirt" the same as "tshirt", etc)
  searchQuery: [
    "observable",
    (oldValue, newValue) => {
      const normalize = (str) =>
        str.trim().toLowerCase()
          .replace(/\\s+/g, " ") // normalize spaces
          .replace(/[^a-z0-9 ]/g, "") // remove special chars
      return normalize(oldValue) === normalize(newValue)
    },
  ],
})
`]},{name:"Heading",attributes:{level:3,id:"complex-data-structures"},children:["Complex Data Structures"]},{$$mdtype:"Tag",name:"Paragraph",attributes:{},children:["For complex data structures like nested objects or arrays, structural comparison"," ","ensures that only genuine changes in data structure trigger reactions:"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`import { configure, observable, reaction } from "@fobx/core"
import { deepEqual } from "fast-equals"

configure({
  comparer: { structural: deepEqual },
})

const nestedData = observable({
  users: [
    { id: 1, details: { name: "Alice", preferences: { theme: "dark" } } },
    { id: 2, details: { name: "Bob", preferences: { theme: "light" } } },
  ],
})

// Reaction will only run if the actual structure changes when using structural comparison
reaction(
  () => nestedData.users,
  (users) => console.log("Users updated", users),
  { equals: "structural" },
)
`]},{name:"Heading",attributes:{level:2,id:"complete-example"},children:["Complete Example"]},{$$mdtype:"Tag",name:"CodeBlock",attributes:{language:"typescript"},children:[`// Example with both structural and custom equality functions

import { configure, makeObservable, observable, reaction } from "@fobx/core"
import { deepEqual } from "fast-equals"

// Configure structural comparison
configure({
  comparer: { structural: deepEqual },
})

// Object with different comparison strategies
const dashboard = makeObservable({
  // Will use structural comparison
  userData: { name: "Alice", preferences: { theme: "dark" } },

  // Will use custom comparison (value within the same 5-point range)
  approximateScore: 75,
}, {
  userData: ["observable", "structural"],
  approximateScore: [
    "observable",
    (a, b) => Math.floor(a / 5) === Math.floor(b / 5),
  ],
})

// Track changes
reaction(
  () => dashboard.userData,
  (userData) => console.log("User data changed:", userData),
)

reaction(
  () => dashboard.approximateScore,
  (score) => console.log("Score changed significantly:", score),
)

// Won't trigger reaction (structurally equal)
dashboard.userData = { name: "Alice", preferences: { theme: "dark" } }

// Will trigger reaction (structurally different)
dashboard.userData = { name: "Alice", preferences: { theme: "light" } }

// Won't trigger reaction (same 5-point range: 75-79)
dashboard.approximateScore = 79

// Will trigger reaction (different 5-point range: 80-84)
dashboard.approximateScore = 80
`]}]},toc:[{id:"structural-comparison",level:2,title:"Structural Comparison",children:[{id:"configuring-structural-comparison",level:3,title:"Configuring Structural Comparison",children:[]},{id:"making-observables-use-structural-comparison",level:3,title:"Making Observables Use Structural Comparison",children:[{id:"_1-using-makeobservable-with-structural-annotation",level:4,title:'1. Using makeObservable with "structural" annotation',children:[]},{id:"_2-using-computed-with-structural-comparison",level:4,title:"2. Using computed with structural comparison",children:[]}]}]},{id:"custom-equality-functions",level:2,title:"Custom Equality Functions",children:[{id:"using-custom-equality-function-with-observable",level:3,title:"Using Custom Equality Function with observable",children:[]},{id:"using-custom-equality-function-with-makeobservable",level:3,title:"Using Custom Equality Function with makeObservable",children:[]}]},{id:"combining-shallow-observables-with-comparison-functions",level:2,title:"Combining Shallow Observables with Comparison Functions",children:[{id:"understanding-observableshallow-behavior",level:3,title:"Understanding observable.shallow Behavior",children:[]},{id:"using-observableshallow-with-custom-equality-function",level:3,title:"Using observable.shallow with Custom Equality Function",children:[]},{id:"best-practices-for-api-data",level:3,title:"Best Practices for API Data",children:[]}]},{id:"important-behavior-notes",level:2,title:"Important Behavior Notes",children:[]},{id:"practical-use-cases",level:2,title:"Practical Use Cases",children:[{id:"performance-optimization",level:3,title:"Performance Optimization",children:[]},{id:"form-data-validation",level:3,title:"Form Data Validation",children:[]},{id:"complex-data-structures",level:3,title:"Complex Data Structures",children:[]}]},{id:"complete-example",level:2,title:"Complete Example",children:[]}]}},navigation:{mainNav:[{label:"Documentation",path:"/"},{label:"GitHub",path:"https://github.com/jereklas/fobx",isExternal:!0}],sidebar:[{title:"Core",items:[{label:"Controlling Comparisons in FobX",path:"/core-docs-controlling-comparisons"},{label:"Creating Observable State in FobX",path:"/core-docs-creating-observable-state"},{label:"Shallow Observables in FobX",path:"/core-docs-shallow-observables"}]}]},lastUpdated:"2025-06-07T17:23:53.637Z"}),document.getElementById("root"));
