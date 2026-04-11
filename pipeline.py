"""
Step 2. Safe Prompt 핵심 파이프라인
실행: python3 pipeline.py
"""

import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path


# ── 환경변수 로드 ──────────────────────────────────────────
def _load_env():
    p = Path(__file__).resolve().parent / ".env"
    if not p.is_file():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key:
            os.environ[key] = val

_load_env()

GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
CLOVA_API_KEY = os.getenv("CLOVA_API_KEY", "")

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

def _ssl():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


# ── 공통 API 호출 ──────────────────────────────────────────
def call_api(url, headers, body):
    payload = json.dumps(body, ensure_ascii=True).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_unredirected_header("Content-Type", "application/json")
    req.add_unredirected_header("Content-Length", str(len(payload)))
    req.add_unredirected_header("User-Agent", _UA)
    for k, v in headers.items():
        req.add_unredirected_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=20, context=_ssl()) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}"
    except Exception as e:
        return None, str(e)


def call_groq(messages, max_tokens=800):
    """Groq (Llama 3.3 70B) 호출"""
    data, err = call_api(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {GROQ_API_KEY}"},
        {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.3,
        }
    )
    if data:
        return data["choices"][0]["message"]["content"].strip(), None
    return None, err


def call_clova(messages, max_tokens=800):
    """HyperCLOVA X 호출 — 실패 시 Groq Fallback"""
    data, err = call_api(
        "https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005",
        {"Authorization": f"Bearer {CLOVA_API_KEY}"},
        {"messages": messages, "maxTokens": max_tokens, "temperature": 0.3}
    )
    if data:
        return data["result"]["message"]["content"].strip(), "HyperCLOVA X"

    # Fallback
    print(f"  [Fallback] HyperCLOVA X 실패 ({err}) → Groq 전환")
    result, err2 = call_groq(messages, max_tokens)
    if result:
        return result, "Groq (Fallback)"
    return None, err2


# ── 색상 출력 ──────────────────────────────────────────────
def c(text, color):
    codes = {
        "green": "\033[92m", "blue": "\033[94m", "yellow": "\033[93m",
        "red": "\033[91m", "bold": "\033[1m", "gray": "\033[90m", "reset": "\033[0m"
    }
    return f"{codes.get(color,'')}{text}{codes['reset']}"

def step(n, title): print(f"\n{c(f'[{n}단계]', 'yellow')} {c(title, 'bold')}")
def ok(msg):        print(f"  {c('✓', 'green')} {msg}")
def info(msg):      print(f"  {c('→', 'blue')} {msg}")
def box(title, content):
    print(f"\n{c('  ┌─ ' + title + ' ' + '─'*(40-len(title)) + '┐', 'gray')}")
    for line in content.strip().split("\n"):
        print(f"{c('  │', 'gray')} {line}")
    print(f"{c('  └' + '─'*43 + '┘', 'gray')}")


# ── 1단계: 위험 분류 ───────────────────────────────────────
def classify_risk(user_input: str) -> tuple[str, int]:
    """
    위험 유형 분류 + 게이지 수치(0~100) 반환
    반환: (risk_type, gauge_score)
    """
    info("GPT 프롬프트 기반 위험 유형 분류 중...")

    prompt = f"""다음 질문을 분석해서 위험 유형과 위험도를 판단해줘.

위험 유형 선택지: 윤리 / 보안 / 편향 / 오남용 / 안전
위험도: 0(완전 안전) ~ 100(매우 위험) 사이 정수

반드시 아래 JSON 형식으로만 답해. 다른 말 하지 마.
{{"risk_type": "위험유형", "score": 숫자, "reason": "한 줄 이유"}}

질문: {user_input}"""

    result, err = call_groq([{"role": "user", "content": prompt}], max_tokens=100)
    if not result:
        return "알 수 없음", 50

    # JSON 파싱
    try:
        # ```json ... ``` 감싸진 경우 처리
        text = result.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text.strip())
        return parsed["risk_type"], int(parsed["score"])
    except Exception:
        # 파싱 실패 시 텍스트에서 추출 시도
        for rt in ["윤리", "보안", "편향", "오남용", "안전"]:
            if rt in result:
                return rt, 70
        return "알 수 없음", 50


# ── 2단계: 의도 확인 질문 생성 ────────────────────────────
def generate_questions(user_input: str, risk_type: str) -> list[str]:
    """위험 유형에 맞는 의도 확인 질문 5개 생성"""
    info(f"HyperCLOVA X — [{risk_type}] 유형 맞춤 질문 생성 중...")

    prompt = f"""사용자가 다음 질문을 했어. 위험 유형은 '{risk_type}'야.

사용자 질문: {user_input}

이 질문의 의도를 파악하기 위한 확인 질문 5개를 만들어줘.
- 예/아니오로 답할 수 있는 질문
- 번호 없이 한 줄씩
- 다른 말 없이 질문만 출력"""

    result, model = call_clova(
        [{"role": "user", "content": prompt}],
        max_tokens=300
    )
    if not result:
        return ["이 정보를 학습 또는 연구 목적으로 사용하실 건가요?"]

    questions = [q.strip() for q in result.strip().split("\n") if q.strip()]
    return questions[:5]


