import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('fs:openFolder'),
  readTree: (folderPath: string) => ipcRenderer.invoke('fs:readTree', folderPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  chat: (payload: object) => ipcRenderer.invoke('ai:chat', payload),
  onChatChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('ai:chunk', (_event, chunk) => callback(chunk))
  },
  onChatDone: (callback: (response: object | null) => void) => {
    ipcRenderer.on('ai:done', (_event, response) => callback(response))
  },
  onFsChanged: (callback: (payload: { event: string; path: string }) => void) => {
    ipcRenderer.on('fs:changed', (_event, payload) => callback(payload))
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  // Terminal
  ptySpawn: (cwd: string) => ipcRenderer.invoke('pty:spawn', cwd),
  ptyWrite: (pid: number, data: string) => ipcRenderer.send('pty:write', pid, data),
  ptyResize: (pid: number, cols: number, rows: number) => ipcRenderer.send('pty:resize', pid, cols, rows),
  ptyKill: (pid: number) => ipcRenderer.send('pty:kill', pid),
  onPtyData: (pid: number, callback: (data: string) => void) => {
    ipcRenderer.on(`pty:data-${pid}`, (_event, data) => callback(data))
  },
  onPtyExit: (pid: number, callback: (payload: { exitCode: number; signal?: number }) => void) => {
    ipcRenderer.on(`pty:exit-${pid}`, (_event, payload) => callback(payload))
  },
})
