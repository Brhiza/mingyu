# 中国出生地点数据来源

行政区名称、代码、拼音和经度沿用既有地点树。纬度来自
[`xiangyuecn/AreaCity-JsSpider-StatsGov`](https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov)
发布的 `ok_geo.csv`（版本 `2025.251231.260403`，MIT 许可），取省、市、区三级行政中心的
GCJ-02 纬度，不复制行政区边界。

未能按行政区代码匹配的节点不写入伪造坐标，运行时会明确标记为省级近似纬度回退。
