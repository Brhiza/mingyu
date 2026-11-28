<p align="center">
  <img src="../public/pwa-192x192.png" alt="命語 Logo" width="76" height="76" />
</p>

<h1 align="center">命語 V2 · Mingyu V2</h1>

<p align="center">
  <strong>觀四時之命，譯數術之語</strong>
</p>

<p align="center">
  開源、純本機可執行、全鏈路可核驗的 <strong>39 項術數排盤引擎</strong>與 <strong>AI 提示詞工作台</strong>。<br>
  八字 · 紫微斗數 · 西洋星盤 · 七政四餘 · 奇門遁甲 · 大六壬 · 六爻 · 梅花 · 塔羅 · 擇日風水 · 姓名典籍
</p>

<p align="center">
  <a href="https://linux.do"><img alt="LINUX DO" src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?style=flat-square" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://modelcontextprotocol.io/specification/2025-06-18/basic/transports"><img alt="MCP" src="https://img.shields.io/badge/MCP-Streamable_HTTP_%26_stdio-0891B2?style=flat-square" /></a>
  <a href="../LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-22C55E?style=flat-square" /></a>
  <a href="https://sydf.cc"><img alt="Online" src="https://img.shields.io/badge/線上工作台-sydf.cc-6D5ACF?style=flat-square" /></a>
</p>

<p align="center">
  <a href="../README.md">简体中文</a> ·
  <strong>繁體中文</strong> ·
  <a href="./README.en.md">English</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 線上使用</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 API 完整文件</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 AI 專用文件 (.md)</a> ·
  <a href="../skills/mingyu/SKILL.md">⚡ Agent Skill 說明</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ 一鍵部署至 Cloudflare</strong></a>
</p>

> **別再讓大型語言模型「心算」你的命盤，也無須折騰繁複的介面設定。**  
> 命語 V2 將 **39 項東方與西洋術數**、獨立天文曆法引擎與古籍規則證據層，直接轉化為**開箱即用的高品質預設 AI 任務提示詞**。所有核心排盤皆在瀏覽器本機或無狀態服務中確定性運算；同時提供 HTTP REST API、遠端 MCP 與離線單檔 CLI，可透過 `outputLanguage`（如 `"zh-TW"`）讓 AI 直接以道地繁體中文與港台常用術數用語解讀。

---

## ⚡ 快速上手

### 方式 1：線上工作台（[sydf.cc](https://sydf.cc)）
> 註：目前線上網頁介面為簡體中文顯示；若需純繁體中文解讀，可於網頁複製提示詞後請 AI 以繁體中文回覆，或透過下方 API / MCP / CLI 傳入 `"outputLanguage": "zh-TW"`。

