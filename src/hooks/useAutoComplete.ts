import { Monaco } from '@monaco-editor/react'

// Constants for autocompletion (can be changed in the future)
const AUTOCOMPLETE_DELAY_MS = 350
const AUTOCOMPLETE_LANGUAGES = [
  'typescript', 'javascript', 'python', 'rust', 'go',
  'html', 'css', 'json', 'plaintext',
]
const AI_MODEL = 'qwen3-coder:480b-cloud'
const CONTEXT_LINES = 50

export function registerAutocompleteProvider(monaco: Monaco, editor: any) {
  // Timer for debouncing autocompletion requests
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  // Register inline completions provider for AI-powered autocompletion
  const provider = monaco.languages.registerInlineCompletionsProvider(
    AUTOCOMPLETE_LANGUAGES,
    {
      provideInlineCompletions: async (model: any, position: any) => {

        // If the user is typing fast, clear the previous timer
        if (typingTimer) clearTimeout(typingTimer)

        return new Promise((resolve) => {
          typingTimer = setTimeout(async () => {

            // Get the line content and check if the cursor is at the end of the line
            const lineContent = model.getLineContent(position.lineNumber)
            const isAtEndOfLine = position.column > lineContent.trimEnd().length

            console.log(`[Autocomplete] Line: ${position.lineNumber}, Col: ${position.column}, EOL: ${isAtEndOfLine}`)

            // If the cursor is not at the end of the line or the line is too short, resolve with no suggestions
            if (!isAtEndOfLine || lineContent.trim().length < 2) {
              resolve({ items: [] })
              return
            }

            // Get the prefix (code before the cursor) for the AI
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - CONTEXT_LINES),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            })

            // Get the suffix (code after the cursor) for the AI
            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + CONTEXT_LINES),
              endColumn: 1000,
            })

            try {
              console.log('[Autocomplete] Fetching from AI...')
              // Get the suggestion from the AI
              const suggestion = await window.electronAPI.getAICompletion(prefix, suffix, AI_MODEL)
              console.log('[Autocomplete] Got suggestion:', suggestion ? 'Yes' : 'No')

              // If no suggestion, resolve with no suggestions
              if (!suggestion) {
                resolve({ items: [] })
                console.log('[Autocomplete] No suggestion')
                return
              }

              // Resolve with the suggestion
              resolve({
                items: [{
                  insertText: suggestion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                }],
              })
            } catch (e) {
              console.error('[Autocomplete] Error:', e)
              resolve({ items: [] })
            }
          }, AUTOCOMPLETE_DELAY_MS)
        })
      },
      // Called when the provider is no longer needed
      freeInlineCompletions: () => { },
    }
  )

  // Dispose the provider when the editor is disposed
  editor.onDidDispose(() => provider.dispose())
}