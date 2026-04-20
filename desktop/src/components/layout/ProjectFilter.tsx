import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useTranslation } from '../../i18n'

export function ProjectFilter() {
  const t = useTranslation()
  const { availableProjects, selectedProjects, setSelectedProjects } = useSessionStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const isAllSelected = selectedProjects.length === 0

  const label = isAllSelected
    ? t('sidebar.allProjects')
    : selectedProjects.length === 1
      ? getDisplayName(selectedProjects[0]!, t('sidebar.other'))
      : `${selectedProjects.length} projects`

  const toggleProject = (path: string) => {
    if (isAllSelected) {
      // Switch from "all" to "only this one"
      setSelectedProjects([path])
    } else if (selectedProjects.includes(path)) {
      const next = selectedProjects.filter((p) => p !== path)
      // If nothing left, revert to all
      setSelectedProjects(next.length === 0 ? [] : next)
    } else {
      const next = [...selectedProjects, path]
      // If all are selected individually, revert to "all"
      setSelectedProjects(next.length >= availableProjects.length ? [] : next)
    }
  }

  const selectAll = () => setSelectedProjects([])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)]"
      >
        <span className="truncate max-w-[140px]">{label}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[300px] overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-1"
          style={{ boxShadow: 'var(--shadow-dropdown)' }}
        >
          {/* All projects */}
          <button
            onClick={selectAll}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <FolderIcon />
            <span className="flex-1 text-[var(--color-text-primary)]">{t('sidebar.allProjects')}</span>
            {isAllSelected && <CheckIcon />}
          </button>

          <div className="mx-2 my-1 border-t border-[var(--color-border)]" />

          {/* Individual projects */}
          {availableProjects.map((path) => {
            const checked = !isAllSelected && selectedProjects.includes(path)
            return (
              <button
                key={path}
                onClick={() => toggleProject(path)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <FolderIcon />
                <span className="flex-1 truncate text-[var(--color-text-primary)]">{getDisplayName(path, t('sidebar.other'))}</span>
                {checked && <CheckIcon />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getDisplayName(sanitizedPath: string, fallback: string = 'Other'): string {
  if (!sanitizedPath || sanitizedPath === '_unknown') return fallback
  const segments = sanitizedPath.split('-').filter(Boolean)
  return segments[segments.length - 1] || fallback
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)] flex-shrink-0">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
