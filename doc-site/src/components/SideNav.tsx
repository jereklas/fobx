import { FunctionComponent } from "preact"
import { SiteMetadata } from "../build/metadata.ts"

interface SideNavProps {
  metadata: SiteMetadata
  currentSlug: string
}

/**
 * Sidebar navigation component that displays sections and links
 */
const SideNav: FunctionComponent<SideNavProps> = (
  { metadata, currentSlug },
) => {
  return (
    <nav className="sidebar">
      {metadata.navigation.sidebar.map((section) => (
        <div key={section.title} className="mb-6">
          <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  className={`block py-1 px-2 rounded ${
                    item.path === `/${currentSlug}`
                      ? "bg-blue-100 text-blue-800"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export default SideNav
