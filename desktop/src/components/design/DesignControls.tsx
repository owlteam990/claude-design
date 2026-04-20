import type { CssOverrides } from '../../stores/designStore'

const FONT_OPTIONS = [
  { label: 'Inter', value: "'Inter', 'Segoe UI', sans-serif" },
  { label: 'Manrope', value: "'Manrope', sans-serif" },
  { label: 'Georgia (Serif)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
]

type Props = {
  overrides: CssOverrides
  onChange: (overrides: Partial<CssOverrides>) => void
}

export function DesignControls({ overrides, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
      <div className="text-[10px] font-semibold tracking-widest text-[var(--color-text-tertiary)] uppercase">
        Design Tokens
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-[var(--color-text-secondary)] w-24 shrink-0">Primary Color</label>
        <input
          type="color"
          value={overrides.primaryColor}
          onChange={(e) => onChange({ primaryColor: e.target.value })}
          className="h-7 w-10 rounded cursor-pointer border border-[var(--color-border)] bg-transparent p-0.5"
        />
        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{overrides.primaryColor}</span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-[var(--color-text-secondary)] w-24 shrink-0">Font</label>
        <select
          value={overrides.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="flex-1 h-7 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-[var(--color-text-secondary)]">Spacing</label>
          <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{overrides.spacing}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={32}
          step={2}
          value={overrides.spacing}
          onChange={(e) => onChange({ spacing: Number(e.target.value) })}
          className="w-full accent-[var(--color-brand)]"
        />
      </div>
    </div>
  )
}
