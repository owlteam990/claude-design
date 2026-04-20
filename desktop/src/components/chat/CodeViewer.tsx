import { useState, useRef, useEffect } from 'react'
import { ShikiHighlighter } from 'react-shiki'
import 'react-shiki/css'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  code: string
  language?: string
  maxLines?: number
  showLineNumbers?: boolean
}

/**
 * Custom warm-toned TextMate theme — uses VS Code-quality tokenization
 * while harmonizing with the app's cream/terra-cotta design system.
 */
const warmCodeTheme = {
  name: 'warm-code',
  type: 'light' as const,
  fg: '#24201E',
  bg: 'transparent',
  tokenColors: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#5C6B7A', fontStyle: 'italic' } },
    { scope: ['string', 'string.quoted', 'string.template', 'string.other.link'], settings: { foreground: '#437220' } },
    { scope: ['string.regexp'], settings: { foreground: '#C15F3C' } },
    { scope: ['keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier'], settings: { foreground: '#B8533B' } },
    { scope: ['keyword.operator'], settings: { foreground: '#B8533B' } },
    { scope: ['entity.name.function', 'support.function'], settings: { foreground: '#1D5A8C' } },
    { scope: ['entity.name.type', 'support.type', 'support.class', 'entity.name.class', 'entity.other.inherited-class'], settings: { foreground: '#7E5520' } },
    { scope: ['entity.name.type.parameter'], settings: { foreground: '#1B7A6A' } },
    { scope: ['variable', 'variable.other', 'variable.other.readwrite'], settings: { foreground: '#24201E' } },
    { scope: ['variable.parameter'], settings: { foreground: '#5C3D2E' } },
    { scope: ['variable.other.property', 'support.type.property-name', 'meta.object-literal.key'], settings: { foreground: '#7A3E20' } },
    { scope: ['variable.other.constant', 'variable.other.enummember'], settings: { foreground: '#7E5520' } },
    { scope: ['constant.numeric', 'constant.language'], settings: { foreground: '#1B7A6A' } },
    { scope: ['punctuation', 'meta.brace', 'meta.bracket'], settings: { foreground: '#5C504A' } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#B8533B' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#7A3E20' } },
    { scope: ['meta.decorator', 'punctuation.decorator'], settings: { foreground: '#7E5520' } },
    { scope: ['markup.inserted', 'punctuation.definition.inserted'], settings: { foreground: '#1A7F37' } },
    { scope: ['markup.deleted', 'punctuation.definition.deleted'], settings: { foreground: '#CF222E' } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: '#1D5A8C', fontStyle: 'bold' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
  ],
}

/**
 * Wraps ShikiHighlighter with a plain-text fallback so the code area
 * is never empty while the async WASM / language-grammar load is in-flight,
 * or if highlighting fails entirely.
 */
function CodeArea({ code, language, showLineNumbers }: { code: string; language?: string; showLineNumbers: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // ShikiHighlighter renders `null` until the async highlight completes.
    // Watch for real content appearing via MutationObserver so we can hide
    // the plain-text fallback as soon as highlighted output is in the DOM.
    const el = containerRef.current
    if (!el) return
    const check = () => {
      const shikiContainer = el.querySelector('[data-testid="shiki-container"]')
      // shiki renders a <code> element inside its container once highlighting is done
      if (shikiContainer?.querySelector('code')) {
        setLoaded(true)
      }
    }
    check()
    const observer = new MutationObserver(check)
    observer.observe(el, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [code, language])

  return (
    <div ref={containerRef} className="code-viewer-area max-h-[420px] overflow-auto bg-[#FDFCF9]">
      {/* Plain-text fallback shown until Shiki finishes highlighting */}
      {!loaded && (
        <pre
          style={{
            margin: 0,
            padding: '0.5rem 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.45',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#24201E',
          }}
        >
          {code}
        </pre>
      )}
      <div style={loaded ? undefined : { position: 'absolute', opacity: 0, pointerEvents: 'none' }}>
        <ShikiHighlighter
          language={language || 'text'}
          theme={warmCodeTheme}
          showLineNumbers={showLineNumbers}
          showLanguage={false}
          addDefaultStyles={false}
          style={{
            margin: 0,
            padding: '0.5rem 0',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.45',
          }}
        >
          {code}
        </ShikiHighlighter>
      </div>
    </div>
  )
}

export function CodeViewer({ code, language, maxLines = 20, showLineNumbers = true }: Props) {
  const [expanded, setExpanded] = useState(false)

  const allLines = code.split('\n')
  const isTruncated = !expanded && allLines.length > maxLines
  const visibleCode = isTruncated ? allLines.slice(0, maxLines).join('\n') : code

  const effectiveShowLineNumbers = showLineNumbers && !!language && language !== 'text'
  const languageLabel = language || 'code'
  const lineCountLabel = `${allLines.length} ${allLines.length === 1 ? 'line' : 'lines'}`
  const showExpandToggle = allLines.length > maxLines

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)]/50 bg-[var(--color-surface-container-low)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container)] px-3 py-1.5 text-[11px] text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-[0.14em]">{languageLabel}</span>
          <span>{lineCountLabel}</span>
        </div>
        <CopyButton
          text={code}
          className="rounded-md border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-lowest)] px-2 py-1 text-[11px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-text-primary)]"
        />
      </div>

      {/* Code area */}
      <CodeArea
        code={visibleCode}
        language={language}
        showLineNumbers={effectiveShowLineNumbers}
      />

      {/* Expand/collapse toggle */}
      {showExpandToggle && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container)] py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-text-primary)]"
        >
          {expanded ? 'Collapse' : `Show ${allLines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  )
}
