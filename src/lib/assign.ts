import { db } from './db'

/**
 * Pick the best employee to assign a task to, based on:
 * 1. Has the category in their skills (required)
 * 2. Has the fewest open tasks (load balancing)
 * 3. Tie-break alphabetically by name
 *
 * Returns the employee id, or null if no active employee has the skill.
 */
export async function autoAssignForCategory(categoryId: string): Promise<string | null> {
  const employees = await db.user.findMany({
    where: { role: 'employee', active: true },
  })

  const matching = employees.filter((e) => {
    try {
      const skills: string[] = JSON.parse(e.categorySkills || '[]')
      return skills.includes(categoryId)
    } catch {
      return false
    }
  })

  if (matching.length === 0) return null

  // Count open tasks per candidate (status NOT done/closed)
  const withCounts = await Promise.all(
    matching.map(async (e) => ({
      user: e,
      openCount: await db.task.count({
        where: {
          assigneeId: e.id,
          status: { notIn: ['done', 'closed'] },
        },
      }),
    }))
  )

  withCounts.sort(
    (a, b) => a.openCount - b.openCount || a.user.name.localeCompare(b.user.name)
  )

  return withCounts[0].user.id
}

/**
 * Resolve a category name (or close match) to a category record.
 * Falls back to keyword-based detection if no exact match.
 */
export async function resolveCategory(
  categoryName: string
): Promise<{ id: string; name: string; color: string } | null> {
  const categories = await db.category.findMany()
  // Exact match (case-insensitive)
  const exact = categories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase().trim()
  )
  if (exact) return exact
  // Partial match
  const partial = categories.find((c) =>
    categoryName.toLowerCase().includes(c.name.toLowerCase())
  )
  if (partial) return partial
  // Keyword fallback
  const lower = categoryName.toLowerCase()
  if (
    lower.includes('payment') ||
    lower.includes('tabby') ||
    lower.includes('refund') ||
    lower.includes('terminal')
  ) {
    return categories.find((c) => c.name === 'Online Payments') ?? null
  }
  if (
    lower.includes('inventory') ||
    lower.includes('bom') ||
    lower.includes('store') ||
    lower.includes('pos') ||
    lower.includes('warehouse') ||
    lower.includes('stock')
  ) {
    return categories.find((c) => c.name === 'Store Support') ?? null
  }
  if (
    lower.includes('website') ||
    lower.includes('enhancement') ||
    lower.includes('development') ||
    lower.includes('plugin') ||
    lower.includes('seo') ||
    lower.includes('banner') ||
    lower.includes('marketplace')
  ) {
    return categories.find((c) => c.name === 'Web Development') ?? null
  }
  // Default to Website Core
  return categories.find((c) => c.name === 'Website Core') ?? categories[0] ?? null
}
