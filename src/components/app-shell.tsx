'use client'

import * as React from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  Bell,
  CheckCheck,
  ChevronDown,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Tag,
  Users,
  Workflow,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore, type ViewId } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { NOTIFICATION_TYPE_META, type NotificationDTO, type UserDTO } from '@/lib/types'
import { LoginView } from '@/components/views/login-view'
import { DashboardView } from '@/components/views/dashboard-view'
import { BoardView } from '@/components/views/board-view'
import { TaskDetailView } from '@/components/views/task-detail-view'
import { NewEmailView } from '@/components/views/new-email-view'
import { NotificationsView } from '@/components/views/notifications-view'
import { EmployeesView } from '@/components/views/employees-view'
import { SettingsView } from '@/components/views/settings-view'
import { ReportsView } from '@/components/views/reports-view'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type NavItem = {
  view: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'new-email', label: 'New Work from Email', icon: Mail, adminOnly: true },
  { view: 'board', label: 'Work Board', icon: ListTodo },
  { view: 'employees', label: 'Employees', icon: Users, adminOnly: true },
  { view: 'notifications', label: 'Notifications', icon: Bell },
  { view: 'reports', label: 'Reports', icon: ShieldCheck, adminOnly: true },
  { view: 'settings', label: 'Settings', icon: Tag, adminOnly: true },
]

export function AppShell() {
  const user = useAppStore((s) => s.user)
  const currentView = useAppStore((s) => s.currentView)
  const setUser = useAppStore((s) => s.setUser)
  const logout = useAppStore((s) => s.logout)
  const setView = useAppStore((s) => s.setView)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  // Check for existing session on first mount
  const [checkingSession, setCheckingSession] = React.useState(true)
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const me = await apiFetch<{ user: UserDTO }>('/api/auth/me')
        if (!cancelled) setUser(me.user)
      } catch {
        // not logged in — fine
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setUser])

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
            <Workflow className="size-6" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-3 animate-spin rounded-full border-2 border-emerald-600/40 border-t-emerald-600" />
            Loading WorkFlow Hub…
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginView />

  const isAdmin = user.role === 'admin'
  const navItems = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Mobile menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 pb-2">
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Workflow className="size-4" />
                  </span>
                  WorkFlow Hub
                </SheetTitle>
              </SheetHeader>
              <SidebarNav
                items={navItems}
                currentView={currentView}
                onNavigate={(v) => setView(v)}
              />
            </SheetContent>
          </Sheet>

          {/* Logo + name */}
          <div className="flex items-center gap-2">
            <span className="hidden md:flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Workflow className="size-4" />
            </span>
            <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              WorkFlow Hub
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <NotificationsBell />
            <UserMenu user={user} onLogout={() => void handleLogout(setUser, logout)} />
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <SidebarNav
            items={navItems}
            currentView={currentView}
            onNavigate={(v) => setView(v)}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <React.Suspense fallback={null}>
            <ViewSwitcher />
          </React.Suspense>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <p>WorkFlow Hub • v1.0 — work assignment &amp; follow-up tracker</p>
          <p className="hidden sm:block">
            AI-assisted task creation • Real-time notifications
          </p>
        </div>
      </footer>

      {/* WebSocket connector */}
      <WebSocketConnector />
    </div>
  )
}

async function handleLogout(
  setUser: (u: null) => void,
  logout: () => void
) {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // ignore — even if logout endpoint fails, clear local state
  }
  setUser(null)
  logout()
}

function ViewSwitcher() {
  const currentView = useAppStore((s) => s.currentView)
  switch (currentView) {
    case 'dashboard':
      return <DashboardView />
    case 'new-email':
      return <NewEmailView />
    case 'board':
      return <BoardView />
    case 'task-detail':
      return <TaskDetailView />
    case 'employees':
      return <EmployeesView />
    case 'notifications':
      return <NotificationsView />
    case 'reports':
      return <ReportsView />
    case 'settings':
      return <SettingsView />
    default:
      return <DashboardView />
  }
}

