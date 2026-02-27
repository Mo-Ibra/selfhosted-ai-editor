// ─── Diff Decorations Hook ────────────────────────────────────────────────────
// With SEARCH/REPLACE, we can't show decorations by line number.
// Instead, we highlight the search text in the editor using a find-based approach.

import { Monaco } from "@monaco-editor/react";
import { AIEdit } from "../types";
import { useEffect, useRef } from "react";

export function useDiffDecorations(
  editorRef: React.MutableRefObject<any>,
  monacoRef: React.MutableRefObject<Monaco | null>,
  pendingEdits: AIEdit[],
  filePath: string | null,
) {
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    if (pendingEdits.length === 0) return;

    // Filter edits for current file
    const fileEdits = pendingEdits.filter(
      (e) => e.file === filePath || filePath?.endsWith(e.file.replace(/\//g, '\\')),
    ).filter(e => e.action === 'replace' && e.search);

    if (fileEdits.length === 0) return;

    const model = editor.getModel();
    if (!model) return;

    const newDecorations: any[] = [];

    for (const edit of fileEdits) {
      if (!edit.search) continue;

      // Find the search text in the model
      const matches = model.findMatches(edit.search, false, false, true, null, false);
      if (matches.length === 0) continue;

      const match = matches[0];

      // Highlight the matched (to-be-replaced) range in red
      newDecorations.push({
        range: match.range,
        options: {
          isWholeLine: false,
          className: 'diff-removed-line',
          linesDecorationsClassName: 'diff-gutter-removed',
          overviewRuler: {
            color: '#f38ba8',
            position: monaco.editor.OverviewRulerLane.Left,
          },
        }
      });
    }

    decorationsRef.current = editor.deltaDecorations([], newDecorations);

    // Scroll to first decorated area
    if (newDecorations.length > 0) {
      editor.revealRangeInCenter(newDecorations[0].range);
    }

  }, [pendingEdits, filePath, editorRef, monacoRef]);
}