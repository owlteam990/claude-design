import { useRef, useState, useEffect, useCallback } from 'react'
import { useTabStore, type Tab } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useTranslation } from '../../i18n'
import { WindowControls, showWindowControls } from './WindowControls'

const TAB_WIDTH = 180

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const disconnectSession = useChatStore((s) => s.disconnectSession)

  const moveTab = useTabStore((s) => s.moveTab)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const [closingTabId, setClosingTabId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const t = useTranslation()

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState)
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, tabs.length])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -TAB_WIDTH : TAB_WIDTH, behavior: 'smooth' })
  }

  const handleClose = (sessionId: string) => {
    // Special tabs can always be closed directly
    const tab = tabs.find((t) => t.sessionId === sessionId)
    if (tab && tab.type !== 'session') {
      closeTab(sessionId)
      return
    }

    const sessionState = useChatStore.getState().sessions[sessionId]
    const isRunning = sessionState && sessionState.chatState !== 'idle'

    if (isRunning) {
      setClosingTabId(sessionId)
      return
    }

    disconnectSession(sessionId)
    closeTab(sessionId)
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setContextMenu({ sessionId, x: e.clientX, y: e.clientY })
  }

  const handleCloseOthers = (sessionId: string) => {
    setContextMenu(null)
    const otherIds = tabs.filter((t) => t.sessionId !== sessionId).map((t) => t.sessionId)
    for (const id of otherIds) {
      disconnectSession(id)
      closeTab(id)
    }
  }

  const handleCloseLeft = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const leftIds = tabs.slice(0, idx).map((t) => t.sessionId)
    for (const id of leftIds) {
      disconnectSession(id)
      closeTab(id)
    }
  }

  const handleCloseRight = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const rightIds = tabs.slice(idx + 1).map((t) => t.sessionId)
    for (const id of rightIds) {
      disconnectSession(id)
      closeTab(id)
    }
  }

  const handleCloseAll = () => {
    setContextMenu(null)
    const allIds = tabs.map((t) => t.sessionId)
    for (const id of allIds) {
      disconnectSession(id)
      closeTab(id)
    }
  }

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndexRef.current === null || dragIndexRef.current === index) {
      setDragOverIndex(null)
      return
    }
    setDragOverIndex(index)
  }

  const handleDrop = (index: number) => {
    if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
      moveTab(dragIndexRef.current, index)
    }
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  if (tabs.length === 0 && !showWindowControls) return null

  return (
    <div
      data-testid="tab-bar"
      data-tauri-drag-region
      className="flex items-stretch bg-[var(--color-surface-container)] min-h-[37px] select-none border-b border-[var(--color-border)]"
    >

      {canScrollLeft && (
        <button onClick={() => scroll('left')} className="flex-shrink-0 w-7 h-[37px] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      )}

      <div ref={scrollRef} className="flex-1 flex items-stretch overflow-x-hidden" onDragOver={(e) => e.preventDefault()}>
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.sessionId}
            tab={tab}
            isActive={tab.sessionId === activeTabId}
            isDragOver={dragOverIndex === index}
            onClick={() => setActiveTab(tab.sessionId)}
            onClose={() => handleClose(tab.sessionId)}
            onContextMenu={(e) => handleContextMenu(e, tab.sessionId)}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {canScrollRight && (
        <button onClick={() => scroll('right')} className="flex-shrink-0 w-7 h-[37px] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      )}

      <WindowControls />

      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--shadow-dropdown)' }}
        >
          <button
            onClick={() => { handleClose(contextMenu.sessionId); setContextMenu(null) }}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.close')}
          </button>
          <button
            onClick={() => handleCloseOthers(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeOthers')}
          </button>
          <button
            onClick={() => handleCloseLeft(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeLeft')}
          </button>
          <button
            onClick={() => handleCloseRight(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeRight')}
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleCloseAll}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeAll')}
          </button>
        </div>
      )}

      {closingTabId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 max-w-sm w-full mx-4" style={{ boxShadow: 'var(--shadow-dropdown)' }}>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('tabs.closeConfirmTitle')}</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">{t('tabs.closeConfirmMessage')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setClosingTabId(null)} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => { closeTab(closingTabId); setClosingTabId(null) }}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                {t('tabs.closeConfirmKeep')}
              </button>
              <button
                onClick={() => {
                  useChatStore.getState().stopGeneration(closingTabId)
                  disconnectSession(closingTabId)
                  closeTab(closingTabId)
                  setClosingTabId(null)
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90"
              >
                {t('tabs.closeConfirmStop')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabItem({ tab, isActive, isDragOver, onClick, onClose, onContextMenu, onDragStart, onDragOver, onDrop, onDragEnd }: {
  tab: Tab
  isActive: boolean
  isDragOver: boolean
  onClick: () => void
  onClose: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`
        flex-shrink-0 flex items-center gap-1.5 px-3 min-h-[37px] cursor-pointer group transition-colors relative
        ${isActive
          ? 'bg-[var(--color-surface)]'
          : 'bg-transparent hover:bg-[var(--color-surface-hover)]'
        }
        ${isDragOver ? 'before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[2px] before:bg-[var(--color-brand)] before:rounded-full' : ''}
      `}
      style={{ width: TAB_WIDTH, maxWidth: TAB_WIDTH }}
    >
      {(tab.type === 'session' || tab.type === 'design') && tab.status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse flex-shrink-0" />
      )}
      {(tab.type === 'session' || tab.type === 'design') && tab.status === 'error' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)] flex-shrink-0" />
      )}
      {tab.type === 'settings' && (
        <span className="material-symbols-outlined text-[14px] flex-shrink-0 text-[var(--color-text-tertiary)]">settings</span>
      )}
      {tab.type === 'scheduled' && (
        <span className="material-symbols-outlined text-[14px] flex-shrink-0 text-[var(--color-text-tertiary)]">schedule</span>
      )}
      {tab.type === 'design' && tab.status !== 'running' && tab.status !== 'error' && (
        <span className="material-symbols-outlined flex-shrink-0 text-[var(--color-brand)]" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>palette</span>
      )}

      <span className={`flex-1 truncate text-xs ${isActive ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>
        {tab.title || 'Untitled'}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-hover)] transition-opacity text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  )
}
