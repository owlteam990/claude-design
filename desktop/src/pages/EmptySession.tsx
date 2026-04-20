import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useUIStore } from '../stores/uiStore'
import { useTabStore } from '../stores/tabStore'
import { DirectoryPicker } from '../components/shared/DirectoryPicker'
import { PermissionModeSelector } from '../components/controls/PermissionModeSelector'
import { ModelSelector } from '../components/controls/ModelSelector'
import { AttachmentGallery } from '../components/chat/AttachmentGallery'
import { FileSearchMenu, type FileSearchMenuHandle } from '../components/chat/FileSearchMenu'
import {
  FALLBACK_SLASH_COMMANDS,
  findSlashToken,
  insertSlashTrigger,
  replaceSlashCommand,
} from '../components/chat/composerUtils'
import type { AttachmentRef } from '../types/chat'

type Attachment = {
  id: string
  name: string
  type: 'image' | 'file'
  mimeType?: string
  previewUrl?: string
  data?: string
}

export function EmptySession() {
  const t = useTranslation()
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workDir, setWorkDir] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [fileSearchOpen, setFileSearchOpen] = useState(false)
  const [atFilter, setAtFilter] = useState('')
  const [atCursorPos, setAtCursorPos] = useState(-1)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const fileSearchRef = useRef<FileSearchMenuHandle>(null)
  const slashItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const createSession = useSessionStore((state) => state.createSession)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const connectToSession = useChatStore((state) => state.connectToSession)
  const setActiveView = useUIStore((state) => state.setActiveView)
  const addToast = useUIStore((state) => state.addToast)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!plusMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [plusMenuOpen])

  useEffect(() => {
    if (!slashMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setSlashMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [slashMenuOpen])

  useEffect(() => {
    if (!fileSearchOpen) return
    const handleClick = (event: MouseEvent) => {
      const menu = document.getElementById('file-search-menu')
      if (
        menu &&
        !menu.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setFileSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [fileSearchOpen])

  const filteredCommands = FALLBACK_SLASH_COMMANDS.filter((command) => {
    if (!slashFilter) return true
    const lower = slashFilter.toLowerCase()
    return command.name.toLowerCase().includes(lower) || command.description.toLowerCase().includes(lower)
  })

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashFilter])

  useEffect(() => {
    if (slashMenuOpen && slashItemRefs.current[slashSelectedIndex]) {
      slashItemRefs.current[slashSelectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [slashMenuOpen, slashSelectedIndex])

  const handleSubmit = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || isSubmitting) return

    setIsSubmitting(true)
    try {
      const sessionId = await createSession(workDir || undefined)
      setActiveView('code')
      useTabStore.getState().openTab(sessionId, 'New Session')
      connectToSession(sessionId)
      const attachmentPayload: AttachmentRef[] = attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        data: attachment.data,
        mimeType: attachment.mimeType,
      }))
      sendMessage(sessionId, text, attachmentPayload)
      setInput('')
      setAttachments([])
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('empty.failedToCreate'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (value: string, cursorPos: number) => {
    setInput(value)
    const token = findSlashToken(value, cursorPos)
    if (!token) {
      setSlashMenuOpen(false)
    } else {
      setSlashFilter(token.filter)
      setSlashMenuOpen(true)
    }

    // Detect @ trigger for file search
    const textBeforeCursor = value.slice(0, cursorPos)
    let pos = -1
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      const ch = textBeforeCursor[i]!
      if (ch === '@') {
        if (i === 0 || /\s/.test(textBeforeCursor[i - 1]!)) {
          pos = i
          break
        }
        break
      }
      if (/\s/.test(ch)) {
        break
      }
    }
    if (pos < 0) {
      setFileSearchOpen(false)
      setAtFilter('')
      setAtCursorPos(-1)
    } else {
      setAtFilter(textBeforeCursor.slice(pos + 1))
      setAtCursorPos(cursorPos)
      setSlashMenuOpen(false)
      setFileSearchOpen(true)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Ignore key events during IME composition (e.g. Chinese input method)
    if (event.nativeEvent.isComposing) return

    // Route file search navigation keys to FileSearchMenu
    if (fileSearchOpen) {
      const key = event.key
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === 'Tab' || key === 'Escape') {
        event.preventDefault()
        if (key === 'Escape') {
          setFileSearchOpen(false)
          setAtFilter('')
          setAtCursorPos(-1)
          return
        }
        fileSearchRef.current?.handleKeyDown(event.nativeEvent)
        return
      }
      return
    }

    if (slashMenuOpen && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = filteredCommands[slashSelectedIndex]
        if (selected) selectSlashCommand(selected.name)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashMenuOpen(false)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    let hasImage = false
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item || !item.type.startsWith('image/')) continue

      hasImage = true
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: `pasted-image-${Date.now()}.png`,
            type: 'image',
            mimeType: file.type || undefined,
            previewUrl: reader.result as string,
            data: reader.result as string,
          },
        ])
      }
      reader.readAsDataURL(file)
    }

    if (!hasImage) return
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const isImage = file.type.startsWith('image/')
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            type: isImage ? 'image' : 'file',
            mimeType: file.type || undefined,
            previewUrl: isImage ? (reader.result as string) : undefined,
            data: reader.result as string,
          },
        ])
      }
      reader.readAsDataURL(file)
    })

    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const fakeEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>
      handleFileSelect(fakeEvent)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
  }

  const selectSlashCommand = (command: string) => {
    const el = textareaRef.current
    if (!el) return
    const cursorPos = el.selectionStart ?? input.length
    const replacement = replaceSlashCommand(input, cursorPos, command)
    if (!replacement) return
    setInput(replacement.value)
    setSlashMenuOpen(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }

  const insertSlashCommand = () => {
    const el = textareaRef.current
    const cursorPos = el?.selectionStart ?? input.length
    const replacement = insertSlashTrigger(input, cursorPos)
    setInput(replacement.value)
    setPlusMenuOpen(false)
    setSlashFilter('')
    setSlashMenuOpen(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#FAF9F5]">
      <div className="flex flex-1 flex-col items-center justify-center p-8 pb-32">
        <div className="flex max-w-md flex-col items-center text-center">
          <img src="/app-icon.jpg" alt="Claude Code Haha" className="mb-6 h-24 w-24 rounded-[22px] shadow-[0_2px_12px_rgba(0,0,0,0.06)]" />
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-[#1B1C1A]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {t('empty.title')}
          </h1>
          <p className="mx-auto max-w-xs text-[#87736D]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {t('empty.subtitle')}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center px-8">
        <div className="flex w-full max-w-3xl flex-col gap-2">
          <div
            className="relative flex flex-col gap-3 rounded-xl border border-[#dac1ba]/15 bg-white p-4"
            style={{ boxShadow: '0 4px 20px rgba(27, 28, 26, 0.04), 0 12px 40px rgba(27, 28, 26, 0.08)' }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {fileSearchOpen && (
              <FileSearchMenu
                ref={fileSearchRef}
                cwd={workDir || ''}
                filter={atFilter}
                onSelect={(_path, name) => {
                  if (atCursorPos >= 0) {
                    const newValue = `${input.slice(0, atCursorPos)}${name}${input.slice(atCursorPos)}`
                    const newCursorPos = atCursorPos + name.length
                    setInput(newValue)
                    setFileSearchOpen(false)
                    setAtFilter('')
                    setAtCursorPos(-1)
                    void textareaRef.current?.focus()
                    requestAnimationFrame(() => {
                      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
                    })
                  }
                }}
              />
            )}

            {slashMenuOpen && filteredCommands.length > 0 && (
              <div
                ref={slashMenuRef}
                className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-[#dac1ba]/20 bg-white shadow-[0_18px_48px_rgba(27,28,26,0.12)]"
              >
                <div className="max-h-[260px] overflow-y-auto py-1">
                  {filteredCommands.map((command, index) => (
                    <button
                      key={command.name}
                      ref={(el) => { slashItemRefs.current[index] = el }}
                      onClick={() => selectSlashCommand(command.name)}
                      onMouseEnter={() => setSlashSelectedIndex(index)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                        index === slashSelectedIndex ? 'bg-[#F4F4F0]' : 'hover:bg-[#F8F7F4]'
                      }`}
                    >
                      <span className="text-sm font-semibold text-[#1B1C1A]">/{command.name}</span>
                      <span className="truncate text-xs text-[#87736D]">{command.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <AttachmentGallery attachments={attachments} variant="composer" onRemove={removeAttachment} />
            )}

            <div className="flex items-start gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => handleInputChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="flex-1 resize-none border-none bg-transparent py-2 leading-relaxed text-[#1B1C1A] outline-none placeholder:text-[#87736D]/50"
                style={{ fontFamily: "'Inter', sans-serif" }}
                placeholder={t('empty.placeholder')}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#dac1ba]/10 pt-3">
              <div className="flex items-center gap-2">
                <div ref={plusMenuRef} className="relative">
                  <button
                    onClick={() => setPlusMenuOpen((prev) => !prev)}
                    aria-label="Open composer tools"
                    className="rounded-lg p-1.5 text-[#87736D] transition-colors hover:bg-[#F4F4F0]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>

                  {plusMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-[240px] rounded-xl border border-[#dac1ba]/20 bg-white py-1 shadow-[0_18px_48px_rgba(27,28,26,0.12)]">
                      <button
                        onClick={() => {
                          fileInputRef.current?.click()
                          setPlusMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1B1C1A] transition-colors hover:bg-[#F8F7F4]"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#87736D]">attach_file</span>
                        {t('empty.addFiles')}
                      </button>
                      <button
                        onClick={insertSlashCommand}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1B1C1A] transition-colors hover:bg-[#F8F7F4]"
                      >
                        <span className="w-5 text-center text-[18px] font-bold text-[#87736D]">/</span>
                        {t('empty.slashCommands')}
                      </button>
                    </div>
                  )}
                </div>

                <PermissionModeSelector workDir={workDir} />
              </div>

              <div className="flex items-center gap-3">
                <ModelSelector />
                <button
                  onClick={handleSubmit}
                  disabled={(!input.trim() && attachments.length === 0) || isSubmitting}
                  className="flex w-[112px] items-center justify-center gap-1 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30"
                >
                  {t('common.run')}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <DirectoryPicker value={workDir} onChange={setWorkDir} />
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
    </div>
  )
}

