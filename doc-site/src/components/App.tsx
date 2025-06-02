import { FunctionComponent } from "preact"
import { RouteMetadata, SiteMetadata } from "../build/metadata.ts"
import Appbar from "./Appbar.tsx"
import SideNav from "./SideNav.tsx"
import PageContent from "./PageContent.tsx"
import TableOfContents from "./TableOfContents.tsx"
import Footer from "./Footer.tsx"
import { ParsedDocument } from "../build/markdown.ts"
import { useEffect } from "preact/hooks"

interface AppProps {
  metadata: SiteMetadata
  route: RouteMetadata
  doc: ParsedDocument
}

/**
 * Main App component that renders the entire page layout
 */
const App: FunctionComponent<AppProps> = ({ metadata, route, doc }) => {
  useEffect(() => {
    const menuButton = document.getElementById("mobile-menu-button")
    const mobileMenu = document.getElementById("mobile-menu")

    if (menuButton && mobileMenu) {
      menuButton.addEventListener("click", () => {
        mobileMenu.classList.toggle("hidden")
      })
    }

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener(
        "click",
        function (this: HTMLAnchorElement, e: Event) {
          e.preventDefault()

          const href = this.getAttribute("href")
          if (!href) return
          const target = document.querySelector<HTMLElement>(href)
          if (target) {
            globalThis.window.scrollTo({
              top: target.offsetTop - 80, // Accounting for header height
              behavior: "smooth",
            })

            // Update URL hash without scrolling
            history.pushState(null, "", this.getAttribute("href"))
          }
        },
      )
    })

   
  }, [])
  return (
    <>
      <Appbar metadata={metadata} />

      <div class="container mx-auto px-4 flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside class="w-full md:w-64 p-4">
          <SideNav metadata={metadata} currentSlug={route.slug} />
        </aside>

        {/* Main content */}
        <main class="flex-1 p-4">
          <PageContent doc={doc} route={route} metadata={metadata} />
        </main>

        {/* Table of Contents */}
        {!route.disableTableOfContents && doc.toc.length > 0 && (
          <aside class="hidden lg:block w-64 p-4">
            <div class="sticky top-24">
              <h3 class="text-lg font-semibold mb-3">On this page</h3>
              <nav class="toc">
                <TableOfContents toc={doc.toc} />
              </nav>
            </div>
          </aside>
        )}
      </div>

      <Footer metadata={metadata} />
    </>
  )
}

export default App
