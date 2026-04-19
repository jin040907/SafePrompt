import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  apiPost,
  fetchHealth,
  friendlyApiError,
  isProductionMissingApiBase,
  type AnswerResponse,
  type ClassifyResponse,
  type HealthResponse,
  type QuestionsResponse,
  type ReconstructResponse,
} from './api'
import { AnswerMarkdown } from './components/AnswerMarkdown'
import { LocalHistoryPanel } from './components/LocalHistoryPanel'
import { RiskGauge } from './components/RiskGauge'
import {
  appendHistory,
  defaultExportBasename,
  downloadTextFile,
  formatEntryAsMarkdown,
  formatEntryAsText,
  loadHistory,
  type HistoryEntry,
} from './history'
import {
  EXAMPLE_PROMPTS,
  GAUGE_EXPLAINER,
  HOW_IT_WORKS,
  NEXT_STEP_HINT,
  QUICKSTART_ONE_LINER,
  QUICKSTART_STEPS,
  STEP_HINTS,
  USER_FAQ,
} from './onboarding'
import './App.css'

type Step = 'input' | 'questions' | 'review' | 'result'

const STEP_ORDER: { key: Step; label: string }[] = [
  { key: 'input', label: '질문' },
  { key: 'questions', label: '분석' },
  { key: 'review', label: '검토' },
  { key: 'result', label: '답변' },
]

