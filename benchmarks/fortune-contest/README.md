# 全球算命师大赛模型评测

本目录收录 2022—2026 年公开比赛资料，共 5 届、40 个命例、200 道四选一题。评测脚本会直接从结构化题库生成自包含任务书，不依赖网页端，也不把项目说明或内部字段发送给模型。

## 数据来源

- 2022—2025：基于 MIT 许可的 [DestinyLinker/MingLi-Bench](https://github.com/DestinyLinker/MingLi-Bench) 结构化资料导入，并保留比赛题号、出生资料、选项、答案和类别。
- 2026：根据香港青年术数家协会发布的[第十七届比赛原题](https://hkjfma.org/2026/06/2026%e5%b9%b4%e7%ac%ac%e5%8d%81%e4%b8%83%e5%b1%86-%e5%85%a8%e7%90%83%e7%ae%97%e5%91%bd%e5%b8%ab%e6%af%94%e8%b3%bd)及其 2026 年 8 月 8 日公布的官方答案整理。

比赛原题及答案的权利归各自发布者所有。本目录只用于可复现的模型能力评测；第三方许可说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 运行方式

默认评测最新的 2026 年 40 题：

```bash
pnpm contest:evaluate
```

指定一个或多个年份：

```bash
pnpm contest:evaluate -- --year 2025
pnpm contest:evaluate -- --years 2022,2026
pnpm contest:evaluate -- --years all
```

按类别筛选：

```bash
pnpm contest:evaluate -- --years all --categories 婚姻,事业
```

可用年份为 2022、2023、2024、2025、2026；可用类别由数据集动态校验。脚本不改变题目或选项顺序，确保同一筛选条件始终使用同一份试卷。接口格式、模型批量评测和并发参数见根目录 README。
