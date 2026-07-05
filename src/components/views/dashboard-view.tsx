'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow, isToday, isPast, parseISO } from 'date-fns'
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  ListTodo,
  MailWarning,
  PlayCircle,
  RefreshCw,
  RotateCw,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CategoryPill, PriorityBadge, UserAvatar } from '@/components/ui-badges'
import { RenewalBadge } from '@/components/renewal-badge'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import type { DashboardSummary } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const REASON_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  overdue: { label: 'Overdue', icon: AlertCircle, tone: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' },
  reply_not_sent: { label: 'Reply not sent', icon: MailWarning, tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  due_today: { label: 'Due today', icon: Clock, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
}

export function DashboardView() {
  const user = useAppStore((s) => s.user)
  const openTask = useAppStore((s) => s.openTask)
  const [data, setData] = React.useState<DashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [runningChecks, setRunningChecks] = React.useState(false)
  const [simulating, setSimulating] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const summary = await apiFetch<DashboardSummary>('/api/dashboard')
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const isAdmin = user?.role === 'admin'

  async function handleRunChecks() {
    setRunningChecks(true)
    try {
      const result = await apiFetch<{ ok: boolean; renewals: number; followUps: number }>(
        '/api/cron/run-all',
        { method: 'POST' }
      )
      toast.success(
        `Ran checks: ${result.renewals} renewal alert${result.renewals === 1 ? '' : 's'}, ${result.followUps} follow-up${result.followUps === 1 ? '' : 's'} sent`
      )
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run checks')
    } finally {
      setRunningChecks(false)
    }
  }

  async function handleTriggerSimulation() {
    setSimulating(true)
    try {
      const result = await apiFetch<{ ok: boolean; simulated: { subject: string } }>(
        '/api/email/simulate',
        { method: 'POST' }
      )
      toast.success(`Simulated email received: "${result.simulated?.subject || 'New email'}"`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger simulation')
    } finally {
      setSimulating(false)
    }
  }


  // Sort renewals by daysUntilExpiry ascending
  const sortedRenewals = React.useMemo(() => {
    if (!data?.upcomingRenewals) return []
    return [...data.upcomingRenewals].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  }, [data?.upcomingRenewals])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isAdmin ? "Today's Snapshot" : 'My Snapshot'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.name?.split(' ')[0] ?? 'there'}. Here's what needs attention.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleTriggerSimulation()}
                disabled={simulating || loading}
                className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                <Send className={cn('size-4', simulating && 'animate-pulse')} />
                Trigger Simulated Email
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRunChecks()}
                disabled={runningChecks || loading}
              >
                {runningChecks ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                Run Checks Now
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="py-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={ListTodo}
          label="Open"
          value={data?.open}
          loading={loading}
          accent="emerald"
          delay={0}
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={data?.overdue}
          loading={loading}
          accent="red"
          delay={0.05}
        />
        <StatCard
          icon={CalendarClock}
          label="Due Today"
          value={data?.dueToday}
          loading={loading}
          accent="amber"
          delay={0.1}
        />
        <StatCard
          icon={CheckCircle2}
          label="Done This Week"
          value={data?.doneThisWeek}
          loading={loading}
          accent="emerald"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By category */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By Category</CardTitle>
            <CardDescription>Open tasks grouped by category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-32 rounded-full" />
                ))}
              </div>
            ) : data?.byCategory.length ? (
              <div className="flex flex-wrap gap-2">
                {data.byCategory.map((c) => (
                  <CategoryPill key={c.categoryId} category={c} count={c.count} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            )}
          </CardContent>
        </Card>

        {/* By employee */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isAdmin ? 'By Employee' : 'My Load'}
            </CardTitle>
            <CardDescription>
              {isAdmin ? 'Open / overdue per team member' : 'Open / overdue for you'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : data?.byEmployee.length ? (
              <ul className="space-y-2">
                {data.byEmployee.map((e) => (
                  <li
                    key={e.userId}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={e.name} size="sm" />
                      <span className="text-sm font-medium truncate">{e.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {e.openCount} open
                      </span>
                      {e.overdueCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          {e.overdueCount} overdue
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Department */}
      {data && data.byDepartment.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              By Department
            </CardTitle>
            <CardDescription>Open / overdue tasks grouped by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.byDepartment.map((d) => (
                <span
                  key={d.departmentId}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${d.color}14`,
                    color: d.color,
                    borderColor: `${d.color}40`,
                  }}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                    aria-hidden
                  />
                  {d.name}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${d.color}26`, color: d.color }}
                  >
                    {d.openCount} open
                  </span>
                  {d.overdueCount > 0 && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                      {d.overdueCount} overdue
                    </span>
                  )}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Needs attention */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Needs Attention</CardTitle>
          <CardDescription>
            Top items that need action right now — sorted by urgency.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : data?.needsAttention.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.needsAttention.map((item) => {
                const meta = REASON_META[item.reason] ?? REASON_META.overdue
                const Icon = meta.icon
                let dueLabel: string | null = null
                let dueRed = false
                if (item.dueDate) {
                  const d = parseISO(item.dueDate)
                  dueLabel = format(d, 'MMM d, yyyy')
                  dueRed = isPast(d) && !isToday(d)
                }
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => openTask(item.id)}
                      className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 -mx-2 px-2 rounded-md"
                    >
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          meta.tone
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </p>
                          <PriorityBadge priority={item.priority} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.assigneeName ? `Assigned to ${item.assigneeName}` : 'Unassigned'}
                          {dueLabel && (
                            <>
                              {' • '}
                              <span className={cn(dueRed && 'text-red-600 dark:text-red-400 font-medium')}>
                                Due {dueLabel}
                              </span>
                            </>
                          )}
                          {' • '}
                          <span className="text-muted-foreground">{meta.label}</span>
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="size-5" />
              </span>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground">
                No tasks need urgent attention right now.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Renewals + Pending Follow-ups grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Renewals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCw className="size-4 text-emerald-600 dark:text-emerald-400" />
                Upcoming Renewals
              </CardTitle>
              {sortedRenewals.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                  {sortedRenewals.length}
                </Badge>
              )}
            </div>
            <CardDescription>Renewal tasks approaching expiry</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : sortedRenewals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <RotateCw className="size-5" />
                </span>
                <p className="text-sm font-medium">No upcoming renewals</p>
                <p className="text-xs text-muted-foreground">
                  All renewals are taken care of — for now.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto wf-scroll">
                {sortedRenewals.map((r) => {
                  let expiryLabel = '—'
                  try {
                    expiryLabel = format(parseISO(r.renewalExpiryDate), 'MMM d, yyyy')
                  } catch {
                    /* ignore */
                  }
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => openTask(r.id)}
                        className="group flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 -mx-2 px-2 rounded-md"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {r.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                            <span>Expires {expiryLabel}</span>
                            {r.renewalProvider && (
                              <>
                                <span>•</span>
                                <span>{r.renewalProvider}</span>
                              </>
                            )}
                            {r.assigneeName && (
                              <>
                                <span>•</span>
                                <span>{r.assigneeName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <RenewalBadge renewalExpiryDate={r.renewalExpiryDate} variant="compact" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending Follow-ups */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
                Follow-ups Due
              </CardTitle>
              {data && data.pendingFollowUps.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900">
                  {data.pendingFollowUps.length}
                </Badge>
              )}
            </div>
            <CardDescription>Tasks due for a follow-up nudge</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : !data || data.pendingFollowUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="size-5" />
                </span>
                <p className="text-sm font-medium">All follow-ups are up to date</p>
                <p className="text-xs text-muted-foreground">
                  No tasks need a follow-up nudge right now.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto wf-scroll">
                {data.pendingFollowUps.map((f) => {
                  let dueLabel: string | null = null
                  let dueRed = false
                  if (f.dueDate) {
                    try {
                      const d = parseISO(f.dueDate)
                      dueLabel = format(d, 'MMM d')
                      dueRed = isPast(d) && !isToday(d)
                    } catch {
                      /* ignore */
                    }
                  }
                  let lastLabel: string
                  if (!f.lastFollowUpAt) {
                    lastLabel = 'No follow-up yet'
                  } else if (f.hoursSinceLastFollowUp != null) {
                    lastLabel = `Last follow-up ${Math.round(f.hoursSinceLastFollowUp)}h ago`
                  } else {
                    try {
                      lastLabel = `Last follow-up ${formatDistanceToNow(parseISO(f.lastFollowUpAt))} ago`
                    } catch {
                      lastLabel = 'Last follow-up recently'
                    }
                  }
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => openTask(f.id)}
                        className="group flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 -mx-2 px-2 rounded-md"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          <Send className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                            {f.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
                            {f.assigneeName && <span>{f.assigneeName}</span>}
                            {dueLabel && (
                              <>
                                <span>•</span>
                                <span className={cn(dueRed && 'text-red-600 dark:text-red-400 font-medium')}>
                                  Due {dueLabel}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span className="truncate">{lastLabel}</span>
                          </div>
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
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | undefined
  loading: boolean
  accent: 'emerald' | 'red' | 'amber' | 'slate'
  delay: number
}) {
  const accentClass = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <span className={cn('flex size-9 items-center justify-center rounded-lg', accentClass)}>
              <Icon className="size-4" />
            </span>
          </div>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {value ?? 0}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
