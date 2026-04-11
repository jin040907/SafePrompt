# Safe Prompt API — Railway / Render / Fly 등 컨테이너 배포용
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py pipeline.py ./

ENV PORT=8000
EXPOSE 8000

# 플랫폼이 주입하는 PORT 로 수신 (Railway, Render 등)
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
