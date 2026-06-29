import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import { analyzeEmailSummary } from '@/lib/email-service'
import { autoAssignForCategory, resolveCategory } from '@/lib/assign'
import { db } from '@/lib/db'
import { dueDateFromPriorityHelper } from '@/lib/due-date'
import type { ParsedTask, Priority } from '@/lib/types'

/**
 * POST /api/email/analyze-summary
 * Body: { text, companyName? }
 *
 * Parses a pasted email digest/summary that may contain MULTIPLE tasks.
 * Returns an enriched list with resolved categoryId + suggestedAssignee.
 */
export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.text !== 'string' || !body.text.trim()) {
      return jsonError('text is required', 400)
    }
    const companyName =
      typeof body.companyName === 'string' ? body.companyName : 'WorkFlow Hub'

    // Fetch settings for due-date defaults
    const settings = await db.setting.findUnique({ where: { id: 'singleton' } })

    const llmTasks = await analyzeEmailSummary(body.text, companyName)

    const enriched: ParsedTask[] = []
    for (const t of llmTasks) {
      const category = await resolveCategory(t.category)
      if (!category) continue
      const suggestedAssigneeId = await autoAssignForCategory(category.id)
      const assignee = suggestedAssigneeId
        ? await db.user.findUnique({
            where: { id: suggestedAssigneeId },
            select: { name: true },
          })
        : null

      // Compute due date: prefer LLM hint, else derive from priority + settings
      let dueDate: string | null = null
      if (t.dueDateHint) {
        const parsed = new Date(t.dueDateHint)
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed.toISOString()
        }
      }
      if (!dueDate && settings) {
        dueDate = dueDateFromPriorityHelper(t.priority as Priority, settings)
      }

      enriched.push({
        title: t.title,
        category: category.name,
        categoryId: category.id,
        priority: t.priority,
        description: t.description,
        dueDate,
        suggestedAssigneeId,
        suggestedAssigneeName: assignee?.name ?? null,
      })
    }

    return NextResponse.json({ tasks: enriched })
  } catch (err) {
    return apiCatch(err)
  }
}
