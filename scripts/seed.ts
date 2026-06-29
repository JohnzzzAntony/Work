// Seed script — run with: bun run scripts/seed.ts
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

const CATEGORY_SEED = [
  { name: 'Website Core', color: '#0ea5e9' },
  { name: 'Online Payments', color: '#16a34a' },
  { name: 'Web Development', color: '#8b5cf6' },
  { name: 'Store Support', color: '#f59e0b' },
]

async function main() {
  console.log('Seeding database...')

  // Wipe existing data (keep things deterministic for the demo)
  await db.notification.deleteMany()
  await db.comment.deleteMany()
  await db.activityLog.deleteMany()
  await db.task.deleteMany()
  await db.setting.deleteMany()
  await db.category.deleteMany()
  await db.user.deleteMany()

  // Categories
  const categories = await Promise.all(
    CATEGORY_SEED.map((c) => db.category.create({ data: c }))
  )
  const [websiteCore, payments, webDev, storeSupport] = categories
  console.log('Created categories:', categories.map((c) => c.name).join(', '))

  // Users
  const admin = await db.user.create({
    data: {
      email: 'admin@workflowhub.com',
      name: 'Alex Morgan',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      categorySkills: JSON.stringify(categories.map((c) => c.id)),
    },
  })

  const john = await db.user.create({
    data: {
      email: 'john@workflowhub.com',
      name: 'John Doe',
      passwordHash: hashPassword('emp123'),
      role: 'employee',
      categorySkills: JSON.stringify([payments.id, webDev.id]),
    },
  })

  const asha = await db.user.create({
    data: {
      email: 'asha@workflowhub.com',
      name: 'Asha Reddy',
      passwordHash: hashPassword('emp123'),
      role: 'employee',
      categorySkills: JSON.stringify([storeSupport.id]),
    },
  })

  const liz = await db.user.create({
    data: {
      email: 'liz@workflowhub.com',
      name: 'Liz Kim',
      passwordHash: hashPassword('emp123'),
      role: 'employee',
      categorySkills: JSON.stringify([websiteCore.id, webDev.id]),
    },
  })

  const raj = await db.user.create({
    data: {
      email: 'raj@workflowhub.com',
      name: 'Raj Mehta',
      passwordHash: hashPassword('emp123'),
      role: 'employee',
      categorySkills: JSON.stringify([websiteCore.id, storeSupport.id]),
    },
  })
  console.log('Created users: admin + 4 employees')

  // Settings singleton
  await db.setting.create({
    data: { id: 'singleton' },
  })

  // Helper for relative dates
  const now = new Date()
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000)
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

  // Sample tasks across statuses
  const sampleEmail = `From: sarah.client@brightbazaar.com
Subject: Payment gateway timeout for repeat customers

Hi team,

We've been getting reports from several repeat customers that when they try to retry a failed payment on the checkout page, the spinner just hangs for 30+ seconds and then shows a generic "Something went wrong" message. This started around 2 days ago and is affecting roughly 1 in 5 retry attempts based on our logs.

The transactions that do succeed show up correctly in the dashboard, so it seems to be just the retry path. Could you investigate? It's costing us conversions during the weekend sale.

Thanks,
Sarah Chen
Bright Bazaar Operations`

  const reply1 = `Hello Sarah,

Thank you for reaching out regarding the payment retry timeout on your checkout page. We have received your message and logged it under our Online Payments workflow. A member of our team will investigate the retry path and the gateway logs and follow up with you shortly.

Best regards,
The WorkFlow Hub Team`

  // Task 1: in_progress, overdue, with email source
  const t1 = await db.task.create({
    data: {
      title: 'Payment gateway timeout for repeat customers',
      description:
        'Repeat customers experience a 30+ second spinner then a generic error when retrying a failed payment. Affects ~20% of retry attempts since 2 days ago.',
      categoryId: payments.id,
      priority: 'high',
      status: 'in_progress',
      assigneeId: john.id,
      createdById: admin.id,
      sourceEmailText: sampleEmail,
      sourceSender: 'sarah.client@brightbazaar.com',
      generatedReplyText: reply1,
      replySent: true,
      dueDate: daysAgo(1), // overdue
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(6),
    },
  })
  await db.activityLog.createMany({
    data: [
      {
        taskId: t1.id,
        userId: admin.id,
        actionType: 'created',
        content: 'Task created from email (sender: sarah.client@brightbazaar.com)',
        createdAt: daysAgo(2),
      },
      {
        taskId: t1.id,
        userId: admin.id,
        actionType: 'reply_generated',
        content: 'Reply draft generated (tone: formal)',
        createdAt: daysAgo(2),
      },
      {
        taskId: t1.id,
        userId: admin.id,
        actionType: 'reply_sent',
        content: 'Reply marked as sent to sender',
        createdAt: daysAgo(2),
      },
      {
        taskId: t1.id,
        userId: admin.id,
        actionType: 'assigned',
        content: 'Assigned to John Doe',
        createdAt: daysAgo(2),
      },
      {
        taskId: t1.id,
        userId: admin.id,
        actionType: 'status_change',
        content: 'Status changed: New → Assigned',
        createdAt: daysAgo(2),
      },
      {
        taskId: t1.id,
        userId: john.id,
        actionType: 'status_change',
        content: 'Status changed: Assigned → In Progress',
        createdAt: daysAgo(1),
      },
      {
        taskId: t1.id,
        userId: john.id,
        actionType: 'comment',
        content: 'Looking into gateway logs now — appears to be a 504 from the retry endpoint.',
        createdAt: hoursAgo(6),
      },
    ],
  })
  await db.comment.create({
    data: {
      taskId: t1.id,
      userId: john.id,
      body: 'Looking into gateway logs now — appears to be a 504 from the retry endpoint. Will escalate to gateway provider.',
      createdAt: hoursAgo(6),
    },
  })

  // Task 2: new, reply not sent, due today
  const t2 = await db.task.create({
    data: {
      title: 'Store checkout bug — coupon code not applied',
      description:
        'Customer reports applying a 10% coupon at checkout shows "applied" but the order total does not change.',
      categoryId: storeSupport.id,
      priority: 'high',
      status: 'new',
      assigneeId: null,
      createdById: admin.id,
      sourceEmailText:
        'From: mike@brightbazaar.com\nSubject: Coupon code BUGCOUP10 not applying discount\n\nHi, the coupon code BUGCOUP10 shows as applied but my order total stays the same. Please fix ASAP, this is hurting our promo campaign.\n\n— Mike',
      sourceSender: 'mike@brightbazaar.com',
      generatedReplyText:
        "Hello Mike,\n\nThank you for letting us know about the coupon code issue. We've received your message and our team will investigate the discount calculation on the checkout page and follow up with you shortly.\n\nBest regards,\nThe WorkFlow Hub Team",
      replySent: false,
      dueDate: hoursFromNow(6),
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
  })
  await db.activityLog.create({
    data: {
      taskId: t2.id,
      userId: admin.id,
      actionType: 'created',
      content: 'Task created from email (sender: mike@brightbazaar.com)',
      createdAt: hoursAgo(3),
    },
  })

  // Task 3: assigned, due today
  const t3 = await db.task.create({
    data: {
      title: 'Homepage banner update for summer sale',
      description: 'Replace the spring sale banner with the new summer sale creative. Copy and assets are in the shared drive.',
      categoryId: websiteCore.id,
      priority: 'medium',
      status: 'assigned',
      assigneeId: asha.id,
      createdById: admin.id,
      dueDate: hoursFromNow(8),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  })
  await db.activityLog.create({
    data: {
      taskId: t3.id,
      userId: admin.id,
      actionType: 'assigned',
      content: 'Assigned to Asha Reddy',
      createdAt: daysAgo(1),
    },
  })

  // Task 4: in_review
  const t4 = await db.task.create({
    data: {
      title: 'SSL certificate renewal for brightbazaar.com',
      description: "Renew the expiring SSL cert. Current cert expires in 5 days. Let's Encrypt via certbot.",
      categoryId: websiteCore.id,
      priority: 'high',
      status: 'in_review',
      assigneeId: liz.id,
      createdById: admin.id,
      dueDate: daysFromNow(2),
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(20),
    },
  })
  await db.activityLog.create({
    data: {
      taskId: t4.id,
      userId: liz.id,
      actionType: 'status_change',
      content: 'Status changed: In Progress → In Review — cert renewed, needs admin verification.',
      createdAt: hoursAgo(20),
    },
  })
  await db.comment.create({
    data: {
      taskId: t4.id,
      userId: liz.id,
      body: 'Cert renewed via certbot. New expiry in 90 days. Auto-renew cron confirmed. Please verify and close.',
      createdAt: hoursAgo(20),
    },
  })

  // Task 5: blocked, overdue
  const t5 = await db.task.create({
    data: {
      title: 'Refund dispute #2291 — customer claims duplicate charge',
      description: 'Customer was charged twice for order #88231. Need to verify with payment provider and issue refund.',
      categoryId: payments.id,
      priority: 'urgent',
      status: 'blocked',
      assigneeId: raj.id,
      createdById: admin.id,
      dueDate: daysAgo(1), // overdue
      createdAt: daysAgo(3),
      updatedAt: hoursAgo(30),
    },
  })
  await db.activityLog.create({
    data: {
      taskId: t5.id,
      userId: raj.id,
      actionType: 'comment',
      content: 'Blocked — waiting on payment provider to send the original transaction ID. Escalated to their support.',
      createdAt: hoursAgo(30),
    },
  })
  await db.comment.create({
    data: {
      taskId: t5.id,
      userId: raj.id,
      body: 'Blocked — waiting on payment provider to send the original transaction ID. Escalated to their support. ETA 24h.',
      createdAt: hoursAgo(30),
    },
  })

  // Task 6: done (closed already)
  const t6 = await db.task.create({
    data: {
      title: 'New product detail page layout for v2 catalog',
      description: 'Implement the new PDP layout with sticky add-to-cart and review snippets.',
      categoryId: webDev.id,
      priority: 'medium',
      status: 'closed',
      assigneeId: liz.id,
      createdById: admin.id,
      dueDate: daysAgo(2),
      createdAt: daysAgo(8),
      updatedAt: daysAgo(1),
      closedAt: daysAgo(1),
    },
  })
  await db.activityLog.createMany({
    data: [
      {
        taskId: t6.id,
        userId: liz.id,
        actionType: 'status_change',
        content: 'Status changed: In Review → Done',
        createdAt: daysAgo(2),
      },
      {
        taskId: t6.id,
        userId: admin.id,
        actionType: 'closed',
        content: 'Verified by admin and closed',
        createdAt: daysAgo(1),
      },
    ],
  })

  // Task 7: done this week
  const t7 = await db.task.create({
    data: {
      title: 'Inventory sync issue between Shopify and warehouse',
      description: 'Inventory counts drift between Shopify and the warehouse system after each fulfillment cycle.',
      categoryId: storeSupport.id,
      priority: 'high',
      status: 'done',
      assigneeId: asha.id,
      createdById: admin.id,
      dueDate: daysFromNow(1),
      createdAt: daysAgo(5),
      updatedAt: hoursAgo(10),
    },
  })
  await db.activityLog.create({
    data: {
      taskId: t7.id,
      userId: asha.id,
      actionType: 'status_change',
      content: 'Status changed: In Progress → Done — sync script patched and verified across 3 cycles.',
      createdAt: hoursAgo(10),
    },
  })

  // Task 8: in_progress
  const t8 = await db.task.create({
    data: {
      title: 'Web dev: build customer account dashboard v2',
      description: 'Build the new account dashboard with order history, addresses, and saved payment methods.',
      categoryId: webDev.id,
      priority: 'medium',
      status: 'in_progress',
      assigneeId: john.id,
      createdById: admin.id,
      dueDate: daysFromNow(4),
      createdAt: daysAgo(2),
      updatedAt: hoursAgo(12),
    },
  })

  // Task 9: new
  const t9 = await db.task.create({
    data: {
      title: 'Add Apple Pay to checkout',
      description: 'Customer request: enable Apple Pay as a payment option at checkout.',
      categoryId: payments.id,
      priority: 'low',
      status: 'new',
      assigneeId: null,
      createdById: admin.id,
      dueDate: daysFromNow(7),
      createdAt: hoursAgo(20),
      updatedAt: hoursAgo(20),
    },
  })

  // Task 10: closed (older, for reports)
  const t10 = await db.task.create({
    data: {
      title: '503 errors on /api/products during peak load',
      description: 'Investigate and fix 503 errors on the products API during high-traffic periods.',
      categoryId: websiteCore.id,
      priority: 'urgent',
      status: 'closed',
      assigneeId: liz.id,
      createdById: admin.id,
      dueDate: daysAgo(6),
      createdAt: daysAgo(10),
      updatedAt: daysAgo(5),
      closedAt: daysAgo(5),
    },
  })

  // Task 11: assigned, low priority
  const t11 = await db.task.create({
    data: {
      title: 'Update footer copyright year across all pages',
      description: 'Footer still shows last year. Bulk update needed.',
      categoryId: websiteCore.id,
      priority: 'low',
      status: 'assigned',
      assigneeId: raj.id,
      createdById: admin.id,
      dueDate: daysFromNow(5),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  })

  // Task 12: closed for reports
  const t12 = await db.task.create({
    data: {
      title: 'Migrate product reviews to new schema',
      description: 'Migrate the reviews table to the new normalized schema with verified-purchase flags.',
      categoryId: webDev.id,
      priority: 'medium',
      status: 'closed',
      assigneeId: john.id,
      createdById: admin.id,
      dueDate: daysAgo(3),
      createdAt: daysAgo(12),
      updatedAt: daysAgo(3),
      closedAt: daysAgo(3),
    },
  })

  // Seed some notifications
  await db.notification.createMany({
    data: [
      {
        userId: admin.id,
        taskId: t5.id,
        type: 'overdue',
        message: '"Refund dispute #2291" assigned to Raj Mehta is overdue',
        createdAt: hoursAgo(2),
      },
      {
        userId: admin.id,
        taskId: t2.id,
        type: 'reply_not_sent',
        message: '"Store checkout bug — coupon code not applied" — reply not sent yet',
        createdAt: hoursAgo(1),
      },
      {
        userId: admin.id,
        taskId: t4.id,
        type: 'done_needs_verification',
        message: '"SSL certificate renewal" marked Done by Liz Kim — needs your verification',
        createdAt: hoursAgo(20),
      },
      {
        userId: john.id,
        taskId: t1.id,
        type: 'overdue',
        message: '"Payment gateway timeout for repeat customers" is overdue',
        createdAt: hoursAgo(2),
      },
      {
        userId: asha.id,
        taskId: t3.id,
        type: 'due_soon',
        message: '"Homepage banner update for summer sale" is due today',
        createdAt: hoursAgo(3),
      },
    ],
  })

  console.log('Seed complete. Created 12 tasks, 4 employees + 1 admin, 5 notifications.')
  console.log('Login credentials:')
  console.log('  Admin:    admin@workflowhub.com / admin123')
  console.log('  Employee: john@workflowhub.com / emp123')
  console.log('            asha@workflowhub.com / emp123')
  console.log('            liz@workflowhub.com / emp123')
  console.log('            raj@workflowhub.com / emp123')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
