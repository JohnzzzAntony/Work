import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { NotificationDTO } from '@/lib/types'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireUser()
    const { id } = await params
    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) return jsonError('Notification not found', 404)
    if (existing.userId !== currentUser.id) return jsonError('Forbidden', 403)

    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
      include: { task: { select: { id: true, title: true } } },
    })

    const dto: NotificationDTO = {
      id: updated.id,
      userId: updated.userId,
      taskId: updated.taskId,
      taskTitle: updated.task?.title ?? null,
      type: updated.type as NotificationDTO['type'],
      message: updated.message,
      read: updated.read,
      createdAt: updated.createdAt.toISOString(),
    }
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}
