# Safe Prompt — 웹 프론트엔드

Vite + React + TypeScript UI입니다. **저장소 루트의 [README.md](../README.md)** 에 설치·실행·배포 전체 안내가 있습니다.

| 항목 | 내용 |
|------|------|
| 로컬 개발 | 저장소 루트에서 `npm run dev` (API + Vite 동시) 또는 `npm run dev -w web` (프론트만) |
| 배포 | Vercel에서 **Root Directory = `web`**, 환경 변수 `VITE_API_BASE` — 자세한 내용은 [DEPLOY.md](../DEPLOY.md) |
| 주요 소스 | `src/App.tsx`, `src/onboarding.ts`, `src/api.ts`, `src/history.ts`(로컬 기록), `src/components/` |

기본 Vite 템플릿 설명은 제거했습니다. ESLint·React Compiler 등은 필요 시 [Vite 문서](https://vite.dev)를 참고하세요.

---

## 권리 및 사용 안내

이 프로젝트는 외부 공개 라이선스를 부여하지 않은 상태이며, 현재 오픈소스 라이선스를 적용하지 않습니다.  
모든 권리는 저작권자에게 있으며, 사전 허가 없는 사용·복제·수정·배포를 금지합니다.  
(`All rights reserved`)
