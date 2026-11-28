<p align="center">
  <img src="../public/pwa-192x192.png" alt="Mingyu Logo" width="76" height="76" />
</p>

<h1 align="center">Mingyu V2 · 命语 V2</h1>

<p align="center">
  <strong>观四时之命，译数术之语</strong> · <em>Observe the cycles of time, translate the language of divination.</em>
</p>

<p align="center">
  <strong>Open-source, deterministic 39-method Eastern &amp; Western metaphysics calculation engine and AI-prompt toolkit.</strong><br>
  BaZi · Zi Wei Dou Shu · Western Astrology · Qi Men Dun Jia · Da Liu Ren · I Ching / Liu Yao · Tarot · Feng Shui · Almanac
</p>

<p align="center">
  <a href="https://linux.do"><img alt="LINUX DO" src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?style=flat-square" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"><img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable_HTTP_%26_stdio-0891B2?style=flat-square" /></a>
  <a href="../LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" /></a>
  <a href="https://sydf.cc"><img alt="Online" src="https://img.shields.io/badge/Online_Workbench-sydf.cc-6D5ACF?style=flat-square" /></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> ·
  <a href="./README.zh-TW.md">繁體中文</a> ·
  <strong>English</strong> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 Web App (CN UI)</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 API Docs</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 AI API Guide (.md)</a> ·
  <a href="../skills/mingyu/SKILL.md">⚡ Agent Skill</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ Deploy to Cloudflare</strong></a>
</p>

> **Stop letting LLMs "hallucinate" birth charts and calendar math.**  
> Mingyu V2 separates **deterministic calculation** (astronomical ephemeris, solar terms, True Solar Time, historical DST, classical rule evidence) from **AI interpretation**. Code computes the exact chart and verified evidence; the generated `prompt.text` lets any LLM deliver accurate, grounded readings in **English or any target language** via `outputLanguage`.

---

## 🎯 How Mingyu Handles International Metaphysics Terminology

Rather than inventing awkward literal translations or opaque pinyin walls, `outputLanguage: "en"` follows established international conventions:
- **Standard international concepts**: `BaZi / Four Pillars`, `Day Master`, `Ten Gods` (`Direct Officer`, `Seven Killings`, `Direct/Indirect Wealth`, `Hurting Officer`, `Resource`), `10-Year Luck Pillars`, `Useful God`, `Life / Career / Wealth / Spouse Palace`, `Open / Rest / Life Gate`, `Eight Mansions`, `Xuan Kong Flying Stars`.
- **Proper nouns kept clear**: Specific stems, stars, and classical anchors preserve `Pinyin (汉字)` on first mention (e.g., `Jia Wood (甲木)`, `Zi Wei (紫微)`, `Hua Lu (化禄)`).
- **Deterministic chart data untouched**: Passing `outputLanguage` never mutates calculated JSON `data`; it cleanly instructs the interpreting model on language and mainstream terminology.

---

## ⚡ Quick Start (MCP, REST API, & Offline CLI)

