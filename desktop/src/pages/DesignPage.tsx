import { useEffect, useRef, useCallback, useState } from 'react'
import { useTabStore } from '../stores/tabStore'
import { useChatStore } from '../stores/chatStore'
import { useDesignStore } from '../stores/designStore'
import { useSessionStore } from '../stores/sessionStore'
import { wsManager } from '../api/websocket'
import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { DesignPreview } from '../components/design/DesignPreview'
import { DesignControls } from '../components/design/DesignControls'
import { DesignToolbar } from '../components/design/DesignToolbar'
import { DESIGN_SYSTEM_PROMPT, BRAND_EXTRACTION_PROMPT } from '../lib/designPrompt'
import type { UIMessage } from '../types/chat'

function extractHtmlFromContent(content: string): string | null {
  const match = content.match(/```html\s*([\s\S]*?)```/)
  return match?.[1]?.trim() ?? null
}

function extractLatestHtmlBlock(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.type !== 'assistant_text') continue
    const html = extractHtmlFromContent(msg.content)
    if (html) return html
  }
  return ''
}

function extractHexColors(text: string): string[] {
  return [...new Set(text.match(/#[0-9A-Fa-f]{6}\b/g) ?? [])]
}

function extractFontNames(text: string): string[] {
  const quoted = text.match(/["']([A-Z][a-zA-Z\s]+)["']/g)?.map((m) => m.replace(/['"]/g, '')) ?? []
  return [...new Set(quoted)]
}

export function DesignPage() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const messages = useChatStore((s) => (activeTabId ? s.sessions[activeTabId]?.messages ?? [] : []))
  const streamingText = useChatStore((s) => (activeTabId ? s.sessions[activeTabId]?.streamingText ?? '' : ''))
  const chatState = useChatStore((s) => (activeTabId ? s.sessions[activeTabId]?.chatState ?? 'idle' : 'idle'))

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === activeTabId))

  const designEntry = useDesignStore((s) => (activeTabId ? s.designs[activeTabId] : undefined))
  const initDesign = useDesignStore((s) => s.initDesign)
  const setPreviewHtml = useDesignStore((s) => s.setPreviewHtml)
  const setCssOverrides = useDesignStore((s) => s.setCssOverrides)
  const setIsExtracting = useDesignStore((s) => s.setIsExtracting)
  const setBrandTokens = useDesignStore((s) => s.setBrandTokens)

  const [chatWidth, setChatWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const setupSentRef = useRef(false)

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = chatWidth
    setIsDragging(true)
    const onMove = (ev: MouseEvent) => {
      setChatWidth(Math.max(240, Math.min(700, startWidth + ev.clientX - startX)))
    }
    const onUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [chatWidth])

  // Connect to session and init design state
  useEffect(() => {
    if (!activeTabId) return
    connectToSession(activeTabId)
    initDesign(activeTabId, activeTabId)
  }, [activeTabId, connectToSession, initDesign])

  // Send system prompt silently on first mount (bypasses chatStore UI messages)
  useEffect(() => {
    if (!activeTabId || setupSentRef.current) return
    const msgs = useChatStore.getState().sessions[activeTabId]?.messages ?? []
    setupSentRef.current = true
    if (msgs.length > 0) return // existing session, skip setup
    wsManager.send(activeTabId, { type: 'user_message', content: DESIGN_SYSTEM_PROMPT })
  }, [activeTabId])

  // Extract HTML from messages/streaming and update preview
  useEffect(() => {
    if (!activeTabId) return
    const html = extractHtmlFromContent(streamingText) ?? extractLatestHtmlBlock(messages)
    if (html) setPreviewHtml(activeTabId, html)
  }, [messages, streamingText, activeTabId, setPreviewHtml])

  // Detect brand extraction completion
  useEffect(() => {
    if (!activeTabId || !designEntry?.isExtracting) return
    if (chatState !== 'idle') return
    const lastAssistant = [...messages].reverse().find((m) => m.type === 'assistant_text')
    if (lastAssistant && lastAssistant.type === 'assistant_text') {
      const colors = extractHexColors(lastAssistant.content)
      const fonts = extractFontNames(lastAssistant.content)
      setBrandTokens(activeTabId, { colors, fonts })
      if (colors.length > 0) {
        setCssOverrides(activeTabId, { primaryColor: colors[0] })
      }
    }
    setIsExtracting(activeTabId, false)
  }, [activeTabId, chatState, messages, designEntry?.isExtracting, setCssOverrides, setIsExtracting, setBrandTokens])

  const handleExportHtml = useCallback(() => {
    if (!designEntry?.previewHtml) return
    const blob = new Blob([designEntry.previewHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `design-${Date.now()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [designEntry?.previewHtml])

  const handleExportPdf = useCallback(() => {
    iframeRef.current?.contentWindow?.print()
  }, [])

  const handleExtractBrand = useCallback(() => {
    if (!activeTabId) return
    const workDir = session?.workDir
    if (!workDir) return
    setIsExtracting(activeTabId, true)
    useChatStore.getState().sendMessage(activeTabId, BRAND_EXTRACTION_PROMPT(workDir))
  }, [activeTabId, session?.workDir, setIsExtracting])

  if (!activeTabId || !designEntry) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DesignToolbar
        hasHtml={!!designEntry.previewHtml}
        isExtracting={designEntry.isExtracting}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onExtractBrand={handleExtractBrand}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div style={{ width: chatWidth }} className="flex flex-col shrink-0 overflow-hidden">
          <MessageList />
          <ChatInput />
        </div>
        <div
          onMouseDown={handleDividerMouseDown}
          className="w-1 cursor-col-resize hover:bg-[var(--color-brand)] bg-[var(--color-border)] shrink-0 transition-colors"
        />
        {/* Preview + controls */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ pointerEvents: isDragging ? 'none' : undefined }}>
          <DesignPreview
            html={designEntry.previewHtml}
            cssOverrides={designEntry.cssOverrides}
            iframeRef={iframeRef}
          />
          <DesignControls
            overrides={designEntry.cssOverrides}
            onChange={(partial) => setCssOverrides(activeTabId, partial)}
          />
        </div>
      </div>
    </div>
  )
}
