import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
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
        <div className="chat-header-main">
          <span>🤖</span>
          <h3>AI Assistant</h3>
        </div>
        <div className="chat-header-actions">
          {isStreaming && (
            <div className="chat-status">
              <span className="dot"></span>
              Thinking...
            </div>
          )}
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
          <div className="chat-empty-state">
            <div className="chat-empty-icon">✨</div>
            <h4>Ready to help</h4>
            <p>Ask me to explain code, fix bugs, or build new features. I can see your active files and apply changes directly.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="chat-message-header">
              <div className="chat-message-avatar">
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <span className="chat-message-role">
                {msg.role === 'user' ? 'You' : 'AI Assistant'}
              </span>
            </div>
            
            <div className="chat-message-bubble">
              <div className="chat-message-content">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const language = match ? match[1] : ''
                        
                        return !inline && match ? (
                          <div className="syntax-highlighter-wrapper">
                            <div className="code-block-header">
                              <span>{language}</span>
                            </div>
                            <SyntaxHighlighter
                              style={oneDark}
                              language={language}
                              PreTag="div"
                              className="syntax-highlighter"
                              customStyle={{
                                margin: 0,
                                borderRadius: '0 0 8px 8px',
                                fontSize: '13px',
                                background: '#0d1117'
                              }}
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
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
                    const actionLabel = edit.action === 'create' ? '🆕' : edit.action === 'delete' ? '🗑️' : '✏️'
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
                            {edit.description || (edit.action === 'replace' ? 'Apply changes' : edit.action === 'create' ? 'New file' : 'Delete file')}
                          </div>
                        </div>
                        {!isAccepted && !isRejected && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="chat-edit-btn accept"
                              onClick={() => onAcceptEdit(edit)}
                              title="Accept"
                            >✓</button>
                            <button
                              className="chat-edit-btn reject"
                              onClick={() => onRejectEdit(edit)}
                              title="Reject"
                            >✗</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        {selectedCode && (
          <div className="chat-selection-badge">
            <span className="selection-icon">🎯</span>
            Using lines {selectedCode.startLine}–{selectedCode.endLine} as context
          </div>
        )}
        
        <div className="chat-input-container">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything..."
            disabled={isStreaming}
            rows={1}
          />
          
          <div className="chat-toolbar">
            <div className="chat-tools-left">
              <button
                className={`tool-btn ${webSearch ? 'active' : ''}`}
                onClick={() => setWebSearch(!webSearch)}
                title={webSearch ? "Web Search Enabled" : "Enable Web Search"}
              >
                🌐
              </button>
              <div className="chat-hint-minimal">
                <span>Shift+Enter for newline</span>
              </div>
            </div>

            <div className="chat-tools-right">
              {isStreaming ? (
                <button
                  className="btn-stop-round"
                  onClick={onStop}
                  title="Stop generation"
                >
                  ⏹
                </button>
              ) : (
                <button
                  className="btn-send-round"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title="Send message"
                >
                  ↑
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
