import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import chokidar, { FSWatcher } from 'chokidar'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pty = require('node-pty')
import type { IPty } from 'node-pty'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.removeMenu()

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── File System IPC ───────────────────────────────────────────────

let watcher: FSWatcher | null = null

// Open folder dialog
ipcMain.handle('fs:openFolder', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Open Project Folder',
  })

  if (!result.canceled && result.filePaths[0]) {
    const folderPath = result.filePaths[0]

    // Setup file watcher
    if (watcher) {
      await watcher.close()
    }

    watcher = chokidar.watch(folderPath, {
      ignored: Array.from(IGNORED),
      persistent: true,
      ignoreInitial: true,
      depth: 6,
    })

    watcher.on('all', (event: string, path: string) => {
      win?.webContents.send('fs:changed', { event, path })
    })

    return folderPath
  }

  return null
})

// IGNORED paths for file tree
const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', '.next',
  '__pycache__', '.cache', 'build', 'coverage', '.venv', 'venv',
  '.DS_Store', 'Thumbs.db'
])

interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

function buildFileTree(dirPath: string, depth = 0): FileNode[] {
  if (depth > 6) return []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDir: true,
          children: buildFileTree(fullPath, depth + 1),
        })
      } else {
        nodes.push({ name: entry.name, path: fullPath, isDir: false })
      }
    }
    // Sort: directories first, then files
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return nodes
  } catch {
    return []
  }
}

ipcMain.handle('fs:readTree', async (_event, folderPath: string) => {
  return buildFileTree(folderPath)
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, content, 'utf-8')
})

// ─── Window Controls ───────────────────────────────────────────────

ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window:close', () => win?.close())

// ─── Ollama AI IPC ─────────────────────────────────────────────────

function buildFileTreeString(nodes: FileNode[], indent = ''): string {
  let result = ''
  for (const node of nodes) {
    result += `${indent}${node.isDir ? '📁' : '📄'} ${node.name}\n`
    if (node.children) result += buildFileTreeString(node.children, indent + '  ')
  }
  return result
}

ipcMain.handle('ai:chat', async (event, payload: {
  activeFile: string
  activeFilePath: string
  fileTreeNodes: FileNode[]
  pinnedFiles: { path: string; content: string }[]
  history: { role: 'user' | 'assistant'; content: string }[]
}) => {
  const { activeFile, activeFilePath, fileTreeNodes, pinnedFiles, history } = payload
  const fileTreeStr = buildFileTreeString(fileTreeNodes)

  let pinnedContext = ''
  for (const pf of pinnedFiles) {
    pinnedContext += `\n<pinned_file path="${pf.path}">\n${pf.content}\n</pinned_file>\n`
  }

  const systemPrompt = `You are an expert AI code editor assistant embedded in a desktop IDE.

You have full awareness of the project structure and can read and edit any file.

<project_file_tree>
${fileTreeStr}
</project_file_tree>
${pinnedContext ? `\n<pinned_files>${pinnedContext}</pinned_files>` : ''}
<active_file path="${activeFilePath}">
${activeFile}
</active_file>

IMPORTANT RULES:
- When asked to make code changes or edits, you MUST respond with ONLY a valid JSON object in this exact format:
{
  "explanation": "Brief description of what you changed and why",
  "edits": [
    {
      "file": "relative/path/from/project/root.ts",
      "startLine": 1,
      "endLine": 5,
      "newContent": "the new replacement content for these lines"
    }
  ]
}
- TO CREATE A NEW FILE: Use the relative path of the new file. Set startLine: 0 and endLine: 0. The context provided should be empty.
- When answering questions, explaining concepts, or having a conversation (NOT making edits), respond in plain text.
- Line numbers are 1-indexed.
- For insertions, set startLine and endLine to the same line (the line to insert after).
- The "file" field should be the FULL absolute path to the file if it exists, otherwise a relative path from the project root.
- Make minimal, precise edits. Only change what is necessary.`

  const requestBody = JSON.stringify({
    model: 'qwen3-coder:480b-cloud',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
    ],
    stream: true,
  })

  return new Promise<void>((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }

    let fullResponse = ''

    const req = http.request(options, (res) => {
      res.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            const token = parsed?.message?.content ?? ''
            if (token) {
              fullResponse += token
              event.sender.send('ai:chunk', token)
            }
            if (parsed.done) {
              // Try to parse as JSON edit response
              const trimmed = fullResponse.trim()
              let aiResponse = null
              // Extract JSON if wrapped in markdown code block
              const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
                || trimmed.match(/(\{[\s\S]*\})/)
              if (jsonMatch) {
                try {
                  const parsed2 = JSON.parse(jsonMatch[1] || jsonMatch[0])
                  if (parsed2.edits && Array.isArray(parsed2.edits)) {
                    // Add unique IDs to edits
                    aiResponse = {
                      explanation: parsed2.explanation || '',
                      edits: parsed2.edits.map((e: object, i: number) => ({
                        id: `edit-${Date.now()}-${i}`,
                        ...e,
                      })),
                    }
                  }
                } catch { /* not a JSON edit */ }
              }
              event.sender.send('ai:done', aiResponse)
              resolve()
            }
          } catch { /* skip malformed */ }
        }
      })

      res.on('error', (err) => {
        event.sender.send('ai:done', null)
        reject(err)
      })
    })

    req.on('error', (err) => {
      event.sender.send('ai:done', null)
      reject(err)
    })

    req.write(requestBody)
    req.end()
  })
})

// ─── Terminal IPC ──────────────────────────────────────────────────

const ptyProcesses: Map<number, IPty> = new Map()

ipcMain.handle('pty:spawn', async (event, cwd: string) => {
  const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: cwd || os.homedir(),
    env: process.env as Record<string, string>,
  })

  const pid = ptyProcess.pid
  ptyProcesses.set(pid, ptyProcess)

  ptyProcess.onData((data: string) => {
    event.sender.send(`pty:data-${pid}`, data)
  })

  ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    event.sender.send(`pty:exit-${pid}`, { exitCode, signal })
    ptyProcesses.delete(pid)
  })

  return pid
})

ipcMain.on('pty:write', (_event, pid: number, data: string) => {
  const ptyProcess = ptyProcesses.get(pid)
  if (ptyProcess) {
    ptyProcess.write(data)
  }
})

ipcMain.on('pty:resize', (_event, pid: number, cols: number, rows: number) => {
  const ptyProcess = ptyProcesses.get(pid)
  if (ptyProcess) {
    ptyProcess.resize(cols, rows)
  }
})

ipcMain.on('pty:kill', (_event, pid: number) => {
  const ptyProcess = ptyProcesses.get(pid)
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcesses.delete(pid)
  }
})

// ─── App Lifecycle ─────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
