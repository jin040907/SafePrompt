"""
Groq·HyperCLOVA HTTP 연결 스모크 테스트 (저장소 루트 `.env`의 키 사용).
`GROQ_MODEL`, `CLOVA_COMPLETIONS_URL`은 `pipeline.py`와 동일하게 지원합니다.
실행: python3 test_api.py
"""

import urllib.request
import urllib.error
import json
import os
import ssl
from pathlib import Path

def _load_env_file():
    """프로젝트 루트의 .env를 읽어 os.environ에 반영 (python-dotenv 없이)."""
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

_load_env_file()

def _ssl_context():
    """macOS 등에서 기본 CA 경로가 비어 있을 때 certifi 번들로 검증.
    SSL 오류가 나면: pip3 install certifi
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()

GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
CLOVA_API_KEY = os.getenv("CLOVA_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip() or "llama-3.3-70b-versatile"
CLOVA_COMPLETIONS_URL = os.getenv(
    "CLOVA_COMPLETIONS_URL",
    "https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005",
).strip() or "https://clovastudio.stream.ntruss.com/testapp/v3/chat-completions/HCX-005"

def c(text, color):
    codes = {"green":"\033[92m","red":"\033[91m","bold":"\033[1m","reset":"\033[0m"}
    return f"{codes[color]}{text}{codes['reset']}"

# urllib 기본 User-Agent는 봇으로 차단되는 경우가 있어(Groq·Cloudflare 1010 등) 일반 클라이언트처럼 보냄
_DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

def call_api(url, headers, body):
    payload = json.dumps(body, ensure_ascii=True).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_unredirected_header("Content-Type", "application/json")
    req.add_unredirected_header("Content-Length", str(len(payload)))
    req.add_unredirected_header("User-Agent", _DEFAULT_UA)
    for k, v in headers.items():
        req.add_unredirected_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}"
    except Exception as e:
        return None, str(e)

# Groq 테스트
print(f"\n{c('[ Groq API ]', 'bold')}")
data, err = call_api(
    "https://api.groq.com/openai/v1/chat/completions",
    {"Authorization": f"Bearer {GROQ_API_KEY}"},
    {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": "Say hello in one sentence."}],
        "max_tokens": 50,
    }
)
if data:
    print(f"  {c('OK', 'green')} {data['choices'][0]['message']['content']}")
else:
    print(f"  {c('FAIL', 'red')} {err}")

# HyperCLOVA X 테스트
print(f"\n{c('[ HyperCLOVA X API ]', 'bold')}")
data, err = call_api(
    CLOVA_COMPLETIONS_URL,
    {"Authorization": f"Bearer {CLOVA_API_KEY}"},
    {
        "messages": [{"role": "user", "content": "Say hello in one sentence."}],
        "maxTokens": 50,
    }
)
if data:
    print(f"  {c('OK', 'green')} {data['result']['message']['content']}")
else:
    print(f"  {c('FAIL', 'red')} {err}")

print()