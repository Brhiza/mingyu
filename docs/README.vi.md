<p align="center">
  <img src="../public/pwa-192x192.png" alt="Mingyu Logo" width="76" height="76" />
</p>

<h1 align="center">Mingyu V2 · 命语 V2</h1>

<p align="center">
  <strong>观四时之命，译数术之语</strong> · <em>Quan sát vận mệnh bốn mùa, chuyển ngữ học thuật số thuật</em>
</p>

<p align="center">
  <strong>Công cụ an sao, tính toán thiên văn – lịch pháp 39 bộ môn Đông &amp; Tây phương mã nguồn mở, tối ưu cho AI.</strong><br>
  Tử Vi Đẩu Số · Bát Tự (Tứ Trụ) · Chiêm Tinh Phương Tây · Kỳ Môn Độn Giáp · Kinh Dịch / Lục Hào · Tarot · Phong Thủy · Xem Ngày Tốt
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
  <a href="./README.ko.md">한국어</a> ·
  <strong>Tiếng Việt</strong>
</p>

<p align="center">
  <a href="https://sydf.cc"><strong>🌐 Web App (Giao diện tiếng Trung)</strong></a> ·
  <a href="https://sydf.cc/api-docs">🔌 Tài liệu API</a> ·
  <a href="https://sydf.cc/api-docs.md">🤖 Tài liệu cho AI (.md)</a> ·
  <a href="../skills/mingyu/SKILL.md">⚡ Agent Skill</a> ·
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu"><strong>☁️ Triển khai Cloudflare 1-click</strong></a>
</p>

> **Đừng để AI "tính nhẩm" lá số Tử Vi hay Tứ Trụ của bạn.**  
> Mingyu V2 tách biệt hoàn toàn **phần lập lá số chính xác bằng thuật toán** (tiết khí, Giờ Mặt Trời Thực, lịch âm dương, chứng cứ cổ thư) khỏi **phần AI luận giải**. Khi gọi API, MCP hoặc CLI với `"outputLanguage": "vi"`, AI sẽ luận giải trực tiếp bằng **thuật ngữ Tử Vi / Bát Tự / Phong Thủy chuẩn tiếng Việt** mà không làm sai lệch bất kỳ dữ liệu gốc nào.

---

## ⚡ Bắt đầu nhanh (MCP / REST API / CLI)

