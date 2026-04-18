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
2. [웹 화면 안내](#웹-화면-안내)
3. [요구 사항](#요구-사항)
4. [설치](#설치)
5. [환경 변수](#환경-변수)
6. [실행](#실행)
7. [API 개요](#api-개요)
8. [프론트 빌드·클라우드 배포](#프론트-빌드클라우드-배포)
9. [프로젝트 구조](#프로젝트-구조)
10. [기타 스크립트](#기타-스크립트)
11. [문제 해결](#문제-해결)
12. [라이선스](#라이선스)

---

## 동작 흐름

1. **질문 입력** → 위험 유형·위험도(게이지) 산출  
2. **의도 확인 질문** → 사용자 답변 수집  
3. **프롬프트 재구성** → 교정된 프롬프트 검토·수정·거부  
4. **최종 답변** → 교정 프롬프트로 LLM 호출  

개발용으로 전 단계를 한 번에 호출하는 `POST /pipeline` 도 제공합니다.

---

## 웹 화면 안내

일반 사용자가 브라우저만으로 따라가기 쉽도록 UI에 다음이 포함되어 있습니다.

| 요소 | 설명 |
|------|------|
| **이용 순서** | 첫 화면에서 「처음이신가요?」를 펼치면 4단계 요약을 볼 수 있습니다. |
| **예시로 채우기** | 교육·일상·의료·개발·직장·학문 등 맥락별 샘플을 누르면 입력란이 채워집니다. |
| **단계별 안내** | 각 카드 상단에 해당 단계에서 할 일이 한 줄로 설명됩니다. |
| **단축키** | 질문 입력 후 **Ctrl + Enter** (Mac: **⌘ + Enter**)로 분석을 시작할 수 있습니다. |
| **접근성** | 처리 중일 때 스크린 리더용 안내(`aria-live`)가 갱신됩니다. |

문구·예시는 `web/src/onboarding.ts`에서 수정할 수 있습니다.

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
| `FRONTEND_URL` | (배포 시 선택) Vercel 등 **프론트 공개 URL** 하나 — CORS 허용 |
| `CORS_ORIGINS` | (배포 시 선택) 허용 오리진을 쉼표로 여러 개 (`https://a.app,https://b.app`) |

- `pipeline.py`가 기동 시 같은 디렉터리의 `.env`를 읽습니다.  
- **`.env`는 Git에 포함되지 않습니다.** 팀원은 각자 `.env`를 만들어야 합니다.  
- 클라우드 백엔드(Railway 등)에는 대시보드 **Environment** 에 위 변수들을 넣습니다.

### 프론트엔드(배포 시)

정적 호스팅에 빌드 결과만 올리고 API는 다른 도메인인 경우:

| 변수 | 설명 |
|------|------|
| `VITE_API_BASE` | 백엔드 베이스 URL (예: `https://api.example.com`, 끝 `/` 없이) |

개발 시에는 Vite 프록시(`/api` → `127.0.0.1:8000`)를 씁니다. **프로덕션 빌드**에서는 `VITE_API_BASE`가 없으면 잘못된 주소로 요청이 가지 않도록 **안내 배너가 표시**되도록 되어 있으니, Vercel 등에 반드시 백엔드 URL을 넣고 빌드하세요.

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
| `POST` | `/classify` | 위험 유형 + 게이지 (+ `received_chars` 등) |
| `POST` | `/questions` | 의도 확인 질문 목록 |
| `POST` | `/reconstruct` | 교정 프롬프트 + 게이지 전후 |
| `POST` | `/answer` | 최종 답변 |
| `POST` | `/pipeline` | 전체 파이프라인 일괄 실행(테스트용) |

CORS는 로컬(`localhost:3000`, `5173` 등)에 더해 환경 변수 **`FRONTEND_URL`**(한 개) 또는 **`CORS_ORIGINS`**(쉼표 구분)로 프로덕션 프론트 도메인을 넣을 수 있습니다. `server.py`의 `_cors_allow_origins()`를 참고하세요.

---

## 프론트 빌드·클라우드 배포

### 로컬에서 정적 파일만 만들기

```bash
cd web && npm run build
```

결과물은 `web/dist/` 입니다.

### 클라우드에 올리기 (Railway + Vercel)

**백엔드**는 저장소 루트의 `Dockerfile` 로 컨테이너 배포하고, **프론트**는 Vercel에서 **Root Directory = `web`** + `web/vercel.json` 을 쓰는 흐름을 권장합니다.  
환경 변수와 순서는 **[DEPLOY.md](./DEPLOY.md)** 를 따르세요.

| 파일 | 용도 |
|------|------|
| `Dockerfile` | API 이미지 (Railway / Render 등) |
| `Procfile` | Docker 없이 Python 빌드팩만 쓸 때 시작 명령 |
| `render.yaml` | Render Blueprint 예시 |
| `web/vercel.json` | Vercel(Vite) — Root Directory `web` 일 때 `dist` 배포 |

---

## 프로젝트 구조

```
SafePrompt/
├── server.py           # FastAPI 앱·라우트
├── pipeline.py         # LLM 호출·위험 분류·재구성·답변
├── serve.py            # 프로덕션 진입점(PORT 읽어 uvicorn 실행) — Dockerfile / Procfile
├── test_api.py         # Groq·HyperCLOVA 연결 스모크 테스트
├── requirements.txt
├── Dockerfile
├── Procfile
├── DEPLOY.md
├── package.json        # concurrently + rxjs; `npm run dev` = API + Vite
├── web/
│   ├── vercel.json     # Vercel — 프로젝트 Root Directory 를 `web` 으로 둘 때
│   ├── src/
│   │   ├── App.tsx
│   │   ├── onboarding.ts
│   │   ├── api.ts
│   │   └── components/ # RiskGauge, AnswerMarkdown 등
│   └── vite.config.ts
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
| `npm run dev` 시 `ECONNREFUSED 127.0.0.1:8000` | **저장소 루트**에서 `npm run dev`로 API와 함께 띄우거나, 다른 터미널에서 `python3 -m uvicorn server:app --reload --port 8000` 실행. `web/`만 들어가서 프론트만 켜면 API가 없음. |
| `Cannot find module 'rxjs'` (concurrently) | 루트에서 `npm install` — `package.json`에 `rxjs`가 명시되어 있습니다. |

---

## 라이선스

현재 이 프로젝트는 외부 공개 라이선스를 부여하지 않은 상태이며, **오픈소스 라이선스를 적용하지 않습니다.**

모든 권리는 저작권자에게 있으며, 사전 허가 없는 사용·복제·수정·배포를 금지합니다.  
(`All rights reserved`)
