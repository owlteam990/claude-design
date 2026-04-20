type Props = {
  hasHtml: boolean
  isExtracting: boolean
  onExportHtml: () => void
  onExportPdf: () => void
  onExtractBrand: () => void
}

export function DesignToolbar({
  hasHtml,
  isExtracting,
  onExportHtml,
  onExportPdf,
  onExtractBrand,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-container)] shrink-0">
      <div className="flex items-center gap-1.5 mr-auto">
        <span
          className="material-symbols-outlined text-[var(--color-brand)]"
          style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
        >
          palette
        </span>
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">Claude Design</span>
      </div>

      <button
        onClick={onExtractBrand}
        disabled={isExtracting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {isExtracting ? 'pending' : 'colorize'}
        </span>
        {isExtracting ? 'Extracting…' : 'Use my brand'}
      </button>

      <button
        onClick={onExportHtml}
        disabled={!hasHtml}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
        HTML
      </button>

      <button
        onClick={onExportPdf}
        disabled={!hasHtml}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>picture_as_pdf</span>
        PDF
      </button>
    </div>
  )
}
