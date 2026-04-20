import { create } from 'zustand'

export type Toast = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export type SettingsTab = 'providers' | 'permissions' | 'general' | 'adapters' | 'agents' | 'skills' | 'computerUse' | 'about'

type ActiveView = 'code' | 'scheduled' | 'terminal' | 'history' | 'settings'

type UIStore = {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  activeView: ActiveView
  pendingSettingsTab: SettingsTab | null
  activeModal: string | null
  toasts: Toast[]

  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveView: (view: ActiveView) => void
  setPendingSettingsTab: (tab: SettingsTab | null) => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUIStore = create<UIStore>((set) => ({
  theme: 'light',
  sidebarOpen: true,
  activeView: 'code',
  pendingSettingsTab: null,
  activeModal: null,
  toasts: [],

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    set({ theme })
  },

  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveView: (view) => set({ activeView: view }),
  setPendingSettingsTab: (tab) => set({ pendingSettingsTab: tab }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // Auto-remove after duration
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
