const routeCache = new Map()
let routeIndex = null
let searchIndex = null

const boot = async () => {
  applyTheme(resolveInitialTheme())
  bindThemeToggle()
  bindMenuToggle()
  bindNavGroups()
  expandActiveNavGroups()
  bindScrollSpy()
  bindHeadingAnchors()
  bindTocScroll()
  bindH1Observer()
  bindSpaNavigation()
  await setupSearch()
}

const getBasePath = () => {
  const script = document.querySelector('script[src*="/assets/app.js"]')
  if (!(script instanceof HTMLScriptElement)) {
    return "/"
  }

  const src = script.getAttribute("src") || "/assets/app.js"
  const marker = "/assets/app.js"
  const index = src.indexOf(marker)
  if (index === -1) {
    return "/"
  }

  const value = src.slice(0, index + 1)
  return value.startsWith("/") ? value : `/${value}`
}

const basePath = getBasePath()

const resolveInitialTheme = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme)
}

const bindThemeToggle = () => {
  const button = document.getElementById("theme-toggle")
  if (!(button instanceof HTMLButtonElement)) {
    return
  }

  let current = document.documentElement.getAttribute("data-theme") ||
    resolveInitialTheme()

  const sunIcon =
    `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
  const moonIcon =
    `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`

  const setIcon = (theme) => {
    button.innerHTML = theme === "dark" ? sunIcon : moonIcon
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    )
  }

  setIcon(current)

  button.addEventListener("click", () => {
    const next = current === "dark" ? "light" : "dark"
    current = next
    applyTheme(next)
    setIcon(next)
  })
}

const bindMenuToggle = () => {
  const button = document.getElementById("menu-button")
  const nav = document.getElementById("left-nav")
  if (!(button instanceof HTMLButtonElement) || !(nav instanceof HTMLElement)) {
    return
  }

  button.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open")
    button.setAttribute("aria-expanded", `${open}`)
  })

  const syncForViewport = () => {
    if (window.innerWidth > 860) {
      nav.classList.remove("is-open")
      button.setAttribute("aria-expanded", "false")
    }
  }

  syncForViewport()
  window.addEventListener("resize", syncForViewport)

  document.addEventListener("click", (event) => {
    if (window.innerWidth > 860) {
      return
    }
    const target = event.target
    if (!(target instanceof Node)) {
      return
    }
    if (button.contains(target) || nav.contains(target)) {
      return
    }
    nav.classList.remove("is-open")
    button.setAttribute("aria-expanded", "false")
  })
}

const bindNavGroups = () => {
  document.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const toggle = target.closest("[data-nav-toggle]")
    if (!(toggle instanceof HTMLButtonElement)) {
      return
    }

    const controls = toggle.getAttribute("aria-controls")
    if (!controls) {
      return
    }

    const section = document.getElementById(controls)
    if (!(section instanceof HTMLElement)) {
      return
    }

    const isCollapsed = section.classList.toggle("is-collapsed")
    toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true")
    section.inert = isCollapsed
  })
}

let scrollSpyLocked = false
let scrollSpyLockTimer = null

const lockScrollSpy = (ms = 1000) => {
  scrollSpyLocked = true
  clearTimeout(scrollSpyLockTimer)
  scrollSpyLockTimer = setTimeout(() => {
    scrollSpyLocked = false
  }, ms)
}

const bindScrollSpy = () => {
  const links = [...document.querySelectorAll("[data-toc-link]")]
  if (links.length === 0) {
    return
  }

  const observed = [
    ...document.querySelectorAll(
      "main article h2[id], main article h3[id], main article h4[id]",
    ),
  ]
  if (observed.length === 0) {
    return
  }

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) =>
        left.boundingClientRect.top - right.boundingClientRect.top
      )

    if (visible.length === 0) {
      return
    }

    if (scrollSpyLocked) {
      return
    }

    const id = visible[0].target.id
    for (const link of links) {
      if (!(link instanceof HTMLAnchorElement)) {
        continue
      }
      link.classList.toggle("is-active", link.dataset.tocLink === id)
    }
  }, { rootMargin: "-80px 0px -60% 0px", threshold: [0, 1] })

  observed.forEach((element) => observer.observe(element))
}

const bindSpaNavigation = () => {
  document.addEventListener("click", async (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const anchor = target.closest("a")
    if (!(anchor instanceof HTMLAnchorElement)) {
      return
    }
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
      return
    }

    const href = anchor.getAttribute("href")
    if (!href || href.startsWith("#") || !isInternalPath(href)) {
      return
    }

    event.preventDefault()
    await navigateTo(href)
  })

  window.addEventListener("popstate", async () => {
    await navigateTo(window.location.pathname, {
      push: false,
      preserveScroll: true,
    })
  })
}

const isInternalPath = (href) => {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return false
  }
  return href.startsWith(basePath) || href.startsWith("/")
}

const normalizeRoute = (path) => {
  const url = new URL(path, window.location.origin)
  let value = decodeURIComponent(url.pathname)

  if (basePath !== "/" && value.startsWith(basePath)) {
    value = `/${value.slice(basePath.length)}`
  }

  if (!value.endsWith("/")) {
    value = `${value}/`
  }

  return value === "//" ? "/" : value
}

const navigateTo = async (
  path,
  options = { push: true, preserveScroll: false },
) => {
  const route = normalizeRoute(path)
  const data = await getRoutePage(route)
  if (!data) {
    window.location.assign(path)
    return
  }

  const main = document.querySelector("main article")
  if (!(main instanceof HTMLElement)) {
    window.location.assign(path)
    return
  }

  main.innerHTML = `<h1>${escapeHtml(data.title)}</h1>${data.html}`
  document.title =
    `${data.title} · ${(document.querySelector(".site-title")?.textContent ||
      "Documentation")}`
  updateToc(data.toc)
  updateActiveNav(route)
  expandActiveNavGroups()
  bindScrollSpy()

  if (!options.preserveScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (options.push) {
    history.pushState({ route }, "", toPath(route))
  }

  bindHeadingAnchors()
  bindH1Observer()
}

const toPath = (route) =>
  route === "/" ? basePath : `${basePath}${route.replace(/^\//, "")}`

const getRoutePage = async (route) => {
  if (routeCache.has(route)) {
    return routeCache.get(route)
  }

  if (!routeIndex) {
    const response = await fetch(`${basePath}assets/route-index.json`)
    if (!response.ok) {
      return null
    }
    routeIndex = await response.json()
  }

  const data = routeIndex[route]
  if (!data) {
    return null
  }

  routeCache.set(route, data)
  return data
}

const updateActiveNav = (route) => {
  document.querySelectorAll("#left-nav .has-active-child").forEach((el) => {
    el.classList.remove("has-active-child")
  })

  const links = [...document.querySelectorAll("#left-nav a[data-route]")]
  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) {
      continue
    }
    const active = link.dataset.route === route
    link.parentElement?.classList.toggle("is-active", active)
    if (active) {
      link.setAttribute("aria-current", "page")
      let cursor = link.parentElement?.closest(".nav-group")
      while (cursor instanceof HTMLElement) {
        cursor.classList.add("has-active-child")
        cursor = cursor.parentElement?.closest(".nav-group")
      }
    } else {
      link.removeAttribute("aria-current")
    }
  }
}

const expandActiveNavGroups = () => {
  const activeLink = document.querySelector("#left-nav a[aria-current='page']")
  if (!(activeLink instanceof HTMLAnchorElement)) {
    return
  }

  let cursor = activeLink.parentElement
  while (cursor) {
    const group = cursor.closest(".nav-group")
    if (!(group instanceof HTMLElement)) {
      break
    }
    const button = group.querySelector(":scope > [data-nav-toggle]")
    const section = group.querySelector(":scope > .nav-group-wrap")
    if (button instanceof HTMLButtonElement && section instanceof HTMLElement) {
      section.classList.remove("is-collapsed")
      section.inert = false
      button.setAttribute("aria-expanded", "true")
    }
    cursor = group.parentElement?.closest(".nav-group") ?? null
  }
}

const updateToc = (items) => {
  const wrap = document.querySelector(".toc-wrap")
  if (!(wrap instanceof HTMLElement)) {
    return
  }

  if (!Array.isArray(items) || items.length === 0) {
    wrap.innerHTML =
      `<h2>On this page</h2><p class="toc-empty">No table of contents for this page.</p>`
    return
  }

  const list = items
    .map((item) =>
      `<li class="toc-depth-${item.depth}"><a href="#${item.id}" data-toc-link="${item.id}">${
        escapeHtml(item.text)
      }</a></li>`
    )
    .join("")

  wrap.innerHTML = `<h2>On this page</h2><ul class="toc-list">${list}</ul>`
}

const setupSearch = async () => {
  const search = document.getElementById("site-search")
  if (!(search instanceof HTMLInputElement)) {
    return
  }

  const container = search.parentElement
  if (!(container instanceof HTMLElement)) {
    return
  }

  const resultBox = document.createElement("div")
  resultBox.className = "search-results"
  resultBox.hidden = true
  container.style.position = "relative"
  container.append(resultBox)

  search.addEventListener("input", async () => {
    const query = search.value.trim().toLowerCase()
    if (query.length < 2) {
      resultBox.hidden = true
      resultBox.innerHTML = ""
      return
    }

    if (!searchIndex) {
      const response = await fetch(`${basePath}assets/search-index.json`)
      if (!response.ok) {
        return
      }
      searchIndex = await response.json()
    }

    const results = searchIndex
      .map((entry) => ({
        ...entry,
        score: scoreSearch(query, entry),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    if (results.length === 0) {
      resultBox.hidden = false
      resultBox.innerHTML =
        `<button type="button" disabled>No results found</button>`
      return
    }

    resultBox.hidden = false
    resultBox.innerHTML = results.flatMap((entry) => {
      const pathLabel =
        Array.isArray(entry.sectionPath) && entry.sectionPath.length > 0
          ? entry.sectionPath.join(" / ")
          : ""
      const matchingToc = Array.isArray(entry.toc)
        ? entry.toc.filter((item) => item.text.toLowerCase().includes(query))
        : []
      if (matchingToc.length > 0) {
        return matchingToc.map((item) =>
          `<button type="button" data-result-route="${entry.routePath}" data-result-anchor="${item.id}">` +
          `<span class="search-result-title">${
            highlightTerm(entry.title, query)
          }</span>` +
          `<span class="search-result-section">\u00a7 ${
            highlightTerm(item.text, query)
          }</span>` +
          (pathLabel
            ? `<span class="search-result-path">${escapeHtml(pathLabel)}</span>`
            : "") +
          `</button>`
        )
      }
      return [
        `<button type="button" data-result-route="${entry.routePath}">` +
        `<span class="search-result-title">${
          highlightTerm(entry.title, query)
        }</span>` +
        (pathLabel
          ? `<span class="search-result-path">${escapeHtml(pathLabel)}</span>`
          : "") +
        `</button>`,
      ]
    }).join("")
  })

  resultBox.addEventListener("click", async (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }
    const button = target.closest("button[data-result-route]")
    if (!(button instanceof HTMLButtonElement)) {
      return
    }
    const route = button.dataset.resultRoute
    if (!route) {
      return
    }
    search.value = ""
    resultBox.hidden = true
    resultBox.innerHTML = ""
    const anchor = button.dataset.resultAnchor
    await navigateTo(toPath(route))
    if (anchor) {
      const el = document.getElementById(anchor)
      if (el) el.scrollIntoView({ behavior: "smooth" })
    }
  })

  document.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Node)) {
      return
    }
    if (!container.contains(target)) {
      resultBox.hidden = true
    }
  })
}

