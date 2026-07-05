import { db } from './db'
import { analyzeEmail } from './email-service'
import { resolveCategory, autoAssignForCategory } from './assign'
import { pushNotification } from './notif-client'
import { dueDateFromPriorityHelper } from './due-date'
import { TASK_INCLUDES, taskToDTO } from './api-helpers'
import type { Priority } from './types'

export async function ingestIncomingEmail(body: {
  senderEmail: string
  senderName: string
  subject: string
  body: string
}) {
  const senderEmail = body.senderEmail.trim()
  const senderName = body.senderName.trim()
  const subject = body.subject.trim()

  // 1. Analyze email content via AI
  const analysis = await analyzeEmail({
    emailText: `Subject: ${subject}\n\n${body.body}`,
    sender: senderEmail,
    tone: 'formal',
  })

  // 2. Resolve category from AI detection
  const resolvedCat = await resolveCategory(analysis.category)
  if (!resolvedCat) {
    throw new Error(`Failed to resolve category: ${analysis.category}`)
  }

  // 3. Find the best employee using auto-assignment
  const assigneeId = await autoAssignForCategory(resolvedCat.id)

  // 4. Find the first admin to associate with system-created task
  const firstAdmin = await db.user.findFirst({
    where: { role: 'admin', active: true },
  })
  const adminId = firstAdmin?.id || 'singleton'

  // Determine priority
  const priority: Priority = ['low', 'medium', 'high', 'urgent'].includes(analysis.priority)
    ? (analysis.priority as Priority)
    : 'medium'

  // Compute due date from priority
  const settings = await db.setting.findUnique({ where: { id: 'singleton' } })
  const computedDueDate = dueDateFromPriorityHelper(priority, settings)

  // Set initial status
  const status = assigneeId ? 'assigned' : 'new'

  // 5. Create task in database
  const createdTask = await db.task.create({
    data: {
      title: analysis.title,
      description: analysis.summary,
      categoryId: resolvedCat.id,
      priority,
      status,
      assigneeId,
      createdById: adminId,
      sourceEmailText: body.body,
      sourceSender: senderEmail,
      generatedReplyText: analysis.replyDraft,
      replySent: false,
      dueDate: new Date(computedDueDate),
    },
    include: TASK_INCLUDES,
  })

  // 6. Log activity: creation
  await db.activityLog.create({
    data: {
      taskId: createdTask.id,
      userId: adminId,
      actionType: 'created',
      content: `Task created automatically from email: "${analysis.title}"`,
    },
  })

  // 7. If assigned, log assignment + create notification + push in real-time
  if (assigneeId) {
    await db.activityLog.create({
      data: {
        taskId: createdTask.id,
        userId: adminId,
        actionType: 'assigned',
        content: `Assigned automatically to ${createdTask.assignee?.name ?? 'employee'}`,
      },
    })

    const notification = await db.notification.create({
      data: {
        userId: assigneeId,
        taskId: createdTask.id,
        type: 'assigned',
        message: `You were assigned a new email task: ${createdTask.title}`,
      },
    })

    // Push real-time notification
    const unreadCount = await db.notification.count({
      where: { userId: assigneeId, read: false },
    })
    void pushNotification(assigneeId, notification, { count: unreadCount })
  }

  return {
    task: taskToDTO(createdTask),
    replyDraft: analysis.replyDraft,
  }
}
