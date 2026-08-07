# 更新日志 (Changelog)

## 0.2.0 — 真太阳时 IANA 历史时区与子时/南半球端到端透传

> 本次为在 `main`（`fc09fdb`）基础上重新实现并合并的功能集。原本地提交因环境丢失未推送，本版本在演进后的代码库上复用既有 `resolveHistoricalTimezone` 完成闭环。

### 新增能力

- **IANA 历史时区端到端透传**：`resolveTrueSolarBirthTime` / `convertTrueSolarTime` 新增可选 `timeZoneId` 字段。提供时按 IANA 历史规则解析当地时刻的 UTC 偏移，重算标准经线（自动含夏令时），覆盖数值 `timezone`，解决固定偏移无法反映历史 DST 的问题。
- **子时双口径（zi-hour dual mode）**：新增 `ziHourMode`（`'standard'` 默认 / `'conservative'`）。`conservative` 下 23:00 仍归亥时（index 11），不使用晚子时拆分；`standard` 维持 23:00 起晚子时（index 12）。`getShichenFromClock` / `getTimeIndexFromClock` 增加可选参数，向后兼容。
- **南半球标记透传（southernHemisphere）**：新增可选布尔字段，由真太阳时解析层一路透传至结果，供上层词库解读季节/年界（仅标记，不参与真太阳时计算）。

### 调用方贯通（end-to-end）

| 调用方 | IANA(`timeZoneId`) | 子时(`ziHourMode`) | 南半球(`southernHemisphere`) | 备注 |
| --- | --- | --- | --- | --- |
| bazi (`baziCalculator.ts`) | ✅ 透传 | ✅ 透传 | ✅ 透传 | 经 `Person` 接口 |
| ziwei (`true-solar-input.ts`) | ✅ 透传 | ✅ 透传 | ✅ 透传 | 经 `ZiweiTrueSolarInput` |
| astrolabe (`astrolabe.ts`) | ✅ 透传（上游已解析 IANA 数值偏移） | ✅ 透传 | ✅ 透传 | 经 `AstrolabeBirthInput` |
| qi_zheng (`qi_zheng/index.ts`) | ✅ 透传（低层 `calculateTrueSolarTime` 新增 `options.timeZoneId`） | — | — | 低层换算不消费子时/南半球，故不传入死字段 |

> `client/index.ts` 直接透传 `TrueSolarBirthTimeInput`，自动继承新字段；`profile/index.ts` 维持数值时区口径，行为不变。

### 验证

- `tsc --noEmit -p packages/core/tsconfig.json`：EXIT 0（全量类型检查通过）。
- 端到端运行时校验（`verify-iana-forwarding.ts`，已清理）：IANA 解析（America/New_York 1988-06-15 → UTC-4 / 经线 -60）、数值兜底、子时双口径（23:30 conservative→亥时 / standard→晚子时）、南半球回显、低层 IANA 选项，全部 PASS。
- 核心回归测试：`tests/true-solar-time.test.ts` 等 5 文件 27/27 PASS；`core-birth-bundle` 等 4 文件 125/125 PASS。
- 全量 111 测试套件中其余失败均源于缺失依赖（react / celestine / @modelcontextprotocol/sdk），与本次代码改动无关，属环境限制。

### 兼容性

- 所有新增字段均为可选，未破坏任何既有调用签名。
- `calculateTrueSolarTime` 新增第 4 参数 `options?`，`getShichenFromClock`/`getTimeIndexFromClock` 新增第 3 参数 `ziHourMode?`，均带默认值，向后兼容。
