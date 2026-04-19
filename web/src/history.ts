/**
 * 브라우저 localStorage 전용 기록. 서버로 전송되지 않습니다.
 */

export const HISTORY_STORAGE_KEY = 'safeprompt_history_v1'
const MAX_ENTRIES = 50

export type HistoryEntry = {
  id: string
  /** ISO 8601 */
  createdAt: string
  userInput: string
  riskType: string
  gaugeBefore: number
  gaugeAfter: number
  safePrompt: string
  answer: string
  model: string
  requestId: string | null
  questions: string[]
  answers: string[]
}

function safeParse(raw: string | null): HistoryEntry[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter(isHistoryEntry)
  } catch {
    return []
  }
}

function isHistoryEntry(x: unknown): x is HistoryEntry {
  if (x == null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.createdAt === 'string' &&
    typeof o.userInput === 'string' &&
    typeof o.riskType === 'string' &&
    typeof o.gaugeBefore === 'number' &&
    typeof o.gaugeAfter === 'number' &&
    typeof o.safePrompt === 'string' &&
    typeof o.answer === 'string' &&
    typeof o.model === 'string' &&
    (o.requestId === null || typeof o.requestId === 'string') &&
    Array.isArray(o.questions) &&
    Array.isArray(o.answers)
  )
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(HISTORY_STORAGE_KEY))
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* quota / private mode */
  }
}

export function appendHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `h-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  const prev = loadHistory()
  const next = [full, ...prev].slice(0, MAX_ENTRIES)
  saveHistory(next)
  return full
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id)
  saveHistory(next)
  return next
}

export function clearAllHistory(): void {
  saveHistory([])
}

/** 단일 기록을 Markdown으로 */
export function formatEntryAsMarkdown(e: HistoryEntry): string {
  const lines: string[] = [
    '# Safe Prompt 기록',
    '',
    `- 저장 시각: ${new Date(e.createdAt).toLocaleString('ko-KR')}`,
    `- 위험 유형: ${e.riskType}`,
    `- 위험도(교정 전→후): ${e.gaugeBefore} → ${e.gaugeAfter}`,
    `- 모델: ${e.model}`,
  ]
  if (e.requestId) {
    lines.push(`- 요청 ID: \`${e.requestId}\``)
  }
  lines.push('', '## 원본 질문', '', e.userInput.trim(), '')

  if (e.questions.length > 0) {
    lines.push('## 의도 확인', '')
    for (let i = 0; i < e.questions.length; i++) {
      lines.push(`${i + 1}. **Q** ${e.questions[i]}`)
      lines.push(`   - **A** ${(e.answers[i] ?? '').trim() || '(없음)'}`)
    }
    lines.push('')
  }

  lines.push('## 교정된 프롬프트', '', e.safePrompt.trim(), '', '## 답변', '', e.answer.trim(), '')
  return lines.join('\n')
}

/** 플레인 텍스트(줄바꿈 위주) */
export function formatEntryAsText(e: HistoryEntry): string {
  return formatEntryAsMarkdown(e).replace(/^#+\s/gm, '').replace(/`([^`]+)`/g, '$1')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

function slugDate(iso: string): string {
  return iso.slice(0, 19).replace(/[-:T]/g, '').slice(0, 14)
}

export function defaultExportBasename(e: HistoryEntry, ext: string): string {
  const short = e.userInput
    .trim()
    .slice(0, 24)
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
  const base = short || 'safeprompt'
  return `safeprompt-${slugDate(e.createdAt)}-${base}.${ext}`
}
