import { useCallback, useState } from "react"

interface UseEditorOptions {
  fileContents: Record<string, string>
  updateFileContent: (path: string, content: string) => void
  writeFile: (path: string, content: string) => Promise<void>
  readFile: (path: string) => Promise<string>
}

/**
 * Editor Hook
 * 
 * Manages the active file and dirty files.
 */
export function useEditor({ fileContents, updateFileContent, writeFile, readFile }: UseEditorOptions) {

  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

  // ────── Actions ────── //

  // Open file — reads content from disk if not already cached
  const openFile = useCallback(async (filePath: string) => {
    await readFile(filePath); // populates fileContents via useFileSystem
    setActiveFilePath(filePath);
  }, [readFile]);

  // Close file
  const closeFile = useCallback(() => {
    setActiveFilePath(null)
  }, [])

  // Change file content
  const changeContent = useCallback((content: string) => {
    if (!activeFilePath) return;
    updateFileContent(activeFilePath, content);
    setDirtyFiles((prev) => new Set(prev).add(activeFilePath))
  }, [activeFilePath, updateFileContent])

  // Save file
  const saveFile = useCallback(async () => {
    if (!activeFilePath) return;
    const content = fileContents[activeFilePath]
    if (content === undefined) return;
    await writeFile(activeFilePath, content)
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      next.delete(activeFilePath)
      return next;
    })
  }, [activeFilePath, fileContents, writeFile])

  // Save all dirty files
  const saveAll = useCallback(async () => {
    const dirty = Array.from(dirtyFiles);
    for (const path of dirty) {
      const content = fileContents[path];
      if (content !== undefined) {
        await writeFile(path, content);
      }
    }
    setDirtyFiles(new Set());
  }, [dirtyFiles, fileContents, writeFile]);

  // Reset
  const reset = useCallback(() => {
    setActiveFilePath(null);
    setDirtyFiles(new Set())
  }, [])

  return {
    activeFilePath,
    activeFileName: activeFilePath?.split(/[\\/]/).pop(),
    activeContent: activeFilePath ? fileContents[activeFilePath] ?? '' : '',
    dirtyFiles,
    openFile,
    closeFile,
    changeContent,
    saveFile,
    saveAll,
    reset,
  }
}