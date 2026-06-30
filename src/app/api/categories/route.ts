import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { CategoryDTO } from '@/lib/types'

const CATEGORY_INCLUDE = {
  department: { select: { id: true, name: true } },
} as const

function categoryToDTO(c: {
  id: string
  name: string
  color: string
  departmentId: string | null
  department: { name: string } | null
}): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    departmentId: c.departmentId,
    departmentName: c.department?.name ?? null,
  }
}

export async function GET() {
  try {
    await requireUser()
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      include: CATEGORY_INCLUDE,
    })
    const dto: CategoryDTO[] = categories.map(categoryToDTO)
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return jsonError('name is required', 400)
    }
    const name = body.name.trim()
    const existing = await db.category.findUnique({ where: { name } })
    if (existing) {
      return jsonError('A category with that name already exists', 400)
    }

    const data: Record<string, unknown> = {
      name,
      color: typeof body.color === 'string' && body.color.trim().length > 0 ? body.color : '#6b7280',
    }

    if (typeof body.departmentId === 'string' && body.departmentId.length > 0) {
      const dept = await db.department.findUnique({ where: { id: body.departmentId } })
      if (!dept) return jsonError('departmentId does not exist', 400)
      data.departmentId = body.departmentId
    }

    const created = await db.category.create({
      data: data as Parameters<typeof db.category.create>[0]['data'],
      include: CATEGORY_INCLUDE,
    })
    return NextResponse.json(categoryToDTO(created), { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
