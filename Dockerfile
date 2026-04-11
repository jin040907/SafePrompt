# Safe Prompt API — Railway / Render / Fly 등 컨테이너 배포용
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py pipeline.py start.sh ./
RUN chmod +x start.sh

ENV PORT=8000
EXPOSE 8000

# PORT 는 런타임에 환경 변수로 주입 (start.sh에서 읽음)
CMD ["./start.sh"]
