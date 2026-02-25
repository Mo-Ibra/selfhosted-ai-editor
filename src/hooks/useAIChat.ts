import { useCallback, useEffect, useRef, useState } from "react"
import { AIEdit, AIResponse, ChatMessage, FileNode } from "../types"

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

    let processedText = text;
    const approvalKeywords = ['ok', 'execute', 'تمام', 'نفذ', 'approved', 'وافق'];
    const isApproval = approvalKeywords.some(k => text.toLowerCase().includes(k));

    // If it looks like an approval, add a hint for the AI
    if (isApproval && messages.some(m => m.content.toLowerCase().includes('implementation_plan.md'))) {
      processedText = `[USER APPROVED PLAN] ${text}\nNow please provide the high-precision JSON edits for the code files as outlined in the plan.`;
    }

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
      history: [...messages, userMsg].map(({ role, content }) => {
        if (content === text) return { role: 'user', content: processedText };
        return { role, content };
      }),
      model: aiModel,
      selectedCode: selectedCode ?? undefined,
    })
  }, [folderPath, fileTree, fileContents, activeFilePath, pinnedFiles, messages, aiModel, selectedCode, readFile])

  // ── Edit Helpers ──

  const applyEditToContent = useCallback((edit: AIEdit): { targetPath: string; newContent: string } | null => {
    const isNewFile = edit.startLine === 0 && edit.endLine === 0;
    const targetPath = resolveTargetPath(edit.file, fileContents, activeFilePath, folderPath)

    if (!targetPath) return null;
    if (isNewFile) return { targetPath, newContent: edit.newContent };

    const lines = (fileContents[targetPath] ?? '').split('\n');

    lines.splice(edit.startLine - 1, edit.endLine - edit.startLine + 1, ...edit.newContent.split('\n'))
    return { targetPath, newContent: lines.join('\n') }
  }, [fileContents, activeFilePath, folderPath]);

  const acceptEdit = useCallback(async (edit: AIEdit) => {

    const result = applyEditToContent(edit);
    if (!result) return;

    await writeFile(result.targetPath, result.newContent);

    setAcceptedEdits((prev) => [...prev, edit.id])
    setPendingEdits((prev) => prev.filter((e) => e.id !== edit.id))

  }, [applyEditToContent, writeFile])

  const rejectEdit = useCallback((edit: AIEdit) => {
    setRejectedEdits((prev) => [...prev, edit.id])
    setPendingEdits((prev) => prev.filter((e) => e.id !== edit.id))
  }, [])

  const acceptAllEdits = useCallback(async () => {
    for (const edit of pendingEdits) await acceptEdit(edit)
  }, [pendingEdits, acceptEdit])

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

    // Remove the assistant's partial response
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
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m))
      );
    });

    window.electronAPI.onChatDone(async (response: AIResponse | null) => {
      const id = streamingMsgId.current;
      streamingMsgId.current = null;
      setIsStreaming(false);

      if (response?.edits?.length) {
        // Automatically apply implementation_plan.md edits
        const planEdit = response.edits.find(e => e.file.toLowerCase().includes('implementation_plan.md'));
        if (planEdit) {
          const result = applyEditToContent(planEdit);
          if (result) {
            await writeFile(result.targetPath, result.newContent);
            setAcceptedEdits(prev => [...prev, planEdit.id]);
          }
        }

        setPendingEdits(response.edits.filter(e => e.id !== planEdit?.id))

        if (id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, content: response.explanation || m.content, edits: response.edits, isStreaming: false }
                : m
            )
          )
        }
      }
    })
  }, [applyEditToContent, writeFile])

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
  // Match existing open file
  const match = Object.keys(fileContents).find(
    (p) => p === editFile || p.endsWith(editFile.replace(/\//g, '\\'))
  )
  if (match) return match

  // Match active file
  if (activeFilePath && (activeFilePath === editFile || activeFilePath.endsWith(editFile.replace(/\//g, '\\')))) {
    return activeFilePath
  }

  // New file — resolve relative to folder
  if (!folderPath) return null
  if (editFile.includes(':') || editFile.startsWith('/') || editFile.startsWith('\\')) return editFile
  return `${folderPath}\\${editFile.replace(/\//g, '\\')}`
}