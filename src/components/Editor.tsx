import { useRef, useEffect, useState } from 'react'
import MonacoEditor, { OnMount, Monaco } from '@monaco-editor/react'
import { AIEdit } from '../types'

interface EditorProps {
  content: string
  filePath: string | null
  fileContents: Record<string, string>
  pendingEdits: AIEdit[]
  onContentChange: (content: string) => void
  onAcceptEdit: (edit: AIEdit) => void
  onRejectEdit: (edit: AIEdit) => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onSave: () => void
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
  fileContents,
  pendingEdits,
  onContentChange,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAll,
  onRejectAll,
  onSave,
}: EditorProps) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])
  const extraLibsRef = useRef<any[]>([])
  const [currentEditIndex, setCurrentEditIndex] = useState(0)

  // ─── Setup Monaco & Standard Libs ───────────────────────────────
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // ─── Configure TypeScript/JSX ───────────────────────────────────
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      typeRoots: ['node_modules/@types']
    })

    // ─── Inject Standard Type Definitions ───────────────────────────
    const standardLibs = [
      {
        filePath: 'electron.d.ts',
        content: `declare module 'electron' {
          export const app: any;
          export const BrowserWindow: any;
          export const ipcMain: any;
          export const dialog: any;
          export const shell: any;
        }`
      },
      {
        filePath: 'node-env.d.ts',
        content: `
          declare module 'node:fs' { export * from 'fs'; }
          declare module 'fs' {
            export function readFileSync(path: string, options?: any): string;
            export function writeFileSync(path: string, data: string, options?: any): void;
            export function existsSync(path: string): boolean;
            export function mkdirSync(path: string, options?: any): void;
            export function readdirSync(path: string, options?: any): any[];
          }
          declare module 'node:path' { export * from 'path'; }
          declare module 'path' {
            export function join(...paths: string[]): string;
            export function dirname(p: string): string;
            export function basename(p: string): string;
            export function extname(p: string): string;
            export function resolve(...paths: string[]): string;
          }
          declare module 'node:url' {
            export function fileURLToPath(url: string | URL): string;
            export function pathToFileURL(path: string): URL;
          }
          declare module 'node:module' {
            export function createRequire(path: string | URL): any;
          }
        `
      },
      {
        filePath: 'react-env.d.ts',
        content: `declare module 'react' {
          export const useState: any;
          export const useEffect: any;
          export const useRef: any;
          export const useCallback: any;
          export const useMemo: any;
          export default { useState, useEffect, useRef, useCallback, useMemo };
        }`
      }
    ]

    standardLibs.forEach(lib => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(lib.content, `file:///${lib.filePath}`)
    })

    // Add Save Command (Ctrl/Cmd + S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave()
    })
  }

  // ─── Project File Awareness ──────────────────────────────────────
  useEffect(() => {
    if (!monacoRef.current) return
    const monaco = monacoRef.current

    // Clear old project libs
    extraLibsRef.current.forEach(lib => lib.dispose())
    extraLibsRef.current = []

    // Inject all loaded project files as extra libs
    Object.entries(fileContents).forEach(([path, content]) => {
      // Don't add the active file as an extra lib if it's already a model
      // But add others for cross-file resolution
      try {
        const lib = monaco.languages.typescript.typescriptDefaults.addExtraLib(
          content,
          `file:///${path.replace(/\\/g, '/')}`
        )
        extraLibsRef.current.push(lib)
      } catch (e) {
        console.warn('Failed to add extra lib for', path, e)
      }
    })
  }, [fileContents])

  // ─── Diff Decorations ────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
    if (pendingEdits.length === 0) return

    const fileEdits = pendingEdits.filter(
      (e) => e.file === filePath || filePath?.endsWith(e.file.replace(/\//g, '\\'))
    )

    if (fileEdits.length === 0) return

    const newDecorations: any[] = []

    for (const edit of fileEdits) {
      const newLines = edit.newContent.split('\n')

      if (edit.oldContent) {
        newDecorations.push({
          range: new monaco.Range(edit.startLine, 1, edit.endLine, 1000),
          options: {
            isWholeLine: true,
            className: 'diff-removed-line',
            linesDecorationsClassName: 'diff-gutter-removed',
            overviewRuler: {
              color: '#f38ba8',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        })
      }

      const endLine = edit.endLine
      newDecorations.push({
        range: new monaco.Range(endLine, 1, endLine, 1000),
        options: {
          isWholeLine: true,
          after: {
            content: `\n${newLines.map(l => `+ ${l}`).join('\n')}`,
            inlineClassName: 'diff-added-block',
          },
          overviewRuler: {
            color: '#a6e3a1',
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      })
    }

    decorationsRef.current = editor.deltaDecorations([], newDecorations)
    if (fileEdits.length > 0) {
      editor.revealLineInCenter(fileEdits[0].startLine)
    }

    // Inject styles
    const styleId = 'monaco-diff-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .diff-removed-line { background: rgba(243, 139, 168, 0.15) !important; text-decoration: line-through; opacity: 0.8; }
        .diff-added-block { 
          display: block;
          background: rgba(166, 227, 161, 0.1) !important;
          color: #a6e3a1; 
          white-space: pre;
          margin-top: 2px;
          padding: 2px 8px;
          border-left: 2px solid #a6e3a1;
          font-family: inherit;
          font-size: 0.95em;
        }
        .diff-gutter-removed { border-left: 2px solid #f38ba8; }
      `
      document.head.appendChild(style)
    }
  }, [pendingEdits, filePath])

  const currentEdit = pendingEdits[currentEditIndex]
  const hasEditsForCurrentFile = pendingEdits.some(
    (e) => e.file === filePath || filePath?.endsWith(e.file.replace(/\//g, '\\'))
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
                automaticLayout: true,
              }}
            />

            {hasEditsForCurrentFile && (
              <div className="diff-actions">
                <span className="diff-actions-label">
                  🔀 {pendingEdits.length} proposed edit{pendingEdits.length > 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-accept" onClick={() => onAcceptEdit(currentEdit || pendingEdits[0])}>✓ Accept</button>
                  <button className="btn-reject" onClick={() => onRejectEdit(currentEdit || pendingEdits[0])}>✗ Reject</button>
                  <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={onAcceptAll}>Accept All</button>
                </div>
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
