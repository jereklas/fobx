import { FunctionComponent } from "preact"

interface ParagraphProps {
  children: any
}

/**
 * Renders paragraph elements
 */
const Paragraph: FunctionComponent<ParagraphProps> = ({ children }) => {
  return <p>{children}</p>
}

export default Paragraph