> Lưu ý: Giao diện web tại [sydf.cc](https://sydf.cc) hiện hiển thị bằng tiếng Trung giản thể. Để tích hợp tiếng Việt cho ứng dụng hoặc trợ lý AI, hãy dùng **MCP / HTTP REST API / CLI offline** kèm tham số `outputLanguage: "vi"`.

### 1. Remote MCP (Khuyên dùng cho AI Agent)
Thêm endpoint MCP vào Cursor, Claude Desktop, Claude Code hoặc Windsurf:
- **Chế độ Router gọn nhẹ (Khuyên dùng — chỉ 4 tool, tiết kiệm ~97% Token)**: `https://sydf.cc/mcp?mode=router`
- **Chế độ đầy đủ**: `https://sydf.cc/mcp`

### 2. Ví dụ gọi HTTP REST API
```json
POST https://sydf.cc/api/calculate
{
  "method": "ziwei",
  "responseMode": "compact",
  "outputLanguage": "vi",
  "input": {
    "question": "Xem vận trình công việc và tài lộc năm tới",
    "gender": "male",
    "birth": {
      "year": 1995, "month": 10, "day": 20,
      "clock": { "kind": "exact", "hour": 9, "minute": 15, "second": 0 },
      "timezone": 7
    }
  }
}
```

Hỏi tiếp trên cùng một lá số/quẻ mà **không gieo lại quẻ**:
```json
POST https://sydf.cc/api/prompt
{
  "repromptToken": "<repromptToken nhận được từ bước calculate>",
  "question": "Cung Phu Thê và đường tình duyên có điểm gì cần lưu ý?"
}
```

### 3. Agent Skill & CLI chạy offline
- Cài đặt skill: `npx skills add Brhiza/mingyu`
- Hoặc tải gói offline (`/downloads/mingyu-skill.zip`, chạy độc lập trên Node.js 20+):
  ```bash
  node scripts/mingyu.mjs calculate ziwei --lang vi --input '...' --compact
  ```

---

## 🔮 Danh mục 39 bộ môn hỗ trợ

| Nhóm | Method ID | Tính năng chính |
| :--- | :--- | :--- |
| **Bát Tự & Mệnh Lý (7)** | `bazi`, `bazi-synastry`, `bazi-ziwei`, `bazi-reverse`, `minglu`, `fortune`, `instant` | Bát Tự Tứ Trụ (Giờ Mặt Trời Thực, 362 quy tắc điều hậu, 57+50 Thần Sát), hợp tuổi đôi bên, đối chiếu Bát Tự – Tử Vi, mở nhánh khi không rõ giờ sinh |
| **Tử Vi & Chiêm Tinh (7)** | `ziwei`, `ziwei-synastry`, `qizheng`, `qizheng-range`, `astrolabe`, `astrolabe-range`, `astrolabe-synastry` | An sao Tử Vi (55 cách cục, Tứ Hóa phi tinh), Thất Chính Tứ Dư, Chiêm Tinh Phương Tây (12 hệ nhà, Transit, Solar Return, Progression, Solar Arc), quét khoảng sinh từng giây |
| **Kỳ Môn & Lục Nhâm (6)** | `qimen`, `qimen-lifetime`, `liuren`, `jinkoujue`, `xiaoliuren`, `taiyi` | Kỳ Môn Độn Giáp (Chuyển bàn / Phi bàn / chung thân cục), Đại Lục Nhâm, Kim Khẩu Quyết, Tiểu Lục Nhâm, Thái Ất Thần Số |
| **Kinh Dịch, Tarot & Xăm (8)** | `liuyao`, `meihua`, `tarot`, `lenormand`, `random-divination`, `ssgw`, `zhuge`, `number-energy` | Lục Hào, Mai Hoa Dịch Số, hỏi nối tiếp giữ nguyên quẻ qua `repromptToken`, trải bài Tarot & Lenormand, 92 quẻ xăm Tam Sơn Quốc Vương, 384 quẻ Gia Cát Thần Số, năng lượng con số |
| **Phong Thủy & Lịch Pháp (5)** | `bazhai`, `xuankong`, `residential`, `almanac`, `calendar` | Bát Trạch & Huyền Không Phi Tinh (kèm sai số độ la kinh), chọn ngày tốt Hoàng Đạo trong 180 ngày (tránh xung tuổi), 24 tiết khí & pha Mặt Trăng |
| **Đặt Tên & Cổ Thư (6)** | `chinese-name`, `chinese-naming`, `zhouyi`, `character-query`, `wuyun-liuqi`, `huangji-jingshi` | Phân tích Ngũ Cách – Ngũ Hành, tra cứu toàn văn *Kinh Dịch* (64 quẻ + Thập Dực), 4.096 quẻ *Tiêu Thị Dịch Lâm*, từ điển Khang Hy |

---

## 🚀 Tự triển khai & Phát triển nội bộ

- **Deploy nhanh lên Cloudflare Workers**: [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Brhiza/mingyu) (hỗ trợ giới hạn `ENABLED_METHODS` trong [wrangler.jsonc](../wrangler.jsonc) và xác thực `ACCESS_TOKEN`).
- **Môi trường local** (Node.js `>= 22.12.0`, `pnpm 11.25.0`): `pnpm install --frozen-lockfile && pnpm dev` / kiểm thử toàn bộ: `pnpm check:all`.
- **Ví dụ & Tài liệu**: [Node.js](../examples/http-client.mjs) · [Python](../examples/http_client.py) · [Agent Skill](../skills/mingyu/SKILL.md) · [Capability Baseline](./v2-capability-baseline.json)

---

## ⚖️ Miễn trừ trách nhiệm & Giấy phép

Kết quả an sao và AI prompt chỉ phục vụ mục đích nghiên cứu văn hóa truyền thống và giải trí, không thay thế tư vấn y tế, tâm lý, pháp lý hay tài chính.  
Mã nguồn phát hành theo giấy phép [MIT License](../LICENSE) (dữ liệu đi kèm tuân theo giấy phép gốc: [Kinh Dịch Wikisource CC BY-SA 4.0](../src/data/zhouyi/README.md), [Caelus MIT](../src/systems/astronomy/README.md)).
