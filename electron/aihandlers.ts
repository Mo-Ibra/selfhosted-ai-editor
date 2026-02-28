/**
 * AI Agent Engine
 * --------------------------------
 * This module implements the core AI agent logic for the desktop IDE.
 *
 * Responsibilities:
 * - Communicate with Ollama via HTTP (streaming responses)
 * - Build structured system prompts with project context
 * - Execute AI tool calls (read_file, list_directory)
 * - Run the recursive agent loop (ReAct pattern)
 * - Stream AI output back to the renderer process
 *
 * Architecture:
 * Electron Main Process → Ollama → Tool Executor → Recursive Agent Loop
 */

import { ipcMain, IpcMainInvokeEvent } from "electron";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ChatPayload, CompletePayload, FileNode, Message } from "./types";
import { AI_IGNORED } from "./fshandlers";
import { parseAgentResponse } from "./agentParser";

// ─── Constants ─────────────────────────────────────────────────────

const OLLAMA = { hostname: 'localhost', port: 11434 } as const
const DEFAULT_MODEL = 'qwen3-coder:480b-cloud'

// ─── State ─────────────────────────────────────────────────────────

let activeChatRequest: http.ClientRequest | null = null

// ─── Ollama HTTP Helper ────────────────────────────────────────────

/**
 * Sends a JSON POST request to the local Ollama server.
 *
 * Design Notes:
 * - Returns the raw ClientRequest instead of awaiting the response.
 * - This allows:
 *    1) Streaming partial tokens
 *    2) Cancelling the request mid-stream
 *
 * @param urlPath API endpoint (e.g. "/api/chat")
 * @param body Request payload sent to the model
 * @returns http.ClientRequest (for streaming & cancellation control)
 */
function ollamaPost(urlPath: string, body: object): http.ClientRequest {
  const bodyStr = JSON.stringify(body)
  const req = http.request({
    ...OLLAMA,
    path: urlPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  })
  req.write(bodyStr)
  req.end()
  return req
}

// ─── Context Builders ──────────────────────────────────────────────

/**
 * Converts a structured FileNode tree into a human-readable string.
 *
 * Used inside the system prompt to give the AI awareness of the
 * project structure without sending full file contents.
 *
 * Behavior:
 * - Filters out AI_IGNORED directories (e.g. node_modules)
 * - Recursively renders folders/files with indentation
 *
 * Why string instead of JSON?
 * → LLMs reason better over natural hierarchical text trees.
 *
 * @param nodes File tree nodes
 * @param indent Current indentation (used internally)
 * @returns Formatted file tree string
 */
function buildFileTreeString(nodes: FileNode[], indent = ''): string {
  // Filter out ignored directories and files
  return nodes.filter((n) => !(n.isDir && AI_IGNORED.has(n.name)))
    .map((n) => {
      const line = `${indent}${n.isDir ? '📁' : '📄'} ${n.name}\n`
      const children = n.children ? buildFileTreeString(n.children, indent + '  ') : ''
      return line + children
    })
    .join('')
}

/**
 * Builds the full system prompt injected into the AI model.
 *
 * This function:
 * - Embeds project file tree
 * - Includes pinned files (full content)
 * - Injects active file content
 * - Injects selected code (if any)
 * - Defines strict response protocol (Agent Contract)
 *
 * IMPORTANT:
 * The AI is constrained to return ONE of the allowed formats:
 * - questions
 * - plan
 * - tool_call
 * - edits
 * - plain text
 *
 * This ensures deterministic parsing and safe automation.
 *
 * @param payload ChatPayload from renderer
 * @returns Complete system prompt string
 */
function buildSystemPrompt(payload: ChatPayload): string {
  const fileTree = buildFileTreeString(payload.fileTreeNodes)

  const pinned = payload.pinnedFiles
    .map((f) => `\n<pinned_file path="${f.path}">\n${f.content}\n</pinned_file>`)
    .join('\n')

  const selection = payload.selectedCode
    ? `\n<selected_code line_start="${payload.selectedCode.startLine}" line_end="${payload.selectedCode.endLine}">\n${payload.selectedCode.content}\n</selected_code>`
    : ''

  return `You are an expert AI code editor embedded in a desktop IDE. You are an AGENT — you must think before acting, ask clarifying questions, propose plans, and execute changes precisely.

---
## TOOLS AVAILABLE
- **read_file**: Read the content of a file you need to inspect.
- **list_directory**: List files/folders inside a path.

---
## RESPONSE PROTOCOL — Output exactly ONE of these formats per response:

### 1. QUESTIONS
\`\`\`json
{ "type": "questions", "questions": ["Question 1?", "Question 2?"] }
\`\`\`

### 2. PLAN
\`\`\`json
{ "type": "plan", "summary": "What you intend to do and why", "files_to_touch": ["src/App.tsx"] }
\`\`\`
→ Proceed after user says "OK" or "execute".

### 3. TOOL CALL
\`\`\`json
{ "type": "tool_call", "tool": "read_file", "path": "src/App.tsx" }
\`\`\`

### 4. EDITS (SEARCH/REPLACE)
\`\`\`xml
<edits summary="Brief summary">
<edit file="src/App.tsx" action="replace" description="Fix login handler">
<<<< SEARCH
exact existing code
==== REPLACE
new replacement code
>>>> END
</edit>
</edits>
\`\`\`
Rules: exact SEARCH text, include 2-3 context lines, never truncate, no line numbers.

### 5. PLAIN TEXT
Just write normal text for explanations or status updates.

---
## WORKFLOW:
1. Simple (< 5 lines, 1 file) → go straight to EDITS.
2. Complex (multi-file, architecture) → Questions → Plan → Edits.
3. Need to inspect a file first → TOOL CALL then EDITS.

---
## CONTEXT:
<project_file_tree>
${fileTree}
</project_file_tree>
${pinned ? `\n<pinned_files>${pinned}\n</pinned_files>` : ''}
<active_file path="${payload.activeFilePath}">
${payload.activeFile}
</active_file>${selection}`
}

