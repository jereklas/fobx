import { FunctionComponent } from "preact"

interface CalloutProps {
  type: "note" | "warning" | "error" | "info"
  title?: string
  children: any
}

/**
 * Renders custom callout blocks with different styles based on type
 */
const Callout: FunctionComponent<CalloutProps> = ({
  type = "note",
  title,
  children,
}) => {
  const icons = {
    note: "ℹ️",
    warning: "⚠️",
    error: "🛑",
    info: "💡",
  }

  return (
    <div>
      <div>
        <span>{icons[type]}</span>
        {title || type.charAt(0).toUpperCase() + type.slice(1)}
      </div>
      <div>{children}</div>
    </div>
  )
}

export default Callout
