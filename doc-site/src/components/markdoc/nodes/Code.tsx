import { FunctionComponent } from "preact"

interface CodeProps {
  children?: string | string[]
}

/**
 * Renders inline code with proper styling
 * Handles both direct content and children, including span-wrapped content
 */
const Code: FunctionComponent<CodeProps> = ({ children }) => {
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

  // Get the code content from children
  let codeContent = ""

  if (children) {
    if (typeof children === "string") {
      codeContent = children
    } else if (Array.isArray(children)) {
      codeContent = children.map(extractTextFromChildren).join("")
    } else {
      // Single child that might be a span or other element
      codeContent = extractTextFromChildren(children)
    }
  }

  return <code>{codeContent}</code>
}

export default Code
