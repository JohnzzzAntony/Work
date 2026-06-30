import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { FollowUpDTO } from '@/lib/types'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser()
    const { id } = await params

    const task = await db.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        assignee: { select: { name: true } },
        createdById: true,
        followUpCount: true,
      },
    })
    if (!task) return jsonError('Task not found', 404)

    // Admin OR the current assignee may trigger a manual follow-up.
    if (currentUser.role !== 'admin' && task.assigneeId !== currentUser.id) {
      return jsonError('Forbidden', 403)
    }

    const message = `Manual follow-up: ${task.title}`
    const followUp = await db.followUp.create({
      data: {
        taskId: id,
        type: 'reminder',
        message,
        sentToUserId: task.assigneeId ?? null,
      },
      include: { sentTo: { select: { name: true } } },
    })

    if (task.assigneeId) {
      await db.notification.create({
        data: {
          userId: task.assigneeId,
          taskId: id,
          type: 'follow_up',
          message: `Follow-up: ${task.title}`,
        },
      })
    }

    const newCount = task.followUpCount + 1
    await db.task.update({
      where: { id },
      data: {
        lastFollowUpAt: new Date(),
        followUpCount: newCount,
      },
    })

    await db.activityLog.create({
      data: {
        taskId: id,
        userId: currentUser.id,
        actionType: 'follow_up',
        content: `Manual follow-up sent by ${currentUser.name}`,
      },
    })

    const dto: FollowUpDTO = {
      id: followUp.id,
      taskId: followUp.taskId,
      type: followUp.type,
      message: followUp.message,
      sentToUserId: followUp.sentToUserId,
      sentToUserName: followUp.sentTo?.name ?? null,
      createdAt: followUp.createdAt.toISOString(),
    }
    return NextResponse.json({ ok: true, followUp: dto }, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
