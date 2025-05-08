// deno-lint-ignore-file no-explicit-any

import {
  $fobx,
  isComputed,
  isObservable,
  isObservableArray,
  isObservableMap,
  isObservableObject,
  isObservableSet,
} from "../core.ts"

/**
 * Represents an element to be rendered in developer tools
 * Can be a string, number, boolean, null, undefined, or a nested element
 */
export type DevToolsValue = string | number | boolean | null | undefined

/**
 * Represents a DOM-like structure used by Chrome DevTools custom formatters
 * Format: [tagName, attributes, ...children]
 * Where children can be DevToolsValue or nested DevToolsElement
 */
export type DevToolsElement = [
  string,
  Record<string, string>,
  ...(DevToolsValue | DevToolsElement)[],
] | [string, { object: any; config?: Partial<FormatterConfig> }]

/**
 * Function that generates the header for an object in the developer tools
 * @param obj The object to format
 * @param config Optional configuration options
 * @returns A DevToolsElement representing the header or null if this formatter doesn't apply
 */
export type HeaderFormatter = (
  obj: any,
  config?: Partial<FormatterConfig>,
) => DevToolsElement | null

/**
 * Function that determines whether an object should have an expandable body
 * @param obj The object to check
 * @param config Optional configuration options
 * @returns Boolean indicating if the object should have an expandable body
 */
export type HasBodyFormatter = (
  obj: any,
  config?: Partial<FormatterConfig>,
) => boolean

/**
 * Function that generates the expandable body content for an object
 * @param obj The object to format
 * @param config Optional configuration options
 * @returns A DevToolsElement representing the body or null if no body should be shown
 */
export type BodyFormatter = (
  obj: any,
  config?: Partial<FormatterConfig>,
) => DevToolsElement | null

/**
 * Complete custom formatter for Chrome DevTools
 */
export interface DevToolsFormatter {
  /** Generates the header for an object */
  header: HeaderFormatter
  /** Determines if an object should have an expandable body */
  hasBody: HasBodyFormatter
  /** Generates the body content for an object */
  body: BodyFormatter
}

/**
 * Configuration options that can be passed to formatter functions
 */
export interface FormatterConfig {
  depth?: number
  label?: string
  obj?: any
}

/**
 * Collection types supported by the formatter
 */
type CollectionType = "array" | "set" | "map" | "object"

declare global {
  interface Window {
    devtoolsFormatters?: DevToolsFormatter[]
  }
}

/**
 * Gets theme colors based on system preference
 */
function getThemeColors() {
  const isDarkMode = globalThis.matchMedia &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches

  return {
    string: isDarkMode ? "#5CCAD8" : "#C41A16", // tealish blue in dark, red in light
    number: isDarkMode ? "#9586DB" : "#1010E0", // bluish purple in dark, blue purple in light
    boolean: isDarkMode ? "#9586DB" : "#1010E0", // bluish purple in dark, blue purple in light
    null: isDarkMode ? "#9586DB" : "#1010E0", // bluish purple in dark, blue purple in light
    property: isDarkMode ? "#85B4FF" : "#3A55A8", // blueish periwinkle in dark, more blue in light
    computed: isDarkMode ? "#C586C0" : "#164, 131, 240", // pink in dark, purple in light
    label: isDarkMode ? "#CCCCCC" : "#6E6E6E", // light gray in dark, darker gray in light
    internal: isDarkMode ? "#919191" : "#CCCCCC", // light gray in dark, darker gray in light
  }
}

/**
 * Estimates text width for calculating offsets
 */
function estimateTextWidth(str: string) {
  const charWidth = 7
  return str?.length ? str.length * charWidth : 0
}

