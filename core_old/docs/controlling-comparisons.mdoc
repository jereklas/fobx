# Controlling Comparisons in FobX

This document explains how to control when FobX considers observable values to
have changed by using different comparison strategies.

## Structural Comparison

FobX supports structural comparison of observable values. This is useful when
you want to compare objects by their structure rather than by reference
equality.

### Configuring Structural Comparison

Before using structural comparison, you need to configure it globally:

```typescript
import { configure } from "@fobx/core"
import { deepEqual } from "fast-equals"

// Configure FobX to use deepEqual for structural comparisons
configure({
  comparer: { structural: deepEqual },
})
```

The `structural` comparer can be any function that takes two arguments and
returns a boolean indicating if they are equal. In the example above, we use
`deepEqual` from the `fast-equals` library.

### Making Observables Use Structural Comparison

Once configured, you can create observables that use structural comparison in
several ways:

#### 1. Using `makeObservable` with `"structural"` annotation

```typescript
import { makeObservable } from "@fobx/core"

const user = makeObservable({
  profile: { name: "Alice", age: 25 },
}, {
  profile: ["observable", "structural"],
})

// Changes that are structurally equivalent won't trigger reactions
user.profile = { name: "Alice", age: 25 } // No reaction triggered

// Changes that are structurally different will trigger reactions
user.profile = { name: "Bob", age: 30 } // Reaction triggered
```

#### 2. Using `computed` with structural comparison

```typescript
import { computed, observable, reaction, runInAction } from "@fobx/core"

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
```

## Custom Equality Functions

Besides structural comparison, FobX allows defining custom equality functions
for fine-grained control over when to consider values equal.

### Using Custom Equality Function with `observable`

```typescript
import { observableBox } from "@fobx/core"

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
```

### Using Custom Equality Function with `makeObservable`

```typescript
import { makeObservable } from "@fobx/core"

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
```

## Combining Shallow Observables with Comparison Functions

FobX allows you to combine `observable.shallow` with custom equality functions
for even more control over reactivity.

### Understanding `observable.shallow` Behavior

When using `observable.shallow` annotation, observable collections are created
but their items remain non-observable, and reference equality is used by
default:

```typescript
import { makeObservable, reaction } from "@fobx/core"

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
```

Unlike regular deep observables which can use structural comparison, shallow
observables rely on reference equality by default, so replacing a collection
with a structurally identical one will still trigger reactions.

### Using `observable.shallow` with Custom Equality Function

You can override the default reference equality by providing a custom equality
function:

```typescript
import { makeObservable, reaction } from "@fobx/core"

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
```

This pattern is excellent for configuration objects where you want to ignore
changes to volatile or non-important properties.

### Best Practices for API Data

When working with API data, here are some approaches to consider:

```typescript
import { makeObservable, reaction } from "@fobx/core"

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
```

With this approach:

- Products remain shallow observables so the individual product objects aren't
  made observable
- If you need structural comparison, you can implement it in your methods before
  updating the observable value
- The computed `selectedProduct` property efficiently derives from the
  observable state

## Important Behavior Notes

1. **Computed Value Optimization**: Computed values in FobX are optimized and
   only calculate when they're being tracked by a reaction. If a computed isn't
   being observed, it won't recalculate until it's accessed.

2. **Reaction Comparisons**: When a reaction fires, it compares the new value
   with the initial value from when the reaction was created, not with the most
   recently seen value. This behavior is important to understand when designing
   custom equality functions.

3. **Transactions Matter**: When making multiple changes that should be treated
   as a single update, always wrap them in `runInAction`. Without this, each
   individual change might trigger unnecessary computed recalculations, leading
   to unexpected behavior with comparison functions.

## Practical Use Cases

### Performance Optimization

Structural comparison involves trade-offs that should be carefully considered:

```typescript
// Consider this scenario:
const userData = observable({
  profile: {
    personal: { name: "Alice", age: 30 },
    preferences: { theme: "dark", notifications: true },
    statistics: {/* possibly large nested data */},
  },
})
```

**Benefits:**

- Prevents unnecessary reactions when objects are recreated but structurally
  identical
- Particularly valuable when reactions are expensive (DOM updates, re-renders,
  network calls)
- Works well with immutable data patterns where new objects are created
  frequently

**Costs:**

- The structural comparison itself is more expensive than reference equality
- The larger and more nested the objects being compared, the more costly the
  comparison
- For very frequent updates to large objects, the comparison cost may outweigh
  the benefits

**When to use:**

- When the cost of running the reaction (e.g., a component re-render) is higher
  than the cost of the comparison
- When working with immutable data patterns where objects are frequently
  recreated
- For objects of moderate size that don't change extremely frequently

**When to avoid:**

- When comparing very large, deeply nested objects
- When the observable updates extremely frequently (many times per second)
- When the reaction is simple and inexpensive to run

### Form Data Validation

Custom equality functions are useful for form validation where you might want to
consider values equal if they're within a certain range or match a particular
pattern:

```typescript
const formData = makeObservable({
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
      oldValue.replace(/\D/g, "") === newValue.replace(/\D/g, ""),
  ],

  // Only trigger reactions for search queries with meaningful differences
  // (ignores extra spaces, treats "t-shirt" the same as "tshirt", etc)
  searchQuery: [
    "observable",
    (oldValue, newValue) => {
      const normalize = (str) =>
        str.trim().toLowerCase()
          .replace(/\s+/g, " ") // normalize spaces
          .replace(/[^a-z0-9 ]/g, "") // remove special chars
      return normalize(oldValue) === normalize(newValue)
    },
  ],
})
```

### Complex Data Structures

For complex data structures like nested objects or arrays, structural comparison
ensures that only genuine changes in data structure trigger reactions:

```typescript
import { configure, observable, reaction } from "@fobx/core"
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
```

## Complete Example

```typescript
// Example with both structural and custom equality functions

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
```
