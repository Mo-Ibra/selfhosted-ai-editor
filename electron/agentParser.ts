import { AgentResponse } from './types'

// ─── Regex Patterns ────────────────────────────────────────────────

const JSON_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/i
const JSON_OBJECT_RE = /(\{[\s\S]*\})/
const EDITS_WITH_SUMMARY_RE = /<edits[^>]*summary="([^"]*)"[^>]*>([\s\S]*?)<\/edits>/
const EDITS_BARE_RE = /<edits>([\s\S]*?)<\/edits>/
const EDIT_TAG_RE = /<edit\s+file="([^"]+)"\s+action="([^"]+)"(?:\s+description="([^"]*)")?[^>]*>([\s\S]*?)<\/edit>/g
const SR_BLOCK_RE = /<{3,}\s*SEARCH\s*([\s\S]*?)\s*={3,}\s*REPLACE\s*([\s\S]*?)\s*>{3,}\s*(?:END|REPLACE)/i

// ─── JSON Parser ───────────────────────────────────────────────────

function tryParseJson(text: string): AgentResponse | null {
  const match = text.match(JSON_BLOCK_RE) ?? text.match(JSON_OBJECT_RE)
  if (!match) return null

  try {
    const parsed = JSON.parse(match[1] ?? match[0])
    if (!['questions', 'plan', 'tool_call'].includes(parsed.type)) return null

    // Normalize plan field names
    if (parsed.type === 'plan') {
      parsed.filesToTouch = parsed.files_to_touch ?? parsed.filesToTouch ?? []
    }

    return parsed as AgentResponse
  } catch {
    return null
  }
}

// ─── XML Edits Parser ──────────────────────────────────────────────

function tryParseEdits(text: string): AgentResponse | null {
  const editsMatch = text.match(EDITS_WITH_SUMMARY_RE) ?? text.match(EDITS_BARE_RE)
  if (!editsMatch) return null

  const summary = editsMatch[1] ?? ''
  const editsContent = editsMatch[2] ?? editsMatch[1] ?? ''

  const edits = [...editsContent.matchAll(EDIT_TAG_RE)].map((match, i) => {
    const [, file, action, description = '', body] = match
    const trimmedBody = body.trim()
    const id = `edit-${Date.now()}-${i}`

    if (action === 'create') {
      return { id, file, action: 'create' as const, description, content: trimmedBody }
    }

    const srMatch = trimmedBody.match(SR_BLOCK_RE)
    if (srMatch) {
      return {
        id, file, action: 'replace' as const, description,
        search: srMatch[1].trim(),
        replace: srMatch[2].trim(),
      }
    }

    return { id, file, action: action as 'replace' | 'delete', description, content: trimmedBody }
  })

  return { type: 'edits', summary, edits }
}

// ─── Main Export ───────────────────────────────────────────────────

export function parseAgentResponse(rawText: string): AgentResponse | null {
  const text = rawText.trim()
  return tryParseJson(text) ?? tryParseEdits(text) ?? null
}