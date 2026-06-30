'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import {
  Building2,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  UserCog,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui-badges'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import type {
  BranchDTO,
  CategoryDTO,
  DepartmentDTO,
  UserDTO,
  UserRole,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type FormState = {
  id?: string
  name: string
  email: string
  password: string
  role: UserRole
  categorySkills: string[]
  departmentId: string // 'none' = clear
  branchId: string // 'none' = clear
  jobTitle: string
  phone: string
}

export function EmployeesView() {
  const user = useAppStore((s) => s.user)
  const [users, setUsers] = React.useState<UserDTO[]>([])
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [departments, setDepartments] = React.useState<DepartmentDTO[]>([])
  const [branches, setBranches] = React.useState<BranchDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [u, c, d, b] = await Promise.all([
        apiFetch<UserDTO[]>('/api/users'),
        apiFetch<CategoryDTO[]>('/api/categories'),
        apiFetch<DepartmentDTO[]>('/api/departments'),
        apiFetch<BranchDTO[]>('/api/branches'),
      ])
      setUsers(u)
      setCategories(c)
      setDepartments(d)
      setBranches(b)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'employee',
      categorySkills: [],
      departmentId: 'none',
      branchId: 'none',
      jobTitle: '',
      phone: '',
    })
    setDialogOpen(true)
  }

  function openEdit(u: UserDTO) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      categorySkills: [...u.categorySkills],
      departmentId: u.departmentId ?? 'none',
      branchId: u.branchId ?? 'none',
      jobTitle: u.jobTitle ?? '',
      phone: u.phone ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    if (!form.id && !form.password) {
      toast.error('Password is required for new employees')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        categorySkills: form.categorySkills,
        departmentId: form.departmentId === 'none' ? null : form.departmentId,
        branchId: form.branchId === 'none' ? null : form.branchId,
        jobTitle: form.jobTitle.trim() || null,
        phone: form.phone.trim() || null,
      }
      if (form.password) body.password = form.password
      if (form.id) {
        await apiFetch(`/api/users/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        toast.success('Employee updated')
      } else {
        await apiFetch('/api/users', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        toast.success('Employee added')
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

  async function handleDeactivate(u: UserDTO) {
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' })
      toast.success(`${u.name} deactivated`)
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  if (user?.role !== 'admin') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
            <ShieldOff className="size-5" />
          </span>
          <p className="text-sm font-medium">You don't have access to this view</p>
          <p className="text-xs text-muted-foreground">
            Employee management is restricted to administrators.
          </p>
        </CardContent>
      </Card>
    )
  }

  function toggleSkill(catId: string) {
    if (!form) return
    setForm((f) => {
      if (!f) return f
      const has = f.categorySkills.includes(catId)
      return {
        ...f,
        categorySkills: has
          ? f.categorySkills.filter((x) => x !== catId)
          : [...f.categorySkills, catId],
      }
    })
  }

  // Filter logic (client-side)
  const filtered = users.filter((u) => {
    if (departmentFilter !== 'all' && u.departmentId !== departmentFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${u.name} ${u.email} ${u.departmentName ?? ''} ${u.branchName ?? ''} ${u.jobTitle ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const departmentNameFor = (uid: string | null | undefined) =>
    uid ? departments.find((d) => d.id === uid)?.name ?? null : null
  const departmentColorFor = (uid: string | null | undefined) =>
    uid ? departments.find((d) => d.id === uid)?.color ?? '#64748b' : '#64748b'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Employees
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage team members, their skills, departments, branches and access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {filtered.length} of {users.length}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto wf-scroll">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden lg:table-cell">Skills</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden xl:table-cell">Branch</TableHead>
                  <TableHead className="text-center">Open</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-10 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                        No employees match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((u) => {
                      const deptName = u.departmentName ?? departmentNameFor(u.departmentId)
                      const deptColor = departmentColorFor(u.departmentId)
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar name={u.name} size="md" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{u.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                {u.jobTitle && (
                                  <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
                                    {u.jobTitle}
                                  </p>
                                )}
                              </div>
                              {u.role === 'admin' && (
                                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                                  Admin
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {u.categorySkills.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                u.categorySkills.slice(0, 3).map((cid) => {
                                  const cat = categories.find((c) => c.id === cid)
                                  return cat ? (
                                    <Badge
                                      key={cid}
                                      variant="outline"
                                      className="text-[10px]"
                                      style={{
                                        backgroundColor: `${cat.color}1a`,
                                        color: cat.color,
                                        borderColor: `${cat.color}40`,
                                      }}
                                    >
                                      {cat.name}
                                    </Badge>
                                  ) : null
                                })
                              )}
                              {u.categorySkills.length > 3 && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  +{u.categorySkills.length - 3}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {deptName ? (
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: deptColor }}
                                />
                                {deptName}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {u.branchName ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Landmark className="size-3" />
                                {u.branchName}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex min-w-[28px] justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {u.openTaskCount ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {u.active ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {format(parseISO(u.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(u)}
                                aria-label={`Edit ${u.name}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              {u.active && u.role !== 'admin' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                                      aria-label={`Deactivate ${u.name}`}
                                    >
                                      <UserX className="size-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Deactivate {u.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        They will no longer be able to log in. Their assigned tasks remain.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => void handleDeactivate(u)}
                                      >
                                        Deactivate
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-emerald-600 dark:text-emerald-400" />
              {form?.id ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
            <DialogDescription>
              Set name, email, role, skills, department and branch.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Name</Label>
                <Input
                  id="e-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  placeholder="Jane Doe"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-email">Email</Label>
                <Input
                  id="e-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => (f ? { ...f, email: e.target.value } : f))}
                  placeholder="jane@company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-pass">
                    Password {form.id && <span className="text-muted-foreground">(blank = keep)</span>}
                  </Label>
                  <Input
                    id="e-pass"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => (f ? { ...f, password: e.target.value } : f))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm((f) => (f ? { ...f, role: v as UserRole } : f))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Building2 className="size-3" /> Department
                  </Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => setForm((f) => (f ? { ...f, departmentId: v } : f))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: d.color }}
                            />
                            {d.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    <Landmark className="size-3" /> Branch
                  </Label>
                  <Select
                    value={form.branchId}
                    onValueChange={(v) => setForm((f) => (f ? { ...f, branchId: v } : f))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {branches.filter((b) => b.active).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-jobtitle">Job Title</Label>
                  <Input
                    id="e-jobtitle"
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => (f ? { ...f, jobTitle: e.target.value } : f))}
                    placeholder="Operations Manager"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-phone">Phone</Label>
                  <Input
                    id="e-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => (f ? { ...f, phone: e.target.value } : f))}
                    placeholder="+1 555 0100"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category skills</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border p-2 wf-scroll">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground col-span-2">No categories yet.</p>
                  ) : (
                    categories.map((c) => {
                      const checked = form.categorySkills.includes(c.id)
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm cursor-pointer rounded p-1 hover:bg-accent"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleSkill(c.id)}
                          />
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </label>
                      )
                    })
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
              {form?.id ? 'Save changes' : 'Add employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
