import { FunctionComponent } from "preact"
import { useEffect, useState } from "preact/hooks"
import { TableOfContentsItem } from "../../build/metadata.ts"

interface TableOfContentsProps {
  toc: TableOfContentsItem[]
  currentHeading?: string
}

const TableOfContents: FunctionComponent<TableOfContentsProps> = (
  { toc },
) => {
  const [activeHeading, setActiveHeading] = useState<string>("")

  // Function to find the current active heading based on scroll position
  const findCurrentHeading = () => {
    if (!toc || toc.length === 0) return ""

    // Collect all heading IDs from the TOC structure
    const getAllHeadingIds = (items: TableOfContentsItem[]): string[] => {
      const ids: string[] = []
      items.forEach((item) => {
        ids.push(item.id)
        if (item.children && item.children.length > 0) {
          ids.push(...getAllHeadingIds(item.children))
        }
      })
      return ids
    }

    const headingIds = getAllHeadingIds(toc)
    const headingElements = headingIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    if (headingElements.length === 0) return ""

    const scrollPosition = window.scrollY
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    const threshold = 150

    // Calculate scroll progress (0 to 1)
    const maxScroll = documentHeight - windowHeight
    const scrollProgress = maxScroll > 0 ? scrollPosition / maxScroll : 0

    // In the last 20% of the document, ensure all remaining headings get highlighted
    if (scrollProgress > 0.8) {
      // Find all headings that have been "passed" (above threshold)
      const passedHeadings = headingElements.filter((el) =>
        el.offsetTop <= scrollPosition + threshold
      )

      if (passedHeadings.length === 0) {
        return headingElements[0]?.id || ""
      }

      // Calculate how many headings are left to highlight
      const totalHeadings = headingElements.length
      const remainingHeadings = totalHeadings - passedHeadings.length

      if (remainingHeadings > 0) {
        // Distribute the remaining 20% of scroll among the remaining headings
        const bottomSectionProgress = (scrollProgress - 0.8) / 0.2 // 0 to 1 within last 20%

        // Use a more conservative progression that delays the last heading
        const adjustedProgress = Math.pow(bottomSectionProgress, 1.5) // Slower start, faster end

        const headingIndex = Math.min(
          Math.floor(adjustedProgress * (remainingHeadings + 1)),
          remainingHeadings - 1,
        )

        // Return the appropriate heading from the remaining ones
        const targetHeadingIndex = passedHeadings.length + headingIndex
        if (targetHeadingIndex < totalHeadings) {
          return headingElements[targetHeadingIndex]?.id || ""
        }
      }

      // Fallback to last heading
      return headingElements[headingElements.length - 1]?.id || ""
    }

    // Normal scrolling behavior for the first 80% of the document
    let activeHeading = ""
    let closestDistance = Infinity

    headingElements.forEach((el) => {
      const headingTop = el.offsetTop
      const distanceFromThreshold = Math.abs(
        headingTop - (scrollPosition + threshold),
      )

      // If this heading is above the threshold line and closer than previous candidates
      if (
        headingTop <= scrollPosition + threshold &&
        distanceFromThreshold < closestDistance
      ) {
        closestDistance = distanceFromThreshold
        activeHeading = el.id
      }
    })

    // If no heading is above the threshold, use the first heading
    if (!activeHeading && headingElements.length > 0) {
      activeHeading = headingElements[0].id
    }

    return activeHeading
  }

  useEffect(() => {
    if (!toc || toc.length === 0) return

    // Collect all heading IDs from the TOC structure
    const getAllHeadingIds = (items: TableOfContentsItem[]): string[] => {
      const ids: string[] = []
      items.forEach((item) => {
        ids.push(item.id)
        if (item.children && item.children.length > 0) {
          ids.push(...getAllHeadingIds(item.children))
        }
      })
      return ids
    }

    const headingIds = getAllHeadingIds(toc)
    const headingElements = headingIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    if (headingElements.length === 0) return

    // Set initial active heading
    const initialHeading = findCurrentHeading()
    if (initialHeading) {
      setActiveHeading(initialHeading)
    }

    // Create intersection observer for more precise tracking during scroll
    const observer = new IntersectionObserver(
      (entries) => {
        // Only update if we're not near the bottom (let scroll handler manage that)
        const documentHeight = document.documentElement.scrollHeight
        const windowHeight = window.innerHeight
        const scrollPosition = window.scrollY
        const isNearBottom =
          scrollPosition + windowHeight >= documentHeight - 100

        if (!isNearBottom) {
          const visibleEntries = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

          if (visibleEntries.length > 0) {
            const topEntry = visibleEntries[0]
            setActiveHeading(topEntry.target.id)
          }
        }
      },
      {
        rootMargin: "-100px 0px -80% 0px", // Account for header height and focus on top portion
        threshold: 0,
      },
    )

    // Scroll handler for edge cases
    const handleScroll = () => {
      const currentHeading = findCurrentHeading()
      if (currentHeading) {
        setActiveHeading(currentHeading)
      }
    }

    // Observe all heading elements
    headingElements.forEach((element) => observer.observe(element))

    // Add scroll listener for edge cases
    window.addEventListener("scroll", handleScroll, { passive: true })

    // Cleanup
    return () => {
      headingElements.forEach((element) => observer.unobserve(element))
      window.removeEventListener("scroll", handleScroll)
    }
  }, [toc])

  if (!toc || toc.length === 0) {
    return null
  }

  const renderTocItems = (items: TableOfContentsItem[]) => {
    return items.map((item) => (
      <li key={item.id}>
        <a
          href={`#${item.id}`}
          className={`toc-link ${activeHeading === item.id ? "active" : ""}`}
          data-level={item.level - 2}
          onClick={(e) => {
            // Allow default link behavior but ensure scroll logic will take over
            setTimeout(() => {
              // After the scroll from the click settles, let the scroll handler update the active state
              const currentHeading = findCurrentHeading()
              if (currentHeading) {
                setActiveHeading(currentHeading)
              }
            }, 100)
          }}
        >
          {item.title}
        </a>
        {item.children && item.children.length > 0 && (
          <ul className="toc-nav">
            {renderTocItems(item.children)}
          </ul>
        )}
      </li>
    ))
  }

  return (
    <aside className="docs-toc">
      <h3 className="toc-title">On this page</h3>
      <nav>
        <ul className="toc-nav">
          {renderTocItems(toc)}
        </ul>
      </nav>
    </aside>
  )
}

export default TableOfContents
