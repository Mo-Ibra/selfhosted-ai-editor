import { useRef, useEffect, useState } from 'react'
import MonacoEditor, { OnMount, Monaco } from '@monaco-editor/react'
import { AIEdit } from '../types'

interface EditorProps {
  content: string
  filePath: string | null
  folderPath: string | null
  fileContents: Record<string, string>
  pendingEdits: AIEdit[]
  onContentChange: (content: string) => void
  onAcceptEdit: (edit: AIEdit) => void
  onRejectEdit: (edit: AIEdit) => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onSave: () => void
  onSelectionChange: (selection: { content: string; startLine: number; endLine: number } | null) => void
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
  folderPath,
  fileContents,
  pendingEdits,
  onContentChange,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAll,
  onRejectAll,
  onSave,
  onSelectionChange,
}: EditorProps) {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])
  const onSaveRef = useRef(onSave)
  const folderPathRef = useRef(folderPath)
  const [currentEditIndex, setCurrentEditIndex] = useState(0)

  // Keep refs in sync so Monaco's mounted callbacks always use latest values
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { folderPathRef.current = folderPath }, [folderPath])

  // ─── Setup Monaco & Standard Libs ───────────────────────────────
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // ─── Define Custom Theme (Standard with JSX Highlights) ─────────
    monaco.editor.defineTheme('standard-jsx', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'tag', foreground: 'f38ba8' },
        { token: 'tag.identifier', foreground: 'f38ba8' },
        { token: 'tag.attribute.name', foreground: 'fab387' },
        { token: 'delimiter.html', foreground: '94e2d5' },
        { token: 'delimiter.xml', foreground: '94e2d5' },
      ],
      colors: {}
    })

    monaco.editor.setTheme('standard-jsx')

    // ─── Configure TypeScript/JSX ───────────────────────────────────
    const root = folderPathRef.current?.replace(/\\/g, '/') ?? ''
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      esModuleInterop: true,
      baseUrl: root || 'file:///',
      paths: {
        '@/*': [`${root}/src/*`]
      },
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
          export const useContext: any;
          export const createContext: any;
          export const memo: any;
          export const forwardRef: any;
          export const Fragment: any;
          export default { useState, useEffect, useRef, useCallback, useMemo };
        }
        declare module 'react/jsx-runtime' {
          export const jsx: any;
          export const jsxs: any;
          export const Fragment: any;
        }
        `
      },
      {
        filePath: 'third-party-stubs.d.ts',
        content: `
          // lucide-react
          declare module 'lucide-react' {
            import { FC, SVGProps } from 'react';
            export type LucideIcon = FC<SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string; }>;
            export const [key: string]: LucideIcon;
          }

          // next.js
          declare module 'next/link' { const Link: any; export default Link; }
          declare module 'next/image' { const Image: any; export default Image; }
          declare module 'next/navigation' {
            export const useRouter: any;
            export const usePathname: any;
            export const useSearchParams: any;
            export const redirect: any;
          }
          declare module 'next/server' { export const NextResponse: any; export const NextRequest: any; }
          declare module 'next/font/google' { export const [key: string]: any; }
          declare module 'next/headers' { export const cookies: any; export const headers: any; }

          // utilities
          declare module 'clsx' { const clsx: (...args: any[]) => string; export default clsx; export { clsx }; }
          declare module 'tailwind-merge' { export const twMerge: (...args: any[]) => string; }
          declare module 'class-variance-authority' { export const cva: any; export type VariantProps<T> = any; }

          // Catch-all: silence "Cannot find module" for any other package
          declare module '*' { const value: any; export default value; export = value; }
        `
      }
    ]

    standardLibs.forEach(lib => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(lib.content, `file:///${lib.filePath}`)
    })

    // Add Save Command (Ctrl/Cmd + S) — use ref to avoid stale closure
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current()
    })

    // ─── Selection Tracking ──────────────────────────────────────────
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection()
      if (!selection || selection.isEmpty()) {
        onSelectionChange(null)
        return
      }

      const selectedContent = editor.getModel()?.getValueInRange(selection) || ''
      onSelectionChange({
        content: selectedContent,
        startLine: selection.startLineNumber,
        endLine: selection.endLineNumber,
      })
    })

    // ─── Inline Completions (AI Autocomplete) ───────────────────────
    let typingTimer: any = null
    const languages = ['typescript', 'javascript', 'python', 'rust', 'go', 'html', 'css', 'json', 'plaintext']
    const provider = monaco.languages.registerInlineCompletionsProvider(languages, {
      provideInlineCompletions: async (model: import('monaco-editor').editor.ITextModel, position: import('monaco-editor').Position) => {
        if (typingTimer) clearTimeout(typingTimer)

        return new Promise((resolve) => {
          typingTimer = setTimeout(async () => {
            const lineContent = model.getLineContent(position.lineNumber)
            const isAtEndOfLine = position.column > lineContent.trimEnd().length

            // Log for debugging
            console.log(`[Autocomplete] Line: ${position.lineNumber}, Col: ${position.column}, EOL: ${isAtEndOfLine}`)

            // Only trigger if at end of line and line isn't just symbols
            if (!isAtEndOfLine || lineContent.trim().length < 2) {
              resolve({ items: [] })
              return
            }

            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 50),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            })

            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 50),
              endColumn: 1000
            })

            try {
              console.log('[Autocomplete] Fetching from AI...')
              const suggestion = await window.electronAPI.getAICompletion(prefix, suffix, 'qwen3-coder:480b-cloud')
              console.log('[Autocomplete] Got suggestion:', suggestion ? 'Yes' : 'No')

              if (!suggestion) {
                resolve({ items: [] })
                return
              }

              resolve({
                items: [{
                  insertText: suggestion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                  }
                }]
              })
            } catch (e) {
              console.error('[Autocomplete] Error:', e)
              resolve({ items: [] })
            }
          }, 350)
        })
      },
      freeInlineCompletions: () => { }
    })

    editor.onDidDispose(() => provider.dispose())
  }

  // ─── Project File Model Registration ────────────────────────────
  // Creates real Monaco models for each loaded project file so the
  // TypeScript worker can resolve imports → Ctrl+Click, export errors,
  // and autocomplete all work automatically.
  useEffect(() => {
    if (!monacoRef.current) return
    const monaco = monacoRef.current
    const activeUri = filePath?.replace(/\\/g, '/')

    // Create or update a model for every loaded project file
    Object.entries(fileContents).forEach(([absPath, content]) => {
      const uriStr = absPath.replace(/\\/g, '/')
      if (uriStr === activeUri) return  // MonacoEditor manages the active file

      const uri = monaco.Uri.parse(uriStr)
      const existing = monaco.editor.getModel(uri)
      if (existing) {
        if (existing.getValue() !== content) existing.setValue(content)
      } else {
        try { monaco.editor.createModel(content, getLanguage(absPath), uri) }
        catch (e) { console.warn('Failed to create model for', absPath, e) }
      }
    })

    // Dispose models for files no longer in fileContents
    monaco.editor.getModels().forEach((model: import('monaco-editor').editor.ITextModel) => {
      const uriStr = model.uri.toString()
      if (uriStr === activeUri) return
      const stillLoaded = Object.keys(fileContents).some(
        p => p.replace(/\\/g, '/') === uriStr
      )
      if (!stillLoaded) model.dispose()
    })
  }, [fileContents, filePath])

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
              path={filePath?.replace(/\\/g, '/')}
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
