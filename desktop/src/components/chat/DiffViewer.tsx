import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { Highlight, type PrismTheme } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  filePath: string
  oldString: string
  newString: string
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', css: 'css', html: 'markup', xml: 'markup',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
  }
  return langMap[ext ?? ''] || 'text'
}

/** Shared warm syntax theme — must stay in sync with CodeViewer */
const warmSyntaxTheme: PrismTheme = {
  plain: {
    color: '#24201E',
    backgroundColor: 'transparent',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8C7E75', fontStyle: 'italic' as const } },
    { types: ['string', 'attr-value', 'template-string'], style: { color: '#437220' } },
    { types: ['keyword', 'selector', 'important', 'atrule'], style: { color: '#B8533B' } },
    { types: ['function'], style: { color: '#1D5A8C' } },
    { types: ['tag'], style: { color: '#B8533B' } },
    { types: ['number', 'boolean'], style: { color: '#1B7A6A' } },
    { types: ['operator'], style: { color: '#24201E' } },
    { types: ['punctuation'], style: { color: '#5C504A' } },
    { types: ['variable', 'parameter'], style: { color: '#24201E' } },
    { types: ['property', 'attr-name'], style: { color: '#7A3E20' } },
    { types: ['builtin', 'class-name', 'constant', 'symbol'], style: { color: '#7E5520' } },
    { types: ['regex'], style: { color: '#C15F3C' } },
    { types: ['inserted'], style: { color: '#1A7F37' } },
    { types: ['deleted'], style: { color: '#CF222E' } },
  ],
}

function highlightSyntax(str: string, language: string) {
  return (
    <Highlight theme={warmSyntaxTheme} code={str} language={language}>
      {({ tokens, getTokenProps }) => (
        <>
          {tokens.map((line, i) => (
            <span key={i}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </span>
          ))}
        </>
      )}
    </Highlight>
  )
}

const diffStyles = {
  variables: {
    light: {
      diffViewerBackground: '#FDFCF9',
      diffViewerColor: '#3B3330',
      addedBackground: '#E8F5E2',
      addedColor: '#3B3330',
      removedBackground: '#FDECEA',
      removedColor: '#3B3330',
      wordAddedBackground: '#B8E4A8',
      wordRemovedBackground: '#F5B8B4',
      addedGutterBackground: '#D4EDCA',
      removedGutterBackground: '#F9D4D0',
      gutterBackground: '#F4F4F0',
      gutterBackgroundDark: '#EFEEEA',
      highlightBackground: '#FFF5D6',
      highlightGutterBackground: '#FFECB3',
      codeFoldGutterBackground: '#E4EDF6',
      codeFoldBackground: '#EDF4FB',
      emptyLineBackground: '#F4F4F0',
      gutterColor: '#87736D',
      addedGutterColor: '#1A7F37',
      removedGutterColor: '#CF222E',
      codeFoldContentColor: '#87736D',
      diffViewerTitleBackground: '#F4F4F0',
      diffViewerTitleColor: '#87736D',
      diffViewerTitleBorderColor: '#DAC1BA',
    },
  },
  diffContainer: {
    borderRadius: '0',
    fontSize: '12px',
    lineHeight: '1.45',
    fontFamily: 'var(--font-mono)',
  },
  line: {
    padding: '1px 0',
  },
  gutter: {
    padding: '1px 8px',
    minWidth: '40px',
    fontSize: '11px',
  },
  wordDiff: {
    padding: '1px 2px',
    borderRadius: '2px',
  },
}

export function DiffViewer({ filePath, oldString, newString }: Props) {
  const language = inferLanguage(filePath)

  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')
  const additions = newLines.filter((l, i) => l !== (oldLines[i] ?? null)).length
  const deletions = oldLines.filter((l, i) => l !== (newLines[i] ?? null)).length

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-outline-variant)]/50 bg-[var(--color-surface-container-low)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container)] px-3 py-1.5">
        <div className="min-w-0">
          <div className="truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">
            {filePath}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
            <span className="rounded-full bg-[#E8F5E2] px-2 py-0.5 text-[#1A7F37]">+{additions}</span>
            <span className="rounded-full bg-[#FDECEA] px-2 py-0.5 text-[#CF222E]">-{deletions}</span>
          </div>
        </div>
        <CopyButton
          text={`--- ${filePath}\n+++ ${filePath}`}
          label="Copy path"
          className="rounded-md border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-lowest)] px-2 py-1 text-[11px] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-high)] hover:text-[var(--color-text-primary)]"
        />
      </div>

      {/* Diff area */}
      <div className="max-h-[400px] overflow-auto">
        <ReactDiffViewer
          oldValue={oldString}
          newValue={newString}
          splitView={false}
          compareMethod={DiffMethod.WORDS}
          renderContent={(str) => highlightSyntax(str, language)}
          hideLineNumbers={false}
          styles={diffStyles}
          useDarkTheme={false}
        />
      </div>
    </div>
  )
}
