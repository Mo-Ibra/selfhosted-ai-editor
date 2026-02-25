import { createContext, ReactNode, useCallback, useContext } from "react";
import { useTerminal } from "./hooks/useTerminal";
import { useFileSystem } from "./hooks/useFileSystem";
import { useEditor } from "./hooks/useEditor";
import { useAIChat } from "./hooks/useAIChat";

// ─── Context Type (composed from all hooks) ───
export type AppContextValue =
  ReturnType<typeof useFileSystem> &
  ReturnType<typeof useEditor> &
  ReturnType<typeof useTerminal> &
  ReturnType<typeof useAIChat>

// ─── Context ───
const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ─── Provider ────
export function AppProvider({ children }: { children: ReactNode }) {
  const fs = useFileSystem();
  const editor = useEditor({ fileContents: fs.fileContents, updateFileContent: fs.updateFileContent, writeFile: fs.writeFile, readFile: fs.readFile })
  const terminal = useTerminal();
  const chat = useAIChat({ folderPath: fs.folderPath, fileTree: fs.fileTree, fileContents: fs.fileContents, activeFilePath: editor.activeFilePath, pinnedFiles: editor.pinnedFiles, readFile: fs.readFile, writeFile: fs.writeFile })

  // ── Composed action: reset all state on folder open ──────────────
  const openFolder = useCallback(async () => {
    const path = await fs.openFolder()
    if (!path) return null
    editor.reset()
    chat.resetChat()
    return path
  }, [fs.openFolder, editor.reset, chat.resetChat]);

  return (
    <AppContext.Provider value={{ ...fs, ...editor, ...terminal, ...chat, openFolder }}>
      {children}
    </AppContext.Provider>
  )
}