function SidebarNav({
  items,
  currentView,
  onNavigate,
}: {
  items: NavItem[]
  currentView: ViewId
  onNavigate: (v: ViewId) => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
      <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      {items.map((item) => {
        const Icon = item.icon
        const active = currentView === item.view
        return (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
            )}
          >
            <Icon className={cn('size-4', active && 'text-emerald-600 dark:text-emerald-400')} />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme">
        <Sun className="size-4" />
      </Button>
    )
  }
  const isDark = theme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function UserMenu({
  user,
  onLogout,
}: {
  user: UserDTO
  onLogout: () => void
}) {
  const initials = (user.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="size-7">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
              {user.name}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">{user.role}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{user.name}</span>
          <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationsBell() {
  const unreadCount = useAppStore((s) => s.unreadCount)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)
  const openTask = useAppStore((s) => s.openTask)
  const setView = useAppStore((s) => s.setView)
  const user = useAppStore((s) => s.user)
  const [items, setItems] = React.useState<NotificationDTO[]>([])
  const [open, setOpen] = React.useState(false)

  const loadRecent = React.useCallback(async () => {
    if (!user) return
    try {
      const all = await apiFetch<NotificationDTO[]>('/api/notifications?filter=all')
      const unread = all.filter((n) => !n.read)
      setUnreadCount(unread.length)
      setItems(all.slice(0, 5))
    } catch {
      /* ignore */
    }
  }, [user, setUnreadCount])

  React.useEffect(() => {
    void loadRecent()
    // poll every 60s as a fallback for environments where WS may not be available
    const id = setInterval(() => void loadRecent(), 60000)
    return () => clearInterval(id)
  }, [loadRecent])

  async function handleClick(n: NotificationDTO) {
    if (!n.read) {
      try {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
        setItems((curr) => curr.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
        setUnreadCount(Math.max(0, unreadCount - 1))
      } catch {
        /* ignore */
      }
    }
    setOpen(false)
    if (n.taskId) openTask(n.taskId)
  }

  async function handleMarkAllRead() {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' })
      setItems((curr) => curr.map((x) => ({ ...x, read: true })))
      setUnreadCount(0)
      toast.success('All marked as read')
    } catch {
      /* ignore */
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleMarkAllRead()}
            >
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((n) => {
                const meta = NOTIFICATION_TYPE_META[n.type]
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => void handleClick(n)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50',
                        !n.read && 'bg-emerald-50/60 dark:bg-emerald-950/20'
                      )}
                    >
                      <span className="text-base leading-none mt-0.5">{meta?.icon ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.read && (
                        <span className="mt-1 size-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <button
          onClick={() => {
            setOpen(false)
            setView('notifications')
          }}
          className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          View all notifications
        </button>
      </PopoverContent>
    </Popover>
  )
}

function WebSocketConnector() {
  const user = useAppStore((s) => s.user)
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)

  React.useEffect(() => {
    if (!user) return
    let socket: Socket | null = null
    try {
      socket = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
        timeout: 10000,
      })
    } catch (err) {
      console.warn('[ws] failed to init socket', err)
      return
    }

    socket.on('connect', () => {
      socket?.emit('subscribe', { userId: user.id })
    })
    socket.on('notification', (n: NotificationDTO) => {
      setUnreadCount(useAppStore.getState().unreadCount + 1)
      const meta = NOTIFICATION_TYPE_META[n.type]
      toast(n.message, {
        description: meta?.label,
        duration: 5000,
      })
    })
    socket.on('notification_count', (payload: { count: number | null }) => {
      if (typeof payload?.count === 'number') {
        setUnreadCount(payload.count)
      }
    })
    socket.on('connect_error', (err: Error) => {
      // Silent — the polling fallback should kick in, and the bell's REST poll covers us anyway.
      console.debug('[ws] connect error (non-fatal):', err.message)
    })

    return () => {
      socket?.disconnect()
      socket = null
    }
  }, [user, setUnreadCount])

  return null
}
