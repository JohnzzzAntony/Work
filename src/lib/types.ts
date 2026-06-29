// Shared type definitions and constants for WorkFlow Hub

export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'in_review'
  | 'done'
  | 'closed'
export type UserRole = 'admin' | 'employee'
export type ReplyTone = 'formal' | 'friendly' | 'apologetic' | 'concise'
export type NotificationType =
  | 'assigned'
  | 'due_soon'
  | 'overdue'
  | 'comment'
  | 'done_needs_verification'
  | 'reply_not_sent'
  | 'in_review_reminder'
  | 'status_change'

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
export const STATUSES: TaskStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'blocked',
  'in_review',
  'done',
  'closed',
]
export const TONES: ReplyTone[] = ['formal', 'friendly', 'apologetic', 'concise']

// Kanban columns (visible on the board)
export const KANBAN_COLUMNS: TaskStatus[] = [
  'new',
  'assigned',
  'in_progress',
  'blocked',
  'in_review',
  'done',
]

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; badgeClass: string; dotClass: string; rank: number }
> = {
  urgent: {
    label: 'Urgent',
    color: '#dc2626',
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
    dotClass: 'bg-red-500',
    rank: 0,
  },
  high: {
    label: 'High',
    color: '#ea580c',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
    dotClass: 'bg-orange-500',
    rank: 1,
  },
  medium: {
    label: 'Medium',
    color: '#ca8a04',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    dotClass: 'bg-amber-500',
    rank: 2,
  },
  low: {
    label: 'Low',
    color: '#16a34a',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
    dotClass: 'bg-emerald-500',
    rank: 3,
  },
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; color: string; badgeClass: string; dotClass: string }
> = {
  new: {
    label: 'New',
    color: '#6366f1',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  assigned: {
    label: 'Assigned',
    color: '#0ea5e9',
    badgeClass: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900',
    dotClass: 'bg-sky-500',
  },
  in_progress: {
    label: 'In Progress',
    color: '#8b5cf6',
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900',
    dotClass: 'bg-violet-500',
  },
  blocked: {
    label: 'Blocked',
    color: '#dc2626',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900',
    dotClass: 'bg-rose-500',
  },
  in_review: {
    label: 'In Review',
    color: '#f59e0b',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    dotClass: 'bg-amber-500',
  },
  done: {
    label: 'Done',
    color: '#16a34a',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900',
    dotClass: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    color: '#64748b',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
}

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { icon: string; label: string; toneClass: string }
> = {
  assigned: { icon: '🆕', label: 'New assignment', toneClass: 'text-sky-600 dark:text-sky-400' },
  due_soon: { icon: '⏰', label: 'Due soon', toneClass: 'text-amber-600 dark:text-amber-400' },
  overdue: { icon: '🔴', label: 'Overdue', toneClass: 'text-red-600 dark:text-red-400' },
  comment: { icon: '💬', label: 'New comment', toneClass: 'text-violet-600 dark:text-violet-400' },
  done_needs_verification: {
    icon: '✅',
    label: 'Needs verification',
    toneClass: 'text-emerald-600 dark:text-emerald-400',
  },
  reply_not_sent: {
    icon: '✍️',
    label: 'Reply not sent',
    toneClass: 'text-orange-600 dark:text-orange-400',
  },
  in_review_reminder: {
    icon: '⏳',
    label: 'In review',
    toneClass: 'text-amber-600 dark:text-amber-400',
  },
  status_change: {
    icon: '🔄',
    label: 'Status update',
    toneClass: 'text-slate-600 dark:text-slate-400',
  },
}

// API response types — these define the contract between frontend and backend

export type CategoryDTO = {
  id: string
  name: string
  color: string
}

export type UserDTO = {
  id: string
  email: string
  name: string
  role: UserRole
  categorySkills: string[]
  active: boolean
  createdAt: string
  openTaskCount?: number
}

export type ActivityLogDTO = {
  id: string
  taskId: string
  userId: string | null
  userName: string | null
  actionType: string
  content: string
  createdAt: string
}

export type CommentDTO = {
  id: string
  taskId: string
  userId: string
  userName: string
  body: string
  createdAt: string
}

export type TaskDTO = {
  id: string
  title: string
  description: string
  categoryId: string
  categoryName: string
  categoryColor: string
  priority: Priority
  status: TaskStatus
  assigneeId: string | null
  assigneeName: string | null
  createdById: string
  createdByName: string
  sourceEmailText: string | null
  sourceSender: string | null
  generatedReplyText: string | null
  replySent: boolean
  dueDate: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  commentCount?: number
}

export type TaskDetailDTO = TaskDTO & {
  activityLogs: ActivityLogDTO[]
  comments: CommentDTO[]
}

export type NotificationDTO = {
  id: string
  userId: string
  taskId: string | null
  taskTitle: string | null
  type: NotificationType
  message: string
  read: boolean
  createdAt: string
}

export type EmailAnalyzeRequest = {
  emailText: string
  sender?: string
  tone?: ReplyTone
  companyName?: string
}

export type EmailAnalyzeResponse = {
  title: string
  category: string // category name
  priority: Priority
  summary: string
  dueDate: string | null // ISO date
  replyDraft: string
  detectedSender?: string
}

// ─── Email Summary → Multi-task analysis ───
// Used by the "Email Summary" view: paste a full email digest/summary that may
// contain multiple distinct tasks; the LLM parses them into structured items.

export type ParsedTask = {
  title: string
  category: string // category NAME (resolved by backend)
  categoryId: string // resolved category id
  priority: Priority
  description: string
  dueDate: string | null // ISO date
  suggestedAssigneeId: string | null
  suggestedAssigneeName: string | null
}

export type EmailSummaryAnalyzeRequest = {
  text: string
  companyName?: string
}

export type EmailSummaryAnalyzeResponse = {
  tasks: ParsedTask[]
}

export type BulkCreateTaskInput = {
  title: string
  categoryId: string
  priority: Priority
  description?: string
  dueDate?: string
  assigneeId?: string | null
  sourceEmailText?: string
  sourceSender?: string
}

export type DashboardSummary = {
  open: number
  overdue: number
  dueToday: number
  doneThisWeek: number
  byCategory: { categoryId: string; name: string; color: string; count: number }[]
  byEmployee: { userId: string; name: string; openCount: number; overdueCount: number }[]
  needsAttention: {
    id: string
    title: string
    reason: string
    assigneeName: string | null
    dueDate: string | null
    priority: Priority
  }[]
}

export type ReportsSummary = {
  totalTasks: number
  closedTasks: number
  avgCompletionHours: number | null
  overdueCount: number
  followUpCount: number
  perEmployee: {
    userId: string
    name: string
    assigned: number
    completed: number
    overdue: number
    avgCompletionHours: number | null
  }[]
  perCategory: {
    categoryId: string
    name: string
    color: string
    total: number
    closed: number
    overdue: number
  }[]
  perPriority: { priority: Priority; total: number; closed: number }[]
  recentCompletions: { id: string; title: string; assigneeName: string | null; closedAt: string; hoursToClose: number | null }[]
}
