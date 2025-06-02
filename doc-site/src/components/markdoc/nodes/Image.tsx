import { FunctionComponent } from "preact"

interface ImageProps {
  src: string
  alt?: string
  title?: string
}

/**
 * Renders image elements
 */
const Image: FunctionComponent<ImageProps> = ({ src, alt = "", title }) => {
  return <img src={src} alt={alt} title={title} />
}

export default Image
