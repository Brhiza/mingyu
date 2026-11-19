# 日月星历数据

`caelus-earth-moon.json` 提取自 Caelus 0.24.1 的固定嵌入数据，仅包含太阳及月亮计算所需的地球 VSOP87D、IAU 1980 章动项和 Meeus 月球项。它不包含行星、小行星或恒星数据；`pluto` 空数组只满足 Caelus `EngineData` 的类型约定，不用于日月计算。

数据来源为项目旧核心所使用的 Caelus 固定数据，上游为 [Caelus](https://github.com/heavyblotto/caelus)，许可见同目录 `CAELUS-LICENSE`。该数据和算法的范围与精度仍需通过参考星历及边界样例独立核验。
