// ─── Diff Decorations Hook ────────────────────────────────────────────────────

import { Monaco } from "@monaco-editor/react";
import { AIEdit } from "../types";
import { useEffect, useRef } from "react";

/**
 * Applies diff decorations to the editor to show added/removed lines.
 * 
 * @param editorRef - Reference to the editor instance.
 * @param monacoRef - Reference to the Monaco instance.
 * @param pendingEdits - Array of pending edits to apply.
 * @param filePath - The path to the currently active file.
 */
export function useDiffDecorations(
  // Editor instance
  editorRef: React.MutableRefObject<any>,
  // Monaco instance
  monacoRef: React.MutableRefObject<Monaco | null>,
  // Pending edits
  pendingEdits: AIEdit[],
  // Current file path
  filePath: string | null,
) {
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    if (pendingEdits.length === 0) return

    // Filter edits for the current file
    const fileEdits = pendingEdits.filter(
      (e) => e.file === filePath || filePath?.endsWith(e.file.replace(/\//g, '\\')),
    );

    // If no edits for the current file, return
    if (fileEdits.length === 0) return;

    // Create decorations for each edit
    const newDecorations = fileEdits.flatMap((edit) => {
      const newLines = edit.newContent.split('\n')
      const decorations: any[] = []

      // If there is old content, add a decoration for the removed lines
      if (edit.oldContent) {
        decorations.push({
          range: new monaco.Range(edit.startLine, 1, edit.endLine, 1000),
          options: {
            isWholeLine: true,
            className: 'diff-removed-line',
            linesDecorationsClassName: 'diff-gutter-removed',
            overviewRuler: {
              color: '#f38ba8',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          }
        });
      }

      // Add a decoration for the added lines
      decorations.push({
        range: new monaco.Range(edit.endLine, 1, edit.endLine, 1000),
        options: {
          isWholeLine: true,
          after: {
            content: `\n${newLines.map((l) => `+ ${l}`).join('\n')}`,
            inlineClassName: 'diff-added-block',
          },
          overviewRuler: {
            color: '#a6e3a1',
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      })

      return decorations
    });

    // Apply the decorations
    decorationsRef.current = editor.deltaDecorations([], newDecorations)

    // Scroll to the first edit like a camera lens
    editor.revealLineInCenter(fileEdits[0].startLine)

  }, [pendingEdits, filePath, editorRef, monacoRef])
}