import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  apiPost,
  type AnswerResponse,
  type ClassifyResponse,
  type QuestionsResponse,
  type ReconstructResponse,
} from './api'
import { RiskGauge } from './components/RiskGauge'
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

export default function App() {
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [step, setStep] = useState<Step>('input')
  const [userInput, setUserInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [classify, setClassify] = useState<ClassifyResponse | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [recon, setRecon] = useState<ReconstructResponse | null>(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [result, setResult] = useState<AnswerResponse | null>(null)

  const canGoQuestions = userInput.trim().length > 0

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

  async function handleClassify() {
    setError(null)
    setLoading(true)
    setClassify(null)
    setQuestions([])
    setAnswers([])
    try {
      const data = await apiPost<ClassifyResponse>('/classify', {
        user_input: userInput.trim(),
      })
      const qs = await apiPost<QuestionsResponse>('/questions', {
        user_input: userInput.trim(),
        risk_type: data.risk_type,
      })
      setClassify(data)
      setQuestions(qs.questions)
      setAnswers(qs.questions.map(() => ''))
      setStep('questions')
    } catch (e) {
      setError(e instanceof Error ? e.message : '분류·질문 생성 실패')
    } finally {
      setLoading(false)
    }
  }

  async function handleReconstruct() {
    if (!classify) return
    setError(null)
    setLoading(true)
    try {
      const data = await apiPost<ReconstructResponse>('/reconstruct', {
        user_input: userInput.trim(),
        risk_type: classify.risk_type,
        questions,
        answers,
        gauge_before: classify.gauge_before,
      })
      setRecon(data)
      setPromptDraft(data.safe_prompt)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : '프롬프트 재구성 실패')
    } finally {
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
    setLoading(true)
    try {
      const data = await apiPost<AnswerResponse>('/answer', {
        safe_prompt: safe,
        gauge_before: recon.gauge_before,
        answers,
      })
      setResult(data)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변 생성 실패')
    } finally {
      setLoading(false)
    }
  }

  function resetAll() {
    setStep('input')
    setUserInput('')
    setClassify(null)
    setQuestions([])
    setAnswers([])
    setRecon(null)
    setPromptDraft('')
    setResult(null)
    setError(null)
  }

  function rejectPrompt() {
    setRecon(null)
    setPromptDraft('')
    setStep('input')
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

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav__brand">
          <h1 className="top-nav__logo">Safe Prompt</h1>
          <p className="top-nav__tagline">
            질문의 위험도를 확인하고, 의도를 확인한 뒤 안전하게 다듬은 프롬프트로 답변을 받습니다.
          </p>
        </div>
      </header>

      <div className="app-body">
        <StepPills step={step} />

        {error ? (
          <div className="banner banner--err" role="alert">
            {error}
          </div>
        ) : null}

        <main className="main">
          {step === 'input' && (
            <section className="card">
              <CardTitle step={1}>질문 입력</CardTitle>
              <textarea
                className="textarea"
                rows={5}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="무엇이든 물어보세요."
                disabled={loading}
              />
              <div className="actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!canGoQuestions || loading}
                  onClick={handleClassify}
                >
                  {loading ? '분석 중…' : '분석 시작'}
                </button>
              </div>
            </section>
          )}

          {step === 'questions' && classify && (
            <section className="card">
              <CardTitle step={2}>분석 · 의도 확인</CardTitle>
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
            </section>
          )}

          {step === 'review' && recon && (
            <section className="card">
              <CardTitle step={3}>프롬프트 검토</CardTitle>
              <div className="compare compare--3">
                <div>
                  <p className="compare__label">원본 프롬프트</p>
                  <pre className="pre pre--orig">{userInput}</pre>
                </div>
                <div className="compare__arrow-col" aria-hidden>
                  →
                </div>
                <div>
                  <p className="compare__label">다듬어진 프롬프트</p>
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
              <p className="meta">
                모델: <strong>{result.model}</strong>
              </p>
              <div className="gauges-row gauges-row--compact">
                <RiskGauge variant="card" value={result.gauge_before} label="교정 전" />
                <span className="gauge-compare__arrow" aria-hidden>
                  →
                </span>
                <RiskGauge variant="card" value={result.gauge_after} label="교정 후" />
                {resultDelta > 0 ? (
                  <div className="gauge-delta">위험도 {resultDelta} 감소</div>
                ) : null}
              </div>
              <article className="answer-box">{result.answer}</article>
              <div className="actions">
                <button type="button" className="btn btn--primary" onClick={resetAll}>
                  다른 질문 하기
                </button>
              </div>
            </section>
          )}
        </main>

        <footer className="footer">입력·답변은 저장하지 않습니다.</footer>
      </div>
    </div>
  )
}
