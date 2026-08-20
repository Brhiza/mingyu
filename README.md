<p align="center">
  <a href="https://linux.do" alt="LINUX DO"><img src="https://img.shields.io/badge/LINUX-DO-FFB003.svg" /></a>
  <a href="https://www.npmjs.com/package/mingyu-core" alt="mingyu-core on npm"><img src="https://img.shields.io/npm/v/mingyu-core?label=mingyu-core&color=CB3837" /></a>
  <a href="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml" alt="CI"><img src="https://github.com/Brhiza/mingyu/actions/workflows/ci.yml/badge.svg" /></a>
</p>

# 命语

命语是一套免费开源的在线算命、占卜与玄学排盘工具。不会八字、紫微或六爻等术语也没关系：填写出生资料或想问的事情，命语会完成排盘，并生成一份可以直接交给 AI 解读的完整提示词。

它既适合普通用户查看运势、感情、事业、财运、合婚、风水和黄道吉日，也为开发者提供公开 API、MCP Server、Agent Skill 与独立 npm 算法包 `mingyu-core`。

<p align="center">
  <a href="https://aov.cc"><strong>在线使用</strong></a> ·
  <a href="https://aov.cc/tutorial">新手教程</a> ·
  <a href="docs/README.md">完整文档</a> ·
  <a href="https://aov.cc/api/v1/openapi.json">OpenAPI</a> ·
  <a href="https://www.npmjs.com/package/mingyu-core">mingyu-core</a>
</p>

## 项目能力

| 你想做的事                 | 可以使用                                         |
| -------------------------- | ------------------------------------------------ |
| 算命、看一生或近期运势     | 八字、紫微斗数、八字紫微合参、星盘、七政四余     |
| 看事业、财运、感情或健康   | 选择对应主题，生成针对性的排盘与 AI 提示词       |
| 合婚、看两个人是否合适     | 八字合盘、紫微合盘、西方占星双盘                 |
| 占卜一件事能不能成         | 六爻、梅花易数、小六壬、金口诀、奇门遁甲、大六壬 |
| 抽牌、求签或找一点启发     | 塔罗牌、雷诺曼、三山国王灵签                     |
| 选结婚、搬家、开业等好日子 | 黄历择日                                         |
| 看住宅方位和风水           | 八宅、玄空飞星、住宅风水合参                     |
| 研究传统玄学与历法         | 太乙神数、皇极经世、五运六气、真太阳时、干支五行 |
| 生成完整 AI 解读提示词     | 所有主要排盘、合盘、占卜、择日与风水入口         |
| 接入自己的应用或 AI        | 公开 API、MCP Server、Agent Skill、`mingyu-core` |

完整术式、计算资料和适用边界见[能力说明](docs/capabilities.md)。

## 不懂术语也能问

你可以直接用日常说法描述目标，命语会引导你选择合适的方式。例如：

- “帮我算命，想看看整体运势、事业、财运和感情。”
- “看看我今年的工作运和财运，有哪些机会需要把握？”
- “帮我们合婚，看看两个人适不适合长期发展。”
- “我想占卜这件事能不能成，什么时候推进更合适？”
- “用玄学角度帮我分析当前困惑，应该选哪种方法？”
- “帮我抽一组塔罗牌，看看这段关系接下来怎么发展。”
- “帮我选一个适合结婚、搬家或开业的好日子。”

在网页里选择“排盘、合盘、占卜、择日”，按提示填写信息即可。涉及出生资料的算命或合盘会使用你填写的时间、地点和性别；一事一问的占卜则应尽量写清人物、事情和时间范围。

## 开发者接入

命语的排盘由确定性代码完成，AI 只负责解读结果。根据使用场景选择一种入口：

| 入口          | 适合场景                                             | 文档                                                |
| ------------- | ---------------------------------------------------- | --------------------------------------------------- |
| 公开 API      | 无需安装，直接获得排盘或完整提示词                   | [API 文档](docs/api.md)                             |
| MCP Server    | 让支持 MCP 的 AI 客户端直接调用本地能力              | [MCP 文档](mcp/README.md)                           |
| Agent Skill   | 让 AI 代理理解“算命、占卜、玄学”等日常请求并选择接口 | [Skill 文档](public/skills/aov-mingyu-api/SKILL.md) |
| `mingyu-core` | 在自己的 TypeScript/JavaScript 应用中复用算法        | [算法包文档](packages/core/README.md)               |

公开 API 基础地址：

```text
https://aov.cc/api/v1
```

更多入口：[API 能力清单](https://aov.cc/api/v1/manifest) · [OpenAPI](https://aov.cc/api/v1/openapi.json) · [llms.txt](https://aov.cc/llms.txt) · [在线 Skill](https://aov.cc/skills/aov-mingyu-api/SKILL.md)

## 快速安装

运行网页和 MCP Server（需要 Node.js 22 与 pnpm；未安装 pnpm 时先运行 `npm install -g pnpm`）：

```bash
git clone https://github.com/Brhiza/mingyu.git
cd mingyu
pnpm install
pnpm dev
```

另开终端启动 MCP Server：

```bash
pnpm mcp
```

为 AI 代理安装公开 Skill：

```bash
npx skills add Brhiza/mingyu --skill aov-mingyu-api -g -y
```

只使用核心算法包：

```bash
npm install mingyu-core
```

常用开发检查：

```bash
pnpm test
pnpm build
```

Cloudflare Pages、Docker、内置 AI 配置、项目结构与全部命令见[开发与部署](docs/development-and-deployment.md)。

## 文档

- [文档目录](docs/README.md)
- [完整能力与算法边界](docs/capabilities.md)
- [公开 API](docs/api.md)
- [MCP Server](mcp/README.md)
- [`mingyu-core` 算法包](packages/core/README.md)
- [开发与部署](docs/development-and-deployment.md)
- [模型评测](docs/model-evaluation.md)
- [算法依据索引](docs/2026-07-10-算法依据索引.md)

## 基于命语构建

### 时月东方

时月东方是一款基于命语核心能力构建的东方术数工具，使用 Vue 3 与 Vite 实现，也可以作为 `mingyu-core` 在独立产品中接入和使用的实际参考。

- 在线体验：[https://sydf.cc](https://sydf.cc)
- 项目源码：[https://github.com/Brhiza/sydf](https://github.com/Brhiza/sydf)

欢迎补充术式依据、测试样例、API 文档、MCP/Skill 客户端示例和移动端体验。功德箱：[支持项目继续维护](https://lk.sydf.cc/)。

## 关于三山国王灵签

三山国王是粤东潮汕与客家地区重要的民间信仰，祖庙位于广东揭西县河婆街道。项目作者来自揭西，自幼接触三山国王信仰，因此在命语中整理并保留了祖庙传承的 92 签灵签体系。

每签保留签号、签题和签诗原文。不同庙本可能存在签序、题名或字句差异，解读以本次抽到的签文为准。我们也希望这套签文能在迷茫时给人一点启发，让这份地方传统继续被看见和使用。

## 免责声明

命语提供命理、占卜、玄学排盘与 AI 提示词辅助，结果仅供参考和娱乐学习，不应替代医疗、法律、投资、心理咨询等专业建议。

## 相关关键词

算命、在线算命、免费算命、AI 算命、占卜、在线占卜、玄学、命理、看运势、八字算命、八字排盘、紫微斗数、合婚、星盘、塔罗占卜、六爻、梅花易数、奇门遁甲、抽签、灵签、黄道吉日、择日、住宅风水。
