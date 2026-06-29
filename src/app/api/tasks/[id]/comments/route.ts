import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { CommentDTO } from '@/lib/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser()
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
      return jsonError('body is required', 400)
    }
    const task = await db.task.findUnique({
      where: { id },
      select: { id: true, title: true, assigneeId: true, createdById: true },
    })
    if (!task) return jsonError('Task not found', 404)
    if (
      currentUser.role !== 'admin' &&
      task.assigneeId !== currentUser.id &&
      task.createdById !== currentUser.id
    ) {
      return jsonError('Forbidden', 403)
    }

    const commentBody = body.body
    const created = await db.comment.create({
      data: {
        taskId: id,
        userId: currentUser.id,
        body: commentBody,
      },
      include: { user: { select: { name: true } } },
    })

    await db.activityLog.create({
      data: {
        taskId: id,
        userId: currentUser.id,
        actionType: 'comment',
        content: commentBody.length > 200 ? commentBody.slice(0, 197) + '...' : commentBody,
      },
    })

    // Notify assignee (if not the commenter) and creator (if not the commenter)
    const targets = new Set<string>()
    if (task.assigneeId && task.assigneeId !== currentUser.id) targets.add(task.assigneeId)
    if (task.createdById && task.createdById !== currentUser.id) targets.add(task.createdById)
    if (targets.size > 0) {
      await db.notification.createMany({
        data: Array.from(targets).map((userId) => ({
          userId,
          taskId: id,
          type: 'comment',
          message: `New comment on ${task.title}`,
        })),
      })
    }

    const dto: CommentDTO = {
      id: created.id,
      taskId: created.taskId,
      userId: created.userId,
      userName: created.user?.name ?? '',
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    }
    return NextResponse.json(dto, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
