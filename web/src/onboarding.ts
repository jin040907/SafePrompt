/** UI 안내 문구 · 예시 질문 */

export const STEP_HINTS: Record<string, string> = {
  input:
    '평소에 AI에게 묻고 싶었던 문장을 그대로 적으면 됩니다. 아래는 교육·일상·의료·개발·직장·학문 등 맥락별 예시를 눌러 채울 수 있어요.',
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

/** 로컬 개발자가 바로 실행할 수 있도록 한 화면 안내용 */
export const QUICKSTART_STEPS = [
  '저장소 루트에 `.env`를 두고 `GROQ_API_KEY`, `CLOVA_API_KEY`를 넣습니다. (`cp .env.example .env` 후 편집)',
  'Python 의존성: `python3 -m venv .venv` → 활성화 후 `pip install -r requirements.txt`',
  '한 번에 실행: `npm install` 후 `npm run dev` → API는 8000, 화면은 http://localhost:5173',
]

/** 복사용 한 줄 (이미 의존성 설치했다면 이것만으로도 됨) */
export const QUICKSTART_ONE_LINER = 'npm install && npm run dev'

export type ExamplePrompt = { id: string; label: string; text: string }

/**
 * 예시 칩은 **사용자가 익숙한 주제·맥락**으로 나눔 (교육, 직장, 의료…).
 * 분석 결과의 위험 유형(윤리/보안/편향/오남용/안전)과 1:1로 맞추지 않아도 됨.
 */
export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: 'edu',
    label: '교육·과제',
    text: '고등학생 수준으로 기후 변화가 해양 생태에 미치는 영향을 세 문단으로 요약해 줘.',
  },
  {
    id: 'life',
    label: '일상·습관',
    text: '재택근무할 때 집중력을 높이는 습관 다섯 가지만 추천해 줘.',
  },
  {
    id: 'health-data',
    label: '의료·개인정보',
    text: '환자 동의 범위를 넘지 않으면서도 병원 홍보에 쓸 수 있는 사례 후기를 어떻게 쓰면 좋을지, 법·윤리적으로 애매한 경계만 예시로 짚어 줘.',
  },
  {
    id: 'dev-sec',
    label: '개발·시스템',
    text: '보안 수업 과제로, SQL 인젝션이 왜 위험한지 취약한 쿼리 예시와 방어(파라미터 바인딩 등) 아이디어를 교육 목적으로만 정리해 줘.',
  },
  {
    id: 'work-hr',
    label: '직장·채용',
    text: '특정 출신 지역이나 성별 지원자가 "우리 팀 문화에 맞지 않을 가능성이 높다"는 식으로만 쓰인 채용 거절 메일 초안을 정중하게 다듬어 줘.',
  },
  {
    id: 'academic-integrity',
    label: '학문·제출',
    text: '과제 마감이 빠듯할 때 검색·AI로 만든 초안을 제출문처럼 보이게만 손보는 체크리스트를 알려 줘.',
  },
]
