// deno-lint-ignore-file no-explicit-any
/**
 * DOM test environment setup.
 *
 * Installs happy-dom globals (document, Node, Event, etc.)
 * so that @fobx/dom and @fobx/jsx can use standard DOM APIs in tests.
 */

import { Window } from "npm:happy-dom"

let _window: InstanceType<typeof Window> | null = null

export function setupDOM(): {
  document: Document
  window: InstanceType<typeof Window>
} {
  if (_window) {
    // Reset body
    ;(_window.document as unknown as Document).body.innerHTML = ""
    return {
      document: _window.document as unknown as Document,
      window: _window,
    }
  }

  _window = new Window()
  const doc = _window.document as unknown as Document

  // Install globals that the libraries need
  const g = globalThis as any
  // DO NOT set g.window — it conflicts with Deno internals
  g.document = doc
  g.Node = _window.Node
  g.HTMLElement = _window.HTMLElement
  g.DocumentFragment = _window.DocumentFragment
  // DO NOT set g.Event — it conflicts with Deno's dispatchEvent internals
  g.MutationObserver = _window.MutationObserver
  g.Comment = _window.Comment
  g.Text = _window.Text

  return { document: doc, window: _window }
}

export function cleanupDOM(): void {
  if (_window) {
    ;(_window.document as unknown as Document).body.innerHTML = ""
  }
}
