# 姓名、汉字与数理数据来源

- 康熙字典、五格数理与三才配置的静态数据由 [`shunshi-kangxi-core@0.1.1`](https://www.npmjs.com/package/shunshi-kangxi-core) 与 [`shunshi-naming-core@0.1.0`](https://www.npmjs.com/package/shunshi-naming-core) 生成；两者均采用 MIT License。
- 数字能量采用八宅体系衍生的八星数组口径，将 1、2、3、4、6、7、8、9 的相邻组合归入天医、生气、延年、伏位、绝命、五鬼、六煞、祸害；0 与 5 作为相邻组合的隐藏、增强作用。字母编号使用 A=1 至 Z=26 的明确换算约定，再展开为数字序列参与组合。
- 诸葛神数 384 签原文整理自 [Lam Jin Lab 公布的《诸葛神数》第 1 至 384 签全文](https://www.lamjinlab.com/blog/zgss-full-text)。
- 孔明神卦采用五次钱币正反构成 32 卦的通行起法，卦名与卦诗据[世纪国学公开资料](https://jiaoyu.shijiguoxue.com/name/29.html)整理。

生成脚本固定依赖版本，并校验字典规模、数理条目数、三才条目数以及 384 签连续性，避免上游变化静默进入发布包。
