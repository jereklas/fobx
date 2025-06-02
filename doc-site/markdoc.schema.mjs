export default {
  nodes: {
    heading: {
      render: "Heading",
      attributes: {
        id: { type: "String" },
        level: { type: "Number", required: true },
      },
      transform: (node, config) => {
        // Generate an ID from the heading content if not provided
        const attributes = node.transformAttributes(config)
        const children = node.transformChildren(config)

        if (!attributes.id && children.length > 0) {
          // Extract text content and convert to a slug format
          let text = ""
          const extractTextContent = (items) => {
            for (const item of items) {
              if (typeof item === "string") {
                text += item
              } else if (item && item.children) {
                extractTextContent(item.children)
              }
            }
          }
          extractTextContent(children)
          // Convert to lowercase, replace spaces with hyphens, and remove special chars
          let slug = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-")

          // Add underscore if the slug starts with a number
          if (/^\d/.test(slug)) {
            slug = "_" + slug
          }

          attributes.id = slug
        }

        return {
          name: "Heading",
          attributes,
          children,
        }
      },
    },
    paragraph: {
      render: "Paragraph",
    },
    fence: {
      render: "CodeBlock",
      attributes: {
        language: { type: "String" },
      },
    },
    link: {
      render: "Link",
      attributes: {
        href: { type: "String", required: true },
        title: { type: "String" },
      },
    },
    image: {
      render: "Image",
      attributes: {
        src: { type: "String", required: true },
        alt: { type: "String" },
        title: { type: "String" },
      },
    },
    list: {
      render: "List",
      attributes: {
        ordered: { type: "Boolean" },
      },
    },
    item: {
      render: "ListItem",
    },
    blockquote: {
      render: "Blockquote",
    },
    hr: {
      render: "HorizontalRule",
    },
    table: {
      render: "Table",
    },
    thead: {
      render: "TableHead",
    },
    tbody: {
      render: "TableBody",
    },
    tr: {
      render: "TableRow",
    },
    th: {
      render: "TableHeader",
      attributes: {
        align: { type: "String" },
      },
    },
    td: {
      render: "TableCell",
      attributes: {
        align: { type: "String" },
      },
    },
  },
  tags: {
    callout: {
      render: "Callout",
      attributes: {
        type: {
          type: "String",
          default: "note",
          matches: ["note", "warning", "error", "info"],
        },
        title: { type: "String" },
      },
    },
  },
}
