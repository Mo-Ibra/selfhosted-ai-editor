import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalProps {
  cwd: string | null
  onClose: () => void
}

export default function Terminal({ cwd, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const pidRef = useRef<number | null>(null)

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTerm({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = term

    let isMounted = true

    // Spawn PTY
    window.electronAPI.ptySpawn(cwd || '').then((pid) => {
      if (!isMounted) {
        window.electronAPI.ptyKill(pid)
        return
      }
      pidRef.current = pid

      // Forward data from PTY to XTerm
      window.electronAPI.onPtyData(pid, (data) => {
        term.write(data)
      })

      // Forward data from XTerm to PTY
      term.onData((data) => {
        window.electronAPI.ptyWrite(pid, data)
      })

      // Handle Terminal Exit
      window.electronAPI.onPtyExit(pid, () => {
        if (isMounted) onClose()
      })

      // Handle Resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        window.electronAPI.ptyResize(pid, term.cols, term.rows)
      })
      resizeObserver.observe(terminalRef.current!)
    })

    return () => {
      isMounted = false
      if (pidRef.current) {
        window.electronAPI.ptyKill(pidRef.current)
      }
      term.dispose()
    }
  }, [])

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span className="terminal-title">TERMINAL</span>
        <button className="terminal-close" onClick={onClose}>×</button>
      </div>
      <div ref={terminalRef} className="xterm-wrapper" />
    </div>
  )
}
