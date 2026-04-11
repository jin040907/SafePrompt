#!/usr/bin/env sh
set -e
# Railway/Render 등은 PORT 를 주입. 없으면 8000 (로컬 Docker).
PORT="${PORT:-8000}"
exec uvicorn server:app --host 0.0.0.0 --port "$PORT"
