import type { DocsNavItem, DocsPage } from "./types.ts"

interface TemplateOptions {
  siteTitle: string
  siteDescription: string
  githubUrl: string
  basePath: string
  nav: DocsNavItem[]
  pages: DocsPage[]
}

export const renderPageHtml = (
  page: DocsPage,
  options: TemplateOptions,
): string => {
  const title = page.title === options.siteTitle
    ? page.title
    : `${page.title} · ${options.siteTitle}`
  const navHtml = renderNav(options.nav, page.routePath, options.basePath)
  const tocHtml = renderToc(page.toc)
  const pageData = JSON.stringify({
    routePath: page.routePath,
    title: page.title,
    toc: page.toc,
    html: page.html,
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${
    escapeHtml(page.description || options.siteDescription)
  }" />
    <link rel="stylesheet" href="${assetUrl(options.basePath, "style.css")}" />
    <script type="module" src="${
    assetUrl(options.basePath, "app.js")
  }"></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header" role="banner">
      <div class="header-brand">
        <button class="menu-button" id="menu-button" aria-expanded="false" aria-controls="left-nav" aria-label="Toggle navigation">☰</button>
        <a class="site-title" href="${pageHref(options.basePath, "/")}">${
    escapeHtml(options.siteTitle)
  }</a>
        <span class="site-subtitle" aria-hidden="true"></span>
      </div>
      <div class="header-actions">
        <label class="search-wrap" for="site-search">
          <span class="sr-only">Search docs</span>
          <input id="site-search" type="search" autocomplete="off" placeholder="Search documentation" />
        </label>
        ${renderGithubLink(options.githubUrl)}
        <button class="theme-button" id="theme-toggle" aria-label="Toggle color theme"></button>
      </div>
    </header>

    <div class="site-shell">
      <aside class="left-rail" id="left-nav" aria-label="Primary navigation">
        <nav>${navHtml}</nav>
      </aside>

      <main id="main-content" class="content" tabindex="-1" role="main">
        <article>
          <h1>${escapeHtml(page.title)}</h1>
          ${page.html}
        </article>
      </main>

      <aside class="right-rail" aria-label="On this page">
        <div class="toc-wrap">
          <h2>On this page</h2>
          ${tocHtml}
        </div>
      </aside>
    </div>

    <script id="docs-page-data" type="application/json">${
    escapeHtml(pageData)
  }</script>
  </body>
</html>`
}

export const renderSearchIndex = (pages: DocsPage[]): string => {
  const payload = pages.map((page) => ({
    title: page.title,
    navTitle: page.navTitle,
    routePath: page.routePath,
    description: page.description,
    text: page.plainText,
    sectionPath: page.sectionPath,
    toc: page.toc,
  }))
  return JSON.stringify(payload)
}

export const renderRouteIndex = (pages: DocsPage[]): string => {
  const map = Object.fromEntries(
    pages.map((page) => [page.routePath, {
      title: page.title,
      html: page.html,
      toc: page.toc,
      description: page.description,
    }]),
  )

  return JSON.stringify(map)
}

const renderNav = (
  items: DocsNavItem[],
  currentRoute: string,
  basePath: string,
): string => {
  const list = items
    .map((item) => renderNavItem(item, currentRoute, basePath).html)
    .join("")
  return `<ul class="nav-list">${list}</ul>`
}

const renderNavItem = (
  item: DocsNavItem,
  currentRoute: string,
  basePath: string,
): { html: string; hasActive: boolean } => {
  const active = item.href === currentRoute
  let hasActive = active
  const renderedChildren = (item.children ?? []).map((child) =>
    renderNavItem(child, currentRoute, basePath)
  )
  if (renderedChildren.some((child) => child.hasActive)) {
    hasActive = true
  }

  const className = [
    "nav-item",
    item.isPage ? "nav-page" : "nav-group",
    !item.isPage && item.collapsible === false ? "nav-group-static" : "",
    active ? "is-active" : "",
    !item.isPage && hasActive ? "has-active-child" : "",
  ].filter(Boolean).join(" ")
  const groupExpanded = !item.isPage &&
    (item.collapsible === false || hasActive || item.defaultExpanded === true)
  const label = item.href
    ? `<a href="${pageHref(basePath, item.href)}" data-route="${item.href}" ${
      active ? 'aria-current="page"' : ""
    }>${escapeHtml(item.title)}</a>`
    : item.collapsible === false
    ? `<div class="nav-group-heading"><span class="nav-group-title">${
      escapeHtml(item.title)
    }</span></div>`
    : `<button type="button" class="nav-group-toggle" data-nav-toggle aria-expanded="${
      groupExpanded ? "true" : "false"
    }" aria-controls="group-${item.id}"><span class="nav-group-title">${
      escapeHtml(item.title)
    }</span><svg class="nav-group-caret" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>`
  const children = renderedChildren.length
    ? `<div class="nav-group-wrap${
      groupExpanded ? "" : " is-collapsed"
    }" id="group-${item.id}"${
      groupExpanded || item.collapsible === false ? "" : " inert"
    }><ul class="nav-list nav-group-children">${
      renderedChildren.map((child) => child.html).join("")
    }</ul></div>`
    : ""

  return {
    html: `<li class="${className}">${label}${children}</li>`,
    hasActive,
  }
}

const renderToc = (toc: DocsPage["toc"]): string => {
  if (toc.length === 0) {
    return '<p class="toc-empty">No table of contents for this page.</p>'
  }

  const links = toc
    .map((item) =>
      `<li class="toc-depth-${item.depth}"><a href="#${item.id}" data-toc-link="${item.id}">${
        escapeHtml(item.text)
      }</a></li>`
    )
    .join("")

  return `<ul class="toc-list">${links}</ul>`
}

const assetUrl = (basePath: string, fileName: string): string =>
  `${basePath}assets/${fileName}`

const renderGithubLink = (githubUrl: string): string => {
  if (!githubUrl) {
    return ""
  }

  return `<a class="github-link" href="${
    escapeHtml(githubUrl)
  }" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub"><svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12c0 4.64 3.01 8.576 7.188 9.965.525.096.712-.228.712-.506 0-.25-.009-.912-.014-1.79-2.922.635-3.54-1.408-3.54-1.408-.479-1.216-1.169-1.539-.955-1.547.781-.016 1.191.727 1.191.727 1.04 1.782 2.728 1.267 3.392.969.106-.754.407-1.267.741-1.558-2.333-.265-4.786-1.166-4.786-5.19 0-1.146.409-2.083 1.08-2.817-.108-.266-.468-1.335.103-2.784 0 0 .881-.282 2.886 1.076A10.03 10.03 0 0 1 12 6.577c.893.004 1.792.121 2.633.356 2.003-1.358 2.883-1.076 2.883-1.076.573 1.449.213 2.518.105 2.784.673.734 1.079 1.671 1.079 2.817 0 4.034-2.457 4.922-4.796 5.182.418.361.79 1.071.79 2.159 0 1.559-.014 2.817-.014 3.2 0 .281.185.607.719.504A10.503 10.503 0 0 0 22.5 12c0-5.799-4.701-10.5-10.5-10.5Z"/></svg></a>`
}

const pageHref = (basePath: string, routePath: string): string => {
  if (routePath === "/") {
    return basePath
  }
  const cleaned = routePath.replace(/^\/+/, "")
  return `${basePath}${cleaned}`
}

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}
