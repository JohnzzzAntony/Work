import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiCatch, jsonError } from '@/lib/api-helpers'
import type { CategoryDTO } from '@/lib/types'

const CATEGORY_INCLUDE = {
  department: { select: { name: true } },
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
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) return jsonError('Category not found', 404)

    const data: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      const name = body.name.trim()
      if (name !== existing.name) {
        const conflict = await db.category.findUnique({ where: { name } })
        if (conflict && conflict.id !== id) {
          return jsonError('A category with that name already exists', 400)
        }
        data.name = name
      }
    }
    if (typeof body.color === 'string' && body.color.trim().length > 0) {
      data.color = body.color
    }

    if (body.departmentId !== undefined) {
      if (typeof body.departmentId === 'string' && body.departmentId.length > 0) {
        const dept = await db.department.findUnique({ where: { id: body.departmentId } })
        if (!dept) return jsonError('departmentId does not exist', 400)
        data.departmentId = body.departmentId
      } else {
        data.departmentId = null
      }
    }

    const updated = await db.category.update({
      where: { id },
      data: data as Parameters<typeof db.category.update>[0]['data'],
      include: CATEGORY_INCLUDE,
    })
    return NextResponse.json(categoryToDTO(updated))
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
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) return jsonError('Category not found', 404)

    const taskCount = await db.task.count({ where: { categoryId: id } })
    if (taskCount > 0) {
      return jsonError(
        `Cannot delete category "${existing.name}" — ${taskCount} task(s) still use it. Reassign those tasks first.`,
        400,
      )
    }

    await db.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiCatch(err)
  }
}
