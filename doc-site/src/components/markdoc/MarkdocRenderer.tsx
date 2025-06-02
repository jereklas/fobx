import { ComponentType, FunctionComponent } from "preact"
import type * as Markdoc from "@markdoc/markdoc"
import Heading from "./nodes/Heading.tsx"
import Paragraph from "./nodes/Paragraph.tsx"
import CodeBlock from "./nodes/CodeBlock.tsx"
import Link from "./nodes/Link.tsx"
import Image from "./nodes/Image.tsx"
import List from "./nodes/List.tsx"
import ListItem from "./nodes/ListItem.tsx"
import Blockquote from "./nodes/Blockquote.tsx"
import HorizontalRule from "./nodes/HorizontalRule.tsx"
import Table from "./nodes/Table.tsx"
import TableHead from "./nodes/TableHead.tsx"
import TableBody from "./nodes/TableBody.tsx"
import TableRow from "./nodes/TableRow.tsx"
import TableHeader from "./nodes/TableHeader.tsx"
import TableCell from "./nodes/TableCell.tsx"
import Callout from "./tags/Callout.tsx"
import Code from "./nodes/Code.tsx"

// For serialized Tag objects
interface MarkdocTag {
  $$mdtype?: "Tag"
  name?: string
  type?: string
  tag?: string
  attributes?: Record<string, unknown>
  children?: Markdoc.RenderableTreeNode[]
}

// Map of Markdoc nodes to Preact components
const nodeComponents = {
  heading: Heading,
  paragraph: Paragraph,
  codeblock: CodeBlock,
  code: Code,
  link: Link,
  image: Image,
  list: List,
  listitem: ListItem,
  blockquote: Blockquote,
  hr: HorizontalRule,
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
}

// Map of Markdoc tags to Preact components
const tagComponents = {
  callout: Callout,
  // Add other tag mappings as needed
}

// Props for the Markdoc renderer
interface MarkdocRendererProps {
  ast: Markdoc.RenderableTreeNode
}

/**
 * Component that renders a Markdoc AST directly to Preact components
 * This eliminates the need for dangerouslySetInnerHTML
 */
const MarkdocRenderer: FunctionComponent<MarkdocRendererProps> = ({ ast }) => {
  // Function to recursively render a Markdoc node
  const renderNode = (
    node: Markdoc.RenderableTreeNode,
  ): preact.ComponentChildren => {
    // Handle null or undefined nodes
    if (node === null || node === undefined) return null

    // Handle primitive value nodes
    if (
      typeof node === "string" || typeof node === "number" ||
      typeof node === "boolean"
    ) {
      return String(node)
    }

    // Handle Markdoc Tag objects (either native Tag or serialized Tag)
    if (typeof node === "object") {
      // If array, map and render each item
      if (Array.isArray(node)) {
        return node.map((item) => renderNode(item))
      }

      const tagObject = node as MarkdocTag

      // Handle transformed nodes from Markdoc.transform
      if (tagObject.$$mdtype === "Tag" || tagObject.name) {
        const componentName = tagObject.name || ""

        // Find component in our component maps - using lowercase to normalize component names
        const tagComponent = tagComponents[
          componentName.toLowerCase() as keyof typeof tagComponents
        ]
        const nodeComponent = nodeComponents[
          componentName.toLowerCase() as keyof typeof nodeComponents
        ]
        const Component = tagComponent || nodeComponent || componentName

        if (componentName && typeof Component !== "string") {
          console.log("trying to render component", node)
          const children = tagObject.children?.map(renderNode) || []
          return (
            <Component {...node} {...(tagObject.attributes || {})}>
              {children}
            </Component>
          )
        }
      }

      // Fallback for unhandled node types with children
      if (tagObject.children) {
        return tagObject.children.map(renderNode)
      }
      console.error("UNKNOWN NODE", node)

      // For unknown object types, try to just display any properties as text
      return JSON.stringify(node)
    }

    // Return empty for unrecognized node types
    return null
  }

  if (!ast) {
    return <div>No content available</div>
  }

  // Render the Markdoc AST
  return <>{renderNode(ast)}</>
}

export default MarkdocRenderer
