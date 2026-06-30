import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { DepartmentDTO } from '@/lib/types'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError('Invalid body', 400)
    }
    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) return jsonError('Department not found', 404)

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      const name = body.name.trim()
      if (name !== existing.name) {
        const conflict = await db.department.findUnique({ where: { name } })
        if (conflict && conflict.id !== id) {
          return jsonError('A department with that name already exists', 400)
        }
        data.name = name
      }
    }
    if (typeof body.color === 'string' && body.color.trim().length > 0) {
      data.color = body.color
    }

    const updated = await db.department.update({
      where: { id },
      data: data as Parameters<typeof db.department.update>[0]['data'],
      include: {
        _count: { select: { users: { where: { active: true } } } },
      },
    })
    const dto: DepartmentDTO = {
      id: updated.id,
      name: updated.name,
      color: updated.color,
      createdAt: updated.createdAt.toISOString(),
      employeeCount: updated._count.users,
    }
    return NextResponse.json(dto)
  } catch (err) {
    return apiCatch(err)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) return jsonError('Department not found', 404)

    const userCount = await db.user.count({
      where: { departmentId: id },
    })
    if (userCount > 0) {
      return jsonError(
        `Cannot delete department "${existing.name}" — ${userCount} user(s) are still assigned. Reassign them to another department first.`,
        400,
      )
    }

    // Detach any categories that referenced this department, then delete.
    await db.category.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    })
    await db.department.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
