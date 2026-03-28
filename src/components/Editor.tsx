import { useRef, useCallback, useState, useEffect } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { AIEdit } from '../types'
import { getLanguage } from "../utils/language";
import { useMonacoSetup } from '../hooks/useMonacoSetup'
import { useFileModels } from '../hooks/useFileModels';
import { useDiffDecorations } from '../hooks/useDiffDecorations';
import { registerAutocompleteProvider } from '../hooks/useAutoComplete'
import { DiffActions } from './DiffActions'
import { useApp } from '../AppProvider'
import { useKeyboardSound } from '../hooks/useKeyboardSound'
import { useGitDecorations } from '../hooks/useGitDecorations'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_EDITOR_OPTIONS = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  fontLigatures: true,
  lineHeight: 22,
  minimap: { enabled: true },
  glyphMargin: true, // NEEDED for Git diff colors
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
  const { editorFontSize, editorLineHeight, settings, editorRef: ctxEditorRef } = useApp()
  const { play } = useKeyboardSound(settings.keyboardSound)
  const editorRef = useRef<any>(null)
  const onSaveRef = useRef(onSave)
  const folderPathRef = useRef(folderPath)
  // Ref so the autocomplete provider always reads the latest value without re-registering
  const autoCompleteEnabledRef = useRef(settings.autoCompletion)
  autoCompleteEnabledRef.current = settings.autoCompletion
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

  // Render Git diff decorations
  useGitDecorations({
    editor: editorRef.current,
    monacoInstance: monacoRef.current,
    folderPath: folderPathRef.current,
    activeFilePath: filePath,
    content: content,
  });

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
    ctxEditorRef.current = editor;
    configureMonaco(monaco);
    registerAutocompleteProvider(monaco, editor, autoCompleteEnabledRef);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });

    editor.onKeyDown((e: any) => {
      // Prevent sound on combined shortcuts (like Ctrl+S, Alt+F, etc)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Prevent sound on navigation, deletion, and modifier keys
      const kc = e.keyCode;
      const isNonTypingKey = (
        kc === monaco.KeyCode.Backspace ||
        kc === monaco.KeyCode.Delete ||
        kc === monaco.KeyCode.LeftArrow ||
        kc === monaco.KeyCode.RightArrow ||
        kc === monaco.KeyCode.UpArrow ||
        kc === monaco.KeyCode.DownArrow ||
        kc === monaco.KeyCode.PageUp ||
        kc === monaco.KeyCode.PageDown ||
        kc === monaco.KeyCode.Home ||
        kc === monaco.KeyCode.End ||
        kc === monaco.KeyCode.Escape ||
        kc === monaco.KeyCode.Shift ||
        kc === monaco.KeyCode.Ctrl ||
        kc === monaco.KeyCode.Alt ||
        kc === monaco.KeyCode.Meta ||
        kc === monaco.KeyCode.CapsLock ||
        kc === monaco.KeyCode.Insert ||
        kc === monaco.KeyCode.Tab ||
        kc === monaco.KeyCode.Space ||
        kc === monaco.KeyCode.Enter ||
        kc >= monaco.KeyCode.F1 && kc <= monaco.KeyCode.F12
      );

      if (!isNonTypingKey) {
        play();
      }
    });

    editor.onDidChangeCursorSelection(handleSelectionChange);

  }, [configureMonaco, handleSelectionChange, play, ctxEditorRef]);

  useEffect(() => {
    return () => {
      if (ctxEditorRef.current === editorRef.current) {
        ctxEditorRef.current = null;
      }
    };
  }, [ctxEditorRef]);

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
          theme={settings.theme === 'light' ? 'vs-light' : 'vs-dark'}
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