# 배포 가이드 (백엔드 + 프론트)

권장 조합: **API → Railway 또는 Render**, **정적 웹 → Vercel**.  
저장소는 GitHub에 올린 뒤 각 서비스에서 **Connect GitHub** 로 연결하면 됩니다.

---

## 1. 공통: 환경 변수 정리

| 변수 | 어디에 넣나 | 설명 |
|------|-------------|------|
| `GROQ_API_KEY` | 백엔드만 | Groq API |
| `CLOVA_API_KEY` | 백엔드만 | HyperCLOVA X |
| `CORS_ORIGINS` 또는 `FRONTEND_URL` | 백엔드만 | 프론트 배포 URL (아래 3단계 후 설정) |
| `VITE_API_BASE` | **프론트 빌드 시** (Vercel) | 백엔드 공개 URL (끝에 `/` 없이) |

프론트는 빌드 시점에 `VITE_*` 가 코드에 박히므로, **API URL을 바꾼 뒤에는 Vercel에서 다시 Deploy** 해야 합니다.

---

## 2. 백엔드 (FastAPI)

### 방법 A: Railway + Dockerfile (권장)

1. [Railway](https://railway.app) 로그인 → **New Project** → **Deploy from GitHub repo**
2. 이 저장소 선택 → **Root directory** 는 저장소 루트 유지
3. Railway가 `Dockerfile` 을 감지하면 자동 빌드
4. **Variables** 에 추가:
   - `GROQ_API_KEY`
   - `CLOVA_API_KEY`
5. 배포가 끝나면 **Settings → Networking → Generate Domain** 으로 공개 URL 확인  
   예: `https://safe-prompt-api-production.up.railway.app`
6. 같은 화면에 **`FRONTEND_URL`** 또는 **`CORS_ORIGINS`** 추가:
   - Vercel 주소가 정해지면: `FRONTEND_URL=https://프로젝트.vercel.app`
   - 여러 개면: `CORS_ORIGINS=https://a.vercel.app,https://b.vercel.app`

헬스 체크: 브라우저에서 `https://(API주소)/health` → `{"status":"healthy"}`

### 방법 B: Render + Docker

1. [Render](https://render.com) → **New** → **Blueprint** → `render.yaml` 연동  
   또는 **Web Service** → Docker 로 `Dockerfile` 지정
2. Environment 에 API 키와 `CORS_ORIGINS` / `FRONTEND_URL` 입력

### 방법 C: Nixpacks (Dockerfile 없이)

저장소 루트에 `requirements.txt` + `Procfile` 이 있으면 Railway 등이 Python 으로 감지할 수 있습니다.  
시작 명령은 `Procfile` 의 `web:` 줄을 따릅니다. **`PORT`** 는 플랫폼이 넣어 줍니다.

---

## 3. 프론트 (Vite → Vercel)

1. [Vercel](https://vercel.com) → **Add New** → **Project** → GitHub 저장소 import
2. **Framework Preset**: Other (저장소 루트의 `vercel.json` 이 빌드를 지정함)
3. **Environment Variables** (Production / Preview 모두에 권장):

   | Name | Value 예시 |
   |------|------------|
   | `VITE_API_BASE` | `https://safe-prompt-api-production.up.railway.app` |

   - **반드시 `https://` 포함**, 마지막 `/` 없음  
   - API 경로는 프론트 코드가 `/classify` 등으로 붙이므로 베이스만 넣으면 됩니다 (`api.ts` 참고).

4. **Deploy** — 빌드 명령은 루트 `vercel.json` 의 `npm run build -w web` 을 사용합니다.

배포 후 브라우저에서 Vercel URL 이 열리고, 질문 입력 → 분석이 동작하면 성공입니다.  
CORS 오류가 나면 백엔드의 `FRONTEND_URL` / `CORS_ORIGINS` 에 **정확히 Vercel 도메인**(https 포함)이 들어갔는지 확인하세요.

---

## 4. 순서 요약

1. 백엔드만 먼저 배포 → 공개 API URL 확보  
2. Vercel 에 `VITE_API_BASE` = 그 API URL 로 **프론트 배포**  
3. 백엔드 환경 변수에 `FRONTEND_URL` = Vercel URL 추가 → 백엔드 **Redeploy**  

---

## 5. 문제 해결

| 증상 | 확인 |
|------|------|
| 브라우저 CORS 에러 | `FRONTEND_URL` / `CORS_ORIGINS`, 스킴(`https`) 일치 |
| API 호출이 로컬(127.0.0.1)로 감 | Vercel에 `VITE_API_BASE` 없이 빌드됨 → 환경 변수 넣고 재배포 |
| Railway 빌드 실패 | Dockerfile 경로, `requirements.txt` 존재 여부 |
| `Invalid value for '--port': '$PORT'` | Railway가 `$PORT`를 그대로 넘길 때 발생. 저장소의 `start.sh` + `Dockerfile` `CMD ["./start.sh"]` 사용. 대시보드 **Start Command**에 `uvicorn ... --port $PORT` 를 직접 넣었다면 **비우기** 또는 `./start.sh` 로 변경 후 재배포 |
| Vercel 빌드 `rolldown` / `Cannot find native binding` | Vite 8 + Linux 빌드에서 optional 의존성 이슈가 날 수 있어, 이 프로젝트는 **Vite 6.x** 로 고정함 (`web/package.json`). |

---

## 6. 로컬에서 프로덕션과 비슷하게 테스트

```bash
# 터미널 1 — API (포트 8000)
export FRONTEND_URL=http://localhost:5173
uvicorn server:app --host 127.0.0.1 --port 8000

# 터미널 2 — 프론트 (VITE_API_BASE 지정)
cd web && VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```