const scoreSearch = (query, entry) => {
  const title = `${entry.title || ""} ${entry.navTitle || ""}`.toLowerCase()
  const description = `${entry.description || ""}`.toLowerCase()
  const text = `${entry.text || ""}`.toLowerCase()
  const tocText = Array.isArray(entry.toc)
    ? entry.toc.map((t) => t.text).join(" ").toLowerCase()
    : ""

  let score = 0
  if (title.includes(query)) score += 12
  if (description.includes(query)) score += 6
  if (tocText.includes(query)) score += 8
  if (text.includes(query)) score += 3
  return score
}

const escapeHtml = (value) =>
  `${value}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const highlightTerm = (text, query) => {
  const escaped = escapeHtml(text)
  if (!query) return escaped
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return escaped.replace(
    new RegExp(`(${escapedQuery})`, "gi"),
    `<mark class="search-match">$1</mark>`,
  )
}

const bindHeadingAnchors = () => {
  const linkIcon =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`

  document.querySelectorAll(
    "main article h2[id], main article h3[id], main article h4[id]",
  ).forEach((heading) => {
    if (!(heading instanceof HTMLElement)) return
    if (heading.querySelector(".heading-anchor")) return
    const id = heading.id
    const link = document.createElement("a")
    link.className = "heading-anchor"
    link.href = `#${id}`
    link.setAttribute("aria-label", `Link to "${heading.textContent?.trim()}"`)
    link.innerHTML = linkIcon
    link.addEventListener("click", (e) => {
      e.preventDefault()
      history.pushState(null, "", `#${id}`)
    })
    heading.append(link)
  })
}

