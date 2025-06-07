import type { FunctionComponent } from "preact"
import type * as Markdoc from "@markdoc/markdoc"
import { nodeComponents, tagComponents } from "./index.ts"

interface MarkdocRendererProps {
  ast: Markdoc.RenderableTreeNode
  readingTime?: { minutes: number; words: number }
}

interface MarkdocTag {
  $$mdtype?: "Tag"
  name?: string
  attributes?: Record<string, string | number | boolean | null | undefined>
  children?: Markdoc.RenderableTreeNode[]
}

/**
 * Component that renders a Markdoc AST directly to Preact components
 * This eliminates the need for dangerouslySetInnerHTML
 */
const MarkdocRenderer: FunctionComponent<MarkdocRendererProps> = (
  { ast, readingTime },
) => {
  let hasInsertedReadingTime = false

  // Helper function to extract text content from children
  const extractTextContent = (
    children: Markdoc.RenderableTreeNode[],
  ): string => {
    return children.map((child) => {
      if (typeof child === "string") return child
      if (typeof child === "number") return String(child)
      if (
        typeof child === "object" && child !== null && !Array.isArray(child)
      ) {
        const tagObject = child as MarkdocTag
        if (tagObject.children) {
          return extractTextContent(tagObject.children)
        }
      }
      if (Array.isArray(child)) {
        return extractTextContent(child)
      }
      return ""
    }).join("")
  }

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
        const renderedItems = []

        for (let index = 0; index < node.length; index++) {
          const item = node[index]
          const renderedItem = renderNode(item)
          
          // Check if this item is a ListItem - don't wrap in span if it is
          const isListItem = typeof item === "object" && item !== null && 
            !Array.isArray(item) && (item as MarkdocTag).name === "ListItem"
          
          if (isListItem) {
            renderedItems.push(renderedItem)
          } else {
            renderedItems.push(<span key={index}>{renderedItem}</span>)
          }

          // Check if this item is an H1 heading and we haven't inserted reading time yet
          if (
            !hasInsertedReadingTime && readingTime &&
            typeof item === "object" && item !== null
          ) {
            const tagObject = item as MarkdocTag
            if (
              (tagObject.$$mdtype === "Tag" || tagObject.name) &&
              tagObject.name === "Heading" &&
              tagObject.attributes?.level === 1
            ) {
              hasInsertedReadingTime = true
              renderedItems.push(
                <div key="reading-time" className="reading-time">
                  {readingTime.minutes} min read
                </div>,
              )
            }
          }
        }

        return renderedItems
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
        const Component = tagComponent || nodeComponent

        if (componentName && Component && typeof Component !== "string") {
          // Get attributes and ensure required props are present
          const attributes = { ...(tagObject.attributes || {}) }

          // Special handling for different component types
          if (componentName.toLowerCase() === "callout") {
            // Ensure callout has a type prop
            const calloutProps = {
              ...attributes,
              type:
                (attributes.type as "note" | "warning" | "error" | "info") ||
                "info",
            }

            const children =
              tagObject.children?.map((child, index) => (
                <span key={index}>{renderNode(child)}</span>
              )) || []

            const CalloutComponent = Component as FunctionComponent<
              { type: string; children: preact.ComponentChildren }
            >
            return (
              <CalloutComponent
                {...calloutProps}
                key={tagObject.attributes?.id || Math.random()}
              >
                {children}
              </CalloutComponent>
            )
          }

          // Special handling for code blocks and inline code - pass text content directly
          if (componentName === "CodeBlock" || componentName === "code") {
            const textContent = tagObject.children
              ? extractTextContent(tagObject.children)
              : ""

            const CodeComponent = Component as FunctionComponent<
              { children: preact.ComponentChildren }
            >
            return (
              <CodeComponent
                {...attributes}
                key={tagObject.attributes?.id || Math.random()}
              >
                {textContent}
              </CodeComponent>
            )
          }

          // Special handling for List components - don't wrap ListItem children in spans
          if (componentName === "List") {
            const children =
              tagObject.children?.map((child, _index) => 
                renderNode(child) // Don't wrap in span for list items
              ) || []

            const ListComponent = Component as FunctionComponent<
              { children: preact.ComponentChildren }
            >
            return (
              <ListComponent
                {...attributes}
                key={tagObject.attributes?.id || Math.random()}
              >
                {children}
              </ListComponent>
            )
          }

          // For all other components, render children normally
          const children =
            tagObject.children?.map((child, index) => (
              <span key={index}>{renderNode(child)}</span>
            )) || []

          const GenericComponent = Component as FunctionComponent<
            { children: preact.ComponentChildren }
          >
          const element = (
            <GenericComponent
              {...attributes}
              key={tagObject.attributes?.id || Math.random()}
            >
              {children}
            </GenericComponent>
          )

          // If this is an H1 heading and we haven't inserted reading time yet, add it after
          if (
            !hasInsertedReadingTime && readingTime &&
            componentName === "Heading" &&
            tagObject.attributes?.level === 1
          ) {
            hasInsertedReadingTime = true
            return (
              <>
                {element}
                <div className="reading-time">
                  {readingTime.minutes} min read
                </div>
              </>
            )
          }

          return element
        }

        // Fallback to native HTML element if no component found
        if (componentName) {
          const children =
            tagObject.children?.map((child, index) => (
              <span key={index}>{renderNode(child)}</span>
            )) || []

          return (
            <div
              {...(tagObject.attributes || {})}
              key={tagObject.attributes?.id || Math.random()}
            >
              {children}
            </div>
          )
        }
      }

      // Fallback for unhandled node types with children
      if (tagObject.children) {
        return tagObject.children.map((child, index) => (
          <span key={index}>{renderNode(child)}</span>
        ))
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
