import { FunctionComponent } from "preact"

interface BlockquoteProps {
  children: any
}

/**
 * Renders blockquote elements
 */
const Blockquote: FunctionComponent<BlockquoteProps> = ({ children }) => {
  return <blockquote>{children}</blockquote>
}

export default Blockquote
