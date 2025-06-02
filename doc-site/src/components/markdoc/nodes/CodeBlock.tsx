import { FunctionComponent } from "preact"

interface CodeBlockProps {
  language?: string
  content?: string
  children?: any
}

/**
 * Renders code blocks with syntax highlighting
 * Handles both direct content and children
 */
const CodeBlock: FunctionComponent<CodeBlockProps> = (
  { language = "", content, children },
) => {
  const classes = language ? `language-${language}` : ""

  // Get the code content from either the content prop or children
  const codeContent = content ||
    (typeof children === "string"
      ? children
      : (Array.isArray(children) ? children.join("") : ""))

  return (
    <pre class={classes}>
      <code>
        {codeContent}
      </code>
    </pre>
  )
}

export default CodeBlock
