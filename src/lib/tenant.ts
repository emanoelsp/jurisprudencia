export function namespaceForUser(userId?: string | null): string | undefined {
  if (!userId) return undefined
  const base = userId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)

  if (!base) return undefined
  return `cli-${base}`
}
