import { FunctionComponent } from "preact"

interface CodeProps {
  children?: string | string[]
}

/**
 * Renders code blocks with syntax highlighting
 * Handles both direct content and children
 */
const CodeBlock: FunctionComponent<CodeProps> = (
  { children },
) => {
  const codeContent = typeof children === "string"
    ? children
    : (Array.isArray(children) ? children.join("") : "")

  return (
    <code>
      {codeContent}
    </code>
  )
}

export default CodeBlock
