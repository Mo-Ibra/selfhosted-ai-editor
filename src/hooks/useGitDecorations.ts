import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { diffLines, Change } from 'diff';

interface UseGitDecorationsProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof monaco | null;
  folderPath: string | null;
  activeFilePath: string | null;
  content: string;
}

export function useGitDecorations({ editor, monacoInstance, folderPath, activeFilePath, content }: UseGitDecorationsProps) {
  const decorationsCollectionRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const originalContentRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!editor || !monacoInstance || !folderPath || !activeFilePath) return;

    let isMounted = true;

    // Fetch the original file content from Git
    const fetchOriginalContent = async () => {
      try {
        const originalContent = await window.electronAPI.getGitOriginalFile(activeFilePath, folderPath);
        if (isMounted) {
          originalContentRef.current = originalContent;
          updateDecorations();
        }
      } catch (err) {
        console.error("Failed to fetch git original file:", err);
      }
    };

    fetchOriginalContent();

    return () => {
      isMounted = false;
    };
  }, [editor, monacoInstance, activeFilePath, folderPath]);

  // Update decorations whenever content changes (debounced)
  useEffect(() => {
    if (!editor || !monacoInstance) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      updateDecorations();
    }, 500); // 500ms debounce

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [content, editor, monacoInstance]);

  const updateDecorations = () => {
    if (!editor || !monacoInstance) return;

    const originalContent = originalContentRef.current;

    // If no original content (e.g., untracked file or error), clear decorations
    if (originalContent === null) {
      if (decorationsCollectionRef.current) {
        decorationsCollectionRef.current.clear();
      }
      return;
    }

    // Normalize line endings to LF before diffing to avoid false positives
    const currentContent = editor.getValue();
    const normalize = (str: string) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();

    // We split by lines here instead of using DiffLines so we have absolute control over whitespace
    const normalizedOriginal = normalize(originalContent) + '\n';
    const normalizedCurrent = normalize(currentContent) + '\n';

    const changes = diffLines(normalizedOriginal, normalizedCurrent);

    console.log(`[GitDecorations] Diff lines count for ${activeFilePath}:`, changes.length);
    console.table(changes.map(c => ({
      added: !!c.added,
      removed: !!c.removed,
      count: c.count,
      valuePreview: c.value.substring(0, 30).replace(/\n/g, '\\n')
    })));

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    let currentLineNumber = 1;

    for (let i = 0; i < changes.length; i++) {
      const change: Change = changes[i];

      if (change.added) {
        // Lines were added in the current document
        newDecorations.push({
          range: new monacoInstance.Range(currentLineNumber, 1, currentLineNumber + change.count! - 1, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'git-decoration-added',
          }
        });
        currentLineNumber += change.count!;
      } else if (change.removed) {
        // Lines were removed from the original document
        // We need to place a marker at the current line where the deletion happened.
        // Be careful if it's the very first line.
        const targetLine = Math.max(1, currentLineNumber - 1);

        // Check if the removed block is immediately followed by an added block 
        // (i.e. a modification rather than just a pure deletion)
        const nextChange = changes[i + 1];
        if (nextChange && nextChange.added) {
          // It's a modification - we'll handle the 'added' part next iteration,
          // but let's change the class of that upcoming addition to 'modified'.

          newDecorations.push({
            range: new monacoInstance.Range(currentLineNumber, 1, currentLineNumber + nextChange.count! - 1, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'git-decoration-modified',
            }
          });

          currentLineNumber += nextChange.count!;
          i++; // Skip the next 'added' block since we handled it as a modification
        } else {
          // Pure deletion
          newDecorations.push({
            range: new monacoInstance.Range(targetLine, 1, targetLine, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'git-decoration-deleted',
            }
          });
        }
      } else {
        // Unchanged lines
        currentLineNumber += change.count!;
      }
    }

    // Apply decorations
    if (!decorationsCollectionRef.current) {
      decorationsCollectionRef.current = editor.createDecorationsCollection(newDecorations);
    } else {
      decorationsCollectionRef.current.set(newDecorations);
    }
  };
}
