---
title: React API Overview
description: Quick-reference table of every export from @fobx/react.
navTitle: Overview
navSection: ["@fobx/react", "API"]
navOrder: 0
navSectionOrder: 3
---

| Export                                        | Description                                                         |
| --------------------------------------------- | ------------------------------------------------------------------- |
| [`observer`](/react/api/observer/)            | HOC that makes a function component reactive + applies `React.memo` |
| [`useObserver`](/react/api/use-observer/)     | Hook that makes a render function reactive (lower-level)            |
| [`useViewModel`](/react/api/use-view-model/)  | Hook that manages a ViewModel instance across React renders         |
| [`ViewModel`](/react/api/use-view-model/)     | Base class for ViewModels with observable props and lifecycle       |
| [`ViewModelLike`](/react/api/use-view-model/) | Interface for classes that can be managed by `useViewModel`         |
| `useController`                               | Alias for `useViewModel`                                            |
| `Controller`                                  | Alias for `ViewModel`                                               |
