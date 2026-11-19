# 即时盘、历法与资料查询

用户明确要求当前或指定时刻的即时盘时，可使用 `instant`，选择 `bazi`、`ziwei`、`bazi-ziwei`、`astrolabe` 或 `qizheng`；`at` 省略时采用 `currentTime` 或调用当刻的整秒。西洋星盘和七政需要用户提供观测地经纬度及时区；真太阳时需要经度及时区。区分 `basis.utcDateTime` 的实际瞬时、`basis.localDateTime` 的民用钟表与可选的 `basis.trueSolarDateTime`；七政使用真太阳时确定命身宫时辰，西洋星盘的真太阳时仅为参考。紫微只输出两种性别排盘口径共有的部分，不生成个人岁限。即时盘不是出生盘，追问应复用已保存结果，不再取新时刻。

历法工具 `calendar` 的 `calendar.kind` 可选 `solar-term`、`moon-phase`、`time-scales`、`true-solar`、`solar-illumination`。按 schema 提供所需时刻、地点或经度；索引 0 的冬至通常属于上一公历年，省略索引查询整年 24 个节气。时间尺度的 UT1 与 TT 是近似值，日出日落及视太阳正午不等于实际可见或室内采光；不可自行推测经纬度或夏令时回拨偏移。

数字能量 `number-energy` 需要用户提供号码；`purpose` 可选普通编号、手机号或车牌。按返回的实际八星序列、字母换算及 0、5 位置解读；民俗取象不证明号码造成现实效果，数理及传统资料还需独立核验。此方法不提供姓名分析或起名。

汉字查询 `character-query` 使用 `query.kind: "text"` 查询文字，或使用 `query.kind: "search"` 按笔画、五行、部首和拼音筛选。按 `nextOffset` 续页；字库未收录或缺少原文时必须明确说明，字义和五行资料仍待独立校勘。字典原文可用 `includeReferences: false` 省略。

姓名分析 `chinese-name` 需要完整姓名，复姓指定 `surnameLength: 2`；`chinese-naming` 按用户给出的姓氏、名字字数、偏好/忌用字、辈分字及其位置生成候选。两者可使用用户明确提供的五行、出生资料或 `birthRange`；范围最长两小时、起点含终点不含，可指定地方时区及真太阳时，标准北京时间范围可附来源 `pillars` 并逐段核验。缺时按各出生时段分别比较，勿将条件模型称作最终喜用；不推测出生时刻、出生地点、家族辈分或实际姓名读音。
