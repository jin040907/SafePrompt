"""
프로덕션 진입점 — Railway/Render 등이 설정하는 PORT 를 Python에서 직접 읽습니다.
(셸에서 $PORT 가 uvicorn 에 문자 그대로 넘어가는 문제 회피)
"""
import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
