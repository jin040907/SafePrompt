"""
Step 2. Safe Prompt 핵심 파이프라인
실행: python3 pipeline.py
"""

import json
import os
import re
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


def call_groq(messages, max_tokens=800, temperature: float | None = None):
    """Groq (Llama 3.3 70B) 호출"""
    t = 0.3 if temperature is None else temperature
    data, err = call_api(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {GROQ_API_KEY}"},
        {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": t,
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


def _parse_questions_from_model_text(text: str) -> list[str]:
    """
    모델이 한 줄에 '1. ... 2. ...' 형태로 주거나, 번호 없이 줄바꿈만 한 경우 모두 처리.
    """
    if not text or not str(text).strip():
        return []
    t = str(text).strip()
    if "```" in t:
        parts = t.split("```")
        inner = parts[1] if len(parts) >= 2 else t
        if inner.strip().startswith("json"):
            inner = inner.strip()[4:].strip()
        try:
            data = json.loads(inner)
            if isinstance(data, list):
                return [str(x).strip() for x in data if str(x).strip()][:5]
            if isinstance(data, dict) and "questions" in data:
                return [str(x).strip() for x in data["questions"] if str(x).strip()][:5]
        except (json.JSONDecodeError, TypeError):
            t = inner if "```" in text else t

    t = t.replace("\r\n", "\n")
    lines = [ln.strip() for ln in t.split("\n") if ln.strip()]

    if len(lines) == 1:
        blob = lines[0]
        chunks = re.split(r"(?<=[\?\!？!])\s+(?=\d+[\.\)]\s)", blob)
        if len(chunks) <= 1:
            chunks = re.split(r"\s+(?=\d+[\.\)]\s)", blob)
        if len(chunks) > 1:
            lines = [c.strip() for c in chunks if c.strip()]

    out: list[str] = []
    for ln in lines:
        ln = re.sub(r"^(?:질문\s*)?\d+[\.\)]\s*", "", ln, flags=re.IGNORECASE).strip()
        ln = re.sub(r"^[-•*]\s+", "", ln).strip()
        # 서두 제거 (모델이 한 줄 설명을 붙이는 경우)
        ln = re.sub(
            r"^(?:다음은|아래는|질문\s*\d*\s*[:\.]?|확인\s*질문\s*[:\.]?)\s*",
            "",
            ln,
            flags=re.IGNORECASE,
        ).strip()
        if ln:
            out.append(ln)

    # 한 줄에 물음표만 여러 개인 경우 (줄바꿈 없이 연속 질문)
    if len(out) == 1 and out[0].count("?") + out[0].count("？") >= 2:
        blob = out[0]
        split_q = re.split(r"(?<=[?？])\s+", blob)
        if len(split_q) > 1:
            out = [s.strip() for s in split_q if s.strip()]

    return out[:10]


def _split_questions_by_marks(raw: str) -> list[str]:
    """파싱 실패 시 물음표 기준으로 질문 후보 분리"""
    t = raw.strip()
    if not t:
        return []
    parts = re.split(r"(?<=[?？])\s+", t)
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if len(p) < 8:
            continue
        if not p.endswith(("?", "？")):
            p = p + "?"
        out.append(p)
    return out[:8]


def _groq_five_questions(user_input: str, risk_type: str) -> list[str] | None:
    prompt = f"""너는 AI 안전 검토를 돕는 조력자다.

사용자가 실제로 한 질문(원문):
\"\"\"{user_input}\"\"\"

위험 유형 분류: {risk_type}

위 **사용자 질문의 주제·목적**을 구체적으로 짚어서, 의도를 확인할 수 있는 질문을 정확히 5개 만들어라.
- 각 질문은 예/아니오로 답할 수 있어야 한다.
- **반드시 사용자 질문에 나온 주제·상황을 질문 안에 한 번 이상 반영**한다(똑같은 일반 문구만 5개 반복 금지).
- 한 줄에 질문 하나. 번호·글머리표·빈 줄 금지.
- 서두·설명·인사 없이 질문 다섯 줄만 출력한다."""
    result, _ = call_groq([{"role": "user", "content": prompt}], max_tokens=700)
    if not result:
        return None
    parsed = _parse_questions_from_model_text(result)
    if len(parsed) >= 5:
        return parsed[:5]
    if len(parsed) < 5:
        extra = _split_questions_by_marks(result)
        seen = {p.strip() for p in parsed}
        for e in extra:
            if e.strip() not in seen and e.strip():
                seen.add(e.strip())
                parsed.append(e.strip())
            if len(parsed) >= 5:
                break
    return parsed[:5] if len(parsed) >= 5 else (parsed if parsed else None)


def _merge_unique_questions(*lists: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for lst in lists:
        for q in lst:
            s = (q or "").strip()
            if not s or s in seen:
                continue
            seen.add(s)
            out.append(s)
            if len(out) >= 5:
                return out
    return out


def _dynamic_fallback_questions(user_input: str, risk_type: str) -> list[str]:
    """
    API 실패 시에만 사용. 사용자 원문·유형을 문장에 넣어 매번 다른 말이 되게 함.
    """
    s = re.sub(r"\s+", " ", user_input.strip())
    if len(s) > 100:
        s = s[:99] + "…"
    risk_note = {
        "보안": "보안·취약점 정보를 악용하지 않는 선에서",
        "윤리": "차별·편향을 조장하지 않는 선에서",
        "편향": "특정 집단에 대한 편견을 키우지 않는 선에서",
        "오남용": "금지된 용도로 쓰지 않는 선에서",
        "안전": "안전 수칙을 지키는 선에서",
    }.get(risk_type, "해당 분야의 윤리·정책을 지키는 선에서")

    return [
        f"지금 적으신 내용(「{s}」)에 대해, 합법적이고 윤리적으로 허용되는 범위에서 답을 얻으려는 것이 맞나요?",
        f"이 질문은 '{risk_type}' 유형으로 분류되었는데, {risk_note} 답변이 필요한 상황이 맞나요?",
        "악의적 이용·실제 피해·금지 행위를 목적으로 하지 않으십니까?",
        "교육·연구·업무 등 정당한 맥락에서만 이 내용을 활용할 계획이신가요?",
        "생성된 답을 무단 배포하거나 금지된 목적으로 재사용할 계획은 없으신가요?",
    ]


def _reconstruction_is_trivial(out: str, original: str) -> bool:
    a = (out or "").strip()
    b = (original or "").strip()
    if not a:
        return True
    if a == b:
        return True
    if len(a) < 60 and (a == b[: len(a)] or b in a or a in b):
        return True
    return False


def _fallback_safe_prompt(
    user_input: str,
    risk_type: str,
    questions: list[str],
    answers: list[str],
) -> str:
    qa = "\n".join(f"- {q} → {a}" for q, a in zip(questions, answers))
    return (
        f"[페르소나] {risk_type} 관련 질문에 대해 책임 있게 안내하는 조력자\n"
        f"[지식 범위] 일반·공개 수준의 정보, 악용·위법 조장 금지\n"
        f"[윤리 준수] 안전·정책을 준수할 것\n"
        f"[맥락] 사용자가 밝힌 의도:\n{qa}\n"
        f"[질문] {user_input.strip()}"
    )


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


def _clamp_dim(v: object) -> int | None:
    try:
        x = int(round(float(v)))  # type: ignore[arg-type]
        return max(1, min(10, x))
    except (TypeError, ValueError):
        return None


def _first_dim(parsed: dict, *keys: str) -> int | None:
    for k in keys:
        if k in parsed and parsed[k] is not None:
            v = _clamp_dim(parsed.get(k))
            if v is not None:
                return v
    return None


def _score_from_dimension_triple(parsed: dict) -> int | None:
    """
    세 축(각 1~10)으로 세분화해 0~100 단일 점수로 환산.
    모델이 한 숫자만 반복하는 현상을 줄이기 위함.
    """
    a = _first_dim(parsed, "d_topic", "topic")
    b = _first_dim(parsed, "d_misuse_if_wrong", "d_misuse", "misuse")
    c = _first_dim(parsed, "d_prompt_ambiguity", "d_ambiguity", "ambiguity")
    if a is None or b is None or c is None:
        return None
    # (10,10,10)→100, (1,1,1)→10 근처
    return max(0, min(100, int(round((a + b + c) / 30.0 * 100))))


def _parse_classify_llm_json(result: str) -> tuple[str, int] | None:
    """모델이 앞뒤 설명·마크다운을 섞어도 JSON 한 덩어리만 찾아 파싱."""
    raw = (result or "").strip()
    if not raw:
        return None

    candidates: list[str] = []
    if "```" in raw:
        for chunk in raw.split("```"):
            c = chunk.strip()
            if c.lower().startswith("json"):
                c = c[4:].lstrip()
            if c.startswith("{"):
                candidates.append(c)
    m = re.search(r"\{[\s\S]{2,2000}\}", raw)
    if m:
        candidates.append(m.group(0))
    candidates.append(raw)

    seen: set[str] = set()
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        try:
            parsed = json.loads(c)
            if not isinstance(parsed, dict):
                continue
            rt = str(parsed.get("risk_type", "")).strip()
            if not rt:
                continue
            dim_score = _score_from_dimension_triple(parsed)
            if dim_score is not None:
                return rt, dim_score
            if "score" in parsed:
                sc = int(parsed.get("score", 50))
                return rt, max(0, min(100, sc))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return None


# ── 1단계: 위험 분류 ───────────────────────────────────────
def classify_risk(user_input: str) -> tuple[str, int]:
    """
    위험 유형 분류 + 게이지 수치(0~100) 반환
    반환: (risk_type, gauge_score)
    """
    info("GPT 프롬프트 기반 위험 유형 분류 중...")

    prompt = f"""다음 사용자 질문을 분석해 위험 유형과 세 가지 하위 지표를 매겨라.

위험 유형(risk_type): 윤리 / 보안 / 편향 / 오남용 / 안전 중 하나

각 지표는 1(매우 낮음)~10(매우 높음) 정수:
- d_topic: 주제 자체의 민감도·정책상 민감도 (일반 교육·과학 요약은 낮게, 무기·해킹 실습은 높게)
- d_misuse_if_wrong: AI가 잘못 안내했을 때 실제 피해·악용 가능성
- d_prompt_ambiguity: 질문이 모호하거나 의도가 불분명한 정도

서로 다른 질문이면 세 숫자 조합도 달라야 한다(항상 비슷한 값만 주지 말 것).

반드시 아래 JSON 한 줄만 출력:
{{"risk_type":"…","d_topic":1-10,"d_misuse_if_wrong":1-10,"d_prompt_ambiguity":1-10,"reason":"한 줄"}}

질문: {user_input}"""

    result, err = call_groq(
        [{"role": "user", "content": prompt}],
        max_tokens=320,
        temperature=0.42,
    )
    if not result:
        return "알 수 없음", 50

    parsed = _parse_classify_llm_json(result)
    if parsed:
        return parsed

    for rt in ["윤리", "보안", "편향", "오남용", "안전"]:
        if rt in result:
            return rt, 70
    return "알 수 없음", 50


# ── 2단계: 의도 확인 질문 생성 ────────────────────────────
def generate_questions(user_input: str, risk_type: str) -> list[str]:
    """
    위험 유형에 맞는 의도 확인 질문 5개.
    배포 전과 같이 HyperCLOVA 우선 → 부족 시 Groq 보강 → 그래도 부족하면 동적 폴백.
    """
    info(f"의도 확인 질문 생성 — [{risk_type}] (HyperCLOVA → Groq → 폴백)")

    prompt = f"""사용자가 다음 질문을 했어. 위험 유형은 '{risk_type}'야.

사용자 질문: {user_input}

이 질문의 의도를 파악하기 위한 확인 질문 5개를 만들어줘.
- 사용자 질문에 나온 주제·상황을 질문 안에서 구체적으로 짚을 것(똑같은 일반 문구만 반복하지 말 것)
- 예/아니오로 답할 수 있는 질문
- 번호 없이 한 줄씩
- 다른 말 없이 질문만 출력"""

    result, model = call_clova(
        [{"role": "user", "content": prompt}],
        max_tokens=512,
    )
    clova_parsed: list[str] = _parse_questions_from_model_text(result) if result else []

    if len(clova_parsed) >= 5:
        return clova_parsed[:5]

    gq = _groq_five_questions(user_input, risk_type)
    merged = _merge_unique_questions(clova_parsed, gq or [])
    if len(merged) >= 5:
        return merged[:5]

    merged = _merge_unique_questions(merged, _dynamic_fallback_questions(user_input, risk_type))
    return merged[:5]


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
        max_tokens=700,
    )
    text = (result or "").strip()
    if text and not _reconstruction_is_trivial(text, user_input):
        return text

    r2, _ = call_groq([{"role": "user", "content": prompt}], max_tokens=900)
    text2 = (r2 or "").strip()
    if text2 and not _reconstruction_is_trivial(text2, user_input):
        return text2

    return _fallback_safe_prompt(user_input, risk_type, questions, answers)


# ── 4단계: 최종 답변 생성 ────────────────────────────────
def generate_answer(safe_prompt: str) -> tuple[str, str]:
    """교정된 프롬프트로 최종 답변 생성"""
    info("HyperCLOVA X — 최종 답변 생성 중...")
    result, model = call_clova(
        [{"role": "user", "content": safe_prompt}],
        max_tokens=600
    )
    return result or "답변 생성 실패", model


def _mitigation_strength(answers: list[str]) -> float:
    """
    의도 확인 답변에서 합법·비악의·교육 맥락을 0~1 로 추정.
    줄마다 따로 세어, 여러 줄에 '예'만 적어도 가산되게 한다(전체 blob 한 번만 보던 버그 방지).
    """
    if not answers:
        return 0.0

    safe_kw = (
        "학습",
        "교육",
        "연구",
        "과제",
        "수업",
        "실습",
        "업무",
        "보고",
        "대학",
        "고등",
        "합법",
        "내부",
        "ctf",
        "보안 전공",
        "시험",
        "레포트",
    )
    benign_kw = (
        "아니요",
        "아니오",
        "없습니다",
        "없음",
        "악의",
        "악의 없",
        "배포 안",
        "배포하지",
        "불법 아님",
        "금지된 목적",
        "no malicious",
    )
    ack_kw = ("네", "예", "응", "맞", "그렇", "yes", "맞습니다", "그렇습니다")

    pts = 0.0
    for raw in answers:
        s = (raw or "").strip().lower()
        if not s:
            continue
        for k in safe_kw:
            if k in s:
                pts += 2.6
        for k in benign_kw:
            if k in s:
                pts += 3.0
        for k in ack_kw:
            if k in s:
                pts += 2.0

    return max(0.0, min(1.0, pts / 42.0))


# ── 교정 후 위험도 재산출 ────────────────────────────────
def recalculate_score(original_score: int, answers: list[str]) -> int:
    """
    사용자 답변 기반으로 교정 후 위험도 재산출 (0~100).

    - 답변을 줄 단위로 반영해 완화 강도 m 을 잡고,
    - 의도 확인에 참여한 줄 수만큼 '참여 보너스'를 더해 교정 효과가 드러나게 함,
    - 원점수가 클수록(민감할수록) 절대 감소폭을 키워 교정 전·후 차이가 두드러지게 함.
    """
    m = _mitigation_strength(answers)
    n_lines = sum(1 for a in answers if (a or "").strip())
    # 질문 5개에 맞춰 답한 만큼 기본 완화(내용이 짧아도 참여 자체 반영)
    participation = min(0.38, 0.072 * n_lines)
    m_eff = min(1.0, m + participation)

    if original_score <= 0:
        return 0

    # 감소 비율: 기본 10% + (완화에 비례 최대 ~58%) — 민감한 원점수일수록 추가 가중
    tier_boost = 0.55 + 0.45 * (original_score / 100.0)
    drop_ratio = (0.10 + 0.58 * m_eff) * tier_boost
    drop_ratio = min(0.92, drop_ratio)

    raw_after = int(round(original_score * (1.0 - drop_ratio)))

    # 의도 확인을 충분히 했는데도 차이가 너무 작으면 최소 감소폭 보장
    if n_lines >= 3 and original_score >= 22:
        min_drop = max(9, int(original_score * 0.16))
        cap_after = original_score - min_drop
        raw_after = min(raw_after, cap_after)

    return max(0, min(100, raw_after))


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
