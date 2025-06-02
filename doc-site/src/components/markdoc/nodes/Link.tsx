import { FunctionComponent } from "preact"

interface LinkProps {
  href: string
  title?: string
  children: any
}

/**
 * Renders anchor links, handling both internal and external links
 */
const Link: FunctionComponent<LinkProps> = ({ href, title, children }) => {
  const isExternal = href.startsWith("http") || href.startsWith("https")

  return (
    <a
      href={href}
      title={title}
      {...(isExternal
        ? {
          target: "_blank",
          rel: "noopener noreferrer",
        }
        : {})}
    >
      {children}
    </a>
  )
}

export default Link
