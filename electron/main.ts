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
      ignored: Array.from(TREE_IGNORED),
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

// TREE_IGNORED: hidden from the editor sidebar & file watcher
const TREE_IGNORED = new Set([
  '.git', '.DS_Store', 'Thumbs.db'
])

// AI_IGNORED: shown in the editor but excluded from the AI's file-tree context
const AI_IGNORED = new Set([
  'node_modules', 'dist', 'dist-electron', '.next',
  '__pycache__', '.cache', 'build', 'coverage', '.venv', 'venv',
  '.git', '.DS_Store', 'Thumbs.db'
])

interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

function buildFileTree(dirPath: string, depth = 0, ignoredSet = TREE_IGNORED): FileNode[] {
  if (depth > 6) return []
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (ignoredSet.has(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDir: true,
          children: buildFileTree(fullPath, depth + 1, ignoredSet),
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
    // Skip AI-ignored directories when building context for the AI
    if (node.isDir && AI_IGNORED.has(node.name)) continue
    result += `${indent}${node.isDir ? '📁' : '📄'} ${node.name}\n`
    if (node.children) result += buildFileTreeString(node.children, indent + '  ')
  }
  return result
}

let activeChatRequest: http.ClientRequest | null = null

ipcMain.on('ai:stop', () => {
  if (activeChatRequest) {
    activeChatRequest.destroy()
    activeChatRequest = null
  }
})

ipcMain.handle('ai:chat', async (event, payload: {
  activeFile: string
  activeFilePath: string
  fileTreeNodes: FileNode[]
  pinnedFiles: { path: string; content: string }[]
  history: { role: 'user' | 'assistant'; content: string }[]
  model: string
  selectedCode?: { content: string; startLine: number; endLine: number }
}) => {
  const { activeFile, activeFilePath, fileTreeNodes, pinnedFiles, history, model, selectedCode } = payload

  const fileTreeStr = buildFileTreeString(fileTreeNodes)

  let pinnedContext = ''
  for (const pf of pinnedFiles) {
    pinnedContext += `\n<pinned_file path="${pf.path}">\n${pf.content}\n</pinned_file>\n`
  }

  const selectionContext = selectedCode
    ? `\n<selected_code line_start="${selectedCode.startLine}" line_end="${selectedCode.endLine}">\n${selectedCode.content}\n</selected_code>`
    : '';

  const systemPrompt = `You are an expert AI code editor embedded in a desktop IDE. You are an AGENT — you must think before acting, ask clarifying questions, propose plans, and execute changes precisely.

---
## TOOLS AVAILABLE
You can call these tools by responding with a tool_call JSON (see format below):
- **read_file**: Read the content of a file you need to inspect.
- **list_directory**: List files/folders inside a path.

---
## RESPONSE PROTOCOL — You MUST output exactly ONE of these formats per response:

### 1. QUESTIONS (ask before acting on ambiguous or large requests)
\`\`\`json
{ "type": "questions", "questions": ["Question 1?", "Question 2?"] }
\`\`\`

### 2. PLAN (after questions are answered, propose a plan and wait for approval)
\`\`\`json
{ "type": "plan", "summary": "What you intend to do and why", "files_to_touch": ["src/App.tsx", "src/utils.ts"] }
\`\`\`
→ After the user says "OK", "تمام", "نفذ", or "execute", proceed with edits.

### 3. TOOL CALL (read a file or list a directory you need)
\`\`\`json
{ "type": "tool_call", "tool": "read_file", "path": "src/App.tsx" }
\`\`\`
→ The result will be injected automatically — then you can continue.

### 4. EDITS (SEARCH/REPLACE — the actual code changes)
\`\`\`xml
<edits summary="Brief summary of what was changed">
<edit file="src/App.tsx" action="replace" description="Add async support to login">
<<<< SEARCH
exact existing code to find
==== REPLACE
new replacement code
>>>> END
</edit>
</edits>
\`\`\`

**SEARCH/REPLACE RULES:**
- **Description**: ALWAYS include a \`description\` attribute in the \`<edit>\` tag (e.g., \`description="Fix bug X"\`).
- **File Path**: Use the EXACT path from the file tree. Double check if you are editing \`Editor.tsx\` vs \`ChatPane.tsx\`. Do NOT repeat the same file name for different files.
- **Precision**: The SEARCH block MUST be an EXACT copy of the existing code.
- **Multiple Edits**: If you need to make multiple changes to the same file, you can use multiple \`<edit>\` tags for that file.
- **Context**: Include 2-3 surrounding lines to make the search unique.

### 5. PLAIN TEXT (for explanations, small answers, status updates)
Just write normal text — no JSON or XML.

---
## WORKFLOW RULES:
1. For SIMPLE requests (< 5 lines change, single file): Skip questions & plan. Go straight to EDITS.
2. For COMPLEX requests (multiple files, architecture changes): Ask → Plan → Edits.
3. If you need to read a file before you can write edits: Use TOOL CALL first.
4. NEVER use line numbers. ALWAYS use SEARCH/REPLACE.
5. NEVER truncate code. Write complete, working replacements.

---
## CONTEXT:
<project_file_tree>
${fileTreeStr}
</project_file_tree>
${pinnedContext ? `\n<pinned_files>${pinnedContext}</pinned_files>` : ''}
<active_file path="${activeFilePath}">
${activeFile}
</active_file>${selectionContext}`

  // ── Build conversation messages ──
  const conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...history,
  ]

  // ── Agentic loop: run until we get a final response (edits or plain text) ──
  const runAgenticLoop = async (msgs: { role: string; content: string }[]): Promise<void> => {
    const requestBody = JSON.stringify({
      model: model || 'qwen3-coder:480b-cloud',
      messages: msgs,
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

      if (activeChatRequest) activeChatRequest.destroy()

      const req = http.request(options, (res) => {
        activeChatRequest = req
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
                const payload = parseAgentResponse(fullResponse)

                if (payload?.type === 'tool_call') {
                  // Execute tool and loop
                  handleToolCall(payload, msgs).then(resolve).catch(reject)
                } else {
                  event.sender.send('ai:done', payload)
                  resolve()
                }
              }
            } catch { /* skip malformed */ }
          }
        })

        res.on('end', () => { activeChatRequest = null })
        res.on('error', (err) => {
          activeChatRequest = null
          event.sender.send('ai:done', null)
          reject(err)
        })
      })

      req.on('error', (err) => {
        activeChatRequest = null
        event.sender.send('ai:done', null)
        reject(err)
      })

      req.write(requestBody)
      req.end()
    })
  }

  // ── Handle Tool Calls ──
  const handleToolCall = async (tool: { type: string; tool: string; path: string }, msgs: { role: string; content: string }[]): Promise<void> => {
    let toolResult = ''
    try {
      if (tool.tool === 'read_file') {
        const rootPath = payload.fileTreeNodes[0]?.path
        const basePath = rootPath ? (fs.statSync(rootPath).isDirectory() ? rootPath : path.dirname(rootPath)) : '';
        const fullPath = (tool.path.includes(':') || tool.path.startsWith('\\'))
          ? tool.path
          : path.join(basePath, tool.path);

        toolResult = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : `File not found: ${tool.path} (Calculated: ${fullPath})`;
      } else if (tool.tool === 'list_directory') {
        const rootPath = payload.fileTreeNodes[0]?.path
        const basePath = rootPath ? (fs.statSync(rootPath).isDirectory() ? rootPath : path.dirname(rootPath)) : '';
        const fullPath = (tool.path.includes(':') || tool.path.startsWith('\\'))
          ? tool.path
          : path.join(basePath, tool.path);
        const entries = fs.existsSync(fullPath) ? fs.readdirSync(fullPath).join('\n') : `Directory not found: ${tool.path}`;
        toolResult = entries
      }
    } catch (e) {
      toolResult = `Error reading ${tool.path}: ${String(e)}`
    }

    // Notify user of tool execution (as a chunk)
    event.sender.send('ai:chunk', `\n\`\`\`tool\n🔍 Reading \`${tool.path}\`...\n\`\`\`\n`)

    // Add tool result to messages and loop
    const newMsgs = [
      ...msgs,
      { role: 'assistant', content: JSON.stringify({ type: 'tool_call', tool: tool.tool, path: tool.path }) },
      { role: 'user', content: `<tool_result tool="${tool.tool}" path="${tool.path}">\n${toolResult}\n</tool_result>` },
    ]
    return runAgenticLoop(newMsgs)
  }

  return runAgenticLoop(conversationMessages)
})

