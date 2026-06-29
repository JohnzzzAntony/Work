'use client'

import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldOff,
  Timer,
  TrendingUp,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui-badges'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  PRIORITY_META,
  PRIORITIES,
  type ReportsSummary,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function ReportsView() {
  const user = useAppStore((s) => s.user)
  const [data, setData] = React.useState<ReportsSummary | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiFetch<ReportsSummary>('/api/reports/summary')
      setData(d)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  if (user?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
            <ShieldOff className="size-5" />
          </span>
          <p className="text-sm font-medium">You don't have access to this view</p>
          <p className="text-xs text-muted-foreground">
            Reports are restricted to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  const avgHrs = data?.avgCompletionHours
  const avgDisplay = avgHrs == null
    ? '—'
    : avgHrs >= 24
      ? `${(avgHrs / 24).toFixed(1)}d`
      : `${avgHrs.toFixed(1)}h`

  // Stacked per-category data
  const categoryData = (data?.perCategory ?? []).map((c) => ({
    name: c.name,
    color: c.color,
    open: c.total - c.closed,
    closed: c.closed,
  }))

  // Per-priority data
  const priorityData = PRIORITIES.map((p) => {
    const item = data?.perPriority.find((x) => x.priority === p)
    return {
      name: PRIORITY_META[p].label,
      color: PRIORITY_META[p].color,
      total: item?.total ?? 0,
      closed: item?.closed ?? 0,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Team performance, completion times, and workload distribution.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Total Tasks"
          value={data?.totalTasks}
          loading={loading}
          tone="slate"
        />
        <StatCard
          icon={CheckCircle2}
          label="Closed Tasks"
          value={data?.closedTasks}
          loading={loading}
          tone="emerald"
        />
        <StatCard
          icon={Timer}
          label="Avg Completion"
          value={avgDisplay}
          loading={loading}
          tone="amber"
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={data?.overdueCount}
          loading={loading}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Per category stacked bar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tasks per Category</CardTitle>
            <CardDescription>Open vs closed, by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="closed" name="Closed" stackId="a" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per priority pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tasks by Priority</CardTitle>
            <CardDescription>Distribution across priority levels.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {priorityData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workload per employee */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
            Workload per Employee
          </CardTitle>
          <CardDescription>Assigned, completed, overdue &amp; average completion time.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Assigned</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Overdue</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Avg Completion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.perEmployee.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      No employees yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.perEmployee.map((e) => (
                    <TableRow key={e.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar name={e.name} size="sm" />
                          <span className="text-sm font-medium">{e.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{e.assigned}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {e.completed}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {e.overdue > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {e.overdue}
                          </span>
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm hidden sm:table-cell">
                        {e.avgCompletionHours == null
                          ? '—'
                          : e.avgCompletionHours >= 24
                            ? `${(e.avgCompletionHours / 24).toFixed(1)}d`
                            : `${e.avgCompletionHours.toFixed(1)}h`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent completions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
            Recent Completions
          </CardTitle>
          <CardDescription>Most recently closed tasks.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="hidden sm:table-cell">Assignee</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead className="text-right">Hours to Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : data?.recentCompletions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      No completions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.recentCompletions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[260px]">
                        <span className="text-sm font-medium truncate">{c.title}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.assigneeName ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={c.assigneeName} size="sm" />
                            <span className="text-sm">{c.assigneeName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(c.closedAt), 'MMM d, p')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {c.hoursToClose == null
                            ? '—'
                            : c.hoursToClose >= 24
                              ? `${(c.hoursToClose / 24).toFixed(1)}d`
                              : `${c.hoursToClose.toFixed(1)}h`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string | undefined
  loading: boolean
  tone: 'emerald' | 'red' | 'amber' | 'slate'
}) {
  const toneClass = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[tone]

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <span className={cn('flex size-9 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="size-4" />
        </span>
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
  )
}
