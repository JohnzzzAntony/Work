'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ClipboardCopy,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Send,
  Sparkles,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import {
  PRIORITIES,
  TONES,
  type CategoryDTO,
  type EmailAnalyzeResponse,
  type ReplyTone,
  type UserDTO,
} from '@/lib/types'
import { toast } from 'sonner'

type Settings = {
  companyName: string
  defaultTone: ReplyTone
}

export function NewEmailView() {
  const openTask = useAppStore((s) => s.openTask)

  // Step 1 input
  const [sender, setSender] = React.useState('')
  const [emailText, setEmailText] = React.useState('')
  const [tone, setTone] = React.useState<ReplyTone>('formal')

  // Loading + result
  const [analyzing, setAnalyzing] = React.useState(false)
  const [result, setResult] = React.useState<EmailAnalyzeResponse | null>(null)

  // Editable suggested task fields
  const [title, setTitle] = React.useState('')
  const [categoryId, setCategoryId] = React.useState<string>('')
  const [priority, setPriority] = React.useState<string>('medium')
  const [dueDate, setDueDate] = React.useState<string>('')
  const [summary, setSummary] = React.useState('')

  // Editable reply draft
  const [replyDraft, setReplyDraft] = React.useState('')
  const [regenerating, setRegenerating] = React.useState(false)

  // Assignment + saving
  const [assigneeId, setAssigneeId] = React.useState<string>('none')
  const [saving, setSaving] = React.useState<'save' | 'assign' | null>(null)

  // Reference data
  const [categories, setCategories] = React.useState<CategoryDTO[]>([])
  const [users, setUsers] = React.useState<UserDTO[]>([])
  const [settings, setSettings] = React.useState<Settings | null>(null)

  React.useEffect(() => {
    void apiFetch<CategoryDTO[]>('/api/categories').then(setCategories).catch(() => {})
    void apiFetch<UserDTO[]>('/api/users').then(setUsers).catch(() => {})
    void apiFetch<Settings>('/api/settings').then((s) => {
      setSettings(s)
      setTone(s.defaultTone as ReplyTone)
    }).catch(() => {})
  }, [])

  async function handleAnalyze() {
    if (!emailText.trim()) {
      toast.error('Please paste the email content first.')
      return
    }
    setAnalyzing(true)
    try {
      const res = await apiFetch<EmailAnalyzeResponse>('/api/email/analyze', {
        method: 'POST',
        body: JSON.stringify({
          emailText,
          sender: sender.trim() || undefined,
          tone,
          companyName: settings?.companyName,
        }),
      })
      setResult(res)
      setTitle(res.title)
      setSummary(res.summary)
      setReplyDraft(res.replyDraft)
      setPriority(res.priority)
      setDueDate(res.dueDate ? res.dueDate.slice(0, 10) : '')
      // Find category by name
      const matchedCat = categories.find((c) => c.name === res.category)
      if (matchedCat) {
        setCategoryId(matchedCat.id)
      } else if (categories[0]) {
        setCategoryId(categories[0].id)
      }
      toast.success('Email analyzed!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleRegenerate() {
    if (!result) return
    setRegenerating(true)
    try {
      const res = await apiFetch<{ replyDraft: string }>('/api/email/regenerate-reply', {
        method: 'POST',
        body: JSON.stringify({
          emailText,
          tone,
          category: categories.find((c) => c.id === categoryId)?.name ?? result.category,
          sender: sender.trim(),
          companyName: settings?.companyName,
        }),
      })
      setReplyDraft(res.replyDraft)
      toast.success('Reply regenerated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(replyDraft)
      toast.success('Reply copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  function reset() {
    setResult(null)
    setTitle('')
    setSummary('')
    setReplyDraft('')
    setDueDate('')
    setPriority('medium')
    setCategoryId('')
    setAssigneeId('none')
  }

  async function handleSave(mode: 'save' | 'assign') {
    if (!result) return
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!categoryId) {
      toast.error('Please select a category')
      return
    }
    setSaving(mode)
    const finalAssignee = mode === 'assign' && assigneeId !== 'none' ? assigneeId : null
    try {
      const created = await apiFetch<{ id: string }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          categoryId,
          priority,
          dueDate: dueDate || undefined,
          description: summary,
          assigneeId: finalAssignee,
          sourceEmailText: emailText,
          sourceSender: sender.trim() || undefined,
          generatedReplyText: replyDraft,
          replySent: false,
        }),
      })
      toast.success(
        mode === 'assign' && finalAssignee ? 'Task created & assigned' : 'Task created'
      )
      reset()
      setEmailText('')
      setSender('')
      openTask(created.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setSaving(null)
    }
  }

  // Suggested assignees — show all employees, but highlight those with category skill
  const suggestedAssignees = React.useMemo(() => {
    if (!categoryId) return users.filter((u) => u.role === 'employee' && u.active)
    const skilled = users.filter(
      (u) => u.role === 'employee' && u.active && u.categorySkills.includes(categoryId)
    )
    const others = users.filter(
      (u) => u.role === 'employee' && u.active && !u.categorySkills.includes(categoryId)
    )
    return [...skilled, ...others]
  }, [users, categoryId])

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            New Work from Email
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste an email — AI will suggest a task and draft a reply.
          </p>
        </div>
        {result && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <ArrowLeft className="size-4" />
            Start over
          </Button>
        )}
      </div>

      {/* Input step */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="size-4 text-emerald-600 dark:text-emerald-400" />
            Email Content
          </CardTitle>
          <CardDescription>Optional sender info + the full email body.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sender">Sender (optional)</Label>
              <Input
                id="sender"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Jane Doe <jane@example.com>"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tone">Reply tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as ReplyTone)}>
                <SelectTrigger id="tone" className="w-full capitalize">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email body</Label>
            <Textarea
              id="email"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              placeholder="Paste the full email content here…"
              disabled={!!result}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => void handleAnalyze()}
              disabled={analyzing || !emailText.trim() || !!result}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing… (5–15s)
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Analyze Email
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results step */}
      {analyzing && !result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: suggested task */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Suggested Task
                </CardTitle>
                <CardDescription>Edit any field before saving.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-title">Title</Label>
                  <Input
                    id="t-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="t-cat">Category</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger id="t-cat" className="w-full">
                        <SelectValue placeholder="Select…" />
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
                    <Label htmlFor="t-prio">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger id="t-prio" className="w-full capitalize">
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
                    <Label htmlFor="t-due">Due date</Label>
                    <Input
                      id="t-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>AI Summary</Label>
                  <div className="text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-700 dark:text-slate-300">
                    {summary || '—'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: generated reply */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Generated Reply
                  </CardTitle>
                  <Badge className="capitalize bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900">
                    {tone}
                  </Badge>
                </div>
                <CardDescription>Adjust tone and regenerate any time.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="r-tone">Tone</Label>
                    <Select
                      value={tone}
                      onValueChange={(v) => setTone(v as ReplyTone)}
                    >
                      <SelectTrigger id="r-tone" className="w-full capitalize">
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
                  <div className="space-y-1.5 flex items-end">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleRegenerate()}
                      disabled={regenerating}
                    >
                      {regenerating ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="r-text">Reply draft</Label>
                    <Button size="sm" variant="ghost" onClick={() => void copyReply()}>
                      <ClipboardCopy className="size-3.5" />
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    id="r-text"
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={9}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assign + Save */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assign &amp; Save</CardTitle>
              <CardDescription>
                Optionally assign now — otherwise the task is saved as <code className="text-xs">new</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="assignee">Assign to (optional)</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger id="assignee" className="w-full">
                      <SelectValue placeholder="Don't assign yet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't assign yet</SelectItem>
                      {suggestedAssignees.map((u) => {
                        const skilled = categoryId && u.categorySkills.includes(categoryId)
                        return (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} {skilled ? '★' : ''}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {categoryId && (
                    <p className="text-[11px] text-muted-foreground">
                      ★ = employee skilled in this category
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleSave('save')}
                    disabled={saving !== null}
                  >
                    {saving === 'save' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save as Task
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void handleSave('assign')}
                    disabled={saving !== null || assigneeId === 'none'}
                  >
                    {saving === 'assign' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Save + Assign
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
