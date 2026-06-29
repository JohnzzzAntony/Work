'use client'

import * as React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  PRIORITY_META,
  STATUS_META,
  type Priority,
  type TaskStatus,
  type CategoryDTO,
} from '@/lib/types'

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority]
  if (!meta) return null
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, 'border', className)}>
      <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
      {meta.label}
    </Badge>
  )
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, 'border', className)}>
      <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
      {meta.label}
    </Badge>
  )
}

export function CategoryBadge({
  category,
  className,
}: {
  category: Pick<CategoryDTO, 'name' | 'color'> | null | undefined
  className?: string
}) {
  if (!category) return null
  return (
    <Badge
      variant="outline"
      className={cn('border', className)}
      style={{
        backgroundColor: `${category.color}1a`,
        color: category.color,
        borderColor: `${category.color}40`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      {category.name}
    </Badge>
  )
}

export function CategoryPill({
  category,
  count,
  className,
  onClick,
}: {
  category: Pick<CategoryDTO, 'name' | 'color'>
  count?: number
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        onClick && 'hover:opacity-80',
        className
      )}
      style={{
        backgroundColor: `${category.color}14`,
        color: category.color,
        borderColor: `${category.color}40`,
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      {category.name}
      {typeof count === 'number' && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${category.color}26`, color: category.color }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function initials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({
  name,
  size = 'sm',
  className,
}: {
  name: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass =
    size === 'lg' ? 'size-10 text-sm' : size === 'md' ? 'size-8 text-xs' : 'size-7 text-[10px]'
  const display = initials(name || '')
  return (
    <Avatar className={cn(sizeClass, className)}>
      <AvatarFallback
        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold"
      >
        {display}
      </AvatarFallback>
    </Avatar>
  )
}

export function OverduePill({ dueDate }: { dueDate: string | null | undefined }) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  const now = new Date()
  const isPast = d.getTime() < now.getTime()
  if (!isPast) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
      Overdue
    </span>
  )
}
