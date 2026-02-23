export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface AIEdit {
  id: string
  file: string
  startLine: number
  endLine: number
  oldContent: string
  newContent: string
}

export interface AIResponse {
  explanation: string
  edits: AIEdit[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  edits?: AIEdit[]
  isStreaming?: boolean
}

export interface OllamaPayload {
  activeFile: string
  activeFilePath: string
  fileTreeNodes: FileNode[]
  pinnedFiles: { path: string; content: string }[]
  history: { role: 'user' | 'assistant'; content: string }[]
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
