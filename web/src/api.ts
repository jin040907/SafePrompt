/** 개발: Vite 프록시 /api → FastAPI. 배포: VITE_API_BASE=https://your-be.railway.app */

/** 프로덕션 빌드인데 VITE_API_BASE 없음 → 예전엔 127.0.0.1:8000 으로 가서 로컬/엉뚱한 서버에 붙는 문제가 많았음 */
export function isProductionMissingApiBase(): boolean {
  return import.meta.env.PROD && !String(import.meta.env.VITE_API_BASE ?? '').trim()
}

export function apiUrl(path: string): string {
  const env = String(import.meta.env.VITE_API_BASE ?? '')
    .trim()
    .replace(/\/$/, '')
  if (env) return `${env}${path}`
  if (import.meta.env.DEV) return `/api${path}`
  throw new Error(
    'VITE_API_BASE가 없습니다. Vercel 환경 변수에 백엔드 URL(예: https://xxx.up.railway.app)을 넣고 저장한 뒤 Redeploy 하세요. Preview 배포는 Preview용 변수도 따로 필요합니다.',
  )
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

/** 백엔드 `X-Request-ID`와 함께 던져지는 API 오류 */
export class ApiError extends Error {
  readonly status: number
  readonly requestId: string | null

  constructor(message: string, status: number, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestId = requestId
  }
}

export type ApiSuccess<T> = { data: T; requestId: string | null }

/** GET /health — 키 설정 여부만(비밀 값 없음). 구버전 API는 필드가 없을 수 있음 */
export type HealthResponse = {
  status: string
  service?: string
  groq_configured?: boolean
  clova_configured?: boolean
  ready?: boolean
}

export async function fetchHealth(): Promise<HealthResponse | 'offline'> {
  try {
    const r = await fetch(apiUrl('/health'), { cache: 'no-store' })
    if (!r.ok) return 'offline'
    return (await r.json()) as HealthResponse
  } catch {
    return 'offline'
  }
}

/** fetch 실패·일반 오류를 사용자에게 보여 줄 짧은 한국어 메시지 */
export function friendlyApiError(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof TypeError) {
    return '서버에 연결할 수 없습니다. 저장소 루트에서 npm run dev 로 API(포트 8000)와 웹을 함께 실행했는지 확인해 주세요.'
  }
  if (e instanceof Error) return e.message
  return '요청에 실패했습니다.'
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiSuccess<T>> {
  const r = await fetch(apiUrl(path), {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const requestId = r.headers.get('x-request-id')?.trim() || null
  if (!r.ok) {
    let detail = r.statusText
    try {
      detail = parseErrorDetail(await r.json())
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, r.status, requestId)
  }
  const data = (await r.json()) as T
  return { data, requestId }
}

export type ClassifyResponse = {
  risk_type: string
  gauge_before: number
  /** 최신 API만 포함. 없으면 글자 수 검증 생략 */
  received_chars?: number
}
export type QuestionsResponse = {
  questions: string[]
  received_chars?: number
}
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
