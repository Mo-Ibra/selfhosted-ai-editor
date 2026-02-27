const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go',
  java: 'java', cs: 'csharp', css: 'css',
  scss: 'scss', html: 'html', json: 'json',
  md: 'markdown', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', sh: 'shell', bash: 'shell',
  txt: 'plaintext', xml: 'xml', sql: 'sql',
  c: 'c', cpp: 'cpp', h: 'c', php: 'php',
  rb: 'ruby', swift: 'swift', kt: 'kotlin',
}

export function getLanguage(filePath: string | null): string {
  if (!filePath) return 'plaintext'
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}