// deno-lint-ignore no-process-global
if (process.env.NODE_ENV !== "production") {
  // Check if window exists on globalThis before accessing its properties
  if (globalThis.window && typeof globalThis.window === "object") {
    if (globalThis.window.devtoolsFormatters === undefined) {
      globalThis.window.devtoolsFormatters = []
    }

    let theme = getThemeColors()

    const darkModeMediaQuery = globalThis.matchMedia?.(
      "(prefers-color-scheme: dark)",
    )
    darkModeMediaQuery?.addEventListener?.("change", () => {
      theme = getThemeColors()
    })

    /**
     * Helper to generate styled span elements
     */
    const createSpan = (text: string, color?: string): DevToolsElement => {
      return ["span", color ? { style: `color: ${color};` } : {}, text]
    }

    /**
     * Format a value with appropriate coloring and styling
     */
    const formatValue = (value: any): { preview: string; color: string } => {
      if (value === null) {
        return { preview: "null", color: theme.null }
      }
      if (value === undefined) {
        return { preview: "undefined", color: theme.null }
      }

      if (typeof value === "string") {
        const preview = value.length > 10 ? value.substring(0, 9) + "…" : value
        return { preview: `'${preview}'`, color: theme.string }
      }
      if (typeof value === "number") {
        return { preview: String(value), color: theme.number }
      }
      if (typeof value === "boolean") {
        return { preview: String(value), color: theme.boolean }
      }
      if (typeof value === "object") {
        if (isObservableArray(value)) {
          return {
            preview: `ObservableArray(${value.length})`,
            color: theme.label,
          }
        }
        if (isObservableSet(value)) {
          return { preview: `ObservableSet(${value.size})`, color: theme.label }
        }
        if (isObservableMap(value)) {
          return { preview: `ObservableMap(${value.size})`, color: theme.label }
        }
        return { preview: "{...}", color: theme.label }
      }

      return { preview: String(value), color: theme.label }
    }

    /**
     * Determine the collection type of an object
     */
    const getCollectionType = (obj: any): CollectionType => {
      if (Array.isArray(obj)) return "array"
      if (isObservableSet(obj)) return "set"
      if (isObservableMap(obj)) return "map"
      return "object"
    }

    /**
     * Get collection information based on its type
     */
    const getCollectionInfo = (obj: any, type: CollectionType) => {
      switch (type) {
        case "array":
          return {
            size: obj.length,
            prefix: `ObservableArray(${obj.length}) [`,
            suffix: "]",
            sizeProp: "length",
            entries: Array.from(obj.entries()).slice(0, 5),
            entryRenderer: (
              entry: [number, any],
              elements: DevToolsElement[],
            ) => {
              const [_index, value] = entry
              const { preview, color } = formatValue(value)
              elements.push(createSpan(preview, color))
            },
          }
        case "set":
          return {
            size: obj.size,
            prefix: `ObservableSet(${obj.size}) {`,
            suffix: "}",
            sizeProp: "size",
            entries: Array.from(obj.values()).slice(0, 5).map((
              v: any,
            ) => [null, v]),
            entryRenderer: (
              entry: [null, any],
              elements: DevToolsElement[],
            ) => {
              const [_, value] = entry
              const { preview, color } = formatValue(value)
              elements.push(createSpan(preview, color))
            },
          }
        case "map":
          return {
            size: obj.size,
            prefix: `ObservableMap(${obj.size}) {`,
            suffix: "}",
            sizeProp: "size",
            entries: Array.from(obj.entries()).slice(0, 5),
            entryRenderer: (entry: [any, any], elements: DevToolsElement[]) => {
              const [key, value] = entry
              const keyFormat = formatValue(key)
              elements.push(createSpan(keyFormat.preview, keyFormat.color))
              elements.push(createSpan(" => "))
              const valueFormat = formatValue(value)
              elements.push(createSpan(valueFormat.preview, valueFormat.color))
            },
          }
        case "object":
        default: {
          const entries = Object.entries(obj).slice(0, 5)
          return {
            size: Object.keys(obj).length,
            prefix: "ObservableObject {",
            suffix: "}",
            sizeProp: null,
            entries,
            entryRenderer: (
              entry: [string, any],
              elements: DevToolsElement[],
            ) => {
              const [key, value] = entry
              elements.push(createSpan(key, theme.internal))
              elements.push(createSpan(": "))
              const { preview, color } = formatValue(value)
              elements.push(createSpan(preview, color))
            },
          }
        }
      }
    }

    /**
     * Generate offset styles based on nesting depth
     */
    const calculateOffsets = (
      key: string = "",
      depth: number = 0,
    ) => {
      const needsOffset = depth > 0
      const keyWidth = estimateTextWidth(key)

      return {
        outerStyles: needsOffset ? `margin-left: -${30 + keyWidth}px;` : "",
        innerStyles: needsOffset ? `padding-left: ${11 + keyWidth}px` : "",
        listMargin: needsOffset ? `0 0 0 -${29 + keyWidth}px` : "0",
      }
    }

    /**
     * Creates preview elements for an object
     */
    const createPreviewElements = (obj: any): DevToolsElement[] => {
      const previewElements: DevToolsElement[] = []

      // Determine collection type and get info
      const type = getCollectionType(obj)
      const info = getCollectionInfo(obj, type)

      // Add prefix
      const parts = info.prefix.split(" ")
      previewElements.push(createSpan(parts[0] + " ", theme.internal))
      previewElements.push(createSpan(parts[1]))

      // Add entries
      info.entries.forEach((entry: any, index) => {
        if (index > 0) {
          previewElements.push(createSpan(", "))
        }

        info.entryRenderer(entry, previewElements)
      })

      // Add ellipsis if there are more items
      const hasMore = info.size > 5
      if (hasMore) {
        previewElements.push(createSpan(", "))
        previewElements.push(createSpan("…", theme.label))
      }

      previewElements.push(createSpan(info.suffix + " "))

      return previewElements
    }

    /**
     * Apply styles to the first element in preview elements
     */
    const applyInnerStyles = (
      previewElements: DevToolsElement[],
      innerStyles: string,
    ): void => {
      const [first] = previewElements
      if (first) {
        if ("style" in first[1]) {
          const firstStyles = first[1].style || ""
          first[1].style = `${firstStyles};${innerStyles}`
        } else {
          first[1] = { ...first[1], style: innerStyles }
        }
      }
    }

    /**
     * Create a size property element (length/size) for collections
     */
    const createSizeProperty = (
      label: string,
      value: number,
    ): DevToolsElement => {
      return [
        "li",
        {},
        ["span", {
          style:
            `padding-left: 20px; font-weight: 700; color: ${theme.property}99`,
        }, label],
        createSpan(": "),
        createSpan(`${value}`, theme.number),
      ]
    }

    /**
     * Format entries for collections (Map, Set, Array)
     */
    const formatCollectionEntries = (
      obj: any,
      depth: number,
    ): DevToolsElement[] => {
      const list: DevToolsElement[] = []
      const type = getCollectionType(obj)

      switch (type) {
        case "array":
          // Format array entries
          obj.forEach((value: any, index: number) => {
            formatEntry(list, index.toString(), value, obj, depth)
          })

          // Add length property
          list.push(createSizeProperty("length", obj.length))
          break

        case "set": {
          // Format set entries
          let index = 0
          obj.forEach((value: any) => {
            formatEntry(list, index.toString(), value, null, depth)
            index++
          })

          // Add size property
          list.push(createSizeProperty("size", obj.size))
          break
        }
        case "map":
          // Format map entries
          obj.forEach((value: any, key: any) => {
            const formattedKey = typeof key === "object"
              ? JSON.stringify(key)
              : String(key)
            const keyDisplay = `"${formattedKey}"`
            formatEntry(list, keyDisplay, value, null, depth)
          })

          // Add size property
          list.push(createSizeProperty("size", obj.size))
          break

        case "object":
        default: {
          // Split and sort entries - non-functions first, then functions
          const entries = Object.entries(obj)
          const nonFunctionEntries = entries.filter(([_, value]) =>
            typeof value !== "function"
          )
          const functionEntries = entries.filter(([_, value]) =>
            typeof value === "function"
          )

          const sortedNonFunctionEntries = nonFunctionEntries.sort((a, b) =>
            a[0].localeCompare(b[0])
          )
          const sortedFunctionEntries = functionEntries.sort((a, b) =>
            a[0].localeCompare(b[0])
          )

          const sortedEntries = [
            ...sortedNonFunctionEntries,
            ...sortedFunctionEntries,
          ]

          for (const [key, value] of sortedEntries) {
            formatEntry(list, key, value, obj, depth)
          }
          break
        }
      }

      return list
    }

    /**
     * Format a single entry for the body list
     */
    const formatEntry = (
      list: DevToolsElement[],
      key: string,
      value: any,
      parentObj: any | null,
      depth: number,
    ) => {
      // Format value appropriately
      let formattedValue: DevToolsValue | DevToolsElement
      const isValueCollection = value !== null && typeof value === "object" && (
        isObservableArray(value) || isObservableObject(value) ||
        isObservableSet(value) || isObservableMap(value)
      )

      if (isValueCollection || typeof value === "function") {
        formattedValue = ["object", {
          object: value,
          config: { depth: depth + 1, label: key },
        }]
      } else {
        const { preview, color } = formatValue(value)
        formattedValue = createSpan(preview, color)
      }

      // Determine property type indicator
      const keyType = isValueCollection
        ? ""
        : isComputed(parentObj, key)
        ? "(c) "
        : isObservable(parentObj, key)
        ? "(o) "
        : ""

      // Add property to list
      list.push([
        "li",
        { style: "padding: 1px 0px" },
        ["span", {
          style: `font-style: italic; color: ${theme.internal};${
            keyType === "" ? "padding-left: 20px" : "margin-left: -7px"
          }`,
        }, keyType],
        ["span", { style: `color: ${theme.property}; font-weight: 700;` }, key],
        createSpan(": "),
        formattedValue,
      ])
    }

    const customFormatter: DevToolsFormatter = {
      header: (obj, config) => {
        if (!obj || typeof obj !== "object" || !($fobx in obj)) return null

        // Handle case when showing the original object
        if (config?.obj === obj) {
          return ["div", {}, createSpan("[[original]]", theme.internal)]
        }

        const depth = config?.depth ?? 0
        const key = config?.label || ""

        // Generate preview elements
        const previewElements = createPreviewElements(obj)

        // Calculate and apply styles for proper indentation
        const { outerStyles, innerStyles } = calculateOffsets(key, depth)
        applyInnerStyles(previewElements, innerStyles)

        // Construct and return the header element
        return [
          "div",
          {
            style:
              `height: 12px; line-height: 12px; font-style: italic;${outerStyles}; opacity: 0.6;`,
          },
          ...previewElements,
        ]
      },

      hasBody: (obj, _config) => {
        return !!(obj && typeof obj === "object" && $fobx in obj)
      },

      body: (obj, config) => {
        // If it's not an object, or it's the second time we've seen the object, use default formatting
        if (!obj || typeof obj !== "object" || obj === config?.obj) return null

        const depth = config?.depth ?? 0
        const key = config?.label || ""
        const { listMargin } = calculateOffsets(key, depth)

        // Create list container
        const list: DevToolsElement = [
          "ol",
          {
            style:
              `list-style-type: none; padding-left: 10px; margin: ${listMargin}`,
          },
        ]

        // Format entries based on collection type
        const entries = formatCollectionEntries(obj, depth)
        entries.forEach((entry) => list.push(entry))

        // Add original object reference
        list.push(["li", {}, ["object", { object: obj, config: { obj } }]])

        return list
      },
    }

    globalThis.window.devtoolsFormatters.push(customFormatter)
  }
}
