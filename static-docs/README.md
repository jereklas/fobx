# static-docs

A Deno static documentation generator that transforms `.md` and `.mdx` files
into accessible, responsive, GitHub Pages-ready documentation pages with
SPA-like navigation.

## Features

- Static output (`index.html` per route) for easy hosting
- Left navigation + right table of contents
- Header with title, client-side search, GitHub link, and theme toggle
- Frontmatter navigation overrides
- Responsive and keyboard-accessible layout
- Unique default color theme with high contrast

## Frontmatter

Supported fields in each markdown file:

- `title`: page title
- `description`: page meta description
- `navTitle`: custom sidebar label
- `navOrder`: numeric order within its section
- `navSection`: custom sidebar section path (`"Guides/Advanced"` or array)
- `navSectionTitle`: rename the page's current section/folder in the sidebar
- `navSectionOrder`: order value for the page's current section/folder
- `navSectionTitles`: array of section titles by depth for full path overrides
- `navSectionOrders`: array of section order values by depth for full path
  overrides
- `toc`: set to `false` to hide generated TOC
- `draft`: set to `true` to exclude from output

## Usage

```sh
cd static-docs
deno task build
deno task preview -- --port 4173
```

Generated output is in `dist/`.

## GitHub Pages

Set `basePath` in `static-docs.config.ts` if hosting under a repository subpath:

```ts
basePath: "/your-repo-name/"
```

`static-docs.config.ts` now reads from `DOCS_BASE_PATH`, so you can switch
without editing code:

```sh
# User/org pages (root)
DOCS_BASE_PATH=/ deno task build

# Project pages (repo subpath)
DOCS_BASE_PATH=/your-repo-name/ deno task build
```

Set `githubUrl` in `static-docs.config.ts` to show a repository button in the
header:

```ts
githubUrl: "https://github.com/jereklas/fobx"
```
