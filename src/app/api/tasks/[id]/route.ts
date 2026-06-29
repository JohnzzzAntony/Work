import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { apiCatch, jsonError, taskToDTO, TASK_INCLUDES } from '@/lib/api-helpers'
import {
  PRIORITIES,
  PRIORITY_META,
  STATUS_META,
  STATUSES,
} from '@/lib/types'
import type { ActivityLogDTO, CommentDTO, Priority, TaskDTO, TaskDetailDTO, TaskStatus } from '@/lib/types'

async function assertTaskAccess(taskId: string, currentUser: { id: string; role: string }) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: TASK_INCLUDES,
  })
  if (!task) return null
  if (
    currentUser.role !== 'admin' &&
    task.assigneeId !== currentUser.id &&
    task.createdById !== currentUser.id
  ) {
    return { forbidden: true as const }
  }
  return task
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser()
    const { id } = await params
    const task = await assertTaskAccess(id, currentUser)
    if (!task) return jsonError('Task not found', 404)
    if ('forbidden' in task && task.forbidden) return jsonError('Forbidden', 403)

    const [activityLogs, comments] = await Promise.all([
      db.activityLog.findMany({
        where: { taskId: id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      }),
      db.comment.findMany({
        where: { taskId: id },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true } } },
      }),
    ])

    const dto: TaskDetailDTO = {
      ...taskToDTO(task),
      activityLogs: activityLogs.map<ActivityLogDTO>((l) => ({
        id: l.id,
        taskId: l.taskId,
        userId: l.userId,
        userName: l.user?.name ?? null,
        actionType: l.actionType,
        content: l.content,
        createdAt: l.createdAt.toISOString(),
      })),
      comments: comments.map<CommentDTO>((c) => ({
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        userName: c.user?.name ?? '',
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    }
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser()
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('Invalid body', 400)

    const existing = await db.task.findUnique({
      where: { id },
      include: { ...TASK_INCLUDES, assignee: { select: { id: true, name: true } } },
    })
    if (!existing) return jsonError('Task not found', 404)
    if (
      currentUser.role !== 'admin' &&
      existing.assigneeId !== currentUser.id &&
      existing.createdById !== currentUser.id
    ) {
      return jsonError('Forbidden', 403)
    }

    const data: Record<string, unknown> = {}
    const logs: { actionType: string; content: string }[] = []
    const notifications: { userId: string; type: string; message: string }[] = []

    // --- title ---
    if (typeof body.title === 'string' && body.title !== existing.title) {
      data.title = body.title
      logs.push({ actionType: 'title_change', content: 'Title updated' })
    }

    // --- description ---
    if (typeof body.description === 'string' && body.description !== existing.description) {
      data.description = body.description
      logs.push({ actionType: 'description_change', content: 'Description updated' })
    }

    // --- categoryId ---
    if (typeof body.categoryId === 'string' && body.categoryId !== existing.categoryId) {
      const cat = await db.category.findUnique({ where: { id: body.categoryId } })
      if (!cat) return jsonError('categoryId does not exist', 400)
      data.categoryId = body.categoryId
      logs.push({ actionType: 'category_change', content: `Category changed to ${cat.name}` })
    }

    // --- priority ---
    if (typeof body.priority === 'string' && body.priority !== existing.priority) {
      if (!PRIORITIES.includes(body.priority as Priority)) {
        return jsonError('Invalid priority', 400)
      }
      const oldLabel = PRIORITY_META[existing.priority as Priority]?.label ?? existing.priority
      const newLabel = PRIORITY_META[body.priority as Priority]?.label ?? body.priority
      data.priority = body.priority
      logs.push({
        actionType: 'priority_change',
        content: `Priority changed: ${oldLabel} → ${newLabel}`,
      })
    }

    // --- status ---
    if (typeof body.status === 'string' && body.status !== existing.status) {
      if (!STATUSES.includes(body.status as TaskStatus)) {
        return jsonError('Invalid status', 400)
      }
      const oldLabel = STATUS_META[existing.status as TaskStatus]?.label ?? existing.status
      const newLabel = STATUS_META[body.status as TaskStatus]?.label ?? body.status
      data.status = body.status
      logs.push({
        actionType: 'status_change',
        content: `Status changed: ${oldLabel} → ${newLabel}`,
      })
      // Notify creator when marked done (needs verification)
      if (body.status === 'done' && existing.createdById !== currentUser.id) {
        notifications.push({
          userId: existing.createdById,
          type: 'done_needs_verification',
          message: `"${existing.title}" marked Done by ${currentUser.name} — needs your verification`,
        })
      }
      // Set closedAt + log when closing
      if (body.status === 'closed') {
        data.closedAt = new Date()
        logs.push({ actionType: 'closed', content: 'Task closed' })
      }
      // Clear closedAt if reopening away from closed
      if (existing.status === 'closed' && body.status !== 'closed') {
        data.closedAt = null
      }
    }

    // --- assigneeId ---
    if (body.assigneeId !== undefined) {
      const incoming: string | null =
        typeof body.assigneeId === 'string' && body.assigneeId.length > 0
          ? body.assigneeId
          : null
      if (incoming !== existing.assigneeId) {
        if (incoming) {
          const assignee = await db.user.findUnique({ where: { id: incoming } })
          if (!assignee) return jsonError('assigneeId does not exist', 400)
          data.assigneeId = incoming
          logs.push({
            actionType: 'assigned',
            content: `Assigned to ${assignee.name}`,
          })
          if (incoming !== currentUser.id) {
            notifications.push({
              userId: incoming,
              type: 'assigned',
              message: `You were assigned: ${existing.title}`,
            })
          }
        } else {
          data.assigneeId = null
          logs.push({ actionType: 'unassigned', content: 'Unassigned' })
        }
      }
    }

    // --- dueDate ---
    if (body.dueDate !== undefined) {
      const incoming: Date | null =
        typeof body.dueDate === 'string' && body.dueDate.length > 0
          ? new Date(body.dueDate)
          : null
      const existingDue = existing.dueDate ? existing.dueDate.toISOString() : null
      const incomingIso = incoming ? incoming.toISOString() : null
      if (incomingIso !== existingDue) {
        data.dueDate = incoming
        logs.push({
          actionType: 'due_date_change',
          content: incoming ? `Due date set to ${incoming.toISOString()}` : 'Due date cleared',
        })
      }
    }

    // --- generatedReplyText ---
    if (
      typeof body.generatedReplyText === 'string' &&
      body.generatedReplyText !== (existing.generatedReplyText ?? '')
    ) {
      data.generatedReplyText = body.generatedReplyText
      logs.push({ actionType: 'reply_generated', content: 'Reply draft updated' })
    }

    // --- replySent ---
    if (typeof body.replySent === 'boolean' && body.replySent && !existing.replySent) {
      data.replySent = true
      logs.push({ actionType: 'reply_sent', content: 'Reply marked as sent' })
    } else if (typeof body.replySent === 'boolean' && !body.replySent) {
      data.replySent = false
    }

    const updated = await db.task.update({ where: { id }, data, include: TASK_INCLUDES })

    // Write activity logs (referencing the assignee snapshot if needed)
    if (logs.length > 0) {
      await db.activityLog.createMany({
        data: logs.map((l) => ({
          taskId: id,
          userId: currentUser.id,
          actionType: l.actionType,
          content: l.content,
        })),
      })
    }
    if (notifications.length > 0) {
      await db.notification.createMany({
        data: notifications.map((n) => ({
          userId: n.userId,
          taskId: id,
          type: n.type,
          message: n.message,
        })),
      })
    }

    const dto: TaskDTO = taskToDTO(updated)
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const existing = await db.task.findUnique({ where: { id } })
    if (!existing) return jsonError('Task not found', 404)
    // Hard delete — cascades to ActivityLog, Comment (onDelete: Cascade).
    // Notifications have no cascade defined but will be cleaned up explicitly.
    await db.notification.deleteMany({ where: { taskId: id } })
    await db.task.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
