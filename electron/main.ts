import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { registerFsHandlers } from './fshandlers';
import { registerAiHandlers } from "./aihandlers";
import { registerTerminalHandlers } from './terminalHandlers'

// ─── Paths ─────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// ─── Window ────────────────────────────────────────────────────────

let win: BrowserWindow | null = null

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

  VITE_DEV_SERVER_URL
    ? win.loadURL(VITE_DEV_SERVER_URL)
    : win.loadFile(path.join(RENDERER_DIST, 'index.html'))
}

// ─── Window Controls ───────────────────────────────────────────────

function registerWindowHandlers() {
  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
  ipcMain.on('window:close', () => win?.close())
}

// ─── App Lifecycle ─────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  registerWindowHandlers()
  registerFsHandlers(() => win)
  registerAiHandlers()
  registerTerminalHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})