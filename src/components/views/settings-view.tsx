'use client'

import * as React from 'react'
import {
  AlertCircle,
  Bell,
  Building2,
  CalendarClock,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  ShieldOff,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { TONES, type CategoryDTO, type ReplyTone } from '@/lib/types'
import { toast } from 'sonner'

type Settings = {
  companyName: string
  defaultTone: ReplyTone
  urgentHours: number
  highDays: number
  mediumDays: number
  lowDays: number
  reminderHoursBefore: number
  overdueCheckHours: number
  inReviewReminderHours: number
  replyNotSentHours: number
  renewalAlertDays: string
  defaultFollowUpHours: number
  escalationOverdueHours: number
}

const DEFAULTS: Settings = {
  companyName: 'WorkFlow Hub',
  defaultTone: 'formal',
  urgentHours: 4,
  highDays: 1,
  mediumDays: 3,
  lowDays: 7,
  reminderHoursBefore: 24,
  overdueCheckHours: 2,
  inReviewReminderHours: 24,
  replyNotSentHours: 4,
  renewalAlertDays: '30,14,7,1',
  defaultFollowUpHours: 48,
  escalationOverdueHours: 72,
}

export function SettingsView() {
  const user = useAppStore((s) => s.user)
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        apiFetch<Settings>('/api/settings'),
        apiFetch<CategoryDTO[]>('/api/categories'),
      ])
      setSettings(s as Settings)
      setCategories(c)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settings')
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
            Settings are restricted to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await apiFetch<Settings>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      })
      setSettings(updated as Settings)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Company, defaults, reminder timing, and reply tone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !settings ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
            <AlertCircle className="size-4" /> Failed to load settings.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                Company
              </CardTitle>
              <CardDescription>Used in reply drafts and notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default Reply Tone</Label>
                <Select
                  value={settings.defaultTone}
                  onValueChange={(v) => update('defaultTone', v as ReplyTone)}
                >
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />
                Categories
              </CardTitle>
              <CardDescription>Categories classify incoming work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                <ul className="space-y-2">
                  {categories.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {c.color}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => toast.info('Category management coming soon')}
              >
                <Plus className="size-4" />
                Add Category
              </Button>
            </CardContent>
          </Card>

          {/* Priority due-date defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="size-4 text-emerald-600 dark:text-emerald-400" />
                Priority Due-Date Defaults
              </CardTitle>
              <CardDescription>Default SLAs per priority level.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumberField
                label="Urgent (hours)"
                value={settings.urgentHours}
                onChange={(v) => update('urgentHours', v)}
                min={1}
              />
              <NumberField
                label="High (days)"
                value={settings.highDays}
                onChange={(v) => update('highDays', v)}
                min={1}
              />
              <NumberField
                label="Medium (days)"
                value={settings.mediumDays}
                onChange={(v) => update('mediumDays', v)}
                min={1}
              />
              <NumberField
                label="Low (days)"
                value={settings.lowDays}
                onChange={(v) => update('lowDays', v)}
                min={1}
              />
            </CardContent>
          </Card>

          {/* Reminder timing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="size-4 text-emerald-600 dark:text-emerald-400" />
                Reminder Timing
              </CardTitle>
              <CardDescription>When to nudge about upcoming or stuck work.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumberField
                label="Reminder hours before due"
                value={settings.reminderHoursBefore}
                onChange={(v) => update('reminderHoursBefore', v)}
                min={1}
              />
              <NumberField
                label="Overdue check interval (hours)"
                value={settings.overdueCheckHours}
                onChange={(v) => update('overdueCheckHours', v)}
                min={1}
              />
              <NumberField
                label="In-review reminder (hours)"
                value={settings.inReviewReminderHours}
                onChange={(v) => update('inReviewReminderHours', v)}
                min={1}
              />
              <NumberField
                label="Reply-not-sent reminder (hours)"
                value={settings.replyNotSentHours}
                onChange={(v) => update('replyNotSentHours', v)}
                min={1}
              />
            </CardContent>
          </Card>

          {/* Renewal alerts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCw className="size-4 text-emerald-600 dark:text-emerald-400" />
                Renewal Alerts
              </CardTitle>
              <CardDescription>
                Notifications will be created this many days before each renewal expires.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="renewalAlertDays">Renewal alert days (comma-separated)</Label>
                <Input
                  id="renewalAlertDays"
                  value={settings.renewalAlertDays}
                  onChange={(e) => update('renewalAlertDays', e.target.value)}
                  placeholder="30,14,7,1"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  e.g. <code className="font-mono">30,14,7,1</code> sends alerts 30, 14, 7, and 1 day(s) before expiry.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4 text-emerald-600 dark:text-emerald-400" />
                Follow-up Defaults
              </CardTitle>
              <CardDescription>
                Defaults for automatic follow-ups and escalations.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumberField
                label="Default follow-up frequency (hours)"
                value={settings.defaultFollowUpHours}
                onChange={(v) => update('defaultFollowUpHours', v)}
                min={1}
              />
              <NumberField
                label="Escalation after overdue (hours)"
                value={settings.escalationOverdueHours}
                onChange={(v) => update('escalationOverdueHours', v)}
                min={1}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
      />
    </div>
  )
}
