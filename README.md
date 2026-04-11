# Safe Prompt

질문의 위험도를 분석하고, 의도 확인 질문을 거쳐 안전하게 다듬은 프롬프트로 AI 답변을 받는 웹 서비스입니다.  
백엔드는 **FastAPI**, 프론트는 **React + TypeScript (Vite)** 입니다.

## 요구 사항

- Python 3.11+
- Node.js 18+ (npm)

## 설치

```bash
# Python 의존성
pip install -r requirements.txt

# Node 의존성 (루트에서 워크스페이스 포함 설치)
npm install
```

## 환경 변수

`.env.example`을 복사해 `.env`를 만들고 API 키를 입력합니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `GROQ_API_KEY` | Groq API (위험 분류 등) |
| `CLOVA_API_KEY` | HyperCLOVA X (CLOVA Studio) |

`.env`는 Git에 올라가지 않습니다.

## 실행

API와 프론트를 한 번에:

```bash
npm run dev
```

- API: http://127.0.0.1:8000  
- 웹 UI: http://localhost:5173  

API만:

```bash
python3 -m uvicorn server:app --reload --port 8000
```

프론트만 (`web/`):

```bash
npm run dev -w web
```

## 프로젝트 구조

| 경로 | 역할 |
|------|------|
| `server.py` | FastAPI 엔드포인트 |
| `pipeline.py` | LLM 호출·파이프라인 로직 |
| `web/` | Vite + React 프론트엔드 |

## 라이선스

팀·해커톤 용도에 맞게 정하세요.
