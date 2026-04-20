import { api } from './client'
import type { SkillMeta, SkillDetail } from '../types/skill'

export const skillsApi = {
  list: () => api.get<{ skills: SkillMeta[] }>('/api/skills'),

  detail: (source: string, name: string) =>
    api.get<{ detail: SkillDetail }>(
      `/api/skills/detail?source=${encodeURIComponent(source)}&name=${encodeURIComponent(name)}`,
    ),
}
