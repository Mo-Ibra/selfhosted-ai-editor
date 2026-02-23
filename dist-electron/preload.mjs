"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  openFolder: () => electron.ipcRenderer.invoke("fs:openFolder"),
  readTree: (folderPath) => electron.ipcRenderer.invoke("fs:readTree", folderPath),
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath, content) => electron.ipcRenderer.invoke("fs:writeFile", filePath, content),
  chat: (payload) => electron.ipcRenderer.invoke("ai:chat", payload),
  onChatChunk: (callback) => {
    electron.ipcRenderer.on("ai:chunk", (_event, chunk) => callback(chunk));
  },
  onChatDone: (callback) => {
    electron.ipcRenderer.on("ai:done", (_event, response) => callback(response));
  },
  onFsChanged: (callback) => {
    electron.ipcRenderer.on("fs:changed", (_event, payload) => callback(payload));
  },
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  },
  windowMinimize: () => electron.ipcRenderer.send("window:minimize"),
  windowMaximize: () => electron.ipcRenderer.send("window:maximize"),
  windowClose: () => electron.ipcRenderer.send("window:close"),
  // Terminal
  ptySpawn: (cwd) => electron.ipcRenderer.invoke("pty:spawn", cwd),
  ptyWrite: (pid, data) => electron.ipcRenderer.send("pty:write", pid, data),
  ptyResize: (pid, cols, rows) => electron.ipcRenderer.send("pty:resize", pid, cols, rows),
  ptyKill: (pid) => electron.ipcRenderer.send("pty:kill", pid),
  onPtyData: (pid, callback) => {
    electron.ipcRenderer.on(`pty:data-${pid}`, (_event, data) => callback(data));
  },
  onPtyExit: (pid, callback) => {
    electron.ipcRenderer.on(`pty:exit-${pid}`, (_event, payload) => callback(payload));
  }
});
