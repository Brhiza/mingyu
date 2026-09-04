# 姓名、汉字与数理数据来源

- 康熙字典、五格数理与三才配置的静态数据由 [`shunshi-kangxi-core@0.1.1`](https://www.npmjs.com/package/shunshi-kangxi-core) 与 [`shunshi-naming-core@0.1.0`](https://www.npmjs.com/package/shunshi-naming-core) 生成；两者均采用 MIT License。
- 数字能量的八星名称、星名和卦变关系核对《钦定协纪辨方书》卷二[大游年变卦](https://www.shidianguji.com/book/SK1619/chapter/1l9llp3fvijvs)，据此将 1、2、3、4、6、7、8、9 对应后天八卦并归类全部相邻组合。将该关系用于号码、字母按 A=1 至 Z=26 展开，以及夹 0 取隐藏、夹 5 取增强，均属于号码解读采用的转换约定，不作为古籍原法表述；界面按实际出现次数和顺序呈现，不采用现代流传的数组强弱排名。
- 诸葛神数 384 签原文整理自 [Lam Jin Lab 公布的《诸葛神数》第 1 至 384 签全文](https://www.lamjinlab.com/blog/zgss-full-text)。
- 孔明神卦采用[五枚硬币同时摇取、按摆放顺序记录正反面](https://sanqing.com.tw/en/%E5%AD%94%E6%98%8E%E7%A5%9E%E6%95%B8/)的流传起法；当前签谱沿用含“后吉卦”“无数卦”的三十二课次序，卦名与卦诗参照[观音神课三十二卦公开资料](https://m.k366.com/qian/2293_3.htm)整理。另有以“光明”“无数”收尾的[孔明神数异本](https://www.kamo-books.co.jp/5597-05.htm)，两套卦序与部分卦名、卦诗不同，不混合使用。

生成脚本固定依赖版本，并校验字典规模、数理条目数、三才条目数以及 384 签连续性，避免上游变化静默进入发布包。
