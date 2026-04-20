import { useEffect, useCallback } from 'react'
import type { RefObject } from 'react'
import type { CssOverrides } from '../../stores/designStore'

type Props = {
  html: string
  cssOverrides: CssOverrides
  iframeRef: RefObject<HTMLIFrameElement>
}

export function DesignPreview({ html, cssOverrides, iframeRef }: Props) {
  const injectOverrides = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document
    if (!doc || !doc.head) return
    let el = doc.getElementById('design-overrides') as HTMLStyleElement | null
    if (!el) {
      el = doc.createElement('style')
      el.id = 'design-overrides'
      doc.head.appendChild(el)
    }
    el.textContent = `:root {
      --primary-color: ${cssOverrides.primaryColor} !important;
      --font-family: ${cssOverrides.fontFamily} !important;
      --spacing-unit: ${cssOverrides.spacing}px !important;
    }`
  }, [cssOverrides, iframeRef])

  // Re-inject after iframe reloads due to srcdoc change
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => injectOverrides()
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [html, injectOverrides, iframeRef])

  // Live-inject when overrides change without reloading
  useEffect(() => {
    injectOverrides()
  }, [injectOverrides])

  if (!html) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center select-none text-[var(--color-text-tertiary)] bg-[var(--color-surface-container-low)]">
        <span className="material-symbols-outlined mb-3 opacity-30" style={{ fontSize: 48 }}>web</span>
        <p className="text-sm">Describe a design to preview it here</p>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className="flex-1 w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
      title="Design Preview"
    />
  )
}
