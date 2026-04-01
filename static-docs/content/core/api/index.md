---
title: API Overview
description: Quick-reference table of every public export from @fobx/core.
navTitle: Overview
navSection: ["@fobx/core", "API"]
navOrder: 0
navSectionOrder: 5
---

This page lists every public export from `@fobx/core` with a short description
and link to its full documentation.

---

## Primitives

| Export                                       | Description                                                |
| -------------------------------------------- | ---------------------------------------------------------- |
| [`observableBox`](/core/api/observable-box/) | Create a reactive boxed value                              |
| [`computed`](/core/api/computed/)            | Derive a cached value from other observables               |
| [`autorun`](/core/api/autorun/)              | Run a side-effect whenever its dependencies change         |
| [`reaction`](/core/api/reaction/)            | Watch a specific expression and react to changes           |
| [`when`](/core/api/when/)                    | Wait for a condition, then run once (or resolve a promise) |

## Objects & Annotations

| Export                                    | Description                                        |
| ----------------------------------------- | -------------------------------------------------- |
| [`observable`](/core/api/observable/)     | Make a plain object or class instance reactive     |
| [`makeObservable`](/core/api/observable/) | Make an object reactive using explicit annotations |

## Collections

| Export                                           | Description                          |
| ------------------------------------------------ | ------------------------------------ |
| [`observableArray`](/core/api/observable-array/) | Reactive array with full `Array` API |
| [`observableMap`](/core/api/observable-map/)     | Reactive `Map` with per-key tracking |
| [`observableSet`](/core/api/observable-set/)     | Reactive `Set`                       |

## Transactions & Tracking

| Export                                                  | Description                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`runInTransaction`](/core/api/transactions/)           | Batch mutations — reactions run only after the outermost transaction ends   |
| [`transaction`](/core/api/transactions/)                | Higher-order function — wraps a function so each call runs in a transaction |
| [`runWithoutTracking`](/core/api/run-without-tracking/) | Read observables without creating dependencies                              |

## Async

| Export                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| [`flow`](/core/api/flow/) | Generator-based async actions with per-step transactions |

## Selectors

| Export                                         | Description                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [`createSelector`](/core/api/create-selector/) | Efficient derived boolean from a collection — O(1) with the default comparer |

## Configuration

| Export                              | Description                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------- |
| [`configure`](/core/api/configure/) | Set global options: `enforceActions`, `onReactionError`, equality comparers |

## Type Predicates

| Export                                                 | Description                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| [`isObservable`](/core/api/type-predicates/)           | Check if a value is a box, computed, or collection observable |
| [`isObservableBox`](/core/api/type-predicates/)        | Check if a value is an `observableBox`                        |
| [`isComputed`](/core/api/type-predicates/)             | Check if a value is a `computed`                              |
| [`isObservableArray`](/core/api/type-predicates/)      | Check if a value is an `observableArray`                      |
| [`isObservableMap`](/core/api/type-predicates/)        | Check if a value is an `observableMap`                        |
| [`isObservableSet`](/core/api/type-predicates/)        | Check if a value is an `observableSet`                        |
| [`isObservableObject`](/core/api/type-predicates/)     | Check if a value is an `observable()` object                  |
| [`isObservableCollection`](/core/api/type-predicates/) | Check if a value is an array, map, or set observable          |
| [`isTransaction`](/core/api/type-predicates/)          | Check if a function was wrapped by `transaction()`            |
| [`isFlow`](/core/api/type-predicates/)                 | Check if a function was wrapped by `flow()`                   |
| [`isPlainObject`](/core/api/type-predicates/)          | Check if a value is a plain `{}` object                       |
