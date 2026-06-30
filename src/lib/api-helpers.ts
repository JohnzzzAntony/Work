import { NextResponse } from 'next/server'
import type { TaskDTO } from './types'

/**
 * Build a JSON error response with a given status code.
 */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

type TaskWithIncludes = {
  id: string
  title: string
  description: string
  categoryId: string
  priority: string
  status: string
  assigneeId: string | null
  createdById: string
  branchId: string | null
  sourceEmailText: string | null
  sourceSender: string | null
  generatedReplyText: string | null
  replySent: boolean
  dueDate: Date | null
  isRenewal: boolean
  renewalExpiryDate: Date | null
  renewalProvider: string | null
  followUpFrequencyHours: number | null
  lastFollowUpAt: Date | null
  followUpCount: number
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
  category: { id: string; name: string; color: string } | null
  assignee: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  branch: { id: string; name: string; type: string } | null
  _count?: { comments?: number }
}

/**
 * Map a Prisma task object (with the standard includes) into a TaskDTO.
 */
export function taskToDTO(task: TaskWithIncludes): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    categoryId: task.categoryId,
    categoryName: task.category?.name ?? '',
    categoryColor: task.category?.color ?? '#6b7280',
    priority: task.priority as TaskDTO['priority'],
    status: task.status as TaskDTO['status'],
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.name ?? null,
    createdById: task.createdById,
    createdByName: task.createdBy?.name ?? '',
    branchId: task.branchId,
    branchName: task.branch?.name ?? null,
    sourceEmailText: task.sourceEmailText,
    sourceSender: task.sourceSender,
    generatedReplyText: task.generatedReplyText,
    replySent: task.replySent,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    isRenewal: task.isRenewal,
    renewalExpiryDate: task.renewalExpiryDate ? task.renewalExpiryDate.toISOString() : null,
    renewalProvider: task.renewalProvider,
    followUpFrequencyHours: task.followUpFrequencyHours,
    lastFollowUpAt: task.lastFollowUpAt ? task.lastFollowUpAt.toISOString() : null,
    followUpCount: task.followUpCount,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    closedAt: task.closedAt ? task.closedAt.toISOString() : null,
    commentCount: task._count?.comments,
  }
}

/** The standard Prisma include shape used across task queries. */
export const TASK_INCLUDES = {
  category: { select: { id: true, name: true, color: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, type: true } },
  _count: { select: { comments: true } },
} as const

/** Prisma include shape for task detail (with activity logs, comments, follow-ups). */
export const TASK_DETAIL_INCLUDES = {
  ...TASK_INCLUDES,
  activityLogs: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { name: true } } },
  },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { name: true } } },
  },
  followUps: {
    orderBy: { createdAt: 'desc' as const },
    include: { sentTo: { select: { name: true } } },
  },
} as const

/**
 * Map an auth-related thrown error to a proper HTTP response.
 * - 'UNAUTHORIZED' -> 401
 * - 'FORBIDDEN'    -> 403
 * Returns null if the error is not auth-related (so the caller can handle it).
 */
export function handleAuthError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401)
    if (err.message === 'FORBIDDEN') return jsonError('Forbidden', 403)
  }
  return null
}

/**
 * Generic error handler for API route try/catch blocks.
 * Returns the auth-mapped response if applicable, otherwise a 500.
 */
export function apiCatch(err: unknown) {
  const authResponse = handleAuthError(err)
  if (authResponse) return authResponse
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[api-error]', err)
  return jsonError(message, 500)
}
