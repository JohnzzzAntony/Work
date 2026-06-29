import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import type { NotificationDTO } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser()
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') || 'all'

    const where: Record<string, unknown> = { userId: currentUser.id }

    if (filter === 'unread') {
      where.read = false
    } else if (filter === 'assigned_to_me') {
      where.type = 'assigned'
    } else if (filter === 'overdue') {
      where.type = 'overdue'
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { id: true, title: true } } },
    })

    const dto: NotificationDTO[] = notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      taskId: n.taskId,
      taskTitle: n.task?.title ?? null,
      type: n.type as NotificationDTO['type'],
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }))
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}
