'use client'

import * as React from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { BellOff, CheckCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { NOTIFICATION_TYPE_META, type NotificationDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Filter = 'all' | 'unread' | 'assigned_to_me' | 'overdue'

export function NotificationsView() {
  const openTask = useAppStore((s) => s.openTask)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)
  const [items, setItems] = React.useState<NotificationDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState<Filter>('all')
  const [markingAll, setMarkingAll] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<NotificationDTO[]>(
        `/api/notifications?filter=${filter}`
      )
      setItems(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [filter])

  React.useEffect(() => {
    void load()
  }, [load])

  async function handleClick(n: NotificationDTO) {
    // Mark as read locally + remote
    if (!n.read) {
      setItems((curr) =>
        curr.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      )
      try {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
        setUnreadCount(Math.max(0, items.filter((x) => !x.read && x.id !== n.id).length))
      } catch {
        /* ignore */
      }
    }
    if (n.taskId) openTask(n.taskId)
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' })
      setItems((curr) => curr.map((x) => ({ ...x, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = items.filter((n) => !n.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="assigned_to_me">Assigned to me</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll || unreadCount === 0}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbox</CardTitle>
          <CardDescription>Newest first. Click to open the related task.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                <BellOff className="size-5" />
              </span>
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground">
                You'll see assignment, comment, and reminder alerts here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[calc(100vh-260px)] overflow-y-auto">
              {items.map((n) => {
                const meta = NOTIFICATION_TYPE_META[n.type]
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => void handleClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50',
                        !n.read && 'bg-emerald-50/60 dark:bg-emerald-950/20'
                      )}
                    >
                      <span className="text-lg leading-none mt-0.5" aria-hidden>
                        {meta?.icon ?? '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">{n.message}</p>
                          {!n.read && (
                            <span className="size-2 rounded-full bg-emerald-500" aria-label="unread" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {n.taskTitle ? (
                            <span className="text-foreground/80">Re: {n.taskTitle}</span>
                          ) : (
                            <span>{meta?.label ?? n.type}</span>
                          )}
                          {' • '}
                          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
