import { FunctionComponent } from "preact"
import { TableOfContentsItem } from "../build/markdown.ts"
import { useEffect } from "preact/hooks"

interface TableOfContentsProps {
  toc: TableOfContentsItem[]
}
// Track the current active heading
let currentActiveHeading: string | null = null

// Function to update the highlighted TOC item
function updateTOCHighlight() {
  // Get all headings and their positions
  const headingElements = Array.from(
    document.querySelectorAll("h2, h3, h4, h5, h6"),
  ).filter((heading) => heading.hasAttribute("id"))

  if (headingElements.length === 0) return

  // Get viewport height and scroll position
  const viewportHeight = globalThis.window.innerHeight
  const scrollPosition = globalThis.window.scrollY
  const bottomPosition = scrollPosition + viewportHeight

  // Find the heading that's currently in view
  // Priority:
  // 1. Heading just above the middle of viewport
  // 2. Heading just after the top of viewport
  // 3. Last heading if we're at the bottom
  // 4. First heading if we're at the top

  let activeHeadingId: string | null = null

  // Check if we're at the bottom of the page
  const isAtBottom = bottomPosition >= document.body.scrollHeight - 50

  if (isAtBottom) {
    // At the bottom, highlight the last heading with an ID
    const lastHeading = headingElements[headingElements.length - 1]
    activeHeadingId = lastHeading.getAttribute("id")
  } else if (scrollPosition < 100) {
    // At the top, highlight the first heading
    const firstHeading = headingElements[0]
    activeHeadingId = firstHeading.getAttribute("id")
  } else {
    // Find the heading closest to the current scroll position
    const middleOfViewport = scrollPosition + viewportHeight / 3

    // Find heading closest to 1/3 from the top of viewport
    let closestHeading = null
    let closestDistance = Infinity

    for (const heading of headingElements) {
      const headingTop = heading.getBoundingClientRect().top +
        scrollPosition

      // If heading is above the 1/3 point
      if (headingTop <= middleOfViewport) {
        const distance = middleOfViewport - headingTop
        if (distance < closestDistance) {
          closestDistance = distance
          closestHeading = heading
        }
      }
    }

    // If we found a heading, use it
    if (closestHeading) {
      activeHeadingId = closestHeading.getAttribute("id")
    } else {
      // Otherwise use the first heading
      activeHeadingId = headingElements[0].getAttribute("id")
    }
  }

  // Only update if we have an active heading and it's different from the current one
  if (activeHeadingId && activeHeadingId !== currentActiveHeading) {
    currentActiveHeading = activeHeadingId

    // Update TOC highlighting
    const tocItems = document.querySelectorAll(".toc li")
    const tocLinks = document.querySelectorAll(".toc a")

    // Remove active class from all items
    tocItems.forEach((item) => {
      item.classList.remove("active")
    })

    // Find and highlight the active link
    tocLinks.forEach((link) => {
      if (link.getAttribute("href") === "#" + activeHeadingId) {
        // Add active class to the parent li element for background highlight
        const listItem = link.parentElement
        if (listItem) {
          listItem.classList.add("active")
        }
      }
    })
  }
}

/**
 * Component to display the table of contents for a page
 */
const TableOfContents: FunctionComponent<TableOfContentsProps> = ({ toc }) => {
  useEffect(() => {
    // Highlight current section in table of contents
    if (document.querySelector(".toc")) {
      // Initial update
      updateTOCHighlight()

      // Update on scroll using throttling for better performance
      let ticking = false
      globalThis.window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            globalThis.window.requestAnimationFrame(() => {
              updateTOCHighlight()
              ticking = false
            })
            ticking = true
          }
        },
        { passive: true },
      )

      // Update on resize as well
      globalThis.window.addEventListener("resize", updateTOCHighlight, {
        passive: true,
      })

      // Make sure DOMContentLoaded properly updates
      globalThis.window.addEventListener("DOMContentLoaded", updateTOCHighlight)
    }
  }, [])
  /**
   * Recursive function to render TOC items with proper hierarchy
   */
  const renderTocItems = (items: TableOfContentsItem[]) => {
    return (
      <ul class="text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              class="hover:text-blue-600 transition-colors"
              data-level={item.level}
            >
              {item.title}
            </a>

            {item.children && item.children.length > 0 && (
              <ul class="pt-1">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a
                      href={`#${child.id}`}
                      class="hover:text-blue-600 transition-colors"
                      data-level={child.level}
                    >
                      {child.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <nav class="toc-container">
      <div class="toc">{renderTocItems(toc)}</div>
    </nav>
  )
}

export default TableOfContents
