'use client'

import * as React from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Delete as DeleteIcon,
  History,
  Landmark,
  Loader2,
  Mail,
  MessageSquare,
  RotateCw,
  Send,
  ShieldCheck,
  User as UserIcon,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  CategoryBadge,
  PriorityBadge,
  StatusBadge,
  UserAvatar,
} from '@/components/ui-badges'
import { RenewalBadge } from '@/components/renewal-badge'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  PRIORITIES,
  STATUSES,
  STATUS_META,
  type BranchDTO,
  type CategoryDTO,
  type FollowUpDTO,
  type TaskDetailDTO,
  type UserDTO,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function TaskDetailView() {
  const user = useAppStore((s) => s.user)
  const taskId = useAppStore((s) => s.currentTaskId)
  const setView = useAppStore((s) => s.setView)
  const isAdmin = user?.role === 'admin'

  const [task, setTask] = React.useState<TaskDetailDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [users, setUsers] = React.useState<UserDTO[]>([])
  const [branches, setBranches] = React.useState<BranchDTO[]>([])
  const [sendingFollowUp, setSendingFollowUp] = React.useState(false)

  // Editable local fields (synced on save)
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [commentText, setCommentText] = React.useState('')
  const [savingDesc, setSavingDesc] = React.useState(false)
  const [savingTitle, setSavingTitle] = React.useState(false)
  const [postingComment, setPostingComment] = React.useState(false)
  const [replyExpanded, setReplyExpanded] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<TaskDetailDTO>(`/api/tasks/${taskId}`)
      setTask(data)
      setTitle(data.title)
      setDescription(data.description)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  React.useEffect(() => {
    void apiFetch<CategoryDTO[]>('/api/categories').then(setCategories).catch(() => {})
    void apiFetch<UserDTO[]>('/api/users').then(setUsers).catch(() => {})
    void apiFetch<BranchDTO[]>('/api/branches').then(setBranches).catch(() => {})
    void load()
  }, [load])

  async function patchTask(payload: Record<string, unknown>) {
    if (!task) return null
    try {
      const updated = await apiFetch<TaskDetailDTO>(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      // Merge to preserve activity logs / comments unless the response includes them
      setTask((prev) =>
        prev
          ? {
              ...updated,
              activityLogs: updated.activityLogs?.length ? updated.activityLogs : prev.activityLogs,
              comments: updated.comments?.length ? updated.comments : prev.comments,
            }
          : updated
      )
      return updated
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
      return null
    }
  }

  async function handleStatusChange(status: string) {
    const updated = await patchTask({ status })
    if (updated) {
      toast.success(`Status: ${STATUS_META[status as keyof typeof STATUS_META]?.label ?? status}`)
      // Re-fetch to get new activity logs
      void load()
    }
  }

  async function handleAssigneeChange(value: string) {
    const assigneeId = value === 'unassigned' ? '' : value
    const updated = await patchTask({ assigneeId })
    if (updated) {
      toast.success(assigneeId ? 'Task assigned' : 'Task unassigned')
      void load()
    }
  }

  async function handleCategoryChange(categoryId: string) {
    const updated = await patchTask({ categoryId })
    if (updated) {
      toast.success('Category updated')
      void load()
    }
  }

  async function handlePriorityChange(priority: string) {
    const updated = await patchTask({ priority })
    if (updated) {
      toast.success('Priority updated')
      void load()
    }
  }

  async function handleDueDateChange(value: string) {
    const updated = await patchTask({ dueDate: value })
    if (updated) {
      toast.success(value ? 'Due date updated' : 'Due date cleared')
      void load()
    }
  }

  async function handleBranchChange(value: string) {
    const branchId = value === 'none' ? null : value
    const updated = await patchTask({ branchId })
    if (updated) {
      toast.success(branchId ? 'Branch set' : 'Branch cleared')
      void load()
    }
  }

  async function handleRenewalToggle(checked: boolean) {
    const updated = await patchTask({ isRenewal: checked })
    if (updated) {
      toast.success(checked ? 'Marked as renewal task' : 'Renewal flag cleared')
      void load()
    }
  }

  async function handleRenewalExpiryChange(value: string) {
    const updated = await patchTask({ renewalExpiryDate: value || null })
    if (updated) {
      toast.success(value ? 'Renewal expiry updated' : 'Renewal expiry cleared')
      void load()
    }
  }

  async function handleRenewalProviderChange(value: string) {
    const updated = await patchTask({ renewalProvider: value || null })
    if (updated) {
      toast.success('Renewal provider updated')
      void load()
    }
  }

  async function handleFollowUpFrequencyChange(value: string) {
    const hours = value === 'none' ? null : Number(value)
    const updated = await patchTask({ followUpFrequencyHours: hours })
    if (updated) {
      toast.success(hours === null ? 'Follow-ups disabled' : `Follow-up frequency set to ${hours}h`)
      void load()
    }
  }

  async function handleSendFollowUp() {
    if (!task) return
    setSendingFollowUp(true)
    try {
      await apiFetch<{ ok: boolean; followUp: FollowUpDTO }>(
        `/api/tasks/${task.id}/follow-up`,
        { method: 'POST' }
      )
      toast.success('Follow-up sent')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send follow-up')
    } finally {
      setSendingFollowUp(false)
    }
  }

  async function handleSaveTitle() {
    if (!task || title.trim() === task.title) return
    setSavingTitle(true)
    const updated = await patchTask({ title: title.trim() })
    setSavingTitle(false)
    if (updated) toast.success('Title updated')
  }

  async function handleSaveDescription() {
    if (!task) return
    setSavingDesc(true)
    const updated = await patchTask({ description })
    setSavingDesc(false)
    if (updated) toast.success('Description saved')
  }

  async function handlePostComment() {
    if (!task || !commentText.trim()) return
    setPostingComment(true)
    try {
      const created = await apiFetch<{ id: string; userName: string }>(
        `/api/tasks/${task.id}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ body: commentText.trim() }),
        }
      )
      setCommentText('')
      toast.success('Comment posted')
      void load()
      void created
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPostingComment(false)
    }
  }

  async function handleMarkReplySent() {
    const updated = await patchTask({ replySent: true })
    if (updated) {
      toast.success('Reply marked as sent')
      void load()
    }
  }

  async function handleMarkDone() {
    await handleStatusChange('done')
  }

  async function handleVerifyClose() {
    await handleStatusChange('closed')
  }

  async function handleDelete() {
    if (!task) return
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      toast.success('Task deleted')
      setView('board')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function copyReply() {
    if (!task?.generatedReplyText) return
    try {
      await navigator.clipboard.writeText(task.generatedReplyText)
      toast.success('Reply copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (error || !task) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error ?? 'Task not found'}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setView('board')}>
            <ArrowLeft className="size-4" />
            Back to board
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Build a timeline combining activityLogs + comments
  type TimelineItem =
    | { kind: 'log'; id: string; userName: string | null; content: string; createdAt: string; actionType: string }
    | { kind: 'comment'; id: string; userName: string; content: string; createdAt: string }
  const timeline: TimelineItem[] = [
    ...task.activityLogs.map((l) => ({
      kind: 'log' as const,
      id: l.id,
      userName: l.userName,
      content: l.content,
      createdAt: l.createdAt,
      actionType: l.actionType,
    })),
    ...task.comments.map((c) => ({
      kind: 'comment' as const,
      id: c.id,
      userName: c.userName,
      content: c.body,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const canMarkDone =
    (task.assigneeId === user?.id || isAdmin) &&
    ['in_progress', 'in_review', 'blocked', 'assigned'].includes(task.status)
  const canVerifyClose = isAdmin && task.status === 'done'

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setView('board')} className="text-muted-foreground">
          <ArrowLeft className="size-4" />
          Back to board
        </Button>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 hover:border-red-300 dark:border-red-900">
                <DeleteIcon className="size-4" />
                Delete Task
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the task and all its activity, comments and notifications. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => void handleDelete()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Header card */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex items-start gap-2 flex-wrap">
            <Badge variant="outline" className={STATUS_META[task.status].badgeClass}>
              <span className={cn('size-1.5 rounded-full', STATUS_META[task.status].dotClass)} />
              {STATUS_META[task.status].label}
            </Badge>
            <CategoryBadge category={{ name: task.categoryName, color: task.categoryColor }} />
            <PriorityBadge priority={task.priority} />
            {task.isRenewal && (
              <RenewalBadge renewalExpiryDate={task.renewalExpiryDate} />
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Created {format(parseISO(task.createdAt), 'MMM d, yyyy')} by {task.createdByName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-[200px] h-10 text-lg font-semibold border-transparent hover:border-input focus-visible:border-input"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleSaveTitle()}
              disabled={savingTitle || title.trim() === task.title}
            >
              {savingTitle ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save
            </Button>
          </div>

          {/* Inline editable fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={task.status} onValueChange={(v) => void handleStatusChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assignee</Label>
              <Select
                value={task.assigneeId ?? 'unassigned'}
                onValueChange={(v) => void handleAssigneeChange(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={task.categoryId} onValueChange={(v) => void handleCategoryChange(v)}>
                <SelectTrigger className="w-full">
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={task.priority} onValueChange={(v) => void handlePriorityChange(v)}>
                <SelectTrigger className="w-full capitalize">
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
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="size-3" /> Due date
              </Label>
              <Input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => void handleDueDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Landmark className="size-3" /> Branch
              </Label>
              <Select
                value={task.branchId ?? 'none'}
                onValueChange={(v) => void handleBranchChange(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.filter((b) => b.active).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <RotateCw className="size-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-medium">Renewal task</p>
                  <p className="text-xs text-muted-foreground">Track expiry &amp; send renewal alerts.</p>
                </div>
              </div>
              <Switch
                checked={task.isRenewal}
                onCheckedChange={(v) => void handleRenewalToggle(v)}
                aria-label="Mark as renewal task"
              />
            </div>
            {task.isRenewal && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Renewal Expiry</Label>
                  <Input
                    type="date"
                    value={task.renewalExpiryDate ? task.renewalExpiryDate.slice(0, 10) : ''}
                    onChange={(e) => void handleRenewalExpiryChange(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1 lg:col-span-3">
                  <Label className="text-xs text-muted-foreground">Renewal Provider</Label>
                  <Input
                    value={task.renewalProvider ?? ''}
                    onChange={(e) => void handleRenewalProviderChange(e.target.value)}
                    placeholder="e.g. GoDaddy, AWS, Namecheap"
                  />
                </div>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left/main column: description + email/reply + timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Description</CardTitle>
              <CardDescription>Add details, links, scope notes, etc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Describe what needs to be done…"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void handleSaveDescription()}
                  disabled={savingDesc || description === task.description}
                >
                  {savingDesc ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Save description
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Original email (if any) */}
          {task.sourceEmailText && (
            <Card>
              <Collapsible open={replyExpanded} onOpenChange={setReplyExpanded}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left group">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mail className="size-4 text-emerald-600 dark:text-emerald-400" />
                        Original Email
                      </CardTitle>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground">
                        {replyExpanded ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  {task.sourceSender && (
                    <CardDescription>From {task.sourceSender}</CardDescription>
                  )}
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <pre className="whitespace-pre-wrap font-sans text-sm bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 max-h-80 overflow-y-auto">
                      {task.sourceEmailText}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Generated reply (if any) */}
          {task.generatedReplyText && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Generated Reply
                  </CardTitle>
                  {task.replySent ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                      <CheckCircle2 className="size-3" />
                      Reply Sent
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 max-h-60 overflow-y-auto">
                  {task.generatedReplyText}
                </pre>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => void copyReply()}>
                    <ClipboardCopy className="size-4" />
                    Copy Reply
                  </Button>
                  {!task.replySent && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void handleMarkReplySent()}
                    >
                      <Check className="size-4" />
                      Mark as Sent
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity & Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4 text-emerald-600 dark:text-emerald-400" />
                Activity &amp; Comments
              </CardTitle>
              <CardDescription>{timeline.length} events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No activity yet.</p>
              ) : (
                <ol className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {timeline.map((item) => {
                    const date = parseISO(item.createdAt)
                    return (
                      <li key={`${item.kind}-${item.id}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          {item.kind === 'comment' ? (
                            <UserAvatar name={item.userName} size="sm" />
                          ) : (
                            <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              <Clock className="size-3" />
                            </span>
                          )}
                          <span className="w-px flex-1 bg-slate-200 dark:bg-slate-800 mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <p className="text-sm">
                            <span className="font-medium text-foreground">
                              {item.userName ?? 'System'}
                            </span>{' '}
                            {item.kind === 'comment' ? (
                              <span className="text-muted-foreground">commented</span>
                            ) : null}
                          </p>
                          <p
                            className={cn(
                              'text-sm mt-0.5 rounded-lg p-2',
                              item.kind === 'comment'
                                ? 'bg-emerald-50 text-slate-800 dark:bg-emerald-950/30 dark:text-slate-200 border border-emerald-100 dark:border-emerald-900/50'
                                : 'text-muted-foreground'
                            )}
                          >
                            {item.content}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1" title={format(date, 'PPpp')}>
                            {formatDistanceToNow(date, { addSuffix: true })}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
              <div className="border-t pt-3 space-y-2">
                <Textarea
                  placeholder="Write a comment…"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handlePostComment()}
                    disabled={postingComment || !commentText.trim()}
                  >
                    {postingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Follow-ups */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Follow-ups
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {task.followUpCount} sent
                </Badge>
              </div>
              <CardDescription>
                Nudge the assignee for a status update at a regular cadence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Frequency</Label>
                  <Select
                    value={
                      task.followUpFrequencyHours != null
                        ? String(task.followUpFrequencyHours)
                        : 'none'
                    }
                    onValueChange={(v) => void handleFollowUpFrequencyChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (disabled)</SelectItem>
                      <SelectItem value="4">Every 4 hours</SelectItem>
                      <SelectItem value="8">Every 8 hours</SelectItem>
                      <SelectItem value="24">Every 24 hours</SelectItem>
                      <SelectItem value="48">Every 48 hours</SelectItem>
                      <SelectItem value="72">Every 72 hours</SelectItem>
                      <SelectItem value="168">Every week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Last follow-up</Label>
                  <div className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
                    {task.lastFollowUpAt ? (
                      <span title={format(parseISO(task.lastFollowUpAt), 'PPpp')}>
                        {formatDistanceToNow(parseISO(task.lastFollowUpAt), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">No follow-up yet</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Total sent</Label>
                  <div className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm font-semibold">
                    {task.followUpCount}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void handleSendFollowUp()}
                  disabled={sendingFollowUp || !task.assigneeId}
                  title={!task.assigneeId ? 'Assign the task first' : undefined}
                >
                  {sendingFollowUp ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send Follow-up Now
                </Button>
              </div>

              {/* Follow-up history */}
              {task.followUps.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Follow-up history
                  </p>
                  <ol className="space-y-2 max-h-72 overflow-y-auto pr-1 wf-scroll">
                    {task.followUps
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((f) => {
                        const typeMeta = FOLLOWUP_TYPE_META[f.type] ?? FOLLOWUP_TYPE_META.reminder
                        return (
                          <li
                            key={f.id}
                            className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] capitalize', typeMeta.tone)}
                              >
                                {f.type}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground" title={format(parseISO(f.createdAt), 'PPpp')}>
                                {formatDistanceToNow(parseISO(f.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm text-foreground">{f.message}</p>
                            {f.sentToUserName && (
                              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                                <UserIcon className="size-3" /> To {f.sentToUserName}
                              </p>
                            )}
                          </li>
                        )
                      })}
                  </ol>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No follow-ups have been sent yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: actions / metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
              <CardDescription>Move this task forward.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {canMarkDone && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void handleMarkDone()}
                >
                  <CheckCircle2 className="size-4" />
                  Mark as Done
                </Button>
              )}
              {canVerifyClose && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void handleVerifyClose()}
                >
                  <ShieldCheck className="size-4" />
                  Verify &amp; Close
                </Button>
              )}
              {!canMarkDone && !canVerifyClose && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {task.status === 'closed'
                    ? 'This task is closed.'
                    : task.status === 'done'
                      ? 'Awaiting admin verification to close.'
                      : 'No quick actions available for this status.'}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserIcon className="size-3.5" /> Assignee
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  {task.assigneeName ? (
                    <>
                      <UserAvatar name={task.assigneeName} size="sm" />
                      <span className="font-medium truncate">{task.assigneeName}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground italic">Unassigned</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> Due
                </span>
                <span className="font-medium">
                  {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : '—'}
                </span>
              </div>
              {task.branchName && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Landmark className="size-3.5" /> Branch
                  </span>
                  <span className="font-medium truncate">{task.branchName}</span>
                </div>
              )}
              {task.isRenewal && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <RotateCw className="size-3.5" /> Renewal
                  </span>
                  <RenewalBadge renewalExpiryDate={task.renewalExpiryDate} variant="compact" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={task.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Priority</span>
                <PriorityBadge priority={task.priority} />
              </div>
              {task.closedAt && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Closed</span>
                  <span className="font-medium text-xs">
                    {format(parseISO(task.closedAt), 'MMM d, yyyy p')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-xs">
                  {formatDistanceToNow(parseISO(task.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

const FOLLOWUP_TYPE_META: Record<string, { tone: string }> = {
  reminder: {
    tone: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  },
  escalation: {
    tone: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
  },
  overdue: {
    tone: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
  },
  renewal: {
    tone: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900',
  },
}
