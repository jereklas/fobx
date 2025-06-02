import { FunctionComponent } from "preact"
import { SiteMetadata } from "../build/metadata.ts"
import { useState } from "preact/hooks"

interface AppbarProps {
  metadata: SiteMetadata
}

/**
 * Application header/navigation bar component
 */
const Appbar: FunctionComponent<AppbarProps> = ({ metadata }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header class="bg-white shadow-md">
      <div class="container mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" class="text-xl font-bold">{metadata.siteInfo.title}</a>
        <nav class="hidden md:block">
          <ul class="flex space-x-6">
            {metadata.navigation.mainNav.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noopener" : undefined}
                  class="hover:text-blue-600 transition-colors"
                >
                  {item.label}
                  {item.isExternal ? " ↗" : ""}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button
          class="md:hidden"
          id="mobile-menu-button"
          aria-label="Menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="h-6 w-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            >
            </path>
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <div class={`${mobileMenuOpen ? "block" : "hidden"}`}>
        <nav class="container mx-auto px-4 py-3">
          <ul class="space-y-2">
            {metadata.navigation.mainNav.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  target={item.isExternal ? "_blank" : undefined}
                  rel={item.isExternal ? "noopener" : undefined}
                  class="block py-2 hover:text-blue-600 transition-colors"
                >
                  {item.label}
                  {item.isExternal ? " ↗" : ""}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default Appbar
