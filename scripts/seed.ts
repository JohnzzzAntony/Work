// Seed script — run with: bun run scripts/seed.ts
// Imports the 63 real Head Office employees (department-wise), adds department-based
// categories, seeds a main branch, and keeps the 10 real pending tasks.
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

// Department seeds — each gets a distinct color
const DEPARTMENT_SEED = [
  { name: 'Syndicate', color: '#0ea5e9' },
  { name: 'HR/Admin/PRO', color: '#ec4899' },
  { name: 'Digital/E-Com/Creative/Care', color: '#8b5cf6' },
  { name: 'Finance/Accounts', color: '#16a34a' },
  { name: 'Inventory', color: '#f59e0b' },
  { name: 'IT', color: '#06b6d4' },
  { name: 'Procurement', color: '#ef4444' },
]

// The 63 employees from the uploaded xlsx, grouped by department
const EMPLOYEES: Record<string, string[]> = {
  Syndicate: [
    'Abdulla Karji',
    'Adnan Al Ali',
    'Ali Karji',
    'Mohamed Adnan',
    'Mariam Adnan',
    'Omar Adnan',
  ],
  'HR/Admin/PRO': [
    'Muhammad Sinan',
    'Maylaa HR Dept.',
    'Sahla Fathimath',
    'Thanseer Mubarak',
    'Muzammil MK',
    'Muhammad Rishad Kunkankandy',
    'Yamone Oo',
    'Anand Madhu',
  ],
  'Digital/E-Com/Creative/Care': [
    'Rashid Othayoth',
    'Vishnu Nair',
    'Ameer Meethal Ermu',
    'Abdul Rahoof',
    'Usama Rao',
    'Keempee L. Labordo',
    'Sanuva Baig Ebrahim',
    'Retchel Abelleza',
    'Yousef Almostafa',
    'Abdul Karim',
    'Amit Tiwari',
    'Mark Chester',
    'Eduard Yaco',
    'Sreelal C\u00a0K',
    'Ammar Salhab Raeef',
    'Mohammed Nasr',
    'Ridhik Santhosh',
  ],
  'Finance/Accounts': [
    'Abdul Kader Keloth',
    'Anees KK',
    'Mohammed Aftab',
    'Muhammad Riyas Palayatil',
    'Mukhthar MK',
    'Ramsal P',
    'Muhammad Khalil',
    'Maurine Lee',
    'Ashnamol Ashraf',
    'Tashmika Pasanga Sumanapala',
    'Ahmed Tarek Mohamed',
    'Rashid Musthafa',
    'Gouri Rajeev',
    'Ahmed Abdelmoati',
  ],
  Inventory: [
    'Muhammad Sajeer',
    'Maylaa Inventory1',
    'Muhammedh Fahadh P V',
  ],
  IT: [
    'Midhun MV',
    'Johns Antony',
    'Rahul Kumar Yadav',
    'Mohammed Shehzil',
  ],
  Procurement: [
    'Siraj Kottarathil',
    'Sahad CK',
    'Muhammed Afsal',
    'Abdul Nissar Mullappally',
    'Munaij Moidu',
    'Muhammed Minhaj',
    'Muhammed Sharook',
  ],
}

// Original work categories + department-based categories
const CATEGORY_SEED = [
  // Original work-type categories
  { name: 'Website Core', color: '#0ea5e9', department: null },
  { name: 'Online Payments', color: '#16a34a', department: null },
  { name: 'Web Development', color: '#8b5cf6', department: null },
  { name: 'Store Support', color: '#f59e0b', department: null },
  // Department-based categories
  { name: 'IT Support', color: '#06b6d4', department: 'IT' },
  { name: 'Finance & Accounts', color: '#16a34a', department: 'Finance/Accounts' },
  { name: 'HR & Admin', color: '#ec4899', department: 'HR/Admin/PRO' },
  { name: 'Procurement', color: '#ef4444', department: 'Procurement' },
  { name: 'Inventory Management', color: '#f59e0b', department: 'Inventory' },
  { name: 'Digital & E-Commerce', color: '#8b5cf6', department: 'Digital/E-Com/Creative/Care' },
  { name: 'Syndicate Operations', color: '#0ea5e9', department: 'Syndicate' },
]

