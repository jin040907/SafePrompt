import { useState } from 'react'
import { AnswerMarkdown } from './AnswerMarkdown'
import {
  clearAllHistory,
  defaultExportBasename,
  downloadTextFile,
  formatEntryAsMarkdown,
  formatEntryAsText,
  type HistoryEntry,
  removeHistoryEntry,
} from '../history'

type Props = {
  entries: HistoryEntry[]
  onEntriesChange: (next: HistoryEntry[]) => void
  onLoadQuestion: (question: string) => void
}

function HistoryEntryBody({ e }: { e: HistoryEntry }) {
  const delta = Math.max(0, e.gaugeBefore - e.gaugeAfter)
  return (
    <div className="history-detail">
      <div className="history-detail__row">
        <span className="history-detail__label">위험도</span>
        <span className="history-detail__value">
          {e.gaugeBefore} → {e.gaugeAfter}
          {delta > 0 ? ` (${delta} 감소)` : ''}
        </span>
      </div>
      <div className="history-detail__row">
        <span className="history-detail__label">모델</span>
        <span className="history-detail__value">{e.model}</span>
      </div>
      {e.requestId ? (
        <div className="history-detail__row">
          <span className="history-detail__label">요청 ID</span>
          <code className="history-detail__code">{e.requestId}</code>
        </div>
      ) : null}

      <div className="history-detail__block">
        <h4 className="history-detail__h">원본 질문</h4>
        <p className="history-detail__text">{e.userInput.trim()}</p>
      </div>

      {e.questions.length > 0 ? (
        <div className="history-detail__block">
          <h4 className="history-detail__h">의도 확인</h4>
          <ul className="history-detail__qa">
            {e.questions.map((q, i) => (
              <li key={i}>
                <span className="history-detail__q">Q{i + 1}. {q}</span>
                <span className="history-detail__a">A. {(e.answers[i] ?? '').trim() || '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="history-detail__block">
        <h4 className="history-detail__h">교정된 프롬프트</h4>
        <pre className="history-detail__pre">{e.safePrompt.trim()}</pre>
      </div>

      <div className="history-detail__block">
        <h4 className="history-detail__h">답변</h4>
        <div className="history-detail__answer answer-box answer-box--md">
          <AnswerMarkdown>{e.answer}</AnswerMarkdown>
        </div>
      </div>
    </div>
  )
}

export function LocalHistoryPanel({ entries, onEntriesChange, onLoadQuestion }: Props) {
  const [open, setOpen] = useState(false)

  function handleDelete(id: string) {
    onEntriesChange(removeHistoryEntry(id))
  }

  function handleClearAll() {
    if (!entries.length) return
    if (!window.confirm('이 브라우저에 저장된 기록을 모두 지울까요?')) return
    clearAllHistory()
    onEntriesChange([])
  }

  function exportOne(e: HistoryEntry, kind: 'md' | 'txt') {
    const body = kind === 'md' ? formatEntryAsMarkdown(e) : formatEntryAsText(e)
    const ext = kind === 'md' ? 'md' : 'txt'
    downloadTextFile(defaultExportBasename(e, ext), body)
  }

  function exportAllMarkdown() {
    if (!entries.length) return
    const parts = entries.map((e) => formatEntryAsMarkdown(e))
    const combined = parts.join('\n\n---\n\n')
    downloadTextFile(`safeprompt-history-${Date.now()}.md`, combined)
  }

  return (
    <section className="history-panel" aria-labelledby="history-panel-title">
      <button
        type="button"
        className="history-panel__toggle"
        id="history-panel-title"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="history-panel__toggle-label">로컬 기록</span>
        <span className="history-panel__count">{entries.length}건</span>
        <span className="history-panel__chev" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
      </button>

      {open ? (
        <div className="history-panel__body">
          <p className="history-panel__hint">
            완료한 세션만 이 기기 브라우저에 저장됩니다. 서버로 전송되지 않습니다.
          </p>
          {entries.length > 0 ? (
            <div className="history-panel__toolbar">
              <button type="button" className="btn btn--secondary btn--compact" onClick={exportAllMarkdown}>
                전체 내보내기 (.md)
              </button>
              <button type="button" className="btn btn--danger-outline btn--compact" onClick={handleClearAll}>
                전체 삭제
              </button>
            </div>
          ) : (
            <p className="history-panel__empty">아직 저장된 기록이 없습니다. 답변까지 완료하면 여기에 쌓입니다.</p>
          )}
          <ul className="history-list">
            {entries.map((e) => (
              <li key={e.id} className="history-list__item">
                <div className="history-list__meta">
                  <time dateTime={e.createdAt} className="history-list__time">
                    {new Date(e.createdAt).toLocaleString('ko-KR')}
                  </time>
                  <span className="history-list__risk">{e.riskType}</span>
                </div>
                <p className="history-list__preview">{e.userInput.trim().slice(0, 120)}{e.userInput.length > 120 ? '…' : ''}</p>
                <details className="history-detail-acc">
                  <summary className="history-detail-acc__summary">세부 내용 보기 · 교정 프롬프트·답변</summary>
                  <HistoryEntryBody e={e} />
                </details>
                <div className="history-list__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact"
                    onClick={() => onLoadQuestion(e.userInput)}
                  >
                    질문만 불러오기
                  </button>
                  <button type="button" className="btn btn--secondary btn--compact" onClick={() => exportOne(e, 'md')}>
                    .md
                  </button>
                  <button type="button" className="btn btn--secondary btn--compact" onClick={() => exportOne(e, 'txt')}>
                    .txt
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--compact history-list__del"
                    onClick={() => handleDelete(e.id)}
                    aria-label="이 기록 삭제"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
