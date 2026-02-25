import { useCallback, useEffect, useState } from "react";
import { FileNode } from "../types";

/**
 * File System Hook
 * 
 * Manages the file tree, folder path, and file contents.
 */
export function useFileSystem() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  /**
   * File Watcher
   * 
   * Watches for file changes and updates the file tree to keep it in sync with the file system.
   */
  useEffect(() => {

    if (!folderPath) return;

    const refresh = () => window.electronAPI.readTree(folderPath).then(setFileTree);
    window.electronAPI.onFsChanged(refresh);
    return () => window.electronAPI.removeAllListeners('fs:changed')

  }, [folderPath]);

  // ── Actions ──

  /**
   * openFolder
   * 
   * Opens a folder dialog and sets the folder path.
   */
  const openFolder = useCallback(async () => {
    const path = await window.electronAPI.openFolder();
    if (!path) return null;
    setFolderPath(path);
    setFileTree(await window.electronAPI.readTree(path))
    setFileContents({});
    return path;
  }, [])

  /**
   * readFile
   * 
   * Reads a file and returns its content.
   */
  const readFile = useCallback(async (filePath: string) => {
    // If file is already in memory, return it
    if (fileContents[filePath]) return fileContents[filePath]
    // Otherwise, read it from the file system
    const content = await window.electronAPI.readFile(filePath)
    setFileContents((prev) => ({ ...prev, [filePath]: content }))
    return content
  }, [fileContents])

  /**
   * writeFile
   * 
   * Writes a file and updates the file tree.
   * SAVING TO DISK
   */
  const writeFile = useCallback(async (filePath: string, content: string) => {

    await window.electronAPI.writeFile(filePath, content);
    setFileContents((prev) => ({ ...prev, [filePath]: content }))
    if (folderPath) setFileTree(await window.electronAPI.readTree(folderPath))

  }, [folderPath])

  /**
   * updateFileContent
   * 
   * Updates the content of a file in memory.
   * NOT SAVING TO DISK
   */
  const updateFileContent = useCallback((filePath: string, content: string) => {
    setFileContents((prev) => ({ ...prev, [filePath]: content }))
  }, [])

  /**
   * refreshTree
   * 
   * Refreshes the file tree.
   */
  const refreshTree = useCallback(async () => {
    if (!folderPath) return
    setFileTree(await window.electronAPI.readTree(folderPath))
  }, [folderPath])

  return {
    folderPath,
    folderName: folderPath?.split(/[\\/]/).pop(),
    fileTree,
    fileContents,
    openFolder,
    readFile,
    writeFile,
    updateFileContent,
    refreshTree,
  }
}