import { ipcMain } from "electron";
import os from "node:os";
import { createRequire } from "node:module";
import type { IPty } from "node-pty";

const require = createRequire(import.meta.url);
const pty = require("node-pty");

// ─── State ─────────────────────────────────────────────────────────

const ptyProcesses = new Map<number, IPty>()

// ─── IPC Registration ──────────────────────────────────────────────

/**
 * Registers IPC handlers for terminal operations.
 *
 * This function:
 * - Handles spawning new PTY processes
 * - Manages PTY lifecycle (spawn, write, resize, kill)
 * - Sends data back to renderer process
 */
export function registerTerminalHandlers() {
  ipcMain.handle('pty:spawn', (event, cwd: string) => {
    const shell = os.platform() === "win32" ? "powershell.exe" : (process.env.SHELL ?? 'bash');

    const ptyProcess: IPty = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd || os.homedir(),
      env: process.env as Record<string, string>,
    });

    const { pid } = ptyProcess
    ptyProcesses.set(pid, ptyProcess)

    ptyProcess.onData((data: string) => {
      event.sender.send(`pty:data-${pid}`, data)
    })

    ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      event.sender.send(`pty:exit-${pid}`, { exitCode, signal })
      ptyProcesses.delete(pid)
    })

    return pid

  });

  // ─── PTY Operations ──────────────────────────────────────────────

  /**
   * Sends data to a PTY process.
   *
   * @param pid Process ID
   * @param data Data to send
   */
  ipcMain.on('pty:write', (_event, pid: number, data: string) => {
    ptyProcesses.get(pid)?.write(data)
  })

  /**
   * Resizes a PTY process.
   *
   * @param pid Process ID
   * @param cols New number of columns
   * @param rows New number of rows
   */
  ipcMain.on('pty:resize', (_event, pid: number, cols: number, rows: number) => {
    ptyProcesses.get(pid)?.resize(cols, rows)
  })

  /**
   * Kills a PTY process.
   *
   * @param pid Process ID
   */
  ipcMain.on('pty:kill', (_event, pid: number) => {
    const proc = ptyProcesses.get(pid)
    if (!proc) return
    proc.kill()
    ptyProcesses.delete(pid)
  })
}