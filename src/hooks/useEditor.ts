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
 * Manages the active file, pinned files, and dirty files.
 */
export function useEditor({ fileContents, updateFileContent, writeFile, readFile }: UseEditorOptions) {

  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
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
      // Remove file from dirty files
      const next = new Set(prev);
      next.delete(activeFilePath)
      return next;
    })
  }, [activeFilePath, fileContents, writeFile])

  // Toggle pin
  const togglePin = useCallback((filePath: string) => {
    setPinnedFiles((prev) =>
      prev.includes(filePath) ? prev.filter((p) => p !== filePath) : [...prev, filePath]
    )
  }, [])

  // Reset
  const reset = useCallback(() => {
    setActiveFilePath(null);
    setPinnedFiles([]);
    setDirtyFiles(new Set())
  }, [])

  return {
    activeFilePath,
    activeFileName: activeFilePath?.split(/[\\/]/).pop(),
    activeContent: activeFilePath ? fileContents[activeFilePath] ?? '' : '',
    pinnedFiles,
    dirtyFiles,
    openFile,
    closeFile,
    changeContent,
    saveFile,
    togglePin,
    reset,
  }
}