// ── Parse Agent Response ────────────────────────────────────────────
function parseAgentResponse(rawText: string): any {
  const trimmed = rawText.trim()

  // Try JSON block (questions / plan / tool_call)
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    || trimmed.match(/(\{[\s\S]*\})/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])
      if (['questions', 'plan', 'tool_call'].includes(parsed.type)) {
        // Normalize plan fields
        if (parsed.type === 'plan') {
          parsed.filesToTouch = parsed.files_to_touch || parsed.filesToTouch || []
        }
        return parsed
      }
    } catch { /* not JSON */ }
  }

  // Try XML edits block
  const editsMatch = trimmed.match(/<edits[^>]*summary="([^"]*)"[^>]*>([\s\S]*?)<\/edits>/)
    || trimmed.match(/<edits>([\s\S]*?)<\/edits>/)

  if (editsMatch) {
    const summary = editsMatch[1] || ''
    const editsContent = editsMatch[2] || editsMatch[1] || ''
    const editBlocks = [...editsContent.matchAll(/<edit\s+file="([^"]+)"\s+action="([^"]+)"(?:\s+description="([^"]*)")?[^>]*>([\s\S]*?)<\/edit>/g)]

    const edits = editBlocks.map((match, i) => {
      const file = match[1]
      const action = match[2] as 'replace' | 'create' | 'delete'
      const description = match[3] || ''
      const body = match[4].trim()

      if (action === 'create') {
        return { id: `edit-${Date.now()}-${i}`, file, action, description, content: body }
      }

      // Parse SEARCH/REPLACE (relaxed for newlines and arrows)
      const srMatch = body.match(/<{3,}\s*SEARCH\s*([\s\S]*?)\s*={3,}\s*REPLACE\s*([\s\S]*?)\s*>{3,}\s*(?:END|REPLACE)/i)
      if (srMatch) {
        return { id: `edit-${Date.now()}-${i}`, file, action: 'replace' as const, description, search: srMatch[1].trim(), replace: srMatch[2].trim() }
      }

      return { id: `edit-${Date.now()}-${i}`, file, action, description, content: body }
    })

    return { type: 'edits', summary, edits }
  }

  // Plain text — return null so the streamed content is shown as-is
  return null
}

