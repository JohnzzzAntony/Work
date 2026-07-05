import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Clearing all tasks, comments, notifications, follow-ups, and activity logs...')
  await db.notification.deleteMany()
  await db.followUp.deleteMany()
  await db.comment.deleteMany()
  await db.activityLog.deleteMany()
  await db.task.deleteMany()
  console.log('All task-related data cleared successfully.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