# ── 3단계: 프롬프트 재구성 ────────────────────────────────
def reconstruct_prompt(
    user_input: str,
    risk_type: str,
    questions: list[str],
    answers: list[str]
) -> str:
    """의도 확인 답변을 바탕으로 안전 프롬프트 재구성"""
    info("HyperCLOVA X — 안전 프롬프트 재구성 중...")

    qa_text = "\n".join([f"Q: {q}\nA: {a}" for q, a in zip(questions, answers)])

    prompt = f"""사용자 원본 질문: {user_input}
위험 유형: {risk_type}

의도 확인 결과:
{qa_text}

위 맥락을 바탕으로 AI가 안전하게 답변할 수 있도록
아래 형식으로 최적화된 프롬프트를 작성해줘.

[페르소나] ...
[지식 범위] ...
[윤리 준수] ...
[맥락] ...
[질문] ..."""

    result, model = call_clova(
        [{"role": "user", "content": prompt}],
        max_tokens=400
    )
    return result or user_input


# ── 4단계: 최종 답변 생성 ────────────────────────────────
def generate_answer(safe_prompt: str) -> tuple[str, str]:
    """교정된 프롬프트로 최종 답변 생성"""
    info("HyperCLOVA X — 최종 답변 생성 중...")
    result, model = call_clova(
        [{"role": "user", "content": safe_prompt}],
        max_tokens=600
    )
    return result or "답변 생성 실패", model


# ── 교정 후 위험도 재산출 ────────────────────────────────
def recalculate_score(original_score: int, answers: list[str]) -> int:
    """
    사용자 답변 기반으로 교정 후 위험도 재산출 (0~100).
    '아니오'·부정적 답은 위험 완화로 더 크게 반영, 긍정(예/학습 목적 등)은 보조적으로 반영.
    """
    neg_count = sum(1 for a in answers if "아니오" in a or "없" in a or "no" in a.lower())
    pos_count = sum(1 for a in answers if "예" in a or "있" in a or "yes" in a.lower())
    reduction = (neg_count * 8) + (pos_count * 4)
    return max(0, min(100, original_score - reduction))


# ── 전체 파이프라인 실행 ──────────────────────────────────
def run_pipeline(user_input: str, user_answers: list[str] | None = None):
    print(f"\n{c('━'*55, 'blue')}")
    print(f"{c('  Safe Prompt 파이프라인', 'bold')}")
    print(f"{c('━'*55, 'blue')}")
    print(f"  {c('입력:', 'bold')} {user_input}")

    # 1단계: 위험 분류
    step(1, "위험 유형 분류")
    risk_type, gauge_before = classify_risk(user_input)
    ok(f"위험 유형: {c(risk_type, 'red')}  |  위험도 게이지(교정 전): {c(str(gauge_before), 'red')}/100")

    # 2단계: 질문 생성
    step(2, "의도 확인 질문 생성")
    questions = generate_questions(user_input, risk_type)
    ok(f"{len(questions)}개 질문 생성 완료")
    for i, q in enumerate(questions, 1):
        print(f"  {c(f'Q{i}.', 'gray')} {q}")

    # 3단계: 의도 확인 답변 수집
    step(3, "의도 확인 답변 (Human-in-the-Loop)")
    if user_answers is None:
        # 터미널 직접 입력 모드
        user_answers = []
        for i, q in enumerate(questions, 1):
            ans = input(f"  {c(f'Q{i}.', 'gray')} {q}\n  {c('답변:', 'green')} ").strip()
            user_answers.append(ans or "미응답")
    else:
        # 자동 답변 모드 (테스트용)
        for q, a in zip(questions, user_answers):
            print(f"  {c('Q.', 'gray')} {q}")
            print(f"  {c('A.', 'green')} {a}")

    # 4단계: 프롬프트 재구성
    step(4, "안전 프롬프트 재구성")
    safe_prompt = reconstruct_prompt(user_input, risk_type, questions, user_answers)
    ok("교정 프롬프트 생성 완료")
    box("교정된 프롬프트", safe_prompt)

    # 5단계: 최종 답변 생성
    step(5, "최종 답변 생성")
    answer, model_used = generate_answer(safe_prompt)

    # 교정 후 위험도 재산출
    gauge_after = recalculate_score(gauge_before, user_answers)

    # 결과 출력
    print(f"\n{c('━'*55, 'blue')}")
    print(f"{c('  최종 결과', 'bold')}")
    print(f"{c('━'*55, 'blue')}")
    print(f"  {c('사용 모델:', 'bold')} {model_used}")
    print(f"  {c('위험도 변화:', 'bold')} {c(str(gauge_before), 'red')}/100  →  {c(str(gauge_after), 'yellow')}/100  ({gauge_before - gauge_after} 감소)")
    box("최종 답변", answer)
    print(f"\n  {c('파이프라인 완료 ✓', 'green')}\n")

    return {
        "risk_type": risk_type,
        "gauge_before": gauge_before,
        "gauge_after": gauge_after,
        "questions": questions,
        "answers": user_answers,
        "safe_prompt": safe_prompt,
        "answer": answer,
        "model": model_used,
    }


# ── 실행 ─────────────────────────────────────────────────
if __name__ == "__main__":
    # 자동 답변 모드로 테스트 (터미널 입력 원하면 user_answers=None)
    result = run_pipeline(
        user_input="SQL 인젝션 공격 원리랑 실제 코드 예시 보여줘",
        user_answers=[
            "예, 보안 전공 대학원생입니다",
            "예, 수업 과제 목적입니다",
            "아니오, 실제 공격 의도 없습니다",
            "예, CTF 실습 환경에서 사용합니다",
            "아니오, 외부 배포 계획 없습니다",
        ]
    )