ipcMain.handle('ai:complete', async (_event, payload: {
  prefix: string
  suffix: string
  model: string
}) => {
  const { prefix, suffix, model } = payload
  const modelName = model || 'qwen3-coder:480b-cloud'

  console.log(`[AI Complete] Requesting completion from ${modelName}...`)

  // FIM (Fill-In-The-Middle) prompt format for Qwen/DeepSeek coder models
  const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`

  const requestBody = JSON.stringify({
    model: modelName,
    prompt: prompt,
    stream: false,
    options: {
      num_predict: 128,
      temperature: 0,
      stop: ['<|file_separator|>', '<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>', '\n\n']
    }
  })

  return new Promise<string>((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }

    let responseData = ''
    const req = http.request(options, (res) => {
      res.on('data', (chunk) => { responseData += chunk.toString() })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData)
          let suggestion = parsed.response || ''

          // Clean up markdown code blocks if present
          suggestion = suggestion.replace(/^```[a-z]*\n/i, '').replace(/```$/g, '').trim()

          console.log(`[AI Complete] Received suggestion: "${suggestion.slice(0, 50)}..."`)
          resolve(suggestion)
        } catch (e) {
          console.error('[AI Complete] JSON Parse Error:', e)
          resolve('')
        }
      })
    })

    req.on('error', (err) => {
      console.error('[AI Complete] Network Error:', err)
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
