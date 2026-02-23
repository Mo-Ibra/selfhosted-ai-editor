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
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),
})
