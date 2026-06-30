'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldOff,
  Trash2,
  Users,
  Tags,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import type { CategoryDTO, DepartmentDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type FormState = {
  id?: string
  name: string
  color: string
}

const DEFAULT_COLOR = '#10b981'

export function DepartmentsView() {
  const user = useAppStore((s) => s.user)
  const [departments, setDepartments] = React.useState<DepartmentDTO[]>([])
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([
        apiFetch<DepartmentDTO[]>('/api/departments'),
        apiFetch<CategoryDTO[]>('/api/categories'),
      ])
      setDepartments(d)
      setCategories(c)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load departments')
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
            Department management is restricted to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  function openCreate() {
    setForm({ name: '', color: DEFAULT_COLOR })
    setDialogOpen(true)
  }

  function openEdit(d: DepartmentDTO) {
    setForm({ id: d.id, name: d.name, color: d.color })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(form.color)) {
      toast.error('Color must be a valid hex like #10b981')
      return
    }
    setSaving(true)
    try {
      const body = { name: form.name.trim(), color: form.color }
      if (form.id) {
        await apiFetch<DepartmentDTO>(`/api/departments/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        toast.success('Department updated')
      } else {
        await apiFetch<DepartmentDTO>('/api/departments', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        toast.success('Department added')
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

  async function handleDelete(d: DepartmentDTO) {
    try {
      await apiFetch(`/api/departments/${d.id}`, { method: 'DELETE' })
      toast.success('Department deleted')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="size-6 text-emerald-600 dark:text-emerald-400" />
            Departments
          </h1>
          <p className="text-sm text-muted-foreground">
            Organize your team into departments. Categories and employees can be linked to a department.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="size-4" />
            Add Department
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Building2 className="size-5" />
            </span>
            <p className="text-sm font-medium">No departments yet</p>
            <p className="text-xs text-muted-foreground mb-2">
              Add your first department to start organizing your team.
            </p>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
              <Plus className="size-4" />
              Add Department
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d, i) => {
            const linkedCategories = categories.filter((c) => c.departmentId === d.id)
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: 'easeOut' }}
              >
                <Card className="h-full overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-3.5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background"
                          style={{
                            backgroundColor: d.color,
                            // @ts-expect-error css var
                            '--tw-ring-color': `${d.color}40`,
                          }}
                        />
                        <CardTitle className="text-base truncate">{d.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() => openEdit(d)}
                          aria-label={`Edit ${d.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-red-600 hover:text-red-700 dark:text-red-400"
                              aria-label={`Delete ${d.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete "{d.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {(d.employeeCount ?? 0) > 0
                                  ? `This department has ${d.employeeCount} active employee${(d.employeeCount ?? 0) === 1 ? '' : 's'} assigned. Please reassign them first — deletion is blocked until they're moved.`
                                  : 'This will permanently remove the department. Any categories linked to it will be detached (their departmentId will be cleared). This cannot be undone.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700 text-white"
                                disabled={(d.employeeCount ?? 0) > 0}
                                onClick={() => void handleDelete(d)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CardDescription className="truncate text-[11px] uppercase tracking-wide">
                      {d.color}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Users className="size-3" />
                          Employees
                        </div>
                        <p className="text-lg font-semibold mt-0.5">{d.employeeCount ?? 0}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Tags className="size-3" />
                          Categories
                        </div>
                        <p className="text-lg font-semibold mt-0.5">{linkedCategories.length}</p>
                      </div>
                    </div>
                    {linkedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {linkedCategories.slice(0, 5).map((c) => (
                          <Badge
                            key={c.id}
                            variant="outline"
                            className="text-[10px]"
                            style={{
                              backgroundColor: `${c.color}1a`,
                              color: c.color,
                              borderColor: `${c.color}40`,
                            }}
                          >
                            {c.name}
                          </Badge>
                        ))}
                        {linkedCategories.length > 5 && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            +{linkedCategories.length - 5}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              {form?.id ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription>
              Give your department a clear name and a color for visual identification.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="d-name">Name</Label>
                <Input
                  id="d-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  placeholder="e.g. Customer Support"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => (f ? { ...f, color: e.target.value } : f))}
                    className="size-10 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1 dark:border-slate-700"
                    aria-label="Pick color"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => (f ? { ...f, color: e.target.value } : f))}
                    className="flex-1 font-mono text-sm"
                    placeholder="#10b981"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setForm((f) => (f ? { ...f, color: preset } : f))}
                        className={cn(
                          'size-6 rounded-full border-2 transition-transform hover:scale-110',
                          form.color.toLowerCase() === preset
                            ? 'border-foreground ring-2 ring-offset-1 ring-offset-background'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: preset }}
                        aria-label={`Use color ${preset}`}
                      />
                    )
                  )}
                </div>
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
              {form?.id ? 'Save changes' : 'Add department'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
