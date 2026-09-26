# 中国出生地点数据来源

行政区名称、代码和拼音沿用既有地点树。经纬度成对来自
[`xiangyuecn/AreaCity-JsSpider-StatsGov`](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov)
发布的 [`ok_geo.csv`](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov/releases/tag/2025.251231.260403)
（版本 `2025.251231.260403`，MIT 许可）。按行政区代码读取 `geo` 字段中的
`lng lat`，两项均为高德地图 GCJ-02 省、市、区三级行政中心坐标；不复制行政区边界。
使用 `node scripts/import-china-location-coordinates.mjs <ok_geo.csv 路径>` 更新数据时，
同一行经纬度必须同步写入。

本版地点树共 3636 个节点，其中 3255 个与上游有坐标的行政区代码匹配；
3238 个原有经纬度已与上游完全一致，17 个旧经度与新纬度未配对的节点已同步为上游经度。
其余 381 个节点未获上游坐标，保留既有经度且不写入伪造纬度；运行时明确标记为
省级近似纬度回退。此类旧经度的坐标来源尚未重新核定。
