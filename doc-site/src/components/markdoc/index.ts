// Node components
import Blockquote from "./nodes/Blockquote.tsx"
import Code from "./nodes/Code.tsx"
import CodeBlock from "./nodes/CodeBlock.tsx"
import Heading from "./nodes/Heading.tsx"
import HorizontalRule from "./nodes/HorizontalRule.tsx"
import Image from "./nodes/Image.tsx"
import Link from "./nodes/Link.tsx"
import List from "./nodes/List.tsx"
import ListItem from "./nodes/ListItem.tsx"
import Paragraph from "./nodes/Paragraph.tsx"
import Table from "./nodes/Table.tsx"
import TableBody from "./nodes/TableBody.tsx"
import TableCell from "./nodes/TableCell.tsx"
import TableHead from "./nodes/TableHead.tsx"
import TableHeader from "./nodes/TableHeader.tsx"
import TableRow from "./nodes/TableRow.tsx"

// Tag components
import Callout from "./tags/Callout.tsx"

export const nodeComponents = {
  blockquote: Blockquote,
  code: Code,
  codeblock: CodeBlock,
  heading: Heading,
  hr: HorizontalRule,
  image: Image,
  link: Link,
  list: List,
  listitem: ListItem,
  paragraph: Paragraph,
  table: Table,
  tbody: TableBody,
  td: TableCell,
  thead: TableHead,
  th: TableHeader,
  tr: TableRow,
}

export const tagComponents = {
  callout: Callout,
}
