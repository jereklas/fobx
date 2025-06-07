/**
 * Generic site TypeScript for FobX documentation
 * Includes search functionality and smooth scrolling for anchor links
 */

import type { SiteMetadata } from "../build/metadata.ts"

interface SearchResult {
  title: string
  path: string
  description?: string
  excerpt?: string
  type: "page" | "heading"
}

class DocumentationSite {
  private metadata: SiteMetadata | null = null
  private isLoading: boolean = false
  private searchQuery: string = ""
  private searchResults: SearchResult[] = []
  private showResults: boolean = false
  private selectedIndex: number = -1
  private dropdownPosition: "left" | "right" = "left"

  private searchRef: HTMLElement | null = null
  private inputRef: HTMLInputElement | null = null

  constructor() {
    this.init()
  }

  private init(): void {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup())
    } else {
      this.setup()
    }
  }

  private setup(): void {
    this.setupSearch()
    this.setupSmoothScrolling()
    this.loadMetadata()
  }

  /**
   * Initialize search functionality
   */
  private setupSearch(): void {
    this.searchRef = document.querySelector(".docs-search")
    this.inputRef = document.querySelector(".docs-search-input")

    if (!this.searchRef || !this.inputRef) return

    // Set up event listeners
    this.inputRef.addEventListener("input", (e) => this.handleSearchChange(e))
    this.inputRef.addEventListener("keydown", (e) => this.handleKeyDown(e))
    this.inputRef.addEventListener("focus", () => this.handleSearchFocus())

    // Close results when clicking outside
    document.addEventListener("mousedown", (e) => this.handleClickOutside(e))

    // Recalculate position on window resize
    window.addEventListener("resize", () => this.handleResize())
  }

  /**
   * Set up smooth scrolling for anchor links
   */
  private setupSmoothScrolling(): void {
    // Find all anchor links that point to headings on the same page
    const anchorLinks = document.querySelectorAll('a[href^="#"]')

    anchorLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = (link as HTMLAnchorElement).getAttribute("href")
        if (href && href.startsWith("#") && href.length > 1) {
          e.preventDefault()
          this.smoothScrollToElement(href.substring(1))
        }
      })
    })

    // Also handle table of contents links
    const tocLinks = document.querySelectorAll('.toc-link[href^="#"]')
    tocLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = (link as HTMLAnchorElement).getAttribute("href")
        if (href && href.startsWith("#") && href.length > 1) {
          e.preventDefault()
          this.smoothScrollToElement(href.substring(1))
        }
      })
    })
  }

  /**
   * Smooth scroll to an element by ID
   */
  private smoothScrollToElement(elementId: string): void {
    const element = document.getElementById(elementId)
    if (element) {
      const headerHeight = 80 // Account for fixed header
      const elementPosition = element.offsetTop - headerHeight

      window.scrollTo({
        top: elementPosition,
        behavior: "smooth",
      })

      // Update URL without triggering page reload
      history.pushState(null, "", `#${elementId}`)

      // Update active TOC item if present
      this.updateActiveTocItem(elementId)
    }
  }

  /**
   * Update active table of contents item
   */
  private updateActiveTocItem(activeId: string): void {
    // Remove active class from all TOC links
    const tocLinks = document.querySelectorAll(".toc-link")
    tocLinks.forEach((link) => link.classList.remove("active"))

    // Add active class to current link
    const activeLink = document.querySelector(`.toc-link[href="#${activeId}"]`)
    if (activeLink) {
      activeLink.classList.add("active")
    }
  }

  /**
   * Load site metadata for search functionality
   */
  private async loadMetadata(): Promise<void> {
    this.isLoading = true
    this.updateSearchPlaceholder()

    try {
      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/metadata.json`)
      if (response.ok) {
        this.metadata = await response.json()
      }
    } catch (error) {
      console.error("Failed to load search metadata:", error)
    } finally {
      this.isLoading = false
      this.updateSearchPlaceholder()
    }
  }

  /**
   * Get the base URL for the site
   */
  private getBaseUrl(): string {
    const metaBaseUrl = document.querySelector(
      'meta[name="base-url"]',
    ) as HTMLMetaElement
    const baseUrl = metaBaseUrl ? metaBaseUrl.getAttribute("content") : "/"
    return baseUrl === "/" ? "" : (baseUrl ?? "")
  }

  /**
   * Update search input placeholder
   */
  private updateSearchPlaceholder(): void {
    if (this.inputRef) {
      this.inputRef.placeholder = "Search docs..."
      this.inputRef.disabled = !this.metadata || this.isLoading
    }
  }

  /**
   * Calculate dropdown position based on available space
   */
  private calculateDropdownPosition(): void {
    if (this.searchRef) {
      const rect = this.searchRef.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const dropdownWidth = 500

      if (rect.left + dropdownWidth > viewportWidth - 20) {
        this.dropdownPosition = "right"
      } else {
        this.dropdownPosition = "left"
      }
    }
  }

  /**
   * Perform search and return results
   */
  private performSearch(query: string): SearchResult[] {
    if (!this.metadata || !query.trim()) return []

    const results: SearchResult[] = []
    const searchTerm = query.toLowerCase()

    this.metadata.routes.forEach((route) => {
      // Skip redirect pages and hidden pages
      if (route.frontmatter.redirect || route.frontmatter.hideInNav) return

      // Search in page title
      if (route.title.toLowerCase().includes(searchTerm)) {
        results.push({
          title: route.title,
          path: route.path,
          description: route.frontmatter.description,
          type: "page",
        })
      }

      // Search in table of contents headings
      if (route.content.toc) {
        route.content.toc.forEach((tocItem) => {
          if (tocItem.title.toLowerCase().includes(searchTerm)) {
            results.push({
              title: tocItem.title,
              path: `${route.path}#${tocItem.id}`,
              description: `From: ${route.title}`,
              type: "heading",
            })
          }

          // Search in nested headings
          if (tocItem.children) {
            tocItem.children.forEach((child) => {
              if (child.title.toLowerCase().includes(searchTerm)) {
                results.push({
                  title: child.title,
                  path: `${route.path}#${child.id}`,
                  description: `From: ${route.title}`,
                  type: "heading",
                })
              }
            })
          }
        })
      }

      // Search in content AST (simplified - just search in text content)
      const searchInContent = (node: any): string => {
        if (typeof node === "string") {
          return node
        }
        if (node && node.children && Array.isArray(node.children)) {
          return node.children.map(searchInContent).join(" ")
        }
        return ""
      }

      if (route.content.ast && route.content.ast.children) {
        const contentText = searchInContent(route.content.ast).toLowerCase()
        if (
          contentText.includes(searchTerm) &&
          !results.some((r) => r.path === route.path && r.type === "page")
        ) {
          // Find excerpt around the search term
          const index = contentText.indexOf(searchTerm)
          const start = Math.max(0, index - 50)
          const end = Math.min(
            contentText.length,
            index + searchTerm.length + 50,
          )
          const excerpt = contentText.slice(start, end)

          results.push({
            title: route.title,
            path: route.path,
            excerpt: `...${excerpt}...`,
            type: "page",
          })
        }
      }
    })

    // Sort results by relevance
    return results
      .sort((a, b) => {
        const aExactTitle = a.title.toLowerCase() === searchTerm
        const bExactTitle = b.title.toLowerCase() === searchTerm

        if (aExactTitle && !bExactTitle) return -1
        if (!aExactTitle && bExactTitle) return 1

        if (a.type === "page" && b.type === "heading") return -1
        if (a.type === "heading" && b.type === "page") return 1

        return a.title.localeCompare(b.title)
      })
      .slice(0, 10) // Limit to 10 results
  }

  /**
   * Highlight search terms in text
   */
  private highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) {
      return text
    }

    // Create regex that captures optional leading/trailing whitespace with the search term
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(
      `(\\s*)(${escapedTerm})(\\s*)`,
      "gi",
    )

    return text.replace(regex, '$1<mark class="search-highlight">$2</mark>$3')
  }

  /**
   * Render search results dropdown
   */
  private renderSearchResults(): void {
    const existingDropdown = document.querySelector(".docs-search-results")
    if (existingDropdown) {
      existingDropdown.remove()
    }

    if (!this.showResults) return

    const dropdown = document.createElement("div")
    dropdown.className = `docs-search-results position-${this.dropdownPosition}`

    if (this.searchResults.length === 0 && this.searchQuery.trim()) {
      dropdown.innerHTML = `
        <div class="docs-search-no-results">
          No results found for "${this.searchQuery}"
        </div>
      `
    } else if (this.searchResults.length > 0) {
      dropdown.innerHTML = this.searchResults
        .map((result, index) => `
          <div class="docs-search-result ${
          index === this.selectedIndex ? "selected" : ""
        }" 
               data-index="${index}"
               data-type="${result.type}">
            <div class="docs-search-result-title">
              ${this.highlightSearchTerm(result.title, this.searchQuery)}
            </div>
            ${
          result.description
            ? `
              <div class="docs-search-result-description">
                ${
              this.highlightSearchTerm(result.description, this.searchQuery)
            }
              </div>
            `
            : ""
        }
            ${
          result.excerpt
            ? `
              <div class="docs-search-result-excerpt">
                ${this.highlightSearchTerm(result.excerpt, this.searchQuery)}
              </div>
            `
            : ""
        }
          </div>
        `)
        .join("")

      // Add click handlers to results
      dropdown.addEventListener("click", (e) => {
        const resultElement = (e.target as HTMLElement).closest(
          ".docs-search-result",
        ) as HTMLElement
        if (resultElement) {
          const index = parseInt(
            resultElement.getAttribute("data-index") || "0",
          )
          this.handleResultClick(this.searchResults[index])
        }
      })

      // Add hover handlers
      dropdown.addEventListener("mouseover", (e) => {
        const resultElement = (e.target as HTMLElement).closest(
          ".docs-search-result",
        ) as HTMLElement
        if (resultElement) {
          this.selectedIndex = parseInt(
            resultElement.getAttribute("data-index") || "0",
          )
          this.updateSelectedResult()
        }
      })
    }

    this.searchRef!.appendChild(dropdown)
  }

  /**
   * Update visual state of selected result
   */
  private updateSelectedResult(): void {
    const results = document.querySelectorAll(".docs-search-result")
    results.forEach((result, index) => {
      result.classList.toggle("selected", index === this.selectedIndex)
    })

    // Scroll the selected item into view
    this.scrollSelectedIntoView()
  }

  /**
   * Scroll the selected search result into view
   */
  private scrollSelectedIntoView(): void {
    if (this.selectedIndex < 0) return

    const dropdown = document.querySelector(
      ".docs-search-results",
    ) as HTMLElement
    const selectedResult = document.querySelector(
      ".docs-search-result.selected",
    ) as HTMLElement

    if (!dropdown || !selectedResult) return

    const dropdownRect = dropdown.getBoundingClientRect()
    const selectedRect = selectedResult.getBoundingClientRect()

    // Check if the selected item is above the visible area
    if (selectedRect.top < dropdownRect.top) {
      dropdown.scrollTop -= dropdownRect.top - selectedRect.top
    } // Check if the selected item is below the visible area
    else if (selectedRect.bottom > dropdownRect.bottom) {
      dropdown.scrollTop += selectedRect.bottom - dropdownRect.bottom
    }
  }

  /**
   * Handle search input changes
   */
  private handleSearchChange(e: Event): void {
    const query = (e.target as HTMLInputElement).value
    this.searchQuery = query

    if (query.trim()) {
      this.searchResults = this.performSearch(query)
      this.showResults = true
      this.selectedIndex = -1
      this.calculateDropdownPosition()
    } else {
      this.searchResults = []
      this.showResults = false
    }

    this.renderSearchResults()
  }

  /**
   * Handle keyboard navigation in search
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.showResults || this.searchResults.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.searchResults.length - 1,
        )
        this.updateSelectedResult()
        break
      case "ArrowUp":
        e.preventDefault()
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1)
        this.updateSelectedResult()
        break
      case "Enter":
        e.preventDefault()
        if (this.selectedIndex >= 0) {
          this.handleResultClick(this.searchResults[this.selectedIndex])
        }
        break
      case "Escape":
        this.hideSearchResults()
        if (this.inputRef) {
          this.inputRef.blur()
        }
        break
    }
  }

  /**
   * Handle search input focus
   */
  private handleSearchFocus(): void {
    if (this.searchQuery.trim() && this.searchResults.length > 0) {
      this.showResults = true
      this.calculateDropdownPosition()
      this.renderSearchResults()
    }
  }

  /**
   * Hide search results
   */
  private hideSearchResults(): void {
    this.showResults = false
    this.selectedIndex = -1
    const dropdown = document.querySelector(".docs-search-results")
    if (dropdown) {
      dropdown.remove()
    }
  }

  /**
   * Handle clicking outside search
   */
  private handleClickOutside(e: MouseEvent): void {
    if (this.searchRef && !this.searchRef.contains(e.target as Node)) {
      this.hideSearchResults()
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    if (this.showResults) {
      this.calculateDropdownPosition()
      this.renderSearchResults()
    }
  }

  /**
   * Handle clicking on a search result
   */
  private handleResultClick(result: SearchResult): void {
    this.hideSearchResults()
    this.searchQuery = ""
    if (this.inputRef) {
      this.inputRef.value = ""
    }

    // Navigate to the result
    const baseUrl = this.getBaseUrl()
    const url = `${baseUrl}${result.path}`
    window.location.href = url
  }
}

// Initialize the documentation site when the script loads
new DocumentationSite()
