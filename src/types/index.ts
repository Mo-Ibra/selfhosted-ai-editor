export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

// ── AI Edit Types (SEARCH/REPLACE system) ──────────────────────────

export interface AIEdit {
  id: string
  file: string
  action: 'replace' | 'create' | 'delete'
  description?: string // NEW: Optional description for this specific edit
  search?: string
  replace?: string
  content?: string
}

export interface AIResponse {
  type: 'edits'
  summary: string
  edits: AIEdit[]
}

export interface AIQuestions {
  type: 'questions'
  questions: string[]
}

export interface AIPlan {
  type: 'plan'
  summary: string
  filesToTouch: string[]
}

export interface AIToolCall {
  type: 'tool_call'
  tool: 'read_file' | 'list_directory'
  path: string
}

export type AIResponsePayload = AIResponse | AIQuestions | AIPlan | AIToolCall | null

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  edits?: AIEdit[]
  questions?: string[]
  isStreaming?: boolean
  toolCalls?: { tool: string; path: string }[]
}

export interface OllamaPayload {
  activeFile: string
  activeFilePath: string
  fileTreeNodes: FileNode[]
  pinnedFiles: { path: string; content: string }[]
  history: { role: 'user' | 'assistant'; content: string }[]
  model: string
  selectedCode?: {
    content: string
    startLine: number
    endLine: number
  }
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  readTree: (folderPath: string) => Promise<FileNode[]>
  readFile: (filePath: string) => Promise<string>
  writeFile: (filePath: string, content: string) => Promise<void>
  chat: (payload: OllamaPayload) => Promise<void>
  onChatChunk: (callback: (chunk: string) => void) => void
  onChatDone: (callback: (response: AIResponse | null) => void) => void
  onFsChanged: (callback: (payload: { event: string; path: string }) => void) => void
  removeAllListeners: (channel: string) => void
  windowClose: () => void
  windowMinimize: () => void
  windowMaximize: () => void

  // Terminal
  ptySpawn: (cwd: string) => Promise<number>
  ptyWrite: (pid: number, data: string) => void
  ptyResize: (pid: number, cols: number, rows: number) => void
  ptyKill: (pid: number) => void
  onPtyData: (pid: number, callback: (data: string) => void) => void
  onPtyExit: (pid: number, callback: (payload: { exitCode: number; signal?: number }) => void) => void

  // AI Completions
  getAICompletion: (prefix: string, suffix: string, model: string) => Promise<string>
  stopAI: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
