import { useRef, useCallback, useState } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { AIEdit } from '../types'
import { getLanguage } from "../utils/language";
import { useMonacoSetup } from '../hooks/useMonacoSetup'
import { useFileModels } from '../hooks/useFileModels';
import { useDiffDecorations } from '../hooks/useDiffDecorations';
import { registerAutocompleteProvider } from '../hooks/useAutoComplete'
import { DiffActions } from './DiffActions'
import { useApp } from '../AppProvider'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_EDITOR_OPTIONS = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  fontLigatures: true,
  lineHeight: 22,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: 'phase' as const,
  cursorSmoothCaretAnimation: 'on' as const,
  renderLineHighlight: 'all' as const,
  padding: { top: 12, bottom: 12 },
  bracketPairColorization: { enabled: true },
  formatOnPaste: true,
  tabSize: 2,
  wordWrap: 'off' as const,
  automaticLayout: true,
}


// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Component ────────────────────────────────────────────────────────────────

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
  // onRejectAll,
  onSave,
  onSelectionChange,
}: EditorProps) {
  const { editorFontSize, editorLineHeight } = useApp()
  const editorRef = useRef<any>(null)
  const onSaveRef = useRef(onSave)
  const folderPathRef = useRef(folderPath)
  const [currentEditIndex] = useState(0);

  // Update save function ref without causing re-renders
  onSaveRef.current = onSave;
  // Update folder path ref without causing re-renders
  folderPathRef.current = folderPath;

  const { monacoRef, configureMonaco } = useMonacoSetup(folderPathRef);

  // Sync project file models with Monaco
  useFileModels(monacoRef, fileContents, filePath);

  // Render diff decorations for pending edits
  useDiffDecorations(editorRef, monacoRef, pendingEdits, filePath);

  const handleSelectionChange = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) {
      onSelectionChange(null)
      return
    }

    const selectedContent = editor.getModel()?.getValueInRange(selection) ?? ''

    onSelectionChange({
      content: selectedContent,
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
    })


  }, [onSelectionChange])

  const handleMount: OnMount = useCallback((editor, monaco) => {

    editorRef.current = editor;
    configureMonaco(monaco);
    registerAutocompleteProvider(monaco, editor);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });

    editor.onDidChangeCursorSelection(handleSelectionChange);

  }, [configureMonaco, handleSelectionChange]);

  const hasEditsForCurrentFile = pendingEdits.some(
    (e) => e.file === filePath || filePath?.endsWith(e.file.replace(/\//g, '\\')),
  );


  if (!filePath) {
    return (
      <div className="editor-area">
        <div className="editor-wrapper">
          <div className="editor-empty">
            <span className="editor-empty-icon">📝</span>
            <p>Select a file to start editing</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="editor-area">
      <div className="editor-wrapper">
        <MonacoEditor
          height="100%"
          path={filePath.replace(/\\/g, '/')}
          value={content}
          language={getLanguage(filePath)}
          theme="vs-dark"
          onMount={handleMount}
          onChange={(val) => onContentChange(val ?? '')}
          options={{ ...BASE_EDITOR_OPTIONS, fontSize: editorFontSize, lineHeight: editorLineHeight }}
        />

        {hasEditsForCurrentFile && (
          <DiffActions
            pendingEdits={pendingEdits}
            currentEdit={pendingEdits[currentEditIndex]}
            onAcceptEdit={onAcceptEdit}
            onRejectEdit={onRejectEdit}
            onAcceptAll={onAcceptAll}
          />
        )}
      </div>
    </div>
  );
};