---
title: Navigation Overrides
navTitle: Nav Control
navSection: Guides/Advanced
navOrder: 2
---

## Frontmatter fields

Use these fields to customize nav placement and ordering:

- `navTitle`: sidebar label
- `navOrder`: ordering weight in the current group
- `navSection`: override sidebar nesting path
- `navSectionTitle`: rename the page's current section/folder label
- `navSectionOrder`: set ordering for the page's current section/folder
- `navSectionTitles`: rename section labels by path depth
- `navSectionOrders`: order section labels by path depth
- `title`: document title

## Example

```yaml
---
title: Document Title
navTitle: Friendly Sidebar Name
navOrder: 5
navSection: Guides/Deep Dive
---
```
