import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { DepartmentDTO } from '@/lib/types'

export async function GET() {
  try {
    await requireUser()
    const departments = await db.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: { where: { active: true } },
          },
        },
      },
    })
    const dto: DepartmentDTO[] = departments.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      createdAt: d.createdAt.toISOString(),
      employeeCount: d._count.users,
    }))
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
    const existing = await db.department.findUnique({ where: { name } })
    if (existing) {
      return jsonError('A department with that name already exists', 400)
    }
    const color =
      typeof body.color === 'string' && body.color.trim().length > 0
        ? body.color
        : '#64748b'
    const created = await db.department.create({ data: { name, color } })
    const dto: DepartmentDTO = {
      id: created.id,
      name: created.name,
      color: created.color,
      createdAt: created.createdAt.toISOString(),
      employeeCount: 0,
    }
    return NextResponse.json(dto, { status: 201 })
  } catch (err) {
    return apiCatch(err)
  }
}
