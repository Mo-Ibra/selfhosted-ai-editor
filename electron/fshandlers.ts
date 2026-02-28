import { ipcMain, dialog, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import chokidar, { FSWatcher } from "chokidar";
import { FileNode } from "../src/types";

// ─── Ignore Lists ──────────────────────────────────────────────────

/** Hidden from the editor sidebar and file watcher */
const TREE_IGNORED = new Set(['.git', '.DS_Store', 'Thumbs.db'])

/** Shown in editor but excluded from AI file-tree context */
export const AI_IGNORED = new Set([
  'node_modules', 'dist', 'dist-electron', '.next',
  '__pycache__', '.cache', 'build', 'coverage', '.venv', 'venv',
  '.git', '.DS_Store', 'Thumbs.db',
])

const MAX_DEPTH = 6

// ─── File Tree Builder ─────────────────────────────────────────────

/***
 * Recursively builds a file tree from a directory path.
 * 
 * @param dirPath The directory path to scan.
 * @param depth The current depth of recursion.
 * @param ignoredSet The set of file/directory names to ignore.
 * @returns An array of FileNode objects representing the file tree.
 */
function buildFileTree(
  dirPath: string,
  depth = 0,
  ignoredSet = TREE_IGNORED
): FileNode[] {

  if (depth > MAX_DEPTH) return [];

  try {

    // Read directory entries
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    // Iterate over directory entries
    for (const entry of entries) {
      // Skip ignored files/directories
      if (ignoredSet.has(entry.name)) continue;

      // Build full path
      const fullPath = path.join(dirPath, entry.name);

      // Recursively build tree for directories, otherwise create file node
      nodes.push(
        entry.isDirectory() ? { name: entry.name, path: fullPath, isDir: true, children: buildFileTree(fullPath, depth + 1, ignoredSet) } : { name: entry.name, path: fullPath, isDir: false, }
      )
    }

    // Sort nodes: directories first, then alphabetically
    return nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    });

  } catch (err) {
    console.error(`[fs] Failed to read directory: ${dirPath}`, err)
    return []
  }
}

// ─── IPC Registration ──────────────────────────────────────────────

/**
 * Registers IPC handlers for file system operations.
 * 
 * @param getWin Function to get the main browser window.
 */
export function registerFsHandlers(getWin: () => BrowserWindow | null) {
  let watcher: FSWatcher | null = null;

  // Handle opening a folder
  ipcMain.handle('fs:openFolder', async () => {
    const win = getWin();
    if (!win) return null;

    // Open dialog to select a folder
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: "Open Project Folder",
    });

    // If dialog was cancelled or no folder selected, return null
    if (canceled || !filePaths[0]) return null;

    const folderPath = filePaths[0];

    // Close existing watcher if any
    if (watcher) await watcher.close();

    // Start watching the folder
    watcher = chokidar.watch(folderPath, {
      ignored: Array.from(TREE_IGNORED),
      persistent: true,
      ignoreInitial: true,
      depth: MAX_DEPTH,
    });

    // Send file changes to renderer
    watcher.on('all', (event: string, changedPath: string) => {
      win.webContents.send('fs:changed', { event, path: changedPath })
    })

    // Handle watcher errors
    watcher.on('error', (err) => {
      console.error('[fs:watcher] Error:', err)
    })

    return folderPath
  });

  // Handle reading the file tree
  ipcMain.handle('fs:readTree', (_event, folderPath: string) => {
    return buildFileTree(folderPath)
  });

  // Handle reading a file
  ipcMain.handle('fs:readFile', (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch (err) {
      console.error(`[fs:readFile] Failed to read: ${filePath}`, err)
      return ''
    }
  });

  // Handle writing a file
  ipcMain.handle('fs:writeFile', (_event, filePath: string, content: string) => {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      // Write the file
      fs.writeFileSync(filePath, content, 'utf-8')
    } catch (err) {
      console.error(`[fs:writeFile] Failed to write: ${filePath}`, err)
      throw err
    }
  })
}