// Main branches / entities to seed
const BRANCH_SEED = [
  { name: 'Head Office', type: 'office', address: 'Dubai, UAE', email: 'info@karjistore.com', phone: '+971 4 000 0000' },
  { name: 'Karji Store', type: 'store', address: 'Dubai, UAE', email: 'store@karjistore.com', phone: '+971 4 000 0001' },
  { name: 'Flower District Marketing', type: 'entity', address: 'Dubai, UAE', email: 'flowerdistrictmarketing@gmail.com', phone: '+971 4 000 0002' },
  { name: 'Rahmania Mall Store', type: 'store', address: 'Rahmania Mall, UAE', email: 'rahmania@karjistore.com', phone: '+971 4 000 0003' },
]

async function main() {
  console.log('Seeding database (real employees + departments + branches)...')

  // Wipe existing data
  await db.notification.deleteMany()
  await db.followUp.deleteMany()
  await db.comment.deleteMany()
  await db.activityLog.deleteMany()
  await db.task.deleteMany()
  await db.setting.deleteMany()
  await db.category.deleteMany()
  await db.user.deleteMany()
  await db.department.deleteMany()
  await db.branch.deleteMany()

  // Departments
  const departments = await Promise.all(
    DEPARTMENT_SEED.map((d) => db.department.create({ data: d }))
  )
  const deptByName = Object.fromEntries(departments.map((d) => [d.name, d]))
  console.log(`Created ${departments.length} departments`)

  // Branches
  const branches = await Promise.all(
    BRANCH_SEED.map((b) => db.branch.create({ data: b }))
  )
  const headOffice = branches[0]
  console.log(`Created ${branches.length} branches/entities`)

  // Categories (with optional department link)
  const categories = await Promise.all(
    CATEGORY_SEED.map((c) =>
      db.category.create({
        data: {
          name: c.name,
          color: c.color,
          departmentId: c.department ? deptByName[c.department].id : null,
        },
      })
    )
  )
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]))
  console.log(`Created ${categories.length} categories`)

  // Admin user
  const admin = await db.user.create({
    data: {
      email: 'admin@workflowhub.com',
      name: 'Alex Morgan',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      categorySkills: JSON.stringify(categories.map((c) => c.id)),
      departmentId: deptByName['IT'].id,
      branchId: headOffice.id,
      jobTitle: 'Operations Manager',
    },
  })

  // Import the 63 employees, grouped by department
  let employeeCount = 0
  // Pick a "lead" employee per department (first in list) who gets login credentials
  // displayed in the console — useful for testing.
  const deptLeads: Record<string, { email: string; name: string }> = {}
  for (const [deptName, names] of Object.entries(EMPLOYEES)) {
    const dept = deptByName[deptName]
    // Map this department to its category (for skill assignment)
    const deptCategoryMap: Record<string, string> = {
      Syndicate: 'Syndicate Operations',
      'HR/Admin/PRO': 'HR & Admin',
      'Digital/E-Com/Creative/Care': 'Digital & E-Commerce',
      'Finance/Accounts': 'Finance & Accounts',
      Inventory: 'Inventory Management',
      IT: 'IT Support',
      Procurement: 'Procurement',
    }
    const skillCat = catByName[deptCategoryMap[deptName]]
    for (const name of names) {
      const cleanedName = name.replace(/\s+/g, ' ').trim()
      const emailSlug =
        cleanedName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '')
          .slice(0, 30) + '@workflowhub.com'
      const isLead = employeeCount < 0 // no leads get passwords by default; admin manages logins
      const user = await db.user.create({
        data: {
          email: emailSlug,
          name: cleanedName,
          passwordHash: hashPassword('emp123'),
          role: 'employee',
          categorySkills: JSON.stringify(skillCat ? [skillCat.id] : []),
          departmentId: dept.id,
          branchId: headOffice.id,
          jobTitle: `${deptName} Team`,
          active: true,
        },
      })
      if (!deptLeads[deptName]) {
        deptLeads[deptName] = { email: emailSlug, name: cleanedName }
      }
      employeeCount++
    }
  }
  console.log(`Imported ${employeeCount} employees across ${Object.keys(EMPLOYEES).length} departments`)

  // Settings singleton (with renewal + follow-up defaults)
  await db.setting.create({
    data: {
      id: 'singleton',
      renewalAlertDays: '30,14,7,1',
      defaultFollowUpHours: 48,
      escalationOverdueHours: 72,
    },
  })

  // Helper to find an employee by name (for task assignment)
  async function findEmployeeByName(name: string) {
    return db.user.findFirst({
      where: { name: { contains: name }, role: 'employee' },
    })
  }

  // Date helpers
  const now = new Date()
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000)
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000)
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000)
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

  // Pick assignees from the imported employees
  const asha = await findEmployeeByName('Ridhik Santhosh') // Digital team
  const raj = await findEmployeeByName('Rahul Kumar Yadav') // IT
  const liz = await findEmployeeByName('Sreelal') // Digital
  const john = await findEmployeeByName('Abdul Kader Keloth') // Finance
  // Fallbacks to admin if not found
  const ashaId = asha?.id ?? admin.id
  const rajId = raj?.id ?? admin.id
  const lizId = liz?.id ?? admin.id
  const johnId = john?.id ?? admin.id

  type TaskInput = {
    title: string
    description: string
    categoryName: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    assigneeId: string
    dueDate: Date
    sourceEmailText: string
    sourceSender: string
    createdAt: Date
    branchId?: string
    isRenewal?: boolean
    renewalExpiryDate?: Date
    renewalProvider?: string
    followUpFrequencyHours?: number
  }

  async function createTask(input: TaskInput) {
    const category = catByName[input.categoryName]
    const assignee = await db.user.findUnique({ where: { id: input.assigneeId } })
    const task = await db.task.create({
      data: {
        title: input.title,
        description: input.description,
        categoryId: category.id,
        priority: input.priority,
        status: 'assigned',
        assigneeId: input.assigneeId,
        createdById: admin.id,
        branchId: input.branchId ?? headOffice.id,
        sourceEmailText: input.sourceEmailText,
        sourceSender: input.sourceSender,
        replySent: true,
        dueDate: input.dueDate,
        isRenewal: input.isRenewal ?? false,
        renewalExpiryDate: input.renewalExpiryDate ?? null,
        renewalProvider: input.renewalProvider ?? null,
        followUpFrequencyHours: input.followUpFrequencyHours ?? 48,
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
          content: `Assigned to ${assignee?.name ?? 'employee'}`,
          createdAt: new Date(input.createdAt.getTime() + 60000),
        },
      ],
    })
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

  // ─── The 10 real tasks ───

  // 1. Inventory / BOM Issue → Inventory Management, High → Inventory dept employee
  const inventoryEmp = await findEmployeeByName('Muhammad Sajeer')
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
    categoryName: 'Inventory Management',
    priority: 'high',
    assigneeId: inventoryEmp?.id ?? ashaId,
    dueDate: daysFromNow(1),
    sourceEmailText:
      'From: Re: [External]Re: Product master configuration correcting… (Daima)',
    sourceSender: 'Daima (via Outlook)',
    createdAt: hoursAgo(5),
    followUpFrequencyHours: 24,
  })

  // 2. Network / POS Machine Issues → Store Support, High → Digital dept (Rashid)
  const rashid = await findEmployeeByName('Rashid Othayoth')
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
    categoryName: 'Store Support',
    priority: 'high',
    assigneeId: rashid?.id ?? rajId,
    dueDate: daysFromNow(1),
    sourceEmailText: 'From: FW: NETWORK MACHINE ERROR',
    sourceSender: 'Store (via Outlook)',
    createdAt: hoursAgo(4),
    branchId: branches[3].id, // Rahmania Mall Store
    followUpFrequencyHours: 24,
  })

  // 3. Website Enhancement → Digital & E-Commerce, Medium → Digital dept
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
    categoryName: 'Digital & E-Commerce',
    priority: 'medium',
    assigneeId: lizId,
    dueDate: daysFromNow(3),
    sourceEmailText: 'From: Re: Website Enhancement Support – Netsolutions',
    sourceSender: 'NetSolutions (via Outlook)',
    createdAt: hoursAgo(8),
    followUpFrequencyHours: 48,
  })

  // 4. Noon's Dubai Mall Digital → Digital & E-Commerce, Low → Rashid
  await createTask({
    title: "Noon's Dubai Mall Digital — onboarding follow-up",
    description: `From: Re: Invitation Letter - Dubai Mall Digital (Launch of Oud)

Tasks:
• Review email content
• Follow up with Rashid Othayoth
• Progress onboarding / seller portal access discussion`,
    categoryName: 'Digital & E-Commerce',
    priority: 'low',
    assigneeId: rashid?.id ?? lizId,
    dueDate: daysFromNow(7),
    sourceEmailText: "From: Re: Invitation Letter - Dubai Mall Digital",
    sourceSender: 'Noon (via Outlook)',
    createdAt: hoursAgo(20),
    followUpFrequencyHours: 72,
  })

  // 5. Tabby Case → Online Payments, Medium → Finance dept
  await createTask({
    title: 'Tabby — restore Fabian access & fix payment visibility',
    description: `From: Re: Missing Fabian Access on Tabby Portal

Tasks:
• Follow up with Mayar Elsayed if issue still unresolved
• Ensure:
  - Missing Fabian account is restored
  - Payment visibility issue is fixed`,
    categoryName: 'Online Payments',
    priority: 'medium',
    assigneeId: johnId,
    dueDate: daysFromNow(2),
    sourceEmailText: 'From: Re: Missing Fabian Access on Tabby Portal',
    sourceSender: 'Tabby (via Outlook)',
    createdAt: hoursAgo(6),
    followUpFrequencyHours: 48,
  })

  // 6. Share Tabby Payout → Online Payments, Medium → Finance dept
  await createTask({
    title: 'Share Tabby payout details with Mayar',
    description: `From: Fw: You're getting a payout from Tabby

Task:
• Share attachment with Mayer (Mayar)`,
    categoryName: 'Online Payments',
    priority: 'medium',
    assigneeId: johnId,
    dueDate: daysFromNow(2),
    sourceEmailText: "From: Fw: You're getting a payout from Tabby",
    sourceSender: 'Tabby (via Outlook)',
    createdAt: hoursAgo(3),
    followUpFrequencyHours: 24,
  })

  // 7. Security Alert → IT Support, Urgent → IT dept
  await createTask({
    title: 'CRITICAL: Security alert for flowerdistrictmarketing@gmail.com',
    description: `From: [External]Security alert for flowerdistrictmarketing@gmail.com

URGENT — potential account compromise.

Tasks:
• Verify account activity (urgent)
• If not recognized:
  - Remove your recovery email
  - Secure the account immediately`,
    categoryName: 'IT Support',
    priority: 'urgent',
    assigneeId: rajId,
    dueDate: hoursFromNow(4),
    sourceEmailText: 'From: [External]Security alert for flowerdistrictmarketing@gmail.com',
    sourceSender: 'Google Security (via Outlook)',
    createdAt: hoursAgo(2),
    branchId: branches[2].id, // Flower District Marketing
    followUpFrequencyHours: 4,
  })

  // 8. Renewal Notice – Hosting / SSL → IT Support, High → IT dept
  // This is a RENEWAL task — triggers the renewal alert system
  await createTask({
    title: 'Renew domain / SSL for karjistore.com before 11 July 2026 expiry',
    description: `From: Fw: Renewal Notice from Megh Technologies

Tasks:
• Renew before expiry:
  - Domain / SSL for karjistore.com (expiry: 11 July 2026)
• Coordinate payment / approval`,
    categoryName: 'IT Support',
    priority: 'high',
    assigneeId: rajId,
    dueDate: new Date('2026-07-11T23:59:59Z'),
    sourceEmailText: 'From: Fw: Renewal Notice from Megh Technologies',
    sourceSender: 'Megh Technologies (via Outlook)',
    createdAt: hoursAgo(10),
    branchId: branches[1].id, // Karji Store
    isRenewal: true,
    renewalExpiryDate: new Date('2026-07-11T23:59:59Z'),
    renewalProvider: 'Megh Technologies',
    followUpFrequencyHours: 168, // weekly follow-up for renewals
  })

  // 9. Network / Payment Terminal Hardware → Online Payments, Medium → Finance
  await createTask({
    title: 'Payment terminal hardware issue — device replacement & touch fix',
    description: `From: RE: Payment terminal hardware issue

Tasks:
• Follow up with Network provider
• Track:
  - Device replacement request
  - APK-related touch issue resolution`,
    categoryName: 'Online Payments',
    priority: 'medium',
    assigneeId: johnId,
    dueDate: daysFromNow(3),
    sourceEmailText: 'From: RE: Payment terminal hardware issue',
    sourceSender: 'Network provider (via Outlook)',
    createdAt: hoursAgo(12),
    followUpFrequencyHours: 48,
  })

  // 10. Marketing / Website Tasks → Digital & E-Commerce, Low → Digital
  await createTask({
    title: 'NEYDO UAE Launch — verify supplier & banner reviews',
    description: `From: NEYDO - Launch in UAE

Tasks (verify completion):
• Confirm:
  - Supplier updated
  - Brand page banners checked/reviewed

Indirect involvement — verify previously requested items are done.`,
    categoryName: 'Digital & E-Commerce',
    priority: 'low',
    assigneeId: lizId,
    dueDate: daysFromNow(7),
    sourceEmailText: 'From: NEYDO - Launch in UAE',
    sourceSender: 'NEYDO (via Outlook)',
    createdAt: daysAgo(1),
    followUpFrequencyHours: 72,
  })

  // Add a second renewal task to demonstrate the renewal system (web hosting renewal in 20 days)
  await createTask({
    title: 'Web hosting renewal — flowerdistrictmarketing.com (annual)',
    description: `Annual web hosting renewal for flowerdistrictmarketing.com.

Tasks:
• Confirm renewal with hosting provider
• Process payment before expiry
• Update billing records`,
    categoryName: 'IT Support',
    priority: 'medium',
    assigneeId: rajId,
    dueDate: daysFromNow(20),
    sourceEmailText: 'Hosting renewal reminder',
    sourceSender: 'Hosting Provider',
    createdAt: hoursAgo(1),
    branchId: branches[2].id,
    isRenewal: true,
    renewalExpiryDate: daysFromNow(20),
    renewalProvider: 'Hosting Provider',
    followUpFrequencyHours: 168,
  })

  // Add an admin notification for the critical security task
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

  console.log('Seed complete.')
  console.log(`  ${departments.length} departments`)
  console.log(`  ${branches.length} branches/entities`)
  console.log(`  ${categories.length} categories (4 work + 7 department-based)`)
  console.log(`  1 admin + ${employeeCount} employees`)
  console.log(`  ${allTasks.length} tasks (incl. 2 renewal tasks)`)
  console.log('')
  console.log('Login credentials:')
  console.log('  Admin: admin@workflowhub.com / admin123')
  console.log('  Any employee: <firstname>.<lastname>@workflowhub.com / emp123')
  console.log('    e.g. rahul.kumar.yadav@workflowhub.com / emp123')
  console.log('         ridhik.santhosh@workflowhub.com / emp123')
  console.log('         muhammad.sajeer@workflowhub.com / emp123')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