> Note: The web workbench at [sydf.cc](https://sydf.cc) is currently in Simplified Chinese UI. For English or multilingual integrations, use **MCP**, the **HTTP REST API**, or the **offline Node.js CLI** with `outputLanguage: "en"` (or any language tag).

### 1. Remote MCP (Recommended for AI Agents)
Add the **Compact Router MCP** endpoint to Cursor, Claude Desktop, Claude Code, Windsurf, or Cherry Studio:
- **Compact Router Mode (Recommended, 4 tools, ~97% smaller context)**: `https://sydf.cc/mcp?mode=router`
  - Exposes `list_methods`, `get_method_schema`, `calculate` (defaults to `responseMode: "compact"`), and `reprompt` (stateless follow-up via `repromptToken`).
- **Full Tool Mode**: `https://sydf.cc/mcp`

### 2. HTTP REST API
- OpenAPI 3.1 Spec: `https://sydf.cc/openapi.json`
- AI-Readable Markdown Docs: `https://sydf.cc/api-docs.md`
- Interactive HTML Docs: `https://sydf.cc/api-docs`

```json
POST https://sydf.cc/api/calculate
{
  "method": "bazi",
  "responseMode": "compact",
  "outputLanguage": "en",
  "input": {
    "question": "How is my career outlook for next year?",
    "gender": "male",
    "birth": {
      "year": 1990, "month": 5, "day": 15,
      "clock": { "kind": "exact", "hour": 14, "minute": 30, "second": 0 },
      "timezone": 8
    }
  }
}
```

Follow up on the exact same chart/draw without re-casting:
```json
POST https://sydf.cc/api/prompt
{
  "repromptToken": "<token from calculate>",
  "question": "What should I focus on in Q3?"
}
```
> Omit `outputLanguage` on `reprompt` to inherit `"en"`, or pass a different language tag at any time to switch languages.

### 3. Agent Skill & Offline Single-File CLI
- Install skill into Claude Code / Codex / Cursor: `npx skills add Brhiza/mingyu`
- Or download the offline bundle (`/downloads/mingyu-skill.zip`, runs standalone on Node.js 20+):
  ```bash
  node scripts/mingyu.mjs methods
  node scripts/mingyu.mjs calculate bazi --lang en --input '{"question":"Career outlook?","gender":"male","birth":{"year":1990,"month":5,"day":15,"clock":{"kind":"exact","hour":14,"minute":30,"second":0},"timezone":8}}' --compact
  ```

---

## 🔮 All 39 Supported Methods

| Category | Method IDs | Highlights |
| :--- | :--- | :--- |
| **BaZi & Natal Destiny (7)** | `bazi`, `bazi-synastry`, `bazi-ziwei`, `bazi-reverse`, `minglu`, `fortune`, `instant` | True Solar Time & historical China DST, unknown-hour / range branch expansion, 362 *Qiongtong Baojian* climate rules, 57+50 Shensha, dual-system corroboration |
| **Zi Wei & Astrology (7)** | `ziwei`, `ziwei-synastry`, `qizheng`, `qizheng-range`, `astrolabe`, `astrolabe-range`, `astrolabe-synastry` | 55 Zi Wei patterns & Flying-Star Four Transformations, Qi Zheng Si Yu, 12 house systems, optional asteroids, Transits / Solar Return / Progressions, per-second birth-range scan |
| **Qi Men & Liu Ren (6)** | `qimen`, `qimen-lifetime`, `liuren`, `jinkoujue`, `xiaoliuren`, `taiyi` | Turning/Flying Plate Qi Men, Qi Men lifetime chart, Da Liu Ren Three Transmissions & Four Lessons, Jin Kou Jue, Xiao Liu Ren & Taiyi |
| **I Ching, Tarot & Divination (8)** | `liuyao`, `meihua`, `tarot`, `lenormand`, `random-divination`, `ssgw`, `zhuge`, `number-energy` | Liu Yao coin/yarrow/time casting, Tarot & Lenormand spreads, lossless `repromptToken` follow-ups, 92 Three Mountain Kings lots, 384 Zhuge Shenshu verses, Eight Stars number energy |
| **Feng Shui & Date Selection (5)** | `bazhai`, `xuankong`, `residential`, `almanac`, `calendar` | Eight Mansions & Xuan Kong Flying Stars with bearing-tolerance candidates, 180-day auspicious date selection with clash checks, 24 solar terms & lunar phases |
| **Naming & Classics (6)** | `chinese-name`, `chinese-naming`, `zhouyi`, `character-query`, `wuyun-liuqi`, `huangji-jingshi` | Five-Grid stroke analysis, complete *I Ching (Zhouyi)* + *Ten Wings* search, 4,096 *Jiaoshi Yilin* verses, 32-sharded *Kangxi* dictionary |

---

## 🚀 Self-Hosting & Local Development

- **One-Click Cloudflare Workers Deploy**: [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu) (set `ENABLED_METHODS` in [wrangler.jsonc](../wrangler.jsonc) and optional `ACCESS_TOKEN` secret for Bearer auth).
- **Local Setup** (Node.js `>= 22.12.0`, `pnpm 11.25.0`): `pnpm install --frozen-lockfile && pnpm dev`; full verification: `pnpm check:all`.
- **Examples & Docs**: [Node.js client](../examples/http-client.mjs) · [Python client](../examples/http_client.py) · [Agent Skill](../skills/mingyu/SKILL.md) · [Capability Baseline](./v2-capability-baseline.json)

---

## ⚖️ Disclaimer & License

Outputs and AI prompts are provided for cultural research and entertainment purposes only and do not constitute medical, psychological, legal, or financial advice.  
Code is licensed under the [MIT License](../LICENSE). Built-in third-party datasets follow their respective licenses ([Zhouyi Wikisource CC BY-SA 4.0](../src/data/zhouyi/README.md), [Caelus MIT](../src/systems/astronomy/README.md)).
