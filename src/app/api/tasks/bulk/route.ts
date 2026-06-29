import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError, taskToDTO, TASK_INCLUDES } from '@/lib/api-helpers'
import { autoAssignForCategory } from '@/lib/assign'
import { PRIORITIES, type Priority, type TaskDTO, type BulkCreateTaskInput } from '@/lib/types'

/**
 * POST /api/tasks/bulk
 * Body: { tasks: BulkCreateTaskInput[], autoAssign?: boolean }
 *
 * Creates multiple tasks in one call. When autoAssign is true (default),
 * any task without an explicit assigneeId is auto-assigned to the best-
 * matching employee for its category (based on skills + current workload).
 *
 * Each created task gets a "created" activity log, and if assigned, an
 * "assigned" log + a notification to the assignee.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return jsonError('tasks (non-empty array) is required', 400)
    }
    const autoAssign = body.autoAssign !== false // default true

    // Validate all inputs first
    const inputs: Array<{
      title: string
      categoryId: string
      priority: Priority
      description: string
      dueDate: Date | null
      assigneeId: string | null
      sourceEmailText: string | null
      sourceSender: string | null
    }> = []

    const categoryIds = new Set(
      (await db.category.findMany()).map((c) => c.id)
    )

    for (let i = 0; i < body.tasks.length; i++) {
      const t: BulkCreateTaskInput = body.tasks[i]
      if (typeof t.title !== 'string' || !t.title.trim()) {
        return jsonError(`tasks[${i}].title is required`, 400)
      }
      if (typeof t.categoryId !== 'string' || !categoryIds.has(t.categoryId)) {
        return jsonError(`tasks[${i}].categoryId is invalid`, 400)
      }
      if (typeof t.priority !== 'string' || !PRIORITIES.includes(t.priority as Priority)) {
        return jsonError(`tasks[${i}].priority is invalid`, 400)
      }

      let assigneeId: string | null =
        typeof t.assigneeId === 'string' && t.assigneeId.length > 0 ? t.assigneeId : null

      // Auto-assign if no explicit assignee and autoAssign is enabled
      if (!assigneeId && autoAssign) {
        assigneeId = await autoAssignForCategory(t.categoryId)
      }

      const dueDate =
        typeof t.dueDate === 'string' && t.dueDate.length > 0
          ? new Date(t.dueDate)
          : null

      inputs.push({
        title: t.title.trim().slice(0, 200),
        categoryId: t.categoryId,
        priority: t.priority as Priority,
        description: typeof t.description === 'string' ? t.description : '',
        dueDate,
        assigneeId,
        sourceEmailText: typeof t.sourceEmailText === 'string' ? t.sourceEmailText : null,
        sourceSender: typeof t.sourceSender === 'string' ? t.sourceSender : null,
      })
    }

    // Create tasks + activity logs + notifications
    const created: TaskDTO[] = []
    for (const input of inputs) {
      const task = await db.task.create({
        data: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
          priority: input.priority,
          status: input.assigneeId ? 'assigned' : 'new',
          assigneeId: input.assigneeId,
          createdById: currentUser.id,
          sourceEmailText: input.sourceEmailText,
          sourceSender: input.sourceSender,
          replySent: true,
          dueDate: input.dueDate,
        },
        include: TASK_INCLUDES,
      })

      await db.activityLog.create({
        data: {
          taskId: task.id,
          userId: currentUser.id,
          actionType: 'created',
          content: 'Task created from email summary',
        },
      })

      if (task.assigneeId) {
        await db.activityLog.create({
          data: {
            taskId: task.id,
            userId: currentUser.id,
            actionType: 'assigned',
            content: `Assigned to ${task.assignee?.name ?? 'employee'}`,
          },
        })
        if (task.assigneeId !== currentUser.id) {
          await db.notification.create({
            data: {
              userId: task.assigneeId,
              taskId: task.id,
              type: 'assigned',
              message: `You were assigned: ${task.title}`,
            },
          })
        }
      }

      created.push(taskToDTO(task))
    }

    return NextResponse.json({ tasks: created, count: created.length }, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