開啟 **[sydf.cc](https://sydf.cc)**，免註冊、免 API Key，所有核心計算直接在瀏覽器本機完成：
1. 輸入出生資料或所問之事，即時產出結構化命盤與分節報告；
2. 一鍵複製提示詞，貼給手邊任意 AI（ChatGPT、Claude、DeepSeek、Gemini 等）即可取得有依據、有考時邊界、不胡編亂造的專業解讀。

### 方式 2：為 AI 助手安裝命語 Skill / 串接遠端 MCP（推薦繁體與跨語種使用者）

- **安裝 Agent Skill（支援 Claude Code、Codex、Cursor 等）**：
  ```bash
  npx skills add Brhiza/mingyu
  ```
- **精簡路由遠端 MCP（推薦，僅 4 個核心工具，節省約 97% Token）**：
  `https://sydf.cc/mcp?mode=router`
- **全量工具模式**：`https://sydf.cc/mcp`
- **離線單檔 Skill 壓縮包（可斷網於 Node.js 執行）**：`/downloads/mingyu-skill.zip`

呼叫 `/api/calculate`、MCP `calculate` 或 CLI 時，加上 `"outputLanguage": "zh-TW"`（或 `"zh-HK"`）即可輸出符合台港習慣的繁體中文解讀指示（如紫微斗數之化祿／化權／化科／化忌、四柱八字之正官／七殺、陽宅風水等），且**不會改動任何底層排盤數據**。

---

## 🔮 完整 39 項能力目錄

| 分類 | 包含術數與工具 ID | 核心能力 |
| :--- | :--- | :--- |
| **命理合參 (7 項)** | `bazi`（八字）、`bazi-synastry`（八字合盤）、`bazi-ziwei`（八字紫微合參）、`bazi-reverse`（四柱反推）、`minglu`（個人命錄）、`fortune`（流運運勢）、`instant`（即時起盤） | 公農曆與真太陽時換算、未知時辰與時間範圍候選展開、362 條《窮通寶鑑》調候規則、57+50 項神煞、雙系統互證與多體系命錄 |
| **紫微星象 (7 項)** | `ziwei`（紫微斗數）、`ziwei-synastry`（紫微合盤）、`qizheng`（七政四餘）、`qizheng-range`（七政出生範圍）、`astrolabe`（西洋星盤）、`astrolabe-range`（星盤出生範圍）、`astrolabe-synastry`（西洋合盤） | 紫微 55 格局與飛星四化（含離心自化與對宮集祿集忌）、七政流曜與洞微行限、12 種宮位制、4 顆小行星按需載入、逐秒出生範圍掃描 |
| **奇門六壬 (6 項)** | `qimen`（奇門遁甲）、`qimen-lifetime`（奇門終身局）、`liuren`（大六壬）、`jinkoujue`（金口訣）、`xiaoliuren`（小六壬）、`taiyi`（太乙神數） | 轉盤／飛盤奇門與經典格局應期、奇門終身局、大六壬三傳四課與行年、金口訣陰陽五用、小六壬與太乙推演 |
| **占卜靈籤 (8 項)** | `liuyao`（六爻）、`meihua`（梅花易數）、`tarot`（塔羅）、`lenormand`（雷諾曼）、`random-divination`（隨機起卦）、`ssgw`（三山國王靈籤）、`zhuge`（諸葛神數）、`number-energy`（數字能量） | 六爻時間／銅錢／蓍草／手工起卦與 `repromptToken` 原盤免重排追問、塔羅與雷諾曼牌陣、揭西祖廟 92 籤、諸葛神數 384 籤、號碼八星磁場解析 |
| **風水擇日 (5 項)** | `bazhai`（八宅）、`xuankong`（玄空飛星）、`residential`（陽宅風水）、`almanac`（黃曆擇日）、`calendar`（曆法天文） | 二十四山坐山誤差候選、下卦／替卦兼向、180 天擇日分頁與民俗神煞、24 節氣精確瞬時、月相與真太陽時 |
| **姓名典籍 (6 項)** | `chinese-name`（姓名分析）、`chinese-naming`（中文起名）、`zhouyi`（周易經文）、`character-query`（康熙字庫）、`wuyun-liuqi`（五運六氣）、`huangji-jingshi`（皇極經世） | 五格三才與五行喜用參考、《周易》64 卦及《十翼》檢索、4096 條《焦氏易林》、32 分片康熙字庫 |

---

## 🛠️ HTTP REST API 與 CLI 使用範例

```json
POST https://sydf.cc/api/calculate
{
  "method": "ziwei",
  "responseMode": "compact",
  "outputLanguage": "zh-TW",
  "input": {
    "question": "請分析明年事業發展與注意事項",
    "gender": "female",
    "birth": {
      "year": 1994, "month": 8, "day": 12,
      "clock": { "kind": "exact", "hour": 10, "minute": 20, "second": 0 },
      "timezone": 8
    }
  }
}
```

- 回傳精簡結果包含 `summary`、`prompt.text` 與 `repromptToken`；追問時將 `repromptToken` 與新 `question` 送至 `POST /api/prompt` 即可延續原盤與原語言設定，不重排、不重抽。
- 本機離線 CLI：
  ```bash
  node scripts/mingyu.mjs calculate ziwei --lang zh-TW --input '...' --compact
  ```
- 完整介面規格請參閱 `/api-docs`、`/api-docs.md`、`/openapi.json` 及 [Node.js 範例](../examples/http-client.mjs) / [Python 範例](../examples/http_client.py)。

---

## 🚀 私有部署與本機開發

- **一鍵部署至 Cloudflare Workers**：[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu)（可於 [wrangler.jsonc](../wrangler.jsonc) 與 `ACCESS_TOKEN` 設定存取權限與開放術數）。
- **本機環境**（Node.js `>= 22.12.0`、`pnpm 11.25.0`）：`pnpm install --frozen-lockfile && pnpm dev`；驗收：`pnpm check:all`。
- **相關文件**：[Agent Skill 說明](../skills/mingyu/SKILL.md) · [能力基線清單](./v2-capability-baseline.json)

---

## ⚖️ 免責聲明與授權

本工具提供之排盤結果與 AI 提示詞僅供傳統文化研究與休閒參考，不構成醫療、心理、法律、投資等專業建議。  
程式碼採用 [MIT](../LICENSE) 授權；第三方資料（[周易維基文庫 CC BY-SA 4.0](../src/data/zhouyi/README.md)、[Caelus MIT](../src/systems/astronomy/README.md)）各自依原授權條款釋出。
