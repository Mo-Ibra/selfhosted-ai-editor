import { useRef, useEffect, useState } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { AIEdit } from '../types'

interface EditorProps {
  content: string
  filePath: string | null
  pendingEdits: AIEdit[]
  onContentChange: (content: string) => void
  onAcceptEdit: (edit: AIEdit) => void
  onRejectEdit: (edit: AIEdit) => void
  onAcceptAll: () => void
  onRejectAll: () => void
}

function getLanguage(filePath: string | null): string {
  if (!filePath) return 'plaintext'
  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cs: 'csharp',
    css: 'css', scss: 'scss', html: 'html', json: 'json', md: 'markdown',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'shell', bash: 'shell',
    txt: 'plaintext', xml: 'xml', sql: 'sql', c: 'c', cpp: 'cpp',
    h: 'c', php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin',
  }
  return langMap[ext ?? ''] ?? 'plaintext'
}

export default function Editor({
  content,
  filePath,
  pendingEdits,
  onContentChange,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAll,
  onRejectAll,
}: EditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<string[]>([])
  const [currentEditIndex, setCurrentEditIndex] = useState(0)

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  // Apply diff decorations when pendingEdits change
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // Clear old decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])

    if (pendingEdits.length === 0) return

    // Only show the active file's edits
    const fileEdits = pendingEdits.filter(
      (e) => e.file === filePath || filePath?.endsWith(e.file)
    )

    if (fileEdits.length === 0) return

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = []

    for (const edit of fileEdits) {
      const oldLines = edit.oldContent?.split('\n') ?? []
      const newLines = edit.newContent.split('\n')

      // Highlight old lines (red - to be removed)
      if (edit.oldContent && oldLines.length > 0) {
        newDecorations.push({
          range: new monaco.Range(edit.startLine, 1, edit.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'diff-removed-line',
            glyphMarginClassName: 'diff-gutter-removed',
            overviewRuler: {
              color: '#f38ba8',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        })
      }

      // Highlight new lines (green - to be added)  
      const insertLine = edit.startLine
      newDecorations.push({
        range: new monaco.Range(insertLine, 1, insertLine, 1),
        options: {
          isWholeLine: true,
          after: {
            content: `  + ${newLines.slice(0, 3).join(' | ')}${newLines.length > 3 ? '...' : ''}`,
            inlineClassName: 'diff-added-preview',
          },
          overviewRuler: {
            color: '#a6e3a1',
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      })
    }

    decorationsRef.current = editor.deltaDecorations([], newDecorations)

    // Scroll to first edit
    if (fileEdits.length > 0) {
      editor.revealLineInCenter(fileEdits[0].startLine)
    }

    // Inject diff CSS into Monaco
    const styleId = 'monaco-diff-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .diff-removed-line { background: rgba(243, 139, 168, 0.15) !important; border-left: 3px solid #f38ba8; }
        .diff-added-preview { color: #a6e3a1; font-style: italic; opacity: 0.8; }
        .diff-gutter-removed { background: #f38ba8; width: 3px !important; margin-left: 2px; }
      `
      document.head.appendChild(style)
    }
  }, [pendingEdits, filePath])

  const currentEdit = pendingEdits[currentEditIndex]
  const hasEditsForCurrentFile = pendingEdits.some(
    (e) => e.file === filePath || filePath?.endsWith(e.file)
  )

  return (
    <div className="editor-area">
      <div className="editor-wrapper">
        {filePath ? (
          <>
            <MonacoEditor
              height="100%"
              value={content}
              language={getLanguage(filePath)}
              theme="vs-dark"
              onMount={handleMount}
              onChange={(val) => onContentChange(val ?? '')}
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                fontLigatures: true,
                lineHeight: 22,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: 'phase',
                cursorSmoothCaretAnimation: 'on',
                renderLineHighlight: 'all',
                padding: { top: 12, bottom: 12 },
                bracketPairColorization: { enabled: true },
                formatOnPaste: true,
                tabSize: 2,
                wordWrap: 'off',
              }}
            />

            {hasEditsForCurrentFile && pendingEdits.length > 0 && (
              <div className="diff-actions">
                <span className="diff-actions-label">
                  🔀 {pendingEdits.length} proposed edit{pendingEdits.length > 1 ? 's' : ''}
                </span>
                {pendingEdits.length > 1 && (
                  <>
                    <button className="btn-accept-all" onClick={onAcceptAll}>
                      ✓ Accept All
                    </button>
                    <button className="btn-reject-all" onClick={onRejectAll}>
                      ✗ Reject All
                    </button>
                  </>
                )}
                {currentEdit && (
                  <>
                    <button className="btn-accept" onClick={() => {
                      onAcceptEdit(currentEdit)
                      setCurrentEditIndex((i) => Math.max(0, i - 1))
                    }}>
                      ✓ Accept
                    </button>
                    <button className="btn-reject" onClick={() => {
                      onRejectEdit(currentEdit)
                      setCurrentEditIndex((i) => Math.max(0, i - 1))
                    }}>
                      ✗ Reject
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="editor-empty">
            <span className="editor-empty-icon">📝</span>
            <p>Select a file to start editing</p>
          </div>
        )}
      </div>
    </div>
  )
}
