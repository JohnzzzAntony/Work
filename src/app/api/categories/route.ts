import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { apiCatch } from '@/lib/api-helpers'
import type { CategoryDTO } from '@/lib/types'

export async function GET() {
  try {
    await requireUser()
    const categories = await db.category.findMany({ orderBy: { name: 'asc' } })
    const dto: CategoryDTO[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }))
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}
