'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from '@dnd-kit/core'
import { useSortable, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, isToday, parseISO } from 'date-fns'
import {
  AlertCircle,
  Landmark,
  LayoutGrid,
  List,
  RefreshCw,
  RotateCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { CategoryBadge, PriorityBadge, StatusBadge, UserAvatar, OverduePill } from '@/components/ui-badges'
import { RenewalBadge, isRenewalSoonOrExpired } from '@/components/renewal-badge'
import { apiFetch, ApiError } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  KANBAN_COLUMNS,
  PRIORITIES,
  STATUS_META,
  type CategoryDTO,
  type Priority,
  type TaskDTO,
  type UserDTO,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Filters = {
  categoryId: string
  assigneeId: string
  priority: string
  q: string
  isRenewal: boolean
}

export function BoardView() {
  const user = useAppStore((s) => s.user)
  const openTask = useAppStore((s) => s.openTask)
  const isAdmin = user?.role === 'admin'

  const [view, setView] = React.useState<'board' | 'list'>('board')
  const [tasks, setTasks] = React.useState<TaskDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filters, setFilters] = React.useState<Filters>({
    categoryId: 'all',
    assigneeId: 'all',
    priority: 'all',
    q: '',
    isRenewal: false,
  })
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [users, setUsers] = React.useState<UserDTO[]>([])

  // Load categories and users (admin only) once
  React.useEffect(() => {
    void apiFetch<CategoryDTO[]>('/api/categories').then(setCategories).catch(() => {})
    if (isAdmin) {
      void apiFetch<UserDTO[]>('/api/users').then(setUsers).catch(() => {})
    }
  }, [isAdmin])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.categoryId !== 'all') params.set('categoryId', filters.categoryId)
      if (isAdmin && filters.assigneeId !== 'all') params.set('assigneeId', filters.assigneeId)
      if (filters.priority !== 'all') params.set('priority', filters.priority)
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (filters.isRenewal) params.set('isRenewal', 'true')
      const qs = params.toString()
      const url = `/api/tasks${qs ? `?${qs}` : ''}`
      const data = await apiFetch<TaskDTO[]>(url)
      setTasks(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [filters, isAdmin])

  React.useEffect(() => {
    void load()
  }, [load])

  // DnD state
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeTask = tasks.find((t) => t.id === activeId) || null

  async function handleDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id)
    const overId = e.over?.id ? String(e.over.id) : null
    setActiveId(null)
    if (!overId) return
    // The over target is a column id (status) — or a card id, in which case find its column
    let newStatus: string | null = null
    if (KANBAN_COLUMNS.includes(overId as (typeof KANBAN_COLUMNS)[number])) {
      newStatus = overId
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (overTask) newStatus = overTask.status
    }
    if (!newStatus) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistic update
    const prev = tasks
    setTasks((curr) =>
      curr.map((t) => (t.id === taskId ? { ...t, status: newStatus as TaskDTO['status'] } : t))
    )
    try {
      await apiFetch<TaskDTO>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(`Moved to ${STATUS_META[newStatus as keyof typeof STATUS_META]?.label ?? newStatus}`)
    } catch (err) {
      setTasks(prev)
      const msg = err instanceof ApiError ? err.message : 'Failed to move task'
      toast.error(msg)
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Work Board
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'All tasks across the team' : 'Your assigned and created tasks'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')}>
            <TabsList>
              <TabsTrigger value="board">
                <LayoutGrid className="size-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="size-4" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks…"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                className="pl-8"
              />
            </div>
            <Select
              value={filters.categoryId}
              onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v }))}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select
                value={filters.assigneeId}
                onValueChange={(v) => setFilters((f) => ({ ...f, assigneeId: v }))}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={filters.priority}
              onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label
              className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
              title="Show only renewal tasks"
            >
              <Checkbox
                checked={filters.isRenewal}
                onCheckedChange={(v) => setFilters((f) => ({ ...f, isRenewal: v === true }))}
              />
              <span className="flex items-center gap-1">
                <RotateCw className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Renewals only
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        view === 'board' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {KANBAN_COLUMNS.map((c) => (
              <div key={c} className="space-y-2">
                <Skeleton className="h-8 w-full" />
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
        )
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <AlertCircle className="size-5" />
            </span>
            <p className="text-sm font-medium">No tasks found</p>
            <p className="text-xs text-muted-foreground">
              Try changing filters, or create a new task from an email.
            </p>
          </CardContent>
        </Card>
      ) : view === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {KANBAN_COLUMNS.map((status) => {
              const columnTasks = tasks.filter((t) => t.status === status)
              const meta = STATUS_META[status]
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={columnTasks}
                  meta={meta}
                  onOpenTask={openTask}
                />
              )
            })}
          </div>
          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} dragging onClick={() => {}} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden sm:table-cell">Assignee</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden xl:table-cell">Branch</TableHead>
                  <TableHead className="hidden lg:table-cell">Due</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const due = t.dueDate ? parseISO(t.dueDate) : null
                  const overdue = due && isPast(due) && !isToday(due) && t.status !== 'done' && t.status !== 'closed'
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => openTask(t.id)}
                    >
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{t.title}</span>
                          {t.isRenewal && (
                            <RenewalBadge
                              renewalExpiryDate={t.renewalExpiryDate}
                              variant="compact"
                              className="shrink-0"
                            />
                          )}
                          {t.commentCount ? (
                            <span className="hidden sm:inline-flex shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {t.commentCount} 💬
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <CategoryBadge
                          category={{ name: t.categoryName, color: t.categoryColor }}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {t.assigneeName ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={t.assigneeName} size="sm" />
                            <span className="text-sm truncate max-w-[120px]">{t.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {t.branchName ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Landmark className="size-3" />
                            {t.branchName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {due ? (
                          <span className={cn(overdue && 'text-red-600 dark:text-red-400 font-medium')}>
                            {format(due, 'MMM d')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(parseISO(t.createdAt), 'MMM d')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KanbanColumn({
  status,
  tasks,
  meta,
  onOpenTask,
}: {
  status: string
  tasks: TaskDTO[]
  meta: { label: string; badgeClass: string; dotClass: string }
  onOpenTask: (id: string) => void
}) {
  const { setNodeRef, isOver } = useColumnDroppable(status)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border bg-slate-50/60 dark:bg-slate-900/40 transition-colors min-h-[120px]',
        isOver && 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30'
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', meta.dotClass)} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{meta.label}</span>
        </div>
        <span className="text-xs font-semibold text-muted-foreground rounded-full bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => onOpenTask(t.id)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}

// Column droppable: each column is registered as a droppable with id = the status string
function useColumnDroppable(id: string) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'column', status: id },
  })
  return { setNodeRef, isOver }
}

function TaskCard({
  task,
  onClick,
  dragging,
}: {
  task: TaskDTO
  onClick: () => void
  dragging?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', status: task.status } })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const due = task.dueDate ? parseISO(task.dueDate) : null
  const overdue = due && isPast(due) && !isToday(due) && task.status !== 'done' && task.status !== 'closed'
  const dueToday = due && isToday(due) && task.status !== 'done' && task.status !== 'closed'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950',
        (isDragging || dragging) && 'opacity-50 shadow-lg ring-2 ring-emerald-400',
        !dragging && 'cursor-pointer'
      )}
      onClick={(e) => {
        // ignore clicks that originated from the drag handle area
        const target = e.target as HTMLElement
        if (target.closest('[data-drag-handle]')) return
        onClick()
      }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug line-clamp-2 text-slate-900 dark:text-slate-100">
          {task.title}
        </p>
        {task.isRenewal && (
          <RenewalBadge
            renewalExpiryDate={task.renewalExpiryDate}
            variant="compact"
            className="shrink-0"
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={{ name: task.categoryName, color: task.categoryColor }} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5">
              <UserAvatar name={task.assigneeName} size="sm" />
              <span className="text-xs text-muted-foreground truncate max-w-[90px]">
                {task.assigneeName}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
          )}
        </div>
        {due && (
          <div className="flex items-center gap-1 text-[11px]">
            {overdue ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <AlertCircle className="size-3" />
                {format(due, 'MMM d')}
              </span>
            ) : dueToday ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="size-3" />
                Today
              </span>
            ) : (
              <span className="text-muted-foreground">{format(due, 'MMM d')}</span>
            )}
          </div>
        )}
      </div>
      {(task.branchName || (task.isRenewal && isRenewalSoonOrExpired(task.renewalExpiryDate))) && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {task.branchName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Landmark className="size-3" />
              {task.branchName}
            </span>
          )}
          {task.isRenewal && isRenewalSoonOrExpired(task.renewalExpiryDate) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium">
              <RotateCw className="size-3" />
              {task.renewalExpiryDate
                ? `Expires ${format(parseISO(task.renewalExpiryDate), 'MMM d')}`
                : 'Expires soon'}
            </span>
          )}
        </div>
      )}
      {task.commentCount ? (
        <div className="absolute top-2 right-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-0.5">
          {task.commentCount} 💬
        </div>
      ) : null}
    </div>
  )
}
