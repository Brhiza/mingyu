<p align="center">
  <a href="https://linux.do" alt="LINUX DO"><img src="https://img.shields.io/badge/LINUX-DO-FFB003.svg" /></a>
  <a href="https://www.npmjs.com/package/mingyu-core" alt="mingyu-core on npm"><img src="https://img.shields.io/npm/v/mingyu-core?label=mingyu-core&color=CB3837" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml" alt="CI"><img src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
</p>

# 命语 (Mingyu)

命语是一套免费开源的在线算命、占卜排盘与 AI 解读提示词工具。输入出生时间或所问之事，即可完成高精度排盘，并生成可直接交给任意大模型解读的完整提示词。

---

## 📿 功德箱

命语与时月东方均为个人业余维护的免费开源项目。

**为什么叫“功德箱”？**  
本项目收到的全部赞助款项目前均定期**全额捐赠给社会正规慈善与公益事业**（用于爱心助学、困境老人救助与乡村公益等）。感谢每一位支持者的善意！

<p align="center">
  <a href="https://lk.sydf.cc/"><strong>👉 前往功德箱（赞助与爱心支持）</strong></a>
</p>

---

<p align="center">
  <a href="https://aov.cc"><strong>🌐 在线使用</strong></a> ·
  <a href="https://aov.cc/tutorial">📖 新手教程</a> ·
  <a href="docs/README.md">📚 完整文档</a> ·
  <a href="https://aov.cc/api/v1/openapi.json">🔌 OpenAPI</a> ·
  <a href="https://www.npmjs.com/package/mingyu-core">📦 mingyu-core (npm)</a>
</p>

---

## 🔮 支持功能

| 分类 | 术数方法 | 主要功能 |
| :--- | :--- | :--- |
| **命理运势** | 八字命理、紫微斗数、八字紫微合参、西方星盘、七政四余 | 支持真太阳时换算、大运流年流月流日细盘、三方四正、庙旺四化、神煞与合盘分析 |
| **周易占卜** | 六爻纳甲、梅花易数 | 支持手摇/指定卦象、京房八宫纳甲、六亲六神、世应动变、体用生克与四时旺衰 |
| **三式绝学** | 奇门遁甲、大六壬、金口诀、太乙神数、皇极经世 | 支持时家转盘/飞盘奇门、月将天地盘四课三传、阴阳五用、年计七十二局与元会运世 |
| **牌卡灵签** | 西方塔罗牌、雷诺曼牌、三山国王灵签、小六壬 | 包含 78 张塔罗全牌阵、36 张雷诺曼及大 Tableau、揭西祖庙 92 签全篇签谱 |
| **择日风水** | 黄历择吉、八宅明镜、玄空飞星、五运六气 | 建除十二神与宜忌排查、东四西四命卦、三元九运飞星排盘与客主加临 |

---

## 🛠️ 开发者接入

### 1. 核心算法包 `mingyu-core`
```bash
npm install mingyu-core
```
```typescript
import { generateBazi, generateLiuyao, drawTarotSpread } from 'mingyu-core';

// 八字排盘
const bazi = generateBazi({ solarDate: '1995-08-18', solarTime: '09:30', gender: '男' });

// 六爻起卦
const liuyao = generateLiuyao(new Date());

// 抽塔罗牌
const tarot = drawTarotSpread('celtic');
```
详见 [mingyu-core 文档](packages/core/README.md)。

### 2. 公开 REST API
基础地址：`https://aov.cc/api/v1`
* [API 接口文档](docs/api.md) · [OpenAPI 规范](https://aov.cc/api/v1/openapi.json) · [LLMs.txt](https://aov.cc/llms.txt)

### 3. MCP Server
支持 Claude Desktop、Cursor 等 MCP 客户端直接调用：
```bash
pnpm mcp
```
详见 [MCP 服务文档](mcp/README.md)。

### 4. Agent Skill
```bash
npx skills add Brhiza/mingyu --skill aov-mingyu-api -g -y
```

---

## 📱 Android 原生应用

提供适配移动端的 Android 原生 APK，支持在生成排盘后**一键唤起已安装的 AI 应用**（如 ChatGPT、Claude、Kimi 等）直接对话，API Key 仅保存在本地设备。

```bash
# 同步 Web 资源到 Android 工程
pnpm android:sync
```

---

## 🚀 本地开发与构建

```bash
# 克隆仓库并安装依赖
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 打包构建
pnpm build
```

---

## ⛩️ 关于三山国王灵签

三山国王是潮汕与客家地区重要的民间信仰，祖庙位于广东省揭西县河婆街道。作者整理并保留了祖庙传承的 92 签灵签体系，每签保留签号、签题、签诗原文与典故。

---

## 🌟 基于命语构建

### 时月东方

时月东方是一款基于命语核心能力构建的东方术数工具，使用 Vue 3 与 Vite 实现，也可以作为 `mingyu-core` 在独立产品中接入和使用的实际参考。

- 在线体验：[https://sydf.cc](https://sydf.cc)
- 项目源码：[https://github.com/Brhiza/sydf](https://github.com/Brhiza/sydf)

---

## 📚 文档目录

- [文档总览](docs/README.md)
- [术数能力与适用范围](docs/capabilities.md)
- [公开 API 文档](docs/api.md)
- [MCP Server 配置指南](mcp/README.md)
- [mingyu-core 算法包说明](packages/core/README.md)
- [开发、部署与环境配置](docs/development-and-deployment.md)

---

## ⚖️ 免责声明

本工具提供的排盘结果与 AI 解读提示词仅供传统文化研究与休闲娱乐参考，不构成且不可替代医疗、心理、法律、投资等专业建议。

---

## 📄 开源协议

本项目基于 MIT License 协议开源。