// ─── Tool Executor ─────────────────────────────────────────────────

/**
 * Resolves tool-provided paths into absolute file system paths.
 *
 * Security Consideration:
 * - If path is already absolute → return as is
 * - Otherwise resolve relative to project root
 *
 * Prevents the AI from blindly accessing arbitrary system paths.
 *
 * @param toolPath Path requested by the AI
 * @param fileTreeNodes Current project file tree
 * @returns Absolute file system path
 */
function resolveRelativePath(toolPath: string, fileTreeNodes: FileNode[]): string {

  // Check if the path is absolute or contains a drive letter
  const isAbsolute = path.isAbsolute(toolPath) || toolPath.includes(':');
  if (isAbsolute) return toolPath

  // Get the root of the file tree
  const root = fileTreeNodes[0]
  if (!root) return toolPath

  // Determine the base path (either the root directory or the directory containing the root file)
  const base = fs.statSync(root.path).isDirectory() ? root.path : path.dirname(root.path)

  // Resolve the relative path
  return path.join(base, toolPath)
}

/**
 * Executes a tool requested by the AI agent.
 *
 * Supported tools:
 * - read_file
 * - list_directory
 *
 * Returns:
 * - Tool output as string (never throws to the agent)
 * - Error messages are returned as text instead of exceptions
 *
 * Why return strings instead of throwing?
 * → The LLM must reason over tool failures as text.
 *
 * @param tool Tool name
 * @param toolPath Target path
 * @param fileTreeNodes Project file tree
 */
function executeTool(tool: string, toolPath: string, fileTreeNodes: FileNode[]): string {

  // Resolve the relative path
  const fullPath = resolveRelativePath(toolPath, fileTreeNodes);

  try {
    // Read file tool
    if (tool === "read_file") {
      // Check if the file exists
      if (!fs.existsSync(fullPath)) return `File not found: ${toolPath} (resolved: ${fullPath})`
      // Read the file
      return fs.readFileSync(fullPath, 'utf-8')
    }

    // List directory tool
    if (tool === 'list_directory') {
      // Check if the directory exists
      if (!fs.existsSync(fullPath)) return `Directory not found: ${toolPath} (resolved: ${fullPath})`
      // List the directory
      return fs.readdirSync(fullPath).join('\n')
    }

    // Unknown tool
    return `Unknown tool: ${tool}`

  } catch (err) {
    return `Error executing "${tool}" on "${toolPath}": ${String(err)}`
  }
}

/**
 * Runs the recursive AI agent loop (ReAct-style).
 *
 * Flow:
 * 1. Send chat request to Ollama (streaming enabled)
 * 2. Stream tokens to renderer in real time
 * 3. When stream completes:
 *    - Parse structured response
 *    - If tool_call → execute tool → re-enter loop
 *    - Otherwise → finalize and return result
 *
 * This function enables:
 * - Multi-step reasoning
 * - Tool execution
 * - Self-correcting workflows
 *
 * Important:
 * - Maintains activeChatRequest for cancellation
 * - Handles malformed JSON lines safely
 *
 * @param event Electron IPC event
 * @param msgs Conversation history
 * @param model Model name
 * @param fileTreeNodes Project file tree
 */
