import { useCallback, useEffect, useRef, useState } from "react"
import { AIEdit, AIResponsePayload, ChatMessage, FileNode } from "../types"

interface SelectedCode {
  content: string
  startLine: number
  endLine: number
}

interface UseAIChatOptions {
  folderPath: string | null
  fileTree: FileNode[]
  fileContents: Record<string, string>
  activeFilePath: string | null
  pinnedFiles: string[]
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
}

export function useAIChat({ folderPath, fileTree, fileContents, activeFilePath, pinnedFiles, readFile, writeFile }: UseAIChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<AIEdit[]>([]);
  const [acceptedEdits, setAcceptedEdits] = useState<string[]>([]);
  const [rejectedEdits, setRejectedEdits] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<SelectedCode | null>(null);
  const [aiModel, setAiModel] = useState(
    () => localStorage.getItem('ai-model') || 'qwen3-coder:480b-cloud'
  )

  const streamingMsgId = useRef<string | null>(null)

  // ── Persist Model ───
  useEffect(() => {
    localStorage.setItem('ai-model', aiModel)
  }, [aiModel])

  // ── Send Message ──
  const sendMessage = useCallback(async (text: string) => {
    if (!folderPath) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text }
    const assistantId = `assistant-${Date.now()}`
    streamingMsgId.current = assistantId;

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', isStreaming: true }])
    setIsStreaming(true)
    setPendingEdits([])
    setAcceptedEdits([])
    setRejectedEdits([])

    const extraFiles = await buildExtraFiles(text, pinnedFiles, fileContents, readFile);

    await window.electronAPI.chat({
      activeFile: activeFilePath ? (fileContents[activeFilePath] ?? '') : '',
      activeFilePath: activeFilePath || '',
      fileTreeNodes: fileTree,
      pinnedFiles: extraFiles,
      history: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
      model: aiModel,
      selectedCode: selectedCode ?? undefined,
    })
  }, [folderPath, fileTree, fileContents, activeFilePath, pinnedFiles, messages, aiModel, selectedCode, readFile])

  // ── SEARCH/REPLACE Engine ──
  const applyEditToContent = useCallback((edit: AIEdit, baseContent?: string): { targetPath: string; newContent: string } | null => {
    const targetPath = resolveTargetPath(edit.file, fileContents, activeFilePath, folderPath)
    if (!targetPath) return null;

    // For 'create' action
    if (edit.action === 'create') {
      return { targetPath, newContent: edit.content ?? '' };
    }

    // For 'delete' action
    if (edit.action === 'delete') {
      return { targetPath, newContent: '' };
    }

    // For 'replace' action — SEARCH/REPLACE
    const isNewFile = baseContent === undefined && !(targetPath in fileContents);
    const currentContent = baseContent !== undefined ? baseContent : (fileContents[targetPath] ?? '');

    if (isNewFile && edit.action === 'replace') {
      return { targetPath, newContent: edit.replace ?? '' };
    }

    if (!edit.search) return null;

    const normalizeLine = (l: string) => l.trim().replace(/[ \t]+/g, ' ');
    const currentLines = currentContent.split('\n');
    const searchLines = edit.search.split('\n');
    const replaceLines = (edit.replace ?? '').split('\n');

    // 1. Exact match attempt
    if (currentContent.includes(edit.search)) {
      return { targetPath, newContent: currentContent.replace(edit.search, edit.replace ?? '') }
    }

    // 2. Bulletproof fuzzy match (ignoring ALL blank lines and indentation)
    const currentNonEmpty = currentLines
      .map((line, idx) => ({ line: normalizeLine(line), idx }))
      .filter(x => x.line.length > 0);

    const searchNonEmpty = searchLines
      .map(line => normalizeLine(line))
      .filter(line => line.length > 0);

    if (searchNonEmpty.length === 0) return null;

    let matchOrigStart = -1;
    let matchOrigEnd = -1;

    for (let i = 0; i <= currentNonEmpty.length - searchNonEmpty.length; i++) {
      let match = true;
      for (let j = 0; j < searchNonEmpty.length; j++) {
        if (currentNonEmpty[i + j].line !== searchNonEmpty[j]) {
          match = false;
          break;
        }
      }

      if (match) {
        matchOrigStart = currentNonEmpty[i].idx;
        matchOrigEnd = currentNonEmpty[i + searchNonEmpty.length - 1].idx;
        break;
      }
    }

    if (matchOrigStart !== -1 && matchOrigEnd !== -1) {
      const newLines = [
        ...currentLines.slice(0, matchOrigStart),
        ...replaceLines,
        ...currentLines.slice(matchOrigEnd + 1)
      ];
      return { targetPath, newContent: newLines.join('\n') };
    }

    // Not found — return null to trigger error notification
    return null;
  }, [fileContents, activeFilePath, folderPath]);

  // ── Accept Single Edit ──
  const acceptEdit = useCallback(async (edit: AIEdit) => {
    const result = applyEditToContent(edit);
    if (!result) {
      // Notify user of failed SEARCH block
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Could not apply edit to \`${edit.file}\`**: The search text was not found in the file. The file may have changed since the AI generated this edit.`,
      }]);
      setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
      return;
    }
    await writeFile(result.targetPath, result.newContent);
    setAcceptedEdits(prev => [...prev, edit.id])
    setPendingEdits(prev => prev.filter(e => e.id !== edit.id))
  }, [applyEditToContent, writeFile])

  const rejectEdit = useCallback((edit: AIEdit) => {
    setRejectedEdits(prev => [...prev, edit.id])
    setPendingEdits(prev => prev.filter(e => e.id !== edit.id))
  }, [])

  const acceptAllEdits = useCallback(async () => {
    // Group edits by target path
    const grouped = new Map<string, AIEdit[]>();
    for (const edit of pendingEdits) {
      const path = resolveTargetPath(edit.file, fileContents, activeFilePath, folderPath);
      if (path) {
        if (!grouped.has(path)) grouped.set(path, []);
        grouped.get(path)!.push(edit);
      }
    }

    // Apply all edits for each file
    for (const [path, edits] of grouped.entries()) {
      let currentContent = fileContents[path] ?? '';
      const finishedIds: string[] = [];
      const failed = [];

      for (const edit of edits) {
        const result = applyEditToContent(edit, currentContent);
        if (result) {
          currentContent = result.newContent;
          finishedIds.push(edit.id);
        } else {
          failed.push(edit);
        }
      }

      // Final write for this file
      if (finishedIds.length > 0) {
        await writeFile(path, currentContent);
        setAcceptedEdits(prev => [...prev, ...finishedIds]);
      }

      // Handle failures
      for (const edit of failed) {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Could not apply edit to \`${edit.file}\`**: ${edit.description || 'Search text not found.'}`,
        }]);
      }
    }

    setPendingEdits([]);
  }, [pendingEdits, fileContents, activeFilePath, folderPath, applyEditToContent, writeFile])

  const rejectAllEdits = useCallback(() => {
    pendingEdits.forEach(rejectEdit)
  }, [pendingEdits, rejectEdit])

  const resetChat = useCallback(() => {
    setMessages([])
    setPendingEdits([])
    setAcceptedEdits([])
    setRejectedEdits([])
  }, [])

  const stopChat = useCallback(() => {
    window.electronAPI.stopAI()
    const id = streamingMsgId.current
    streamingMsgId.current = null
    setIsStreaming(false)
    if (id) {
      setMessages(prev => prev.filter(m => m.id !== id))
    }
  }, [])

  // ── Streaming Listeners ──
  useEffect(() => {
    window.electronAPI.removeAllListeners('ai:chunk');
    window.electronAPI.removeAllListeners('ai:done');

    window.electronAPI.onChatChunk((chunk: string) => {
      const id = streamingMsgId.current;
      if (!id) return;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + chunk } : m));
    });

    window.electronAPI.onChatDone(async (payload: AIResponsePayload) => {
      const id = streamingMsgId.current;
      streamingMsgId.current = null;
      setIsStreaming(false);

      if (!payload) return;

      if (payload.type === 'questions') {
        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, content: '', questions: payload.questions, isStreaming: false } : m
        ));
        return;
      }

      if (payload.type === 'plan') {
        // Auto-save the plan to implementation_plan.md
        if (folderPath) {
          const planPath = `${folderPath}\\implementation_plan.md`;
          const planContent = `# Implementation Plan\n\n${payload.summary}\n\n## Files to Touch\n${payload.filesToTouch.map(f => `- \`${f}\``).join('\n')}`;
          await writeFile(planPath, planContent);
        }
        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, content: `📋 **Plan Created**\n\n${payload.summary}\n\n**Files:** ${payload.filesToTouch.join(', ')}\n\nType **"OK"** or **"تمام"** to execute.`, isStreaming: false } : m
        ));
        return;
      }

      if (payload.type === 'edits') {
        const planEdit = payload.edits.find(e => e.file.toLowerCase().includes('implementation_plan.md'));

        // Auto-apply plan files
        if (planEdit) {
          const result = applyEditToContent(planEdit);
          if (result) {
            await writeFile(result.targetPath, result.newContent);
            setAcceptedEdits(prev => [...prev, planEdit.id]);
          }
        }

        const codeEdits = payload.edits.filter(e => e.id !== planEdit?.id);
        setPendingEdits(codeEdits);

        setMessages(prev => prev.map(m =>
          m.id === id
            ? { ...m, content: payload.summary || m.content, edits: codeEdits, isStreaming: false }
            : m
        ));
      }
    })
  }, [applyEditToContent, writeFile, folderPath])

  return {
    aiModel, setAiModel,
    messages,
    isStreaming,
    pendingEdits,
    acceptedEdits,
    rejectedEdits,
    selectedCode, setSelectedCode,
    sendMessage,
    acceptEdit,
    rejectEdit,
    acceptAllEdits,
    rejectAllEdits,
    resetChat,
    stopChat,
  }
}

// ────────── Pure Helpers ──────────

async function buildExtraFiles(
  text: string,
  pinnedFiles: string[],
  fileContents: Record<string, string>,
  readFile: (path: string) => Promise<string>
) {
  const mentions = text.match(/@(\S+)/g) ?? []
  const mentioned = await resolveMentions(mentions, fileContents, readFile)
  const pinned = await Promise.all(
    pinnedFiles.map(async (p) => ({ path: p, content: fileContents[p] ?? await readFile(p) }))
  )
  return mergeUnique(pinned, mentioned)
}

async function resolveMentions(
  mentions: string[],
  fileContents: Record<string, string>,
  readFile: (path: string) => Promise<string>
) {
  const allPaths = Object.keys(fileContents)
  const results = await Promise.all(
    mentions.map(async (mention) => {
      const tag = mention.slice(1)
      const found = allPaths.find((p) => p === tag || p.endsWith(tag.replace(/\//g, '\\')))
      if (!found) return null
      return { path: found, content: fileContents[found] ?? await readFile(found) }
    })
  )
  return results.filter(Boolean) as { path: string; content: string }[]
}

function mergeUnique(
  primary: { path: string; content: string }[],
  secondary: { path: string; content: string }[]
) {
  const merged = [...primary]
  for (const item of secondary) {
    if (!merged.some((f) => f.path === item.path)) merged.push(item)
  }
  return merged
}

function resolveTargetPath(
  editFile: string,
  fileContents: Record<string, string>,
  activeFilePath: string | null,
  folderPath: string | null
): string | null {
  const normalizedEditFile = editFile.replace(/\//g, '\\');
  const allPaths = Object.keys(fileContents);

  // 1. Exact match
  if (fileContents[editFile]) return editFile;
  if (fileContents[normalizedEditFile]) return normalizedEditFile;

  // 2. Suffix match (e.g. AI says "src/App.tsx" and we have "D:\project\src\App.tsx")
  const parts = normalizedEditFile.split('\\');
  for (let i = 0; i < parts.length; i++) {
    const suffix = parts.slice(i).join('\\');
    const match = allPaths.find(p => p.endsWith(suffix));
    if (match) return match;
  }

  // 3. Active file match fallback
  if (activeFilePath && (activeFilePath === editFile || activeFilePath.endsWith(normalizedEditFile))) {
    return activeFilePath
  }

  // 4. New file — resolve relative to folder
  if (!folderPath) return null
  if (editFile.includes(':') || editFile.startsWith('/') || editFile.startsWith('\\')) return editFile
  return `${folderPath}\\${normalizedEditFile}`
}