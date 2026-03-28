import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage, AIEdit } from '../types'
import { useApp } from '../AppProvider'

interface AIChatProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (message: string) => void
  onAcceptEdit: (edit: AIEdit) => void
  onRejectEdit: (edit: AIEdit) => void
  acceptedEdits: string[]
  rejectedEdits: string[]
  aiModel: string
  selectedCode: { content: string; startLine: number; endLine: number } | null
  webSearch: boolean
  setWebSearch: (val: boolean) => void
  onStop: () => void
}

export default function AIChat({
  messages,
  isStreaming,
  onSend,
  onAcceptEdit,
  onRejectEdit,
  acceptedEdits,
  rejectedEdits,
  aiModel,
  selectedCode,
  webSearch,
  setWebSearch,
  onStop,
}: AIChatProps) {
  const { settings, updateSetting } = useApp()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    onSend(text)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const toggleDirection = () => {
    updateSetting('chatDirection', settings.chatDirection === 'ltr' ? 'rtl' : 'ltr')
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>🤖</span>
        <h3>AI Assistant</h3>
        <div className="chat-header-actions">
          <button 
            className={`btn-direction ${settings.chatDirection}`} 
            onClick={toggleDirection}
            title={`Switch to ${settings.chatDirection === 'ltr' ? 'RTL' : 'LTR'}`}
          >
            {settings.chatDirection === 'ltr' ? 'LTR' : 'RTL'}
          </button>
          <span className="chat-model-badge">{aiModel ? aiModel.split(':')[0] : 'assistant'}</span>
        </div>
      </div>

      <div className={`chat-messages ${settings.chatDirection}`}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <p>Ask me anything about your code.</p>
            <p style={{ marginTop: 8, fontSize: 12 }}>
              I can read your files and propose edits.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <span className="chat-message-role">
              {msg.role === 'user' ? '👤 You' : '🤖 AI'}
            </span>
            <div className="chat-message-content">
              {msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
              {msg.isStreaming && <span className="cursor-blink" />}
            </div>

            {/* Questions card */}
            {msg.questions && msg.questions.length > 0 && (
              <div className="chat-questions-card">
                <div className="chat-questions-title">❓ Questions before proceeding:</div>
                <ol className="chat-questions-list">
                  {msg.questions.map((q, i) => <li key={i}>{q}</li>)}
                </ol>
              </div>
            )}

            {msg.edits && msg.edits.length > 0 && (
              <div className="chat-message-edits">
                {msg.edits.map((edit) => {
                  const isAccepted = acceptedEdits.includes(edit.id)
                  const isRejected = rejectedEdits.includes(edit.id)
                  const fileName = edit.file.split('\\').pop()?.split('/').pop() ?? edit.file
                  const actionLabel = edit.action === 'create' ? '🆕 Create' : edit.action === 'delete' ? '🗑️ Delete' : '✏️ Edit'
                  return (
                    <div
                      key={edit.id}
                      className={`chat-edit-item ${isAccepted ? 'accepted' : ''} ${isRejected ? 'rejected' : ''}`}
                    >
                      <span className="chat-edit-icon">
                        {isAccepted ? '✅' : isRejected ? '❌' : actionLabel}
                      </span>
                      <div className="chat-edit-info">
                        <div className="chat-edit-file">{fileName}</div>
                        <div className="chat-edit-desc">
                          {edit.description || (edit.action === 'replace' ? 'Search & Replace' : edit.action === 'create' ? 'New file' : 'Delete file')}
                        </div>
                      </div>
                      {!isAccepted && !isRejected && (
                        <>
                          <button
                            className="chat-edit-btn accept"
                            onClick={() => onAcceptEdit(edit)}
                          >✓</button>
                          <button
                            className="chat-edit-btn reject"
                            onClick={() => onRejectEdit(edit)}
                          >✗</button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        {selectedCode && (
          <div className="chat-selection-badge">
            <span className="selection-icon">🎯</span>
            Selection Active: Lines {selectedCode.startLine}–{selectedCode.endLine}
          </div>
        )}
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to read, explain, or edit your code..."
            disabled={isStreaming}
            rows={3}
          />
          <div className="chat-input-actions">
            <span className="chat-hint">Enter to send · Shift+Enter for newline · Use @filename to mention files</span>
            <button
              className={`btn-web-search ${webSearch ? 'active' : ''}`}
              onClick={() => setWebSearch(!webSearch)}
              title={webSearch ? "Web Search Enabled" : "Enable Web Search"}
            >
              🌐
            </button>
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? '⏳' : '↑'} Send
            </button>
            {isStreaming && (
              <button
                className="btn-stop"
                onClick={onStop}
                title="Stop generation"
              >
                ⏹ Stop
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
