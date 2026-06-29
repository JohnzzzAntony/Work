// Seed script — run with: bun run scripts/seed.ts
// Replaces ALL demo tasks with the 10 real pending tasks provided by the user.
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
  console.log('Seeding database (real tasks)...')

  // Wipe existing data
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

  // Users (team)
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
  await db.setting.create({ data: { id: 'singleton' } })

  // Date helpers
  const now = new Date()
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000)
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

  // Helper to create a task with a "created" + "assigned" activity log
  type TaskInput = {
    title: string
    description: string
    categoryId: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assigneeId: string
    dueDate: Date
    sourceEmailText: string
    sourceSender: string
    createdAt: Date
  }

  async function createTask(input: TaskInput) {
    const task = await db.task.create({
      data: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        priority: input.priority,
        status: 'assigned',
        assigneeId: input.assigneeId,
        createdById: admin.id,
        sourceEmailText: input.sourceEmailText,
        sourceSender: input.sourceSender,
        replySent: true,
        dueDate: input.dueDate,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      },
    })
    await db.activityLog.createMany({
      data: [
        {
          taskId: task.id,
          userId: admin.id,
          actionType: 'created',
          content: 'Task created from email summary',
          createdAt: input.createdAt,
        },
        {
          taskId: task.id,
          userId: admin.id,
          actionType: 'assigned',
          content: `Assigned to ${
            [john, asha, liz, raj].find((u) => u.id === input.assigneeId)?.name ?? 'employee'
          }`,
          createdAt: new Date(input.createdAt.getTime() + 60000),
        },
      ],
    })
    // Notify the assignee
    await db.notification.create({
      data: {
        userId: input.assigneeId,
        taskId: task.id,
        type: 'assigned',
        message: `You were assigned: ${input.title}`,
        createdAt: new Date(input.createdAt.getTime() + 60000),
      },
    })
    return task
  }

  // ─── Task 1: Inventory / BOM Issue (Store Support, High) → Asha ───
  await createTask({
    title: 'Inventory / BOM Issue — root cause & permanent fix (Daima)',
    description: `From: Re: [External]Re: Product master configuration correcting… (Daima)

High priority — impacting operations and stock accuracy.

Tasks:
• Follow up with TSC / technical team for:
  - Root cause analysis
  - Permanent fix (not temporary workaround)
• Request timeline + resolution date from vendor
• Ensure interim fix:
  - Execute warehouse stock transfers to clear mismatch
• Coordinate with inventory team to complete stock corrections`,
    categoryId: storeSupport.id,
    priority: 'high',
    assigneeId: asha.id,
    dueDate: daysFromNow(1),
    sourceEmailText:
      'From: Re: [External]Re: Product master configuration correcting… [Re: [Exter...ms - Daima | Outlook]\n\nInventory / BOM issue impacting operations and stock accuracy. Need TSC/technical root cause analysis, permanent fix, vendor timeline, interim stock transfers, and inventory team stock corrections.',
    sourceSender: 'Daima (via Outlook)',
    createdAt: hoursAgo(5),
  })

  // ─── Task 2: Network / POS Machine Issues (Store Support, High) → Raj ───
  await createTask({
    title: 'Network / POS Machine Error — Rahmania Mall terminal',
    description: `From: FW: NETWORK MACHINE ERROR

Tasks:
• Investigate Z report + device issue (Rahmania Mall terminal)
• Coordinate with Network / POS support for fix
• Verify:
  - Printing issue
  - Missing "slide option"

Linked to earlier email to Network team (already reported): Re: Z Repo...ouch issue`,
    categoryId: storeSupport.id,
    priority: 'high',
    assigneeId: raj.id,
    dueDate: daysFromNow(1),
    sourceEmailText:
      'From: FW: NETWORK MACHINE ERROR [FW: NETWOR...HINE ERROR | Outlook]\n\nRahmania Mall terminal Z report + device issue. Printing issue and missing slide option. Linked to earlier Re: Z Repo...ouch issue email to Network team.',
    sourceSender: 'Store (via Outlook)',
    createdAt: hoursAgo(4),
  })

  // ─── Task 3: Website Enhancement – Data Sharing (Web Development, Medium) → Liz ───
  await createTask({
    title: 'Website Enhancement — share data with NetSolutions vendor',
    description: `From: Re: Website Enhancement Support – Netsolutions

Tasks:
• Provide to vendor:
  - GA4 / analytics data OR grant read-only access
• List of:
  - Plugins & integrations
• Any:
  - Performance reports
  - SEO audits
• Identify business bottlenecks in customer journey

Needed before/for discussion with vendor team.`,
    categoryId: webDev.id,
    priority: 'medium',
    assigneeId: liz.id,
    dueDate: daysFromNow(3),
    sourceEmailText:
      'From: Re: Website Enhancement Support – Netsolutions [Re: [Exter...tsolutions | Outlook]\n\nProvide vendor with GA4/analytics data or read-only access, list of plugins & integrations, performance reports, SEO audits. Identify business bottlenecks in customer journey. Needed for vendor discussion.',
    sourceSender: 'NetSolutions (via Outlook)',
    createdAt: hoursAgo(8),
  })

  // ─── Task 4: Noon's Dubai Mall Digital (Web Development, Low) → John ───
  await createTask({
    title: "Noon's Dubai Mall Digital — onboarding follow-up",
    description: `From: Re: Invitation Letter - Dubai Mall Digital (Launch of Oud)

Tasks:
• Review email content
• Follow up with Rashid Othayoth
• Progress onboarding / seller portal access discussion`,
    categoryId: webDev.id,
    priority: 'low',
    assigneeId: john.id,
    dueDate: daysFromNow(7),
    sourceEmailText:
      "From: Re: Invitation Letter - Dubai Mall Digital [Re: [Exter...uch of Oud | Outlook]\n\nReview email content, follow up with Rashid Othayoth, progress onboarding / seller portal access discussion for Noon's Dubai Mall Digital.",
    sourceSender: 'Noon (via Outlook)',
    createdAt: hoursAgo(20),
  })

  // ─── Task 5: Tabby Case — Fabian Access / Missing Data (Online Payments, Medium) → John ───
  await createTask({
    title: 'Tabby — restore Fabian access & fix payment visibility',
    description: `From: Re: Missing Fabian Access on Tabby Portal

Tasks:
• Follow up with Mayar Elsayed if issue still unresolved
• Ensure:
  - Missing Fabian account is restored
  - Payment visibility issue is fixed`,
    categoryId: payments.id,
    priority: 'medium',
    assigneeId: john.id,
    dueDate: daysFromNow(2),
    sourceEmailText:
      'From: Re: Missing Fabian Access on Tabby Portal [RE: [Exter...bby Portal | Outlook]\n\nFollow up with Mayar Elsayed. Ensure missing Fabian account is restored and payment visibility issue is fixed on Tabby portal.',
    sourceSender: 'Tabby (via Outlook)',
    createdAt: hoursAgo(6),
  })

  // ─── Task 6: Share Tabby Payout Details (Online Payments, Medium) → John ───
  await createTask({
    title: 'Share Tabby payout details with Mayar',
    description: `From: Fw: You're getting a payout from Tabby

Task:
• Share attachment with Mayer (Mayar)`,
    categoryId: payments.id,
    priority: 'medium',
    assigneeId: john.id,
    dueDate: daysFromNow(2),
    sourceEmailText:
      "From: Fw: You're getting a payout from Tabby [Fw: [Exter...from Tabby | Outlook]\n\nShare the attached payout details with Mayer (Mayar).",
    sourceSender: 'Tabby (via Outlook)',
    createdAt: hoursAgo(3),
  })

  // ─── Task 7: Security Alert (Website Core, Urgent) → Raj ───
  await createTask({
    title: 'CRITICAL: Security alert for flowerdistrictmarketing@gmail.com',
    description: `From: [External]Security alert for flowerdistrictmarketing@gmail.com

URGENT — potential account compromise.

Tasks:
• Verify account activity (urgent)
• If not recognized:
  - Remove your recovery email
  - Secure the account immediately`,
    categoryId: websiteCore.id,
    priority: 'urgent',
    assigneeId: raj.id,
    dueDate: hoursFromNow(4),
    sourceEmailText:
      'From: [External]Security alert for flowerdistrictmarketing@gmail.com [[External]...@gmail.com | Outlook]\n\nVerify account activity urgently. If not recognized, remove recovery email and secure the account immediately.',
    sourceSender: 'Google Security (via Outlook)',
    createdAt: hoursAgo(2),
  })

  // ─── Task 8: Renewal Notice – Hosting / SSL (Website Core, High) → Liz ───
  await createTask({
    title: 'Renew domain / SSL for karjistore.com before 11 July 2026 expiry',
    description: `From: Fw: Renewal Notice from Megh Technologies

Tasks:
• Renew before expiry:
  - Domain / SSL for karjistore.com (expiry: 11 July 2026)
• Coordinate payment / approval`,
    categoryId: websiteCore.id,
    priority: 'high',
    assigneeId: liz.id,
    dueDate: new Date('2026-07-11T23:59:59Z'),
    sourceEmailText:
      'From: Fw: Renewal Notice from Megh Technologies [Fw: [Exter...te Limited | Outlook]\n\nRenew domain / SSL for karjistore.com before expiry on 11 July 2026. Coordinate payment / approval.',
    sourceSender: 'Megh Technologies (via Outlook)',
    createdAt: hoursAgo(10),
  })

  // ─── Task 9: Network / Payment Terminal Hardware Issue (Online Payments, Medium) → John ───
  await createTask({
    title: 'Payment terminal hardware issue — device replacement & touch fix',
    description: `From: RE: Payment terminal hardware issue

Tasks:
• Follow up with Network provider
• Track:
  - Device replacement request
  - APK-related touch issue resolution`,
    categoryId: payments.id,
    priority: 'medium',
    assigneeId: john.id,
    dueDate: daysFromNow(3),
    sourceEmailText:
      'From: RE: Payment terminal hardware issue [RE: [Exter...ware issue | Outlook]\n\nFollow up with Network provider. Track device replacement request and APK-related touch issue resolution.',
    sourceSender: 'Network provider (via Outlook)',
    createdAt: hoursAgo(12),
  })

  // ─── Task 10: Marketing / Website Tasks (Web Development, Low) → Liz ───
  await createTask({
    title: 'NEYDO UAE Launch — verify supplier & banner reviews',
    description: `From: NEYDO - Launch in UAE

Tasks (verify completion):
• Confirm:
  - Supplier updated
  - Brand page banners checked/reviewed

Indirect involvement — verify previously requested items are done.`,
    categoryId: webDev.id,
    priority: 'low',
    assigneeId: liz.id,
    dueDate: daysFromNow(7),
    sourceEmailText:
      'From: NEYDO - Launch in UAE [Re: [Exter...Raw Look. | Outlook]\n\nVerify completion: supplier updated, brand page banners checked/reviewed. Indirect involvement.',
    sourceSender: 'NEYDO (via Outlook)',
    createdAt: daysAgo(1),
  })

  // Add a couple of admin notifications for overdue/due-soon items
  const allTasks = await db.task.findMany()
  const securityTask = allTasks.find((t) => t.priority === 'urgent')
  if (securityTask) {
    await db.notification.create({
      data: {
        userId: admin.id,
        taskId: securityTask.id,
        type: 'overdue',
        message: `CRITICAL security alert task "${securityTask.title}" needs immediate action`,
        createdAt: hoursAgo(1),
      },
    })
  }

  console.log('Seed complete. Created 10 real tasks across 4 categories.')
  console.log('Assignments:')
  console.log('  Asha (Store Support): 1 task — Inventory/BOM')
  console.log('  Raj  (Store Support + Website Core): 2 tasks — POS Machine, Security Alert')
  console.log('  Liz  (Website Core + Web Dev): 3 tasks — Website Enhancement, SSL Renewal, NEYDO')
  console.log('  John (Payments + Web Dev): 4 tasks — Noon, Tabby x2, Terminal Hardware')
  console.log('')
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
