<p align="center">
  <img src="../public/pwa-192x192.png" alt="Mingyu Logo" width="76" height="76" />
</p>

<h1 align="center">命語 V2 · Mingyu V2</h1>

<p align="center">
  <strong>观四时之命，译数术之语</strong> · <em>四時の命を観じ、数術の語を訳す</em>
</p>

<p align="center">
  <strong>オープンソース・ローカル実行可能な 39 種類の東洋・西洋占術計算エンジン＆ AI プロンプト基盤。</strong><br>
  四柱推命（八字） · 紫微斗数 · 西洋占星術 · 奇門遁甲 · 大六壬 · 周易・六爻 · タロット · 風水 · 択日・暦法
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
  <strong>日本語</strong> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 Web 版 (中国語 UI)</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 API ドキュメント</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 AI 向け仕様 (.md)</a> ·
  <a href="../skills/mingyu/SKILL.md">⚡ Agent Skill</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ Cloudflare にワンクリック配備</strong></a>
</p>

> **LLM に命式・ホロスコープを「暗算」させないための決定論的占術エンジン。**  
> 命語 V2 は、節入り時刻・真太陽時・サマータイム補正・天文天体暦・古典ルール根拠層をプログラムで厳密に計算し、そのまま任意の AI に渡せる高品質なプロンプト（`prompt.text`）を生成します。API / MCP / CLI で `outputLanguage: "ja"` を指定すれば、**日本の四柱推命・紫微斗数・西洋占星術の標準用語に沿った日本語鑑定**をそのまま出力できます。

---

## ⚡ クイックスタート（MCP / REST API / CLI）

> 注：Web ワークベンチ（[sydf.cc](https://sydf.cc)）の画面 UI は現在簡体字中国語ですが、**MCP / HTTP REST API / オフライン CLI** では `outputLanguage: "ja"` を指定して日本語で完結した運用が可能です。

### 1. リモート MCP（AI エージェント連携推奨）
Cursor・Claude Desktop・Claude Code・Windsurf 等に以下のエンドポイントを追加してください：
- **ルーターモード（推奨・コア 4 ツールのみでトークン約 97% 削減）**：`https://sydf.cc/mcp?mode=router`
- **フルツールモード**：`https://sydf.cc/mcp`

### 2. HTTP REST API 呼び出し例
```json
POST https://sydf.cc/api/calculate
{
  "method": "bazi",
  "responseMode": "compact",
  "outputLanguage": "ja",
  "input": {
    "question": "来年の仕事運と転職のタイミングを知りたいです",
    "gender": "male",
    "birth": {
      "year": 1990, "month": 5, "day": 15,
      "clock": { "kind": "exact", "hour": 14, "minute": 30, "second": 0 },
      "timezone": 9
    }
  }
}
```

同じ命式・卦のまま追加質問する場合（再占・再描画なし）：
```json
POST https://sydf.cc/api/prompt
{
  "repromptToken": "<初回 calculate で返却されたトークン>",
  "question": "特に注意すべき月と行動指針は？"
}
```

### 3. Agent Skill ＆ オフライン CLI
- スキル追加：`npx skills add Brhiza/mingyu`
- オフライン単一ファイル CLI（`/downloads/mingyu-skill.zip`、Node.js 20+ 対応）：
  ```bash
  node scripts/mingyu.mjs calculate ziwei --lang ja --input '...' --compact
  ```

---

## 🔮 対応する全 39 種類の占術・暦法

| カテゴリ | メソッド ID | 主な機能 |
| :--- | :--- | :--- |
| **命理・相性 (7)** | `bazi`, `bazi-synastry`, `bazi-ziwei`, `bazi-reverse`, `minglu`, `fortune`, `instant` | 四柱推命（節入り厳密計算・真太陽時・調候用神 362 則・神殺 57+50 種）、八字＋紫微クロス鑑定、出生時刻不明時の候補分岐展開 |
| **紫微・占星術 (7)** | `ziwei`, `ziwei-synastry`, `qizheng`, `qizheng-range`, `astrolabe`, `astrolabe-range`, `astrolabe-synastry` | 紫微斗数（55 格局・飛星四化）、七政四余、西洋占星術（12 ハウスシステム、トランジット・太陽回帰・プログレス・ソーラーアーク）、秒単位出生範囲スキャン |
| **奇門・六壬 (6)** | `qimen`, `qimen-lifetime`, `liuren`, `jinkoujue`, `xiaoliuren`, `taiyi` | 奇門遁甲（転盤・飛盤・終身局）、大六壬（三伝四課）、金口訣、小六壬、太乙神数 |
| **易占・カード・霊籤 (8)** | `liuyao`, `meihua`, `tarot`, `lenormand`, `random-divination`, `ssgw`, `zhuge`, `number-energy` | 六爻占術・梅花易数、`repromptToken` による原盤保持再質問、タロット＆ルノルマン（正逆位対応）、三山国王霊籤 92 首、諸葛神数 384 籤、八星数字エネルギー |
| **風水・択日・暦法 (5)** | `bazhai`, `xuankong`, `residential`, `almanac`, `calendar` | 八宅・玄空飛星（方位誤差許容候補展開）、180 日吉日選定（参加者干支の沖剋回避）、二十四節気・月相・均時差・真太陽時 |
| **姓名・古典 (6)** | `chinese-name`, `chinese-naming`, `zhouyi`, `character-query`, `wuyun-liuqi`, `huangji-jingshi` | 漢字画数・五行バランス、`周易` 64 卦＋十翼・焦氏易林 4096 則・康熙字典 32 分割検索、五運六気・皇極経世 |

---

## 🚀 セルフホスト ＆ 開発

- **Cloudflare Workers 配備**：[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu)（[wrangler.jsonc](../wrangler.jsonc) で `ENABLED_METHODS` や `ACCESS_TOKEN` を設定可能）。
- **ローカル検証**（Node.js `>= 22.12.0`、`pnpm 11.25.0`）：`pnpm install --frozen-lockfile && pnpm dev` / 全量テスト：`pnpm check:all`。
- **サンプル＆仕様**：[Node.js](../examples/http-client.mjs) · [Python](../examples/http_client.py) · [Agent Skill](../skills/mingyu/SKILL.md) · [Capability Baseline](./v2-capability-baseline.json)

---

## ⚖️ 免責事項・ライセンス

本ツールによる算出結果および AI プロンプトは伝統文化研究・娯楽目的の参考情報であり、医療・心理・法律・投資等の専門的助言に代わるものではありません。  
ソースコードは [MIT License](../LICENSE) で公開されています（同梱データ：[周易 Wikisource CC BY-SA 4.0](../src/data/zhouyi/README.md)、[Caelus MIT](../src/systems/astronomy/README.md)）。
