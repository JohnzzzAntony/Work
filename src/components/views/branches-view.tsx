'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Building,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldOff,
  Store,
  Trash2,
  Users,
  ListTodo,
  Power,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import type { BranchDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type BranchType = 'branch' | 'store' | 'entity' | 'subsidiary' | 'office'

const BRANCH_TYPES: BranchType[] = ['branch', 'store', 'entity', 'subsidiary', 'office']

const TYPE_META: Record<
  BranchType,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  branch: {
    label: 'Branch',
    icon: Landmark,
    tone: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900',
  },
  store: {
    label: 'Store',
    icon: Store,
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
  },
  entity: {
    label: 'Entity',
    icon: Building,
    tone: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900',
  },
  subsidiary: {
    label: 'Subsidiary',
    icon: Building,
    tone: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
  },
  office: {
    label: 'Office',
    icon: Building,
    tone: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
}

type FormState = {
  id?: string
  name: string
  type: BranchType
  address: string
  phone: string
  email: string
  active: boolean
}

type FilterType = 'all' | BranchType

export function BranchesView() {
  const user = useAppStore((s) => s.user)
  const [branches, setBranches] = React.useState<BranchDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [filter, setFilter] = React.useState<FilterType>('all')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<BranchDTO[]>('/api/branches')
      setBranches(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load branches')
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
            Branch management is restricted to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  function openCreate() {
    setForm({ name: '', type: 'branch', address: '', phone: '', email: '', active: true })
    setDialogOpen(true)
  }

  function openEdit(b: BranchDTO) {
    setForm({
      id: b.id,
      name: b.name,
      type: (BRANCH_TYPES.includes(b.type as BranchType) ? b.type : 'branch') as BranchType,
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      active: b.active,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        active: form.active,
      }
      if (form.id) {
        await apiFetch<BranchDTO>(`/api/branches/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        toast.success('Branch updated')
      } else {
        await apiFetch<BranchDTO>('/api/branches', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        toast.success('Branch added')
      }
      setDialogOpen(false)
      setForm(null)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b: BranchDTO) {
    try {
      await apiFetch(`/api/branches/${b.id}`, { method: 'DELETE' })
      toast.success('Branch deleted')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filtered = filter === 'all' ? branches : branches.filter((b) => b.type === filter)

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="size-6 text-emerald-600 dark:text-emerald-400" />
            Branches &amp; Entities
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Manage your main branches, stores, entities, and offices. Employees and tasks can be linked to a branch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="size-4" />
            Add Branch
          </Button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...BRANCH_TYPES] as FilterType[]).map((t) => {
          const isActive = filter === t
          const label = t === 'all' ? 'All' : TYPE_META[t].label + 's'
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'
              )}
            >
              {label}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {t === 'all'
                  ? branches.length
                  : branches.filter((b) => b.type === t).length}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Landmark className="size-5" />
            </span>
            <p className="text-sm font-medium">
              {filter === 'all' ? 'No branches yet' : `No ${TYPE_META[filter as BranchType].label.toLowerCase()}s yet`}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Add a branch, store, entity, or office to get started.
            </p>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
              <Plus className="size-4" />
              Add Branch
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b, i) => {
            const meta = TYPE_META[(BRANCH_TYPES.includes(b.type as BranchType) ? b.type : 'branch') as BranchType]
            const TypeIcon = meta.icon
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: 'easeOut' }}
              >
                <Card className={cn('h-full flex flex-col', !b.active && 'opacity-70')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg border',
                            meta.tone
                          )}
                        >
                          <TypeIcon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{b.name}</CardTitle>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className={cn('text-[10px]', meta.tone)}>
                              {meta.label}
                            </Badge>
                            {b.active ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900 text-[10px]">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => openEdit(b)}
                          aria-label={`Edit ${b.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-red-600 hover:text-red-700 dark:text-red-400"
                              aria-label={`Delete ${b.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{b.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {((b.employeeCount ?? 0) > 0 || (b.taskCount ?? 0) > 0)
                                  ? `This branch is referenced by ${b.employeeCount ?? 0} employee${(b.employeeCount ?? 0) === 1 ? '' : 's'} and ${b.taskCount ?? 0} task${(b.taskCount ?? 0) === 1 ? '' : 's'}. Please reassign them first — deletion is blocked while references exist.`
                                  : 'This will permanently remove the branch. This cannot be undone.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={((b.employeeCount ?? 0) > 0 || (b.taskCount ?? 0) > 0)}
                                onClick={() => void handleDelete(b)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <div className="space-y-1.5 text-xs">
                      {b.address && (
                        <div className="flex items-start gap-1.5 text-muted-foreground">
                          <MapPin className="size-3 shrink-0 mt-0.5" />
                          <span className="text-slate-600 dark:text-slate-300">{b.address}</span>
                        </div>
                      )}
                      {b.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3 shrink-0" />
                          <a href={`tel:${b.phone}`} className="text-slate-600 dark:text-slate-300 hover:underline">
                            {b.phone}
                          </a>
                        </div>
                      )}
                      {b.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="size-3 shrink-0" />
                          <a href={`mailto:${b.email}`} className="text-slate-600 dark:text-slate-300 hover:underline truncate">
                            {b.email}
                          </a>
                        </div>
                      )}
                      {!b.address && !b.phone && !b.email && (
                        <p className="text-muted-foreground italic">No contact details.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="size-3" />
                          Employees
                        </div>
                        <p className="text-base font-semibold">{b.employeeCount ?? 0}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <ListTodo className="size-3" />
                          Tasks
                        </div>
                        <p className="text-base font-semibold">{b.taskCount ?? 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-4 text-emerald-600 dark:text-emerald-400" />
              {form?.id ? 'Edit Branch' : 'Add Branch'}
            </DialogTitle>
            <DialogDescription>
              Define a branch, store, entity, subsidiary, or office location.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b-name">Name *</Label>
                  <Input
                    id="b-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                    placeholder="Head Office"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => (f ? { ...f, type: v as BranchType } : f))}
                  >
                    <SelectTrigger className="w-full capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCH_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-address">Address</Label>
                <Input
                  id="b-address"
                  value={form.address}
                  onChange={(e) => setForm((f) => (f ? { ...f, address: e.target.value } : f))}
                  placeholder="123 Main St, City, Country"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b-phone">Phone</Label>
                  <Input
                    id="b-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => (f ? { ...f, phone: e.target.value } : f))}
                    placeholder="+1 555 0100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="b-email">Email</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => (f ? { ...f, email: e.target.value } : f))}
                    placeholder="office@company.com"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Power className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Inactive branches won't appear in dropdowns.</p>
                  </div>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => (f ? { ...f, active: v } : f))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {form?.id ? 'Save changes' : 'Add branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
