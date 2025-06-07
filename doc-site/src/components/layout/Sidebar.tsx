import { FunctionComponent } from "preact"
import { NavigationMetadata, SiteInfo } from "../../build/metadata.ts"

interface SidebarProps {
  siteInfo: SiteInfo
  navigation: NavigationMetadata
  currentPath: string
}

// TODO: this or something needs to be converted into a button that's accessible on mobile

const Sidebar: FunctionComponent<SidebarProps> = (
  { navigation, currentPath, siteInfo },
) => {
  return (
    <aside className="docs-sidebar">
      {navigation.sidebar.map((section) => (
        <div key={section.title} className="sidebar-section">
          <h3 className="sidebar-title">{section.title}</h3>
          <nav>
            <ul className="sidebar-nav">
              {section.items.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.isExternal
                      ? item.path
                      : siteInfo.baseUrl === "/"
                      ? item.path
                      : `${siteInfo.baseUrl}${item.path}`}
                    className={`sidebar-link ${
                      currentPath === item.path ? "active" : ""
                    }`}
                    target={item.isExternal ? "_blank" : undefined}
                    rel={item.isExternal ? "noopener noreferrer" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ))}
    </aside>
  )
}

export default Sidebar
