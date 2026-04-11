/** UI 안내 문구 · 예시 질문 */

export const STEP_HINTS: Record<string, string> = {
  input:
    '평소에 AI에게 묻고 싶었던 문장을 그대로 적으면 됩니다. 아래 예시를 눌러 채울 수도 있어요.',
  questions:
    '의도를 확인하는 질문입니다. 솔직하게 짧게 답하면, 그에 맞게 프롬프트가 조정됩니다.',
  review:
    '오른쪽은 AI가 다듬은 프롬프트입니다. 필요하면 직접 수정한 뒤, 마음에 들면 수락해 답변을 받으세요.',
  result: '아래는 교정된 프롬프트로 생성된 답변입니다. 처음부터 다시 하려면 「다른 질문 하기」를 누르세요.',
}

export const HOW_IT_WORKS = [
  '질문을 넣으면 위험도와 유형이 분석됩니다.',
  '확인 질문에 답합니다.',
  '안전하게 다듬어진 프롬프트를 검토합니다.',
  '수락하면 그 프롬프트로 AI 답변이 만들어집니다.',
]

export type ExamplePrompt = { id: string; label: string; text: string }

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'study',
    label: '학습·글쓰기',
    text: '고등학생 수준으로 기후 변화가 해양 생태에 미치는 영향을 세 문단으로 요약해 줘.',
  },
  {
    id: 'daily',
    label: '일상·추천',
    text: '재택근무할 때 집중력을 높이는 습관 다섯 가지만 추천해 줘.',
  },
  {
    id: 'careful',
    label: '민감 주의',
    text: '의약품 복용 전에 반드시 확인해야 할 사항이 뭐야? (일반적인 안내만)',
  },
]
