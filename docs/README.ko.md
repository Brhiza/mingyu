<p align="center">
  <img src="../public/pwa-192x192.png" alt="Mingyu Logo" width="76" height="76" />
</p>

<h1 align="center">밍위 V2 · Mingyu V2 / 命语 V2</h1>

<p align="center">
  <strong>观四时之命，译数术之语</strong> · <em>사시(四時)의 명을 살피고, 수술(數術)의 언어를 옮기다</em>
</p>

<p align="center">
  <strong>오픈소스·로컬 실행 가능한 39종 동서양 명리·점성·주역 만세력 계산 엔진 및 AI 프롬프트 툴킷.</strong><br>
  사주팔자 · 궁합 · 자미두수 · 서양 점성술 · 기문둔갑 · 대육임 · 주역/육효 · 타로 · 풍수 · 택일
</p>

<p align="center">
  <a href="https://linux.do"><img alt="LINUX DO" src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?style=flat-square" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"><img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable_HTTP_%26_stdio-0891B2?style=flat-square" /></a>
  <a href="../LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" /></a>
  <a href="https://sydf.cc"><img alt="Online" src="https://img.shields.io/badge/Web-sydf.cc-6D5ACF?style=flat-square" /></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> ·
  <a href="./README.zh-TW.md">繁體中文</a> ·
  <a href="./README.en.md">English</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <strong>한국어</strong> ·
  <a href="./README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 웹 워크벤치 (중국어 UI)</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 API 문서</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 AI용 문서 (.md)</a> ·
  <a href="../skills/mingyu/SKILL.md">⚡ Agent Skill</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ Cloudflare 원클릭 배포</strong></a>
</p>

> **LLM에게 사주 간지나 절입 시각을 '암산'시키지 마세요.**  
> 밍위 V2는 절기 정밀 시각, 진태양시 보정, 서머타임, 천문역법, 고전 규칙 근거를 코드로 결정론적으로 계산한 뒤 AI가 바로 해석할 수 있는 프롬프트(`prompt.text`)를 생성합니다. API / MCP / CLI 호출 시 `outputLanguage: "ko"`를 지정하면 **한국 명리학·자미두수·점성술 표준 용어(일간·십성·대운·세운·용신 등)에 맞춘 자연스러운 한국어 풀이**를 받을 수 있습니다.

---

## ⚡ 빠른 시작 (MCP / REST API / CLI)

> 참고: 웹 화면([sydf.cc](https://sydf.cc)) UI는 현재 간체 중국어로 제공됩니다. 한국어 서비스 및 AI 에이전트 연동에는 **MCP / HTTP REST API / 오프라인 CLI**에서 `"outputLanguage": "ko"` 옵션을 사용하세요.

### 1. 원격 MCP 연결 (AI 에이전트 권장)
Cursor, Claude Desktop, Claude Code, Windsurf 등에서 아래 주소를 등록하세요:
- **라우터 모드 (권장 · 핵심 4개 도구로 토큰 약 97% 절감)**: `https://sydf.cc/mcp?mode=router`
- **전체 도구 모드**: `https://sydf.cc/mcp`

### 2. HTTP REST API 요청 예시
```json
POST https://sydf.cc/api/calculate
{
  "method": "bazi",
  "responseMode": "compact",
  "outputLanguage": "ko",
  "input": {
    "question": "내년 직장운과 이직 시기가 궁금합니다",
    "gender": "female",
    "birth": {
      "year": 1992, "month": 3, "day": 15,
      "clock": { "kind": "exact", "hour": 14, "minute": 30, "second": 0 },
      "timezone": 9
    }
  }
}
```

같은 명반/점괘에 대해 이어서 질문할 때 (재추첨 없이 토큰 절약):
```json
POST https://sydf.cc/api/prompt
{
  "repromptToken": "<calculate 응답의 repromptToken>",
  "question": "하반기 연애운과 재물운은 어떤가요?"
}
```

### 3. Agent Skill 및 오프라인 CLI
- 스킬 설치: `npx skills add Brhiza/mingyu`
- 오프라인 단일 파일 CLI (`/downloads/mingyu-skill.zip`, Node.js 20+):
  ```bash
  node scripts/mingyu.mjs calculate bazi-synastry --lang ko --input '...' --compact
  ```

---

## 🔮 지원하는 전체 39개 메서드

| 분류 | 메서드 ID | 핵심 기능 |
| :--- | :--- | :--- |
| **사주·명리·합참 (7)** | `bazi`, `bazi-synastry`, `bazi-ziwei`, `bazi-reverse`, `minglu`, `fortune`, `instant` | 만세력·진태양시·야자시/조자시 및 시진 미상 후보 분기, 궁통보감 362조 조후 규칙, 신살 57+50종, 사주 궁합(`bazi-synastry`), 사주+자미 교차 검증 |
| **자미·서양점성·칠정 (7)** | `ziwei`, `ziwei-synastry`, `qizheng`, `qizheng-range`, `astrolabe`, `astrolabe-range`, `astrolabe-synastry` | 자미두수 55격국 및 비성 사화, 칠정사여, 서양 점성술 12 하우스 시스템(트랜짓/솔라 리턴/세컨더리/솔라 아크), 초 단위 출생 시간대 스캔 |
| **기문·육임·삼식 (6)** | `qimen`, `qimen-lifetime`, `liuren`, `jinkoujue`, `xiaoliuren`, `taiyi` | 기문둔갑(전반/비반/종신국), 대육임, 금구결, 소육임, 태을신수 |
| **주역점·타로·영첨 (8)** | `liuyao`, `meihua`, `tarot`, `lenormand`, `random-divination`, `ssgw`, `zhuge`, `number-energy` | 육효(시간·동전·시초·수동), 매화역수, `repromptToken` 무손실 추가 질문, 타로/레노먼드 정·역방향 스프레드, 삼산국왕 영첨 92수, 제갈신수 384수, 숫자 에너지 |
| **풍수·택일·역법 (5)** | `bazhai`, `xuankong`, `residential`, `almanac`, `calendar` | 팔택/현공비성 방위 오차 후보 계산, 180일 황력 길일 택일(참여자 충살 회피), 24절기·월상·진태양시 |
| **성명·고전 (6)** | `chinese-name`, `chinese-naming`, `zhouyi`, `character-query`, `wuyun-liuqi`, `huangji-jingshi` | 한자 획수·오행 분석, 주역 64괘·십익·초씨역림 4096조·강희자전 32분할 검색, 오운육기·황극경세 |

---

## 🚀 자체 호스팅 및 로컬 개발

- **Cloudflare Workers 원클릭 배포**: [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu) ([wrangler.jsonc](../wrangler.jsonc) 및 `ACCESS_TOKEN` 설정 지원).
- **로컬 개발** (Node.js `>= 22.12.0`, `pnpm 11.25.0`): `pnpm install --frozen-lockfile && pnpm dev` / 전체 검증: `pnpm check:all`.
- **예제 및 문서**: [Node.js](../examples/http-client.mjs) · [Python](../examples/http_client.py) · [Agent Skill](../skills/mingyu/SKILL.md) · [Capability Baseline](./v2-capability-baseline.json)

---

## ⚖️ 면책 조항 및 라이선스

본 도구의 계산 결과와 AI 프롬프트는 전통문화 연구 및 엔터테인먼트 참고용이며, 의료·심리·법률·투자 등 전문 자문을 대체하지 않습니다.  
코드는 [MIT License](../LICENSE)를 따릅니다 ([주역 위키문헌 CC BY-SA 4.0](../src/data/zhouyi/README.md), [Caelus MIT](../src/systems/astronomy/README.md)).
