'use client'

import { create } from 'zustand'
import type { UserDTO } from '@/lib/types'

export type ViewId =
  | 'dashboard'
  | 'new-email'
  | 'email-summary'
  | 'board'
  | 'task-detail'
  | 'employees'
  | 'departments'
  | 'branches'
  | 'notifications'
  | 'reports'
  | 'settings'

type AppState = {
  user: UserDTO | null
  currentView: ViewId
  currentTaskId: string | null
  sidebarOpen: boolean
  unreadCount: number
  setUser: (u: UserDTO | null) => void
  logout: () => void
  setView: (v: ViewId) => void
  openTask: (id: string) => void
  setSidebarOpen: (open: boolean) => void
  setUnreadCount: (n: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentView: 'dashboard',
  currentTaskId: null,
  sidebarOpen: false,
  unreadCount: 0,
  setUser: (u) => set({ user: u }),
  logout: () =>
    set({
      user: null,
      currentView: 'dashboard',
      currentTaskId: null,
      sidebarOpen: false,
      unreadCount: 0,
    }),
  setView: (v) => set({ currentView: v, sidebarOpen: false }),
  openTask: (id) => set({ currentTaskId: id, currentView: 'task-detail', sidebarOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setUnreadCount: (n) => set({ unreadCount: Math.max(0, n) }),
}))
