export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children?: FileNode[]
}

export interface ChatPayload {
  activeFile: string
  activeFilePath: string
  fileTreeNodes: FileNode[]
  pinnedFiles: { path: string; content: string }[]
  history: { role: 'user' | 'assistant'; content: string }[]
  model: string
  selectedCode?: { content: string; startLine: number; endLine: number }
}

export interface CompletePayload {
  prefix: string
  suffix: string
  model: string
}

export interface AgentEdit {
  id: string
  file: string
  action: 'replace' | 'create' | 'delete'
  description: string
  content?: string
  search?: string
  replace?: string
}

export interface AgentResponse {
  type: 'questions' | 'plan' | 'tool_call' | 'edits'
  [key: string]: any
}

export type Message = { role: string; content: string }