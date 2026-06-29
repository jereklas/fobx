/**
 * Get's the current node environment from process.env.NODE_ENV
 * @returns the environgment the process is running in
 */
export function getNodeEnv(): string | undefined {
  const p = (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process
  return p?.env?.NODE_ENV
}
