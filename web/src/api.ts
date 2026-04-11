/** 개발: Vite 프록시 /api → FastAPI. 배포: VITE_API_BASE=https://your-be.railway.app */

export function apiUrl(path: string): string {
  const env = import.meta.env.VITE_API_BASE?.replace(/\/$/, '')
  if (env) return `${env}${path}`
  if (import.meta.env.DEV) return `/api${path}`
  return `http://127.0.0.1:8000${path}`
}

function parseErrorDetail(data: unknown): string {
  if (data == null) return '요청 실패'
  if (typeof data === 'string') return data
  if (typeof data === 'object' && 'detail' in data) {
    const d = (data as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d.map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: string }).msg) : String(x))).join(', ')
    }
  }
  try {
    return JSON.stringify(data)
  } catch {
    return '요청 실패'
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    let detail = r.statusText
    try {
      detail = parseErrorDetail(await r.json())
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return r.json() as Promise<T>
}

export type ClassifyResponse = { risk_type: string; gauge_before: number }
export type QuestionsResponse = { questions: string[] }
export type ReconstructResponse = {
  safe_prompt: string
  gauge_before: number
  gauge_after: number
}
export type AnswerResponse = {
  answer: string
  model: string
  gauge_before: number
  gauge_after: number
}
