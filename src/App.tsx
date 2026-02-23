import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import FileExplorer from './components/FileExplorer'
import Editor from './components/Editor'
import AIChat from './components/AIChat'
import { FileNode, ChatMessage, AIEdit, AIResponse } from './types'

export default function App() {
  // ─── Folder & File State ─────────────────────────────────────────
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([])

  // ─── AI State ────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingEdits, setPendingEdits] = useState<AIEdit[]>([])
  const [acceptedEdits, setAcceptedEdits] = useState<string[]>([])
  const [rejectedEdits, setRejectedEdits] = useState<string[]>([])

  // Ref for active streaming message ID
  const streamingMsgId = useRef<string | null>(null)

  // ─── Open Folder ─────────────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    const path = await window.electronAPI.openFolder()
    if (!path) return
    setFolderPath(path)
    const tree = await window.electronAPI.readTree(path)
    setFileTree(tree)
    // Reset state
    setActiveFilePath(null)
    setFileContents({})
    setPinnedFiles([])
    setPendingEdits([])
    setMessages([])
    setAcceptedEdits([])
    setRejectedEdits([])
  }, [])

  // ─── File Click ──────────────────────────────────────────────────
  const handleFileClick = useCallback(async (filePath: string) => {
    setActiveFilePath(filePath)
    if (!fileContents[filePath]) {
      const content = await window.electronAPI.readFile(filePath)
      setFileContents((prev) => ({ ...prev, [filePath]: content }))
    }
  }, [fileContents])

  // ─── Pin Toggle ──────────────────────────────────────────────────
  const handlePinToggle = useCallback((filePath: string) => {
    setPinnedFiles((prev) =>
      prev.includes(filePath)
        ? prev.filter((p) => p !== filePath)
        : [...prev, filePath]
    )
  }, [])

  // ─── Editor Content Change ───────────────────────────────────────
  const handleContentChange = useCallback((content: string) => {
    if (!activeFilePath) return
    setFileContents((prev) => ({ ...prev, [activeFilePath]: content }))
  }, [activeFilePath])

  // ─── AI Streaming Setup ──────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.removeAllListeners('ai:chunk')
    window.electronAPI.removeAllListeners('ai:done')

    window.electronAPI.onChatChunk((chunk: string) => {
      if (!streamingMsgId.current) return
      const id = streamingMsgId.current
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: m.content + chunk } : m
        )
      )
    })

    window.electronAPI.onChatDone((response: AIResponse | null) => {
      const id = streamingMsgId.current
      streamingMsgId.current = null
      setIsStreaming(false)

      if (response && response.edits?.length > 0) {
        setPendingEdits(response.edits)
        setAcceptedEdits([])
        setRejectedEdits([])
        // Update the streaming message with edits info and explanation
        if (id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                  ...m,
                  content: response.explanation || m.content,
                  edits: response.edits,
                  isStreaming: false,
                }
                : m
            )
          )
        }
      } else {
        if (id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, isStreaming: false } : m
            )
          )
        }
      }
    })
  }, [])

  // ─── Send Message to AI ──────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!folderPath) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    // Create streaming assistant message placeholder
    const assistantId = `assistant-${Date.now()}`
    streamingMsgId.current = assistantId
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    setPendingEdits([])
    setAcceptedEdits([])
    setRejectedEdits([])

    // Gather pinned file contents
    const pinnedFileContents = await Promise.all(
      pinnedFiles.map(async (p) => ({
        path: p,
        content: fileContents[p] ?? (await window.electronAPI.readFile(p)),
      }))
    )

    // Build relative file tree for prompt
    const activeContent = activeFilePath ? (fileContents[activeFilePath] ?? '') : ''

    const chatHistory = messages.map(m => ({
      role: m.role,
      content: m.content
    }))

    // Add current user message to history
    chatHistory.push({ role: 'user', content: text })

    await window.electronAPI.chat({
      activeFile: activeContent,
      activeFilePath: activeFilePath ?? '',
      fileTreeNodes: fileTree,
      pinnedFiles: pinnedFileContents,
      history: chatHistory,
    })
  }, [folderPath, fileTree, activeFilePath, fileContents, pinnedFiles, messages])

  // ─── Apply Edit to File Content ──────────────────────────────────
  const applyEdit = useCallback((edit: AIEdit): string | null => {
    const isNewFile = edit.startLine === 0 && edit.endLine === 0

    // Find the file — match by full path or partial
    const targetPath = Object.keys(fileContents).find(
      (p) => p === edit.file || p.endsWith(edit.file.replace(/\//g, '\\'))
    ) ?? activeFilePath

    if (isNewFile) return edit.newContent
    if (!targetPath) return null

    const content = fileContents[targetPath] ?? ''
    const lines = content.split('\n')
    const start = edit.startLine - 1
    const end = edit.endLine - 1
    const newLines = edit.newContent.split('\n')
    lines.splice(start, Math.max(0, end - start + 1), ...newLines)
    return lines.join('\n')
  }, [fileContents, activeFilePath])

  // ─── Accept Edit ─────────────────────────────────────────────────
  const handleAcceptEdit = useCallback(async (edit: AIEdit) => {
    const newContent = applyEdit(edit)
    if (newContent === null) return

    let targetPath = Object.keys(fileContents).find(
      (p) => p === edit.file || p.endsWith(edit.file.replace(/\//g, '\\'))
    ) ?? (activeFilePath && (activeFilePath === edit.file || activeFilePath.endsWith(edit.file.replace(/\//g, '\\'))) ? activeFilePath : null)

    // If still not found, it might be a new file with a relative path
    if (!targetPath && folderPath) {
      // Check if it's already an absolute path
      if (edit.file.includes(':') || edit.file.startsWith('/') || edit.file.startsWith('\\')) {
        targetPath = edit.file
      } else {
        // Assume relative to folderPath
        targetPath = `${folderPath}\\${edit.file.replace(/\//g, '\\')}`
      }
    }

    if (!targetPath) return

    setFileContents((prev) => ({ ...prev, [targetPath!]: newContent }))
    await window.electronAPI.writeFile(targetPath, newContent)

    // Refresh tree if it was a new file
    if (folderPath) {
      const tree = await window.electronAPI.readTree(folderPath)
      setFileTree(tree)
    }

    setAcceptedEdits((prev) => [...prev, edit.id])
    setPendingEdits((prev) => prev.filter((e) => e.id !== edit.id))
  }, [applyEdit, fileContents, activeFilePath, folderPath])

  // ─── Reject Edit ─────────────────────────────────────────────────
  const handleRejectEdit = useCallback((edit: AIEdit) => {
    setRejectedEdits((prev) => [...prev, edit.id])
    setPendingEdits((prev) => prev.filter((e) => e.id !== edit.id))
  }, [])

  // ─── Accept All ──────────────────────────────────────────────────
  const handleAcceptAll = useCallback(async () => {
    for (const edit of pendingEdits) {
      await handleAcceptEdit(edit)
    }
  }, [pendingEdits, handleAcceptEdit])

  // ─── Reject All ──────────────────────────────────────────────────
  const handleRejectAll = useCallback(() => {
    for (const edit of pendingEdits) {
      handleRejectEdit(edit)
    }
  }, [pendingEdits, handleRejectEdit])

  // ─── Window Controls ─────────────────────────────────────────────
  const folderName = folderPath?.split('\\').pop() ?? folderPath?.split('/').pop()

  const activeContent = activeFilePath ? fileContents[activeFilePath] ?? '' : ''
  const activeFileName = activeFilePath?.split('\\').pop() ?? activeFilePath?.split('/').pop()

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Title Bar */}
      <div className="titlebar">
        <div className="titlebar-traffic">
          <button
            className="titlebar-btn close"
            onClick={() => window.electronAPI.windowClose()}
          />
          <button
            className="titlebar-btn minimize"
            onClick={() => window.electronAPI.windowMinimize()}
          />
          <button
            className="titlebar-btn maximize"
            onClick={() => window.electronAPI.windowMaximize()}
          />
        </div>
        <div className="titlebar-title">
          AI Editor {activeFileName ? `— ${activeFileName}` : ''}
        </div>
        {folderName && (
          <div className="titlebar-folder">📁 {folderName}</div>
        )}
      </div>

      {/* Main Content */}
      {!folderPath ? (
        <div className="welcome-screen">
          <div className="welcome-icon">⚡</div>
          <h1>AI Editor</h1>
          <p>Open a project folder to start editing with AI assistance powered by Ollama.</p>
          <button className="btn-primary" onClick={handleOpenFolder}>
            📂 Open Folder
          </button>
        </div>
      ) : (
        <div className="main-layout">
          <FileExplorer
            tree={fileTree}
            activeFile={activeFilePath}
            pinnedFiles={pinnedFiles}
            onFileClick={handleFileClick}
            onPinToggle={handlePinToggle}
            onOpenFolder={handleOpenFolder}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tabs */}
            <div className="editor-tabs">
              {activeFilePath && (
                <div className="editor-tab active">
                  {activeFileName}
                  <button
                    className="tab-close-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFilePath(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <Editor
              content={activeContent}
              filePath={activeFilePath}
              pendingEdits={pendingEdits}
              onContentChange={handleContentChange}
              onAcceptEdit={handleAcceptEdit}
              onRejectEdit={handleRejectEdit}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
            />
          </div>

          <AIChat
            messages={messages}
            isStreaming={isStreaming}
            onSend={handleSend}
            onAcceptEdit={handleAcceptEdit}
            onRejectEdit={handleRejectEdit}
            acceptedEdits={acceptedEdits}
            rejectedEdits={rejectedEdits}
          />
        </div>
      )}
    </div>
  )
}
