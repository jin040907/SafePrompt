import './RiskGauge.css'

type Props = {
  value: number
  label?: string
  /** bar: 기본 게이지 / card: 시나리오 PDF 스타일 숫자 박스 */
  variant?: 'bar' | 'card'
}

/** 기획서: 0–30 안전, 31–69 주의, 70–100 위험 */
function tier(v: number): 'safe' | 'warn' | 'danger' {
  if (v <= 30) return 'safe'
  if (v <= 69) return 'warn'
  return 'danger'
}

export function RiskGauge({ value, label, variant = 'bar' }: Props) {
  const v = Math.max(0, Math.min(100, value))
  const t = tier(v)

  if (variant === 'card') {
    return (
      <div
        className={`risk-gauge-card risk-gauge-card--${t}`}
        role="img"
        aria-label={`위험도 ${v}점`}
      >
        {label ? <div className="risk-gauge-card__label">{label}</div> : null}
        <div className="risk-gauge-card__num">{v}</div>
        <div className="risk-gauge-card__suffix">/ 100</div>
      </div>
    )
  }

  return (
    <div className={`risk-gauge risk-gauge--${t}`} role="img" aria-label={`위험도 ${v}점`}>
      {label ? <div className="risk-gauge__label">{label}</div> : null}
      <div className="risk-gauge__bar-wrap">
        <div className="risk-gauge__bar" style={{ width: `${v}%` }} />
      </div>
      <div className="risk-gauge__segments" aria-hidden>
        <span>안전</span>
        <span>주의</span>
        <span>위험</span>
      </div>
      <div className="risk-gauge__meta">
        <span className="risk-gauge__value">{v}</span>
        <span className="risk-gauge__max">/ 100</span>
        <span className="risk-gauge__tier">
          {t === 'safe' ? '안전' : t === 'warn' ? '주의' : '위험'}
        </span>
      </div>
    </div>
  )
}
