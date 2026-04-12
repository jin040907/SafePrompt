# 보안 정책 (Security Policy)

## 목적

이 저장소는 사용자 프롬프트와 LLM 응답을 다루며, 교육·연구·실무 등 **민감할 수 있는 주제**와 맞닿을 수 있습니다.  
본 문서는 **소프트웨어·인프라·설정상의 보안 취약점**을 책임 있게 신고·조치하기 위한 안내입니다.

---

## 신고 대상 (이 채널로 연락해 주세요)

다음에 해당하면 **비공개**로 알려 주시기 바랍니다.

- 인증·세션·API 키·환경 변수 노출, 권한 우회
- 서버·컨테이너·배포 설정 오류로 인한 데이터 유출 가능성
- CORS·헤더·TLS·의존성 취약점 등 **구현·운영과 직접 연결된** 기술적 문제
- 저장소·CI·비밀 관리와 관련된 유출 또는 오설정

### 신고 방법 (권장)

1. GitHub 저장소 상단 **Security** 탭 → **Report a vulnerability** (비공개 보안 권고)  
2. 또는 유지보수 담당자에게 **비공개 채널**(조직/팀에서 정한 보안 연락처)으로 같은 내용을 보내 주세요.

공개 이슈에는 **재현 절차·취약점 세부 내용을 올리지 마세요.** 먼저 비공개로 알려 주시면, 수정·배포 후 공개 범위를 함께 정할 수 있습니다.

---

## 이 문서의 신고 채널에 맞지 않는 경우

아래는 **보안 취약점 신고**와 성격이 다릅니다. 일반 **Issues** 또는 프로젝트에서 안내하는 피드백 경로를 이용해 주세요.

- 위험도 분류·게이지·재구성 문구 등 **모델·프롬프트 설계에 대한 의견**이나 오탐·미탐
- 특정 주제에 대한 **정책·윤리·교육적 판단**에 대한 논의
- 서비스 약관·법적 분쟁·긴급 법 집행 요청 (해당 시 공식 법적 절차를 따르십시오)

악의적 이용이나 안전 우려가 **즉각적이고 심각**하다고 판단되면, 플랫폼(GitHub 등)의 신고 기능과 현지 법·기관 안내를 병행하는 것을 권장합니다.

---

## 기대되는 응답

- 합리적인 범위에서 검토 후, 연락 가능한 경우 **수신 확인**을 드리겠습니다.
- 심각도에 따라 수정·배포 일정이 달라질 수 있으며, 공개 전 **조정된 공지**를 우선할 수 있습니다.

---

## 지원 버전

보안 수정은 일반적으로 **기본 브랜치(예: `main`)** 기준 최신 코드에 적용합니다.  
오래된 태그·포크는 개별적으로 맞춰야 할 수 있습니다.

---

## 영문 요약 (for security researchers)

**Safe Prompt** may handle sensitive user prompts and LLM outputs. This policy covers **technical vulnerabilities** in code, configuration, deployment, and credentials. Please report via **GitHub Security Advisories** (private) or your org’s security contact—**do not** file public issues with exploit details. **Product / AI-safety feedback** (classification accuracy, wording) belongs in regular Issues, not this channel.
