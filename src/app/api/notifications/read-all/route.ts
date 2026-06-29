import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'

export async function POST() {
  try {
    const currentUser = await requireUser()
    const result = await db.notification.updateMany({
      where: { userId: currentUser.id, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true, count: result.count })
  } catch (err) {
    return apiCatch(err)
  }
}
