import { create } from 'zustand'

export type CssOverrides = {
  primaryColor: string
  fontFamily: string
  spacing: number
}

export type DesignEntry = {
  sessionId: string
  previewHtml: string
  cssOverrides: CssOverrides
  brandTokens: { colors: string[]; fonts: string[] } | null
  isExtracting: boolean
}

type DesignStore = {
  designs: Record<string, DesignEntry>
  initDesign: (tabId: string, sessionId: string) => void
  setPreviewHtml: (tabId: string, html: string) => void
  setCssOverrides: (tabId: string, overrides: Partial<CssOverrides>) => void
  setBrandTokens: (tabId: string, tokens: DesignEntry['brandTokens']) => void
  setIsExtracting: (tabId: string, value: boolean) => void
  removeDesign: (tabId: string) => void
}

const DEFAULT_CSS: CssOverrides = {
  primaryColor: '#8F482F',
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  spacing: 16,
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  designs: {},

  initDesign: (tabId, sessionId) => {
    if (get().designs[tabId]) return
    set((s) => ({
      designs: {
        ...s.designs,
        [tabId]: {
          sessionId,
          previewHtml: '',
          cssOverrides: { ...DEFAULT_CSS },
          brandTokens: null,
          isExtracting: false,
        },
      },
    }))
  },

  setPreviewHtml: (tabId, html) =>
    set((s) => {
      const entry = s.designs[tabId]
      if (!entry) return s
      return { designs: { ...s.designs, [tabId]: { ...entry, previewHtml: html } } }
    }),

  setCssOverrides: (tabId, overrides) =>
    set((s) => {
      const entry = s.designs[tabId]
      if (!entry) return s
      return {
        designs: {
          ...s.designs,
          [tabId]: { ...entry, cssOverrides: { ...entry.cssOverrides, ...overrides } },
        },
      }
    }),

  setBrandTokens: (tabId, tokens) =>
    set((s) => {
      const entry = s.designs[tabId]
      if (!entry) return s
      return { designs: { ...s.designs, [tabId]: { ...entry, brandTokens: tokens } } }
    }),

  setIsExtracting: (tabId, value) =>
    set((s) => {
      const entry = s.designs[tabId]
      if (!entry) return s
      return { designs: { ...s.designs, [tabId]: { ...entry, isExtracting: value } } }
    }),

  removeDesign: (tabId) =>
    set((s) => {
      const { [tabId]: _, ...rest } = s.designs
      return { designs: rest }
    }),
}))