function StepPills({ step }: { step: Step }) {
  const activeIndex = STEP_ORDER.findIndex((s) => s.key === step)
  return (
    <nav className="step-pills" aria-label="진행 단계">
      <ol className="step-pills__list">
        {STEP_ORDER.map((s, i) => {
          const active = s.key === step
          const done = i < activeIndex
          return (
            <li
              key={s.key}
              className={`step-pills__item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="step-pills__num">{i + 1}</span>
              {s.label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function CardTitle({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="card__title">
      <span className="card__title-badge" aria-hidden>
        {step}
      </span>
      <h2 className="card__title-text">{children}</h2>
    </div>
  )
}

function CardHint({ children }: { children: ReactNode }) {
  return <p className="card__hint">{children}</p>
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyTextButton({
  text,
  label,
  className = '',
}: {
  text: string
  label: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--compact ${className}`.trim()}
      onClick={async () => {
        const ok = await copyToClipboard(text)
        if (ok) {
          setDone(true)
          window.setTimeout(() => setDone(false), 2000)
        }
      }}
    >
      {done ? '복사됨' : label}
    </button>
  )
}

function ErrorBanner({
  message,
  requestId,
  onDismiss,
}: {
  message: string
  requestId: string | null
  onDismiss: () => void
}) {
  return (
    <div className="banner banner--err error-banner" role="alert">
      <div className="error-banner__main">
        <p className="error-banner__msg">{message}</p>
        {requestId ? (
          <div className="error-banner__meta">
            <span className="error-banner__rid-label">요청 ID</span>
            <code className="error-banner__rid">{requestId}</code>
            <CopyTextButton text={requestId} label="ID 복사" />
          </div>
        ) : null}
        <p className="error-banner__kbd-hint">
          <kbd className="kbd">Esc</kbd> 키로도 닫을 수 있어요
        </p>
      </div>
      <button type="button" className="btn btn--ghost btn--compact error-banner__close" onClick={onDismiss}>
        닫기
      </button>
    </div>
  )
}

function HowItWorks() {
  return (
    <details className="how-it-works">
      <summary className="how-it-works__summary">처음이신가요? 이용 순서 보기</summary>
      <ol className="how-it-works__list">
        {HOW_IT_WORKS.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </details>
  )
}

function QuickStartLocal() {
  return (
    <details className="quick-start">
      <summary className="quick-start__summary">로컬에서 바로 실행하기</summary>
      <p className="quick-start__lead">
        API 키를 넣은 뒤 저장소 <strong>루트</strong>에서 아래를 따르면 됩니다.
      </p>
      <div className="quick-start__cmd">
        <code className="quick-start__code">{QUICKSTART_ONE_LINER}</code>
        <CopyTextButton text={QUICKSTART_ONE_LINER} label="명령 복사" />
      </div>
      <ol className="quick-start__list">
        {QUICKSTART_STEPS.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </details>
  )
}

function StepNextHint({ step }: { step: Step }) {
  return (
    <p className="step-next-hint" id="step-next-hint">
      <span className="step-next-hint__label">이 단계에서</span> {NEXT_STEP_HINT[step]}
    </p>
  )
}

function UserFaqSection() {
  return (
    <section className="user-faq" aria-labelledby="user-faq-title">
      <h3 id="user-faq-title" className="user-faq__title">
        자주 묻는 질문
      </h3>
      <div className="user-faq__list">
        {USER_FAQ.map((item, i) => (
          <details key={i} className="user-faq__item">
            <summary className="user-faq__q">{item.q}</summary>
            <p className="user-faq__a">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function ServiceStatusBanners({
  health,
}: {
  health: HealthResponse | 'offline' | undefined
}) {
  if (health === undefined) return null
  if (health === 'offline') {
    return (
      <div className="banner banner--err" role="status">
        <strong>API에 연결되지 않습니다.</strong> 터미널에서 프로젝트 루트로 이동한 뒤{' '}
        <code className="inline-code">npm run dev</code>로 백엔드(포트 8000)와 웹을 함께 실행했는지 확인해 주세요.
      </div>
    )
  }
  if (health.groq_configured === false) {
    return (
      <div className="banner banner--err" role="status">
        <strong>GROQ_API_KEY가 없습니다.</strong> 루트에 <code className="inline-code">.env</code>를 두고
        Groq 키를 넣은 뒤 API 서버를 다시 시작해 주세요. (위험 분류 등에 필요합니다.)
      </div>
    )
  }
  if (health.clova_configured === false && health.groq_configured === true) {
    return (
      <div className="banner banner--info" role="status">
        <strong>CLOVA_API_KEY가 비어 있습니다.</strong> 질문 생성·답변은 Groq로 동작할 수 있으나, 설정하면
        HyperCLOVA를 우선 사용합니다.
      </div>
    )
  }
  return null
}

export default function App() {
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState<Step>('input')
  const [userInput, setUserInput] = useState('')
  /** 마지막으로 분석 API에 성공적으로 보낸 원문(재구성 단계에서 textarea 없을 때 사용) */
  const [lockedPrompt, setLockedPrompt] = useState('')

  /**
   * 예시 칩으로만 채울 때는 state가 먼저 갱신되고 DOM ref는 한 틱 늦을 수 있음.
   * `'' ?? userInput`이 아니라 빈 문자열이 우선되어 버튼이 꺼진 채로 남는 문제가 있었음.
   */
  const getPromptText = () => userInput.trim() || (promptRef.current?.value ?? '').trim()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null)
  /** 마지막 성공 API 호출의 추적 ID(백엔드 `X-Request-ID`) */
  const [lastRequestId, setLastRequestId] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => loadHistory())
  /** GET /health — 연결 여부·API 키 설정(값은 모름) */
  const [serviceHealth, setServiceHealth] = useState<HealthResponse | 'offline' | undefined>(undefined)
  /** 스크린 리더용 로딩 설명 */
  const [loadingHint, setLoadingHint] = useState<string | null>(null)

  const [classify, setClassify] = useState<ClassifyResponse | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [recon, setRecon] = useState<ReconstructResponse | null>(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [result, setResult] = useState<AnswerResponse | null>(null)

  const canGoQuestions = getPromptText().length > 0

  const answerInputs = useMemo(() => {
    if (questions.length === 0) return null
    return questions.map((q, i) => (
      <label key={i} className="field">
        <span className="field__q">
          Q{i + 1}. {q}
        </span>
        <input
          type="text"
          value={answers[i] ?? ''}
          onChange={(e) => {
            const next = [...answers]
            next[i] = e.target.value
            setAnswers(next)
          }}
          placeholder="답변 입력"
          autoComplete="off"
        />
      </label>
    ))
  }, [questions, answers])

  useEffect(() => {
    if (step !== 'questions' || questions.length === 0) return
    const id = window.setTimeout(() => {
      document.querySelector<HTMLInputElement>('.stack input[type="text"]')?.focus()
    }, 60)
    return () => clearTimeout(id)
  }, [step, questions])

  useEffect(() => {
    if (isProductionMissingApiBase()) return
    let cancelled = false
    void fetchHealth().then((h) => {
      if (!cancelled) setServiceHealth(h)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!error) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      setError(null)
      setErrorRequestId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [error])

  async function runClassify(text: string) {
    if (!text) {
      setError('질문을 입력한 뒤 분석을 시작해 주세요.')
      setErrorRequestId(null)
      return
    }
    setUserInput(text)
    setError(null)
    setErrorRequestId(null)
    setLoadingHint('질문을 분석하고 확인 질문을 만드는 중입니다. 네트워크에 따라 1~2분 걸릴 수 있습니다.')
    setLoading(true)
    setClassify(null)
    setQuestions([])
    setAnswers([])
    try {
      const { data, requestId: rid1 } = await apiPost<ClassifyResponse>('/classify', {
        user_input: text,
      })
      if (
        typeof data.received_chars === 'number' &&
        data.received_chars !== text.length
      ) {
        setError(
          `서버가 받은 글자 수(${data.received_chars})와 보낸 글자 수(${text.length})가 다릅니다. 다른 API 인스턴스에 붙었을 수 있습니다. Vercel의 VITE_API_BASE와 Railway 배포를 확인해 주세요.`,
        )
        setErrorRequestId(rid1)
        return
      }
      const { data: qs, requestId: rid2 } = await apiPost<QuestionsResponse>('/questions', {
        user_input: text,
        risk_type: data.risk_type,
      })
      if (
        typeof qs.received_chars === 'number' &&
        qs.received_chars !== text.length
      ) {
        setError(
          `질문 생성 단계에서 글자 수 불일치(보냄 ${text.length} / 받음 ${qs.received_chars}). API 주소를 확인해 주세요.`,
        )
        setErrorRequestId(rid2)
        return
      }
      setLockedPrompt(text)
      setClassify(data)
      setQuestions(qs.questions)
      setAnswers(qs.questions.map(() => ''))
      setLastRequestId(rid2 ?? rid1)
      setStep('questions')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
        setErrorRequestId(e.requestId)
      } else {
        setError(friendlyApiError(e))
        setErrorRequestId(null)
      }
    } finally {
      setLoadingHint(null)
      setLoading(false)
    }
  }

  function onPromptSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const raw = fd.get('user_prompt')
    const text = typeof raw === 'string' ? raw.trim() : ''
    void runClassify(text)
  }

  async function handleReconstruct() {
    if (!classify) return
    const text = lockedPrompt.trim() || userInput.trim()
    if (!text) {
      setError('원본 질문이 비어 있습니다. 이전 단계로 돌아가 입력을 확인해 주세요.')
      return
    }
    setUserInput(text)
    setError(null)
    setErrorRequestId(null)
    setLoadingHint('교정된 프롬프트를 만드는 중입니다.')
    setLoading(true)
    try {
      const { data, requestId } = await apiPost<ReconstructResponse>('/reconstruct', {
        user_input: text,
        risk_type: classify.risk_type,
        questions,
        answers,
        gauge_before: classify.gauge_before,
      })
      setRecon(data)
      setPromptDraft(data.safe_prompt)
      setLastRequestId(requestId)
      setStep('review')
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
        setErrorRequestId(e.requestId)
      } else {
        setError(friendlyApiError(e))
        setErrorRequestId(null)
      }
    } finally {
      setLoadingHint(null)
      setLoading(false)
    }
  }

  async function handleAnswer() {
    if (!recon) return
    const safe = promptDraft.trim()
    if (!safe) {
      setError('교정 프롬프트가 비어 있습니다')
      return
    }
    setError(null)
    setErrorRequestId(null)
    setLoadingHint('답변을 생성하는 중입니다.')
    setLoading(true)
    try {
      const { data, requestId } = await apiPost<AnswerResponse>('/answer', {
        safe_prompt: safe,
        gauge_before: recon.gauge_before,
        answers,
      })
      setResult(data)
      setLastRequestId(requestId)
      setStep('result')

      if (classify) {
        appendHistory({
          userInput: lockedPrompt.trim() || userInput.trim(),
          riskType: classify.risk_type,
          gaugeBefore: data.gauge_before,
          gaugeAfter: data.gauge_after,
          safePrompt: safe,
          answer: data.answer,
          model: data.model,
          requestId,
          questions: [...questions],
          answers: [...answers],
        })
        setHistoryEntries(loadHistory())
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
        setErrorRequestId(e.requestId)
      } else {
        setError(friendlyApiError(e))
        setErrorRequestId(null)
      }
    } finally {
      setLoadingHint(null)
      setLoading(false)
    }
  }

  function resetAll() {
    setStep('input')
    setUserInput('')
    setLockedPrompt('')
    setClassify(null)
    setQuestions([])
    setAnswers([])
    setRecon(null)
    setPromptDraft('')
    setResult(null)
    setError(null)
    setErrorRequestId(null)
    setLastRequestId(null)
  }

  function loadQuestionFromHistory(text: string) {
    setStep('input')
    setUserInput(text)
    setLockedPrompt('')
    setClassify(null)
    setQuestions([])
    setAnswers([])
    setRecon(null)
    setPromptDraft('')
    setResult(null)
    setError(null)
    setErrorRequestId(null)
    setLastRequestId(null)
    window.setTimeout(() => {
      promptRef.current?.focus()
      promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  function rejectPrompt() {
    setRecon(null)
    setPromptDraft('')
    setStep('input')
    setErrorRequestId(null)
    setError('취소되었습니다. 처음부터 다시 입력할 수 있습니다.')
  }

  function focusPromptEdit() {
    promptRef.current?.focus()
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const answersComplete =
    questions.length > 0 &&
    answers.length === questions.length &&
    answers.every((a) => a.trim().length > 0)

  const reconDelta =
    recon != null ? Math.max(0, recon.gauge_before - recon.gauge_after) : 0
  const resultDelta =
    result != null ? Math.max(0, result.gauge_before - result.gauge_after) : 0

  const riskTypeClass =
    classify && classify.gauge_before >= 70 ? 'risk-cell--danger' : 'risk-cell--neutral'

  function exportCurrentResult(kind: 'md' | 'txt') {
    if (!result || !classify) return
    const snap: HistoryEntry = {
      id: 'export',
      createdAt: new Date().toISOString(),
      userInput: lockedPrompt.trim() || userInput.trim(),
      riskType: classify.risk_type,
      gaugeBefore: result.gauge_before,
      gaugeAfter: result.gauge_after,
      safePrompt: promptDraft.trim(),
      answer: result.answer,
      model: result.model,
      requestId: lastRequestId,
      questions: [...questions],
      answers: [...answers],
    }
    const body = kind === 'md' ? formatEntryAsMarkdown(snap) : formatEntryAsText(snap)
    const ext = kind === 'md' ? 'md' : 'txt'
    downloadTextFile(defaultExportBasename(snap, ext), body)
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <header className="top-nav">
        <div className="top-nav__inner">
          <div className="top-nav__brand">
            <h1 className="top-nav__logo">Safe Prompt</h1>
            <p className="top-nav__tagline">
              질문의 위험도를 확인하고, 의도를 확인한 뒤 안전하게 다듬은 프롬프트로 답변을 받습니다.
            </p>
          </div>
        </div>
      </header>

      <div className="app-body">
        <div className="app-body__inner">
          <div className="app-body__center">
            <StepPills step={step} />
            <StepNextHint step={step} />

            <div
              className={`loading-strip ${loading ? 'is-active' : ''}`}
              aria-hidden={!loading}
            />

            <p className="sr-only" aria-live="polite">
              {loading ? loadingHint ?? '요청을 처리하고 있습니다. 잠시만 기다려 주세요.' : ''}
            </p>

            {isProductionMissingApiBase() ? (
              <div className="banner banner--err" role="alert">
                <strong>VITE_API_BASE가 없습니다.</strong> Vercel 환경 변수에 Railway API URL을 넣고
                Redeploy 하지 않으면 브라우저가 잘못된 주소(로컬 등)로 요청해 결과가 항상 같게 보일 수
                있습니다.
              </div>
            ) : (
              <ServiceStatusBanners health={serviceHealth} />
            )}

            {error ? (
              <ErrorBanner
                message={error}
                requestId={errorRequestId}
                onDismiss={() => {
                  setError(null)
                  setErrorRequestId(null)
                }}
              />
            ) : null}

            <main id="main-content" className="main" aria-busy={loading} aria-describedby="step-next-hint">
          {step === 'input' && (
            <section className="card">
              <CardTitle step={1}>질문 입력</CardTitle>
              <CardHint>{STEP_HINTS.input}</CardHint>
              <HowItWorks />
              <QuickStartLocal />
              <form ref={formRef} onSubmit={onPromptSubmit}>
                <div className="example-chips" role="group" aria-label="예시 질문">
                  <span className="example-chips__label">예시로 채우기</span>
                  <div className="example-chips__row">
                    {EXAMPLE_PROMPTS.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        className="example-chip"
                        disabled={loading}
                        onClick={() => setUserInput(ex.text)}
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={promptRef}
                  name="user_prompt"
                  className="textarea"
                  id="main-question"
                  rows={5}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    if (!(e.ctrlKey || e.metaKey)) return
                    e.preventDefault()
                    if (!canGoQuestions || loading) return
                    formRef.current?.requestSubmit()
                  }}
                  placeholder="예: 위와 같이 궁금한 내용을 한글로 적어 주세요."
                  disabled={loading}
                  aria-describedby="hint-input-shortcut char-count-hint"
                />
                <p id="char-count-hint" className="char-count" aria-live="polite">
                  {userInput.length.toLocaleString()}자
                </p>
                <p id="hint-input-shortcut" className="kbd-hint">
                  입력 후 <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd> (Mac은{' '}
                  <kbd className="kbd">⌘</kbd> + <kbd className="kbd">Enter</kbd>)로도 분석을 시작할 수
                  있어요.
                </p>
                <div className="actions">
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={!canGoQuestions || loading}
                  >
                    {loading ? '분석 중…' : '분석 시작'}
                  </button>
                </div>
              </form>
              <UserFaqSection />
            </section>
          )}

          {step === 'questions' && classify && (
            <section className="card">
              <CardTitle step={2}>분석 · 의도 확인</CardTitle>
              <CardHint>{STEP_HINTS.questions}</CardHint>
              <table className="info-table">
                <tbody>
                  <tr>
                    <th scope="row">유형</th>
                    <td className={riskTypeClass}>{classify.risk_type}</td>
                  </tr>
                  <tr>
                    <th scope="row">위험도</th>
                    <td>{classify.gauge_before} / 100</td>
                  </tr>
                </tbody>
              </table>
              <RiskGauge value={classify.gauge_before} label="위험도" />
              <p className="gauge-explain">{GAUGE_EXPLAINER}</p>
              <h3 className="h3">확인 질문</h3>
              <div className="stack">{answerInputs}</div>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={loading}
                  onClick={() => {
                    setStep('input')
                    setQuestions([])
                    setAnswers([])
                  }}
                >
                  이전
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!answersComplete || loading}
                  onClick={handleReconstruct}
                >
                  {loading ? '만드는 중…' : '안전한 프롬프트 만들기'}
                </button>
              </div>
              {!answersComplete && questions.length > 0 ? (
                <p className="action-hint" role="status">
                  확인 질문 {questions.length}개 모두에 답하면 다음 단계로 갈 수 있어요.
                </p>
              ) : null}
            </section>
          )}

          {step === 'review' && recon && (
            <section className="card">
              <CardTitle step={3}>프롬프트 검토</CardTitle>
              <CardHint>{STEP_HINTS.review}</CardHint>
              <div className="compare compare--3">
                <div>
                  <p className="compare__label">원본 프롬프트</p>
                  <pre className="pre pre--orig">{userInput}</pre>
                </div>
                <div className="compare__arrow-col" aria-hidden>
                  →
                </div>
                <div>
                  <div className="compare__label-row">
                    <p className="compare__label">다듬어진 프롬프트</p>
                    <CopyTextButton text={promptDraft} label="프롬프트 복사" />
                  </div>
                  <textarea
                    ref={promptRef}
                    className="textarea textarea--prompt"
                    rows={12}
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="gauges-row">
                <RiskGauge value={recon.gauge_before} label="교정 전" />
                <span className="gauge-compare__arrow" aria-hidden>
                  →
                </span>
                <RiskGauge value={recon.gauge_after} label="교정 후" />
                {reconDelta > 0 ? (
                  <div className="gauge-delta">위험도 {reconDelta} 감소</div>
                ) : recon.gauge_before === recon.gauge_after && recon.gauge_before <= 35 ? (
                  <div className="gauge-delta gauge-delta--muted">감소 없음 · 낮은 위험 구간</div>
                ) : null}
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn--danger-outline"
                  disabled={loading}
                  onClick={rejectPrompt}
                >
                  거부하고 다시 입력
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={loading}
                  onClick={focusPromptEdit}
                >
                  수정하기
                </button>
                <button
                  type="button"
                  className="btn btn--success"
                  disabled={loading}
                  onClick={handleAnswer}
                >
                  {loading ? '생성 중…' : '수락하고 답변 받기'}
                </button>
              </div>
            </section>
          )}

          {step === 'result' && result && (
            <section className="card">
              <CardTitle step={4}>답변</CardTitle>
              <CardHint>{STEP_HINTS.result}</CardHint>
              <p className="meta meta--wrap">
                모델: <strong>{result.model}</strong>
                {lastRequestId ? (
                  <>
                    {' '}
                    · 요청 ID{' '}
                    <code className="meta__rid" title="백엔드 로그와 대조할 때 사용">
                      {lastRequestId}
                    </code>{' '}
                    <CopyTextButton text={lastRequestId} label="복사" />
                  </>
                ) : null}
              </p>
              <div className="gauges-row gauges-row--compact">
                <RiskGauge variant="card" value={result.gauge_before} label="교정 전" />
                <span className="gauge-compare__arrow" aria-hidden>
                  →
                </span>
                <RiskGauge variant="card" value={result.gauge_after} label="교정 후" />
                {resultDelta > 0 ? (
                  <div className="gauge-delta">위험도 {resultDelta} 감소</div>
                ) : result.gauge_before === result.gauge_after && result.gauge_before <= 35 ? (
                  <div className="gauge-delta gauge-delta--muted">감소 없음 · 낮은 위험 구간</div>
                ) : null}
              </div>
              {result.gauge_before === result.gauge_after && result.gauge_before === 0 ? (
                <p className="gauge-same-hint">
                  교정 전이 <strong>0</strong>이면 감점할 수 없어 교정 후도 <strong>0</strong>으로 같게
                  나옵니다. 교육·일반 질문은 보통 10~40대로 분류되도록 안내했으니, 새로 분석하면 숫자가
                  구분되어 보일 수 있습니다.
                </p>
              ) : null}
              <article className="answer-box answer-box--md" aria-label="생성된 답변">
                <AnswerMarkdown>{result.answer}</AnswerMarkdown>
              </article>
              <div className="answer-actions answer-actions--after-answer">
                <CopyTextButton text={result.answer} label="답변 전체 복사" />
                <button type="button" className="btn btn--secondary btn--compact" onClick={() => exportCurrentResult('md')}>
                  Markdown 저장
                </button>
                <button type="button" className="btn btn--secondary btn--compact" onClick={() => exportCurrentResult('txt')}>
                  텍스트 저장
                </button>
              </div>
              <div className="actions">
                <button type="button" className="btn btn--primary" onClick={resetAll}>
                  다른 질문 하기
                </button>
              </div>
            </section>
          )}
            </main>
          </div>

          <aside className="app-sidebar" aria-label="로컬에 저장된 기록">
            <LocalHistoryPanel
              entries={historyEntries}
              onEntriesChange={setHistoryEntries}
              onLoadQuestion={loadQuestionFromHistory}
            />
          </aside>
        </div>

        <footer className="footer">
          개인 질문·답변은 서버에 저장되지 않습니다. 로컬 기록은 이 브라우저에만 남으며 다른 기기와
          동기화되지 않습니다. 공공 PC에서는 사용 후 브라우저 탭을 닫아 주세요.
        </footer>
      </div>
    </div>
  )
}