async function runAgenticLoop(event: IpcMainInvokeEvent,
  msgs: Message[],
  model: string,
  fileTreeNodes: FileNode[],) {

  return new Promise<void>((resolve, reject) => {
    const req = ollamaPost('/api/chat', {
      model: model || DEFAULT_MODEL,
      messages: msgs,
      stream: true,
    });

    activeChatRequest = req
    let fullResponse = ''

    // Handle response from Ollama
    req.on('response', (res) => {
      res.on('data', (chunk: Buffer) => {
        for (const line of chunk.toString().split('\n').filter(Boolean)) {
          try {
            // Parse the JSON line
            const parsed = JSON.parse(line);
            // Extract the token
            const token: string = parsed?.message?.content || "";

            // Send the token to the renderer
            if (token) {
              fullResponse += token
              event.sender.send('ai:chunk', token)
            }

            // If the response is not done, continue streaming
            if (!parsed.done) return;

            // Stream finished — decide what to do next
            const agentPayload = parseAgentResponse(fullResponse)

            // If the response is a tool call, execute it
            if (agentPayload?.type === 'tool_call') {
              const result = executeTool(agentPayload.tool, agentPayload.path, fileTreeNodes)
              event.sender.send('ai:chunk', `\n\`\`\`tool\n🔍 Reading \`${agentPayload.path}\`...\n\`\`\`\n`)

              // Re-enter the loop with the tool result
              runAgenticLoop(
                event,
                [
                  ...msgs,
                  { role: 'assistant', content: JSON.stringify(agentPayload) },
                  { role: 'user', content: `<tool_result tool="${agentPayload.tool}" path="${agentPayload.path}">\n${result}\n</tool_result>` },
                ],
                model,
                fileTreeNodes,
              ).then(resolve).catch(reject)
            } else {
              // If the response is not a tool call, send it to the renderer
              event.sender.send('ai:done', agentPayload)
              resolve()
            }

          } catch (err) {
            // Skip malformed JSON lines from the stream
            console.error('[ai:chunk] Parse error:', err)
          }
        }
      });

      // Handle response end
      res.on('end', () => {
        if (activeChatRequest === req) activeChatRequest = null
      })

      // Handle response errors
      res.on('error', (err) => {
        console.error('[ai:chat] Response stream error:', err)
        if (activeChatRequest === req) activeChatRequest = null
        event.sender.send('ai:done', null)
        reject(err)
      })
    });

    // Handle request errors
    req.on('error', (err) => {
      console.error('[ai:chat] Request error:', err)
      if (activeChatRequest === req) activeChatRequest = null
      event.sender.send('ai:done', null)
      reject(err)
    })

  })
};

/**
 * Registers all AI-related IPC handlers in the main process.
 *
 * This function connects the renderer process to the local AI engine (Ollama),
 * and exposes three main capabilities:
 *
 * 1. ai:chat     → Runs the agent loop (multi-step reasoning with tools, streaming enabled).
 * 2. ai:complete → Provides single-shot code completion (FIM-based, no streaming).
 * 3. ai:stop     → Cancels any active AI request.
 *
 * It manages the lifecycle of active AI requests to ensure:
 * - Only one chat request runs at a time.
 * - Requests can be safely aborted.
 * - The editor does not crash on malformed responses.
 *
 * This acts as the bridge between the Electron main process and the AI backend.
 */
export function registerAiHandlers() {

  // Handle stopping the AI chat
  ipcMain.on('ai:stop', () => {
    activeChatRequest?.destroy();
    activeChatRequest = null;
  })

  // Handle AI chat
  ipcMain.handle('ai:chat', async (event, payload: ChatPayload) => {

    // Cancel any existing chat request
    if (activeChatRequest) {
      activeChatRequest.destroy();
      activeChatRequest = null;
    }

    // Build the system prompt
    const messages: Message[] = [
      { role: 'System', content: buildSystemPrompt(payload) },
      ...payload.history,
    ];

    // Run the agentic loop
    return runAgenticLoop(event, messages, payload.model, payload.fileTreeNodes)
  });

  // Handle AI code completion
  ipcMain.handle('ai:complete', (_event, { prefix, suffix, model }: CompletePayload) => {
    const modelName = model || DEFAULT_MODEL

    // FIM format for Qwen/DeepSeek coder models
    const prompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`

    console.log(`[ai:complete] Requesting from ${modelName}...`)

    // Send the request to Ollama
    return new Promise<string>((resolve, reject) => {
      const req = ollamaPost('/api/generate', {
        model: modelName,
        prompt,
        stream: false, // Disable streaming for code completion
        options: {
          num_predict: 128, // Limit the number of tokens to predict
          temperature: 0, // Low temperature for more deterministic output
          stop: ['<|file_separator|>', '<|fim_prefix|>', '<|fim_suffix|>', '<|fim_middle|>', '\n\n'], // Stop tokens
        },
      });

      // Handle response from Ollama
      req.on('response', (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk.toString() })
        res.on('end', () => {
          try {
            // Parse the response and remove markdown code blocks e.g. '```typescript```' or '```'
            const suggestion = (JSON.parse(data).response ?? '')
              .replace(/^```[a-z]*\n/i, '')
              .replace(/```$/g, '')
              .trim()

            // Log the suggestion
            console.log(`[ai:complete] Received: "${suggestion.slice(0, 50)}..."`)
            resolve(suggestion)
          } catch (err) {
            console.error('[ai:complete] Parse error:', err)
            resolve('') // resolve empty rather than crash the editor
          }
        })
        res.on('error', (err) => {
          console.error('[ai:complete] Response error:', err)
          reject(err)
        })
      })

      // Handle request errors
      req.on('error', (err) => {
        console.error('[ai:complete] Request error:', err)
        reject(err)
      })
    })

  })
}