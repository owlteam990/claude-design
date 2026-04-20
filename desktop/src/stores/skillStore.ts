import { create } from 'zustand'
import { skillsApi } from '../api/skills'
import type { SkillMeta, SkillDetail } from '../types/skill'

type SkillStore = {
  skills: SkillMeta[]
  selectedSkill: SkillDetail | null
  isLoading: boolean
  isDetailLoading: boolean
  error: string | null

  fetchSkills: () => Promise<void>
  fetchSkillDetail: (source: string, name: string) => Promise<void>
  clearSelection: () => void
}

export const useSkillStore = create<SkillStore>((set) => ({
  skills: [],
  selectedSkill: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,

  fetchSkills: async () => {
    set({ isLoading: true, error: null })
    try {
      const { skills } = await skillsApi.list()
      set({ skills, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  fetchSkillDetail: async (source, name) => {
    set({ isDetailLoading: true, error: null })
    try {
      const { detail } = await skillsApi.detail(source, name)
      set({ selectedSkill: detail, isDetailLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isDetailLoading: false,
      })
    }
  },

  clearSelection: () => set({ selectedSkill: null }),
}))
