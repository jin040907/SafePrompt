"""
Safe Prompt FastAPI 서버 — `/classify`, `/questions`, `/reconstruct`, `/answer`, `/health` 등.
설치: pip install -r requirements.txt
한 번에 실행(API+프론트): npm install && npm run dev → API :8000, UI http://localhost:5173
API만: python3 -m uvicorn server:app --reload --host 127.0.0.1 --port 8000

배포 시 CORS: 환경 변수 CORS_ORIGINS(쉼표 구분) 또는 FRONTEND_URL.
`pipeline`과 동일하게 루트 `.env`의 API 키를 사용합니다.
"""

import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Optional

from pipeline import (
    classify_risk,
    generate_questions,
    reconstruct_prompt,
    generate_answer,
    recalculate_score,
)


def _cors_allow_origins() -> list[str]:
    """로컬 개발 오리진 + CORS_ORIGINS / FRONTEND_URL(프로덕션 프론트)."""
    origins: set[str] = {
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    }
    for chunk in os.getenv("CORS_ORIGINS", "").split(","):
        u = chunk.strip().rstrip("/")
        if u:
            origins.add(u)
    front = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if front:
        origins.add(front)
    return list(origins)


app = FastAPI(title="Safe Prompt API")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """클라이언트가 보낸 X-Request-ID를 유지하고, 없으면 UUID를 부여해 응답 헤더로 돌려준다."""

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = (request.headers.get("X-Request-ID") or "").strip()
        if not rid or len(rid) > 128:
            rid = str(uuid.uuid4())
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


# ── 요청/응답 스키마 ──────────────────────────────────────

class ClassifyRequest(BaseModel):
    user_input: str

class ClassifyResponse(BaseModel):
    risk_type: str
    gauge_before: int
    received_chars: int = Field(
        ...,
        description="서버가 받은 user_input 길이(공백 제거 후). 프론트와 불일치하면 요청 경로를 의심",
    )

class QuestionsRequest(BaseModel):
    user_input: str
    risk_type: str

class QuestionsResponse(BaseModel):
    questions: list[str]
    received_chars: int = Field(..., description="서버가 받은 user_input 길이(공백 제거 후)")

class ReconstructRequest(BaseModel):
    user_input: str
    risk_type: str
    questions: list[str]
    answers: list[str]
    gauge_before: Optional[int] = Field(
        None,
        description="1단계 classify 게이지(선택). 없으면 서버에서 재분류",
    )

class ReconstructResponse(BaseModel):
    safe_prompt: str
    gauge_after: int
    gauge_before: int

class AnswerRequest(BaseModel):
    safe_prompt: str
    gauge_before: int
    answers: list[str]

class AnswerResponse(BaseModel):
    answer: str
    model: str
    gauge_before: int
    gauge_after: int


# ── 엔드포인트 ────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "service": "Safe Prompt API"}


@app.get("/health")
def health():
    """프론트가 연결·환경을 안내할 수 있도록 키 설정 여부만 반환(값은 노출하지 않음)."""
    groq = bool(os.getenv("GROQ_API_KEY", "").strip())
    clova = bool(os.getenv("CLOVA_API_KEY", "").strip())
    return {
        "status": "healthy",
        "service": "Safe Prompt API",
        "groq_configured": groq,
        "clova_configured": clova,
        "ready": groq and clova,
    }


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    """1단계: 위험 유형 분류 + 게이지 수치"""
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="입력이 비어 있습니다")
    raw = req.user_input.strip()
    risk_type, gauge_before = classify_risk(req.user_input)
    return ClassifyResponse(
        risk_type=risk_type,
        gauge_before=gauge_before,
        received_chars=len(raw),
    )


@app.post("/questions", response_model=QuestionsResponse)
def questions(req: QuestionsRequest):
    """2단계: 의도 확인 질문 5개 생성"""
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="입력이 비어 있습니다")
    if not req.risk_type.strip():
        raise HTTPException(status_code=400, detail="risk_type이 비어 있습니다")
    raw = req.user_input.strip()
    qs = generate_questions(req.user_input, req.risk_type)
    return QuestionsResponse(questions=qs, received_chars=len(raw))


@app.post("/reconstruct", response_model=ReconstructResponse)
def reconstruct(req: ReconstructRequest):
    """3단계: 안전 프롬프트 재구성"""
    if not req.user_input.strip():
        raise HTTPException(status_code=400, detail="입력이 비어 있습니다")
    if len(req.questions) != len(req.answers):
        raise HTTPException(
            status_code=400,
            detail="질문 개수와 답변 개수가 일치해야 합니다",
        )
    if req.gauge_before is not None:
        gauge_before = max(0, min(100, req.gauge_before))
    else:
        _, gauge_before = classify_risk(req.user_input)
    safe_prompt = reconstruct_prompt(
        req.user_input, req.risk_type, req.questions, req.answers
    )
    gauge_after = recalculate_score(gauge_before, req.answers)
    return ReconstructResponse(
        safe_prompt=safe_prompt,
        gauge_before=gauge_before,
        gauge_after=gauge_after,
    )


@app.post("/answer", response_model=AnswerResponse)
def answer(req: AnswerRequest):
    """4단계: 최종 답변 생성"""
    if not req.safe_prompt.strip():
        raise HTTPException(status_code=400, detail="교정 프롬프트가 비어 있습니다")
    result, model = generate_answer(req.safe_prompt)
    gauge_after = recalculate_score(req.gauge_before, req.answers)
    return AnswerResponse(
        answer=result,
        model=model,
        gauge_before=req.gauge_before,
        gauge_after=gauge_after,
    )


# ── 전체 파이프라인 한 번에 (테스트용) ──────────────────

class PipelineRequest(BaseModel):
    user_input: str
    answers: Optional[list[str]] = None

@app.post("/pipeline")
def pipeline(req: PipelineRequest):
    """전체 파이프라인 한 번에 실행 (프론트 연결 전 테스트용)"""
    risk_type, gauge_before = classify_risk(req.user_input)
    questions = generate_questions(req.user_input, risk_type)

    answers = req.answers or ["예"] * len(questions)

    safe_prompt = reconstruct_prompt(
        req.user_input, risk_type, questions, answers
    )
    answer, model = generate_answer(safe_prompt)
    gauge_after = recalculate_score(gauge_before, answers)

    return {
        "risk_type": risk_type,
        "gauge_before": gauge_before,
        "gauge_after": gauge_after,
        "questions": questions,
        "safe_prompt": safe_prompt,
        "answer": answer,
        "model": model,
    }
