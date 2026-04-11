# Safe Prompt

사용자 질문의 **위험도**를 먼저 판별하고, **의도 확인 질문**에 답한 뒤 **안전하게 다듬은 프롬프트**로 LLM 답변을 받는 도구입니다.  
출력 사후 검열이 아니라 **입력 단계에서의 사전 방어(Pre-emptive Defense)** 에 초점을 둡니다.

| 구분 | 스택 |
|------|------|
| 백엔드 | Python 3.11+, FastAPI, Uvicorn |
| 프론트엔드 | React 19, TypeScript, Vite |
| LLM | Groq(Llama), HyperCLOVA X(주) · 실패 시 Groq 폴백 |

---

## 목차

1. [동작 흐름](#동작-흐름)
2. [요구 사항](#요구-사항)
3. [설치](#설치)
4. [환경 변수](#환경-변수)
5. [실행](#실행)
6. [API 개요](#api-개요)
7. [프론트 빌드·배포](#프론트-빌드배포)
8. [프로젝트 구조](#프로젝트-구조)
9. [기타 스크립트](#기타-스크립트)
10. [문제 해결](#문제-해결)
11. [라이선스](#라이선스)

---

## 동작 흐름

1. **질문 입력** → 위험 유형·위험도(게이지) 산출  
2. **의도 확인 질문** → 사용자 답변 수집  
3. **프롬프트 재구성** → 교정된 프롬프트 검토·수정·거부  
4. **최종 답변** → 교정 프롬프트로 LLM 호출  

개발용으로 전 단계를 한 번에 호출하는 `POST /pipeline` 도 제공합니다.

---

## 요구 사항

- **Python** 3.11 이상  
- **Node.js** 18 이상 (npm)  
- **API 키**: Groq, Naver Cloud HyperCLOVA X(CLOVA Studio) — `pipeline.py`에서 사용  

---

## 설치

```bash
git clone <저장소 URL>
cd SafePrompt   # 또는 클론한 폴더명

# Python (가상환경 권장)
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Node (루트에서 워크스페이스 포함)
npm install
```

---

## 환경 변수

저장소 루트에 `.env` 파일을 둡니다. 예시는 `.env.example`을 복사합니다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `GROQ_API_KEY` | Groq API — 위험 분류 등에 사용 |
| `CLOVA_API_KEY` | HyperCLOVA X — 질문 생성·프롬프트 재구성·답변(주 경로) |

- `pipeline.py`가 기동 시 같은 디렉터리의 `.env`를 읽습니다.  
- **`.env`는 Git에 포함되지 않습니다.** 팀원은 각자 `.env`를 만들어야 합니다.

### 프론트엔드(배포 시)

정적 호스팅에 빌드 결과만 올리고 API는 다른 도메인인 경우:

| 변수 | 설명 |
|------|------|
| `VITE_API_BASE` | 백엔드 베이스 URL (예: `https://api.example.com`, 끝 `/` 없이) |

설정하지 않으면 개발 시에는 Vite 프록시(`/api` → `127.0.0.1:8000`), 프로덕션 빌드 기본은 `http://127.0.0.1:8000` 입니다.

---

## 실행

### API + 웹 UI 동시에 (권장)

```bash
npm run dev
```

| 서비스 | URL |
|--------|-----|
| FastAPI | http://127.0.0.1:8000 |
| Vite 개발 서버 | http://localhost:5173 |

### 백엔드만

```bash
python3 -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

### 프론트만

```bash
npm run dev -w web
```

### API 문서 (Swagger)

브라우저에서 **http://127.0.0.1:8000/docs** — 요청/응답 스키마와 호출 테스트 가능합니다.

---

## API 개요

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/` | 서비스 이름 확인 |
| `GET` | `/health` | 헬스 체크 |
| `POST` | `/classify` | 위험 유형 + 게이지 |
| `POST` | `/questions` | 의도 확인 질문 목록 |
| `POST` | `/reconstruct` | 교정 프롬프트 + 게이지 전후 |
| `POST` | `/answer` | 최종 답변 |
| `POST` | `/pipeline` | 전체 파이프라인 일괄 실행(테스트용) |

CORS는 로컬 `http://localhost:3000`, `http://localhost:5173` 만 허용되어 있습니다. 다른 오리진을 쓰면 `server.py`의 `allow_origins`를 수정하세요.

---

## 프론트 빌드·배포

```bash
cd web && npm run build
```

결과물은 `web/dist/` 입니다.  
배포 시 `VITE_API_BASE`로 백엔드 URL을 지정한 뒤 빌드하면, 프론트가 해당 API로 요청합니다.

---

## 프로젝트 구조

```
SafePrompt/
├── server.py           # FastAPI 앱·라우트
├── pipeline.py         # LLM 호출·위험 분류·재구성·답변
├── test_api.py         # API 연결 스모크 테스트
├── requirements.txt
├── package.json        # 루트: concurrently로 api+web 동시 실행
├── web/                # Vite + React
│   ├── src/
│   │   ├── App.tsx     # UI 플로우
│   │   ├── api.ts      # fetch 헬퍼
│   │   └── ...
│   └── vite.config.ts  # 개발 시 /api 프록시
└── .env.example
```

---

## 기타 스크립트

- **`python3 test_api.py`** — Groq / HyperCLOVA 연결 여부를 빠르게 확인할 때 사용합니다.  
- **`python3 pipeline.py`** — 터미널에서 파이프라인 전체를 예시 입력으로 돌려 볼 수 있습니다.

---

## 문제 해결

| 증상 | 참고 |
|------|------|
| `CERTIFICATE_VERIFY_FAILED` (macOS 등) | `pip install certifi` — `pipeline.py`에서 certifi 번들을 사용합니다. |
| `latin-1` / 헤더 인코딩 오류 | API 키에 한글·이모지가 섞이지 않았는지 확인하세요. |
| `uvicorn` 명령을 찾을 수 없음 | `python3 -m uvicorn server:app --reload --port 8000` 사용 또는 사용자 `bin`을 `PATH`에 추가. |
| 프론트만 빌드해 올렸는데 API 호출 실패 | `VITE_API_BASE` 설정 후 다시 `npm run build`, CORS에 프론트 도메인 추가. |

---

## 라이선스

팀·행사 규정에 맞게 저장소에 라이선스 파일을 추가하세요. (미정이면 이 문단을 수정·삭제하면 됩니다.)
