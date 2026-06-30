import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import { runFollowUps } from '@/lib/followup-engine'

export async function POST(request: Request) {
  try {
    await requireCronOrAdmin(request)
    const created = await runFollowUps()
    return NextResponse.json({ ok: true, created })
  } catch (err) {
    return apiCatch(err)
  }
}
