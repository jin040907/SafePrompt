# Safe Prompt API — Railway / Render / Fly 등 컨테이너 배포용
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py pipeline.py serve.py ./

ENV PORT=8000
EXPOSE 8000

# 셸 $PORT 미전개 환경 대비: serve.py 가 os.environ["PORT"] 사용
CMD ["python", "serve.py"]