const bindTocScroll = () => {
  document.addEventListener("click", (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const link = target.closest(".toc-list a")
    if (!(link instanceof HTMLAnchorElement)) return
    const href = link.getAttribute("href")
    if (!href || !href.startsWith("#")) return
    const id = href.slice(1)
    const el = document.getElementById(id)
    if (!el) return
    event.preventDefault()
    // immediately mark this link active and suppress scroll spy
    document.querySelectorAll("[data-toc-link]").forEach((a) => {
      a.classList.toggle(
        "is-active",
        a instanceof HTMLAnchorElement && a.dataset.tocLink === id,
      )
    })
    lockScrollSpy(1000)
    el.scrollIntoView({ behavior: "smooth" })
    history.pushState(null, "", href)
  })
}

let h1Observer = null

const bindH1Observer = () => {
  if (h1Observer) {
    h1Observer.disconnect()
    h1Observer = null
  }

  const subtitle = document.querySelector(".site-subtitle")
  if (!(subtitle instanceof HTMLElement)) return

  const h1 = document.querySelector("main article h1")
  if (!(h1 instanceof HTMLElement)) return

  const pageTitle = h1.textContent?.trim() ?? ""
  subtitle.textContent = `— ${pageTitle}`

  h1Observer = new IntersectionObserver(
    ([entry]) => {
      subtitle.classList.toggle("is-visible", !entry.isIntersecting)
    },
    {
      rootMargin: `-${
        Math.round(
          parseFloat(getComputedStyle(document.documentElement).fontSize) * 3.6,
        )
      }px 0px 0px 0px`,
      threshold: 0,
    },
  )

  h1Observer.observe(h1)
}

await boot()
