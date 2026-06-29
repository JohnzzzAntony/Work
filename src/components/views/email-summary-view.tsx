'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  PRIORITIES,
  PRIORITY_META,
  type CategoryDTO,
  type EmailSummaryAnalyzeResponse,
  type ParsedTask,
  type Priority,
  type UserDTO,
} from '@/lib/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type EditableTask = ParsedTask & {
  selected: boolean
}

export function EmailSummaryView() {
  const setView = useAppStore((s) => s.setView)

  const [rawText, setRawText] = React.useState('')
  const [analyzing, setAnalyzing] = React.useState(false)
  const [tasks, setTasks] = React.useState<EditableTask[]>([])
  const [hasResults, setHasResults] = React.useState(false)
  const [creating, setCreating] = React.useState(false)

  // Reference data
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [users, setUsers] = React.useState<UserDTO[]>([])

  React.useEffect(() => {
    void apiFetch<CategoryDTO[]>('/api/categories').then(setCategories).catch(() => {})
    void apiFetch<UserDTO[]>('/api/users').then(setUsers).catch(() => {})
  }, [])

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      setRawText(text)
      toast.success('Pasted from clipboard')
    } catch {
      toast.error('Could not read clipboard — paste manually')
    }
  }

  async function handleAnalyze() {
    if (!rawText.trim()) {
      toast.error('Please paste the email summary first.')
      return
    }
    setAnalyzing(true)
    setHasResults(false)
    try {
      const res = await apiFetch<EmailSummaryAnalyzeResponse>(
        '/api/email/analyze-summary',
        {
          method: 'POST',
          body: JSON.stringify({ text: rawText }),
        }
      )
      const enriched: EditableTask[] = (res.tasks || []).map((t) => ({
        ...t,
        selected: true,
      }))
      if (enriched.length === 0) {
        toast.info('No actionable tasks detected in the text.')
      } else {
        toast.success(`Found ${enriched.length} task${enriched.length === 1 ? '' : 's'}`)
      }
      setTasks(enriched)
      setHasResults(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateTask(idx: number, patch: Partial<EditableTask>) {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  function removeTask(idx: number) {
    setTasks((prev) => prev.filter((_, i) => i !== idx))
  }

  function reset() {
    setRawText('')
    setTasks([])
    setHasResults(false)
  }

  const selectedTasks = tasks.filter((t) => t.selected)

  async function handleCreateAll() {
    if (selectedTasks.length === 0) {
      toast.error('Select at least one task to create.')
      return
    }
    setCreating(true)
    try {
      const payload = selectedTasks.map((t) => ({
        title: t.title,
        categoryId: t.categoryId,
        priority: t.priority,
        description: t.description,
        dueDate: t.dueDate || undefined,
        assigneeId: t.suggestedAssigneeId,
        sourceEmailText: rawText,
        sourceSender: 'Email summary digest',
      }))
      const res = await apiFetch<{ count: number }>('/api/tasks/bulk', {
        method: 'POST',
        body: JSON.stringify({ tasks: payload, autoAssign: true }),
      })
      toast.success(`Created ${res.count} task${res.count === 1 ? '' : 's'} on the board`)
      reset()
      setView('board')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tasks')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Email Summary → Tasks
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a full email digest or summary — AI extracts every task and auto-assigns each to the right employee.
          </p>
        </div>
        {hasResults && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <ArrowLeft className="size-4" />
            Start over
          </Button>
        )}
      </div>

      {/* Input step */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                Paste Your Email Analysis / Summary
              </CardTitle>
              <CardDescription className="mt-1">
                Paste the full content of your email summary, digest, or thread. The AI will identify every distinct task, categorize it, set priority, and suggest an assignee.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handlePasteFromClipboard()}
              disabled={!!hasResults}
            >
              <ClipboardPaste className="size-3.5" />
              Paste
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            placeholder={
              'Paste your full email summary here. For example:\n\n' +
              '1. Inventory / BOM Issue (Daima)\nFrom: Re: Product master configuration...\nTasks:\n• Follow up with TSC for root cause analysis\n• Request timeline from vendor\n...\n\n' +
              '2. Network / POS Machine Issues\nFrom: FW: NETWORK MACHINE ERROR\nTasks:\n• Investigate Z report + device issue\n...\n\nThe AI will parse this into separate tasks on the board.'
            }
            disabled={hasResults}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {rawText.length.toLocaleString()} characters
            </p>
            <Button
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !rawText.trim() || hasResults}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing… (10–20s)
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Analyze &amp; Extract Tasks
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {analyzing && !hasResults && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 w-full rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Results step */}
      {hasResults && tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Summary bar */}
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      {tasks.length} task{tasks.length === 1 ? '' : 's'} extracted
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      {selectedTasks.length} selected for creation • Review &amp; edit below
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTasks((prev) =>
                        prev.map((t) => ({ ...t, selected: !prev.every((x) => x.selected) }))
                      )
                    }
                  >
                    {tasks.every((t) => t.selected) ? 'Deselect all' : 'Select all'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task cards */}
          {tasks.map((task, idx) => {
            const meta = PRIORITY_META[task.priority]
            const category = categories.find((c) => c.id === task.categoryId)
            return (
              <TaskCard
                key={idx}
                task={task}
                idx={idx}
                meta={meta}
                categoryName={category?.name ?? task.category}
                categoryColor={category?.color ?? '#6b7280'}
                categories={categories}
                users={users}
                onUpdate={updateTask}
                onRemove={removeTask}
              />
            )
          })}

          {/* Create all */}
          <Card className="sticky bottom-4 shadow-lg">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'} ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Each will be auto-assigned &amp; added to the Work Board.
                  </p>
                </div>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void handleCreateAll()}
                  disabled={creating || selectedTasks.length === 0}
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Create {selectedTasks.length} Task{selectedTasks.length === 1 ? '' : 's'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty results */}
      {hasResults && tasks.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No actionable tasks were detected. Try pasting more detail or rephrasing.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TaskCard({
  task,
  idx,
  meta,
  categoryName,
  categoryColor,
  categories,
  users,
  onUpdate,
  onRemove,
}: {
  task: EditableTask
  idx: number
  meta: { label: string; badgeClass: string; dotClass: string }
  categoryName: string
  categoryColor: string
  categories: CategoryDTO[]
  users: UserDTO[]
  onUpdate: (idx: number, patch: Partial<EditableTask>) => void
  onRemove: (idx: number) => void
}) {
  const skilledAssignees = users.filter(
    (u) => u.role === 'employee' && u.active && u.categorySkills.includes(task.categoryId)
  )
  const otherAssignees = users.filter(
    (u) => u.role === 'employee' && u.active && !u.categorySkills.includes(task.categoryId)
  )
  const orderedAssignees = [...skilledAssignees, ...otherAssignees]

  return (
    <Card
      className={cn(
        'transition-opacity',
        !task.selected && 'opacity-50'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={() => onUpdate(idx, { selected: !task.selected })}
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                task.selected
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 dark:border-slate-600'
              )}
              aria-label={task.selected ? 'Deselect task' : 'Select task'}
            >
              {task.selected && <CheckCircle2 className="size-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                <Wand2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              </CardTitle>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-red-600"
            onClick={() => onRemove(idx)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Task title</Label>
          <Input
            value={task.title}
            onChange={(e) => onUpdate(idx, { title: e.target.value })}
            className="font-medium"
          />
        </div>

        {/* Category + Priority + Due date + Assignee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor }}
              />
              <Select
                value={task.categoryId}
                onValueChange={(v) => {
                  const cat = categories.find((c) => c.id === v)
                  onUpdate(idx, {
                    categoryId: v,
                    category: cat?.name ?? task.category,
                  })
                }}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Priority</Label>
            <Select
              value={task.priority}
              onValueChange={(v) => onUpdate(idx, { priority: v as Priority })}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Due date</Label>
            <Input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) =>
                onUpdate(idx, {
                  dueDate: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                })
              }
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <UserCheck className="size-3" />
              Assignee
            </Label>
            <Select
              value={task.suggestedAssigneeId ?? 'none'}
              onValueChange={(v) => {
                const user = users.find((u) => u.id === v)
                onUpdate(idx, {
                  suggestedAssigneeId: v === 'none' ? null : v,
                  suggestedAssigneeName: v === 'none' ? null : user?.name ?? null,
                })
              }}
            >
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {orderedAssignees.map((u) => {
                  const skilled = u.categorySkills.includes(task.categoryId)
                  return (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {skilled ? '★' : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-xs', meta.badgeClass)}>
            <span className={cn('size-1.5 rounded-full mr-1', meta.dotClass)} />
            {meta.label}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
              borderColor: `${categoryColor}40`,
            }}
          >
            {categoryName}
          </Badge>
          {task.suggestedAssigneeName && (
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
              <UserCheck className="size-3 mr-1" />
              {task.suggestedAssigneeName}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description (includes sub-tasks &amp; context)</Label>
          <Textarea
            value={task.description}
            onChange={(e) => onUpdate(idx, { description: e.target.value })}
            rows={Math.min(10, Math.max(3, task.description.split('\n').length + 1))}
            className="text-xs font-mono leading-relaxed"
          />
        </div>
      </CardContent>
    </Card>
  )
}
