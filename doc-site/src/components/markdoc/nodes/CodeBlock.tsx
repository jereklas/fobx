import { FunctionComponent } from "preact"

interface CodeBlockProps {
  language?: string
  content?: string
  children?: any
}

/**
 * Renders code blocks with syntax highlighting
 * Handles both direct content and children, including span-wrapped content
 */
const CodeBlock: FunctionComponent<CodeBlockProps> = (
  { language = "", content, children },
) => {
  const classes = language ? `language-${language}` : ""

  // Helper function to extract text content from nested elements
  const extractTextFromChildren = (child: any): string => {
    if (typeof child === "string") return child
    if (typeof child === "number") return String(child)
    if (child?.props?.children) {
      // Handle span elements and other components with children
      if (Array.isArray(child.props.children)) {
        return child.props.children.map(extractTextFromChildren).join("")
      }
      return extractTextFromChildren(child.props.children)
    }
    return ""
  }

  // Get the code content from either the content prop or children
  let codeContent = content || ""

  if (!codeContent && children) {
    if (typeof children === "string") {
      codeContent = children
    } else if (Array.isArray(children)) {
      codeContent = children.map(extractTextFromChildren).join("")
    } else {
      // Single child that might be a span or other element
      codeContent = extractTextFromChildren(children)
    }
  }

  return (
    <pre class={classes}>
      <code>
        {codeContent}
      </code>
    </pre>
  )
}

export default CodeBlock
