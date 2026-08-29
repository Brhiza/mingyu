import React, { useState } from 'react';
import type { MingluLuckChronicleSectionData } from 'mingyu-core/minglu';

interface Props {
  data: MingluLuckChronicleSectionData;
}

export const MingluLuckChronicleSection: React.FC<Props> = ({ data }) => {
  const { startAge, startYear, handoverInfo, direction, cycles } = data;
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);
  const [expandedYearSet, setExpandedYearSet] = useState<Set<number>>(new Set());

  const activeCycle = cycles[selectedCycleIndex] || cycles[0];

  const toggleYearMonths = (year: number) => {
    setExpandedYearSet((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const expandAllYearsInCycle = () => {
    if (!activeCycle) return;
    const allYearNums = activeCycle.annualYears.map((y) => y.year);
    const isAllExpanded = allYearNums.every((y) => expandedYearSet.has(y));
    if (isAllExpanded) {
      setExpandedYearSet((prev) => {
        const next = new Set(prev);
        allYearNums.forEach((y) => next.delete(y));
        return next;
      });
    } else {
      setExpandedYearSet((prev) => {
        const next = new Set(prev);
        allYearNums.forEach((y) => next.add(y));
        return next;
      });
    }
  };

  return (
    <section id="bazi-luck-chronicle" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">08</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第八章：大运流年流月全息编年大表</h2>
          <p className="minglu-section-subtitle">
            起运交运时序、百年大运步进、人生阶段重心、岁运特殊感应与 12 个流月全景展开
          </p>
        </div>
      </div>

      {/* 起运交运基本参数 */}
      <div className="minglu-meta-grid mb-6">
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">起运年龄</span>
          <span className="minglu-meta-value font-bold text-amber-700 dark:text-amber-300">
            约 {startAge} 岁起运 (公历 {startYear} 年)
          </span>
        </div>
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">大运流向</span>
          <span className="minglu-meta-value font-bold">{direction}</span>
        </div>
        <div className="minglu-meta-item col-span-2">
          <span className="minglu-meta-label">交运时间考据</span>
          <span className="minglu-meta-value">{handoverInfo}</span>
        </div>
      </div>

      {/* 大运卡片导航条 */}
      <div className="minglu-subblock mb-6">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
          百年大运行步序列（点击切换查看十年精微）：
        </div>
        <div className="minglu-luck-tabs-bar">
          {cycles.map((c, idx) => (
            <button
              type="button"
              key={idx}
              className={`minglu-luck-tab-btn ${selectedCycleIndex === idx ? 'is-active' : ''}`}
              onClick={() => setSelectedCycleIndex(idx)}
            >
              <span className="text-[11px] opacity-75">
                {c.startAge}-{c.endAge}岁
              </span>
              <span className="font-black text-lg block my-0.5">{c.ganZhi}</span>
              <span className="text-xs font-medium opacity-90">{c.tenGod}</span>
              <span className="text-[10px] opacity-70 block">{c.lifeStage}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 选中大运详细卡片与 10 个流年大表 */}
      {activeCycle && (
        <div className="minglu-subblock">
          {/* 大运深度洞察大卡片 */}
          <div className="minglu-card minglu-active-luck-card mb-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4 pb-4 border-b border-amber-200/50 dark:border-amber-800/40">
              <div>
                <span className="minglu-card-badge">
                  第 {activeCycle.cycleIndex} 步大运 · 十年总领
                </span>
                <h4 className="text-3xl font-black text-amber-800 dark:text-amber-300 mt-1">
                  【{activeCycle.ganZhi}运】
                  <span className="text-base font-normal text-slate-600 dark:text-slate-400 ml-2">
                    ({activeCycle.startAge} - {activeCycle.endAge} 岁 · 公历 {activeCycle.startYear}{' '}
                    - {activeCycle.endYear} 年)
                  </span>
                </h4>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="minglu-pill is-primary font-bold">运干: {activeCycle.tenGod}</span>
                <span className="minglu-pill is-primary font-bold">
                  运支: {activeCycle.zhiTenGod}
                </span>
                <span className="minglu-pill is-secondary">纳音: {activeCycle.nayin}</span>
                <span className="minglu-pill is-secondary">运势: {activeCycle.lifeStage}</span>
              </div>
            </div>

            {/* 大运深度人生指引 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
              <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-slate-800">
                <div className="font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
                  <span>阶段主题与人生重心</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeCycle.lifeTheme}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-slate-800">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1">
                  <span>事业谋划与财富策略</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeCycle.careerAdvice}
                </p>
              </div>
              <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-slate-800">
                <div className="font-bold text-sky-900 dark:text-sky-200 mb-1 flex items-center gap-1">
                  <span>身心调养与作息指引</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeCycle.healthAdvice}
                </p>
              </div>
            </div>
          </div>

          {/* 10 个流年大表与流月 */}
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-200">
              【{activeCycle.ganZhi}运】下十个流年全息展开
            </h4>
            <button type="button" className="minglu-btn-toggle-all" onClick={expandAllYearsInCycle}>
              {activeCycle.annualYears.every((y) => expandedYearSet.has(y.year))
                ? '收起全部流月明细'
                : '展开全部流月明细'}
            </button>
          </div>

          <div className="space-y-4">
            {activeCycle.annualYears.map((y) => {
              const isExpanded = expandedYearSet.has(y.year);
              return (
                <div
                  key={y.year}
                  className="minglu-card border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-4 transition-all"
                >
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {y.year} 年
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        {y.age} 岁
                      </span>
                      <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                        {y.ganZhi}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-200/40">
                        {y.tenGod} / {y.zhiTenGod}
                      </span>
                      <span className="text-xs text-slate-500">纳音：{y.nayin}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="minglu-btn-expand-months"
                        onClick={() => toggleYearMonths(y.year)}
                      >
                        {isExpanded ? '收起流月' : '查看 12 流月'}
                      </button>
                    </div>
                  </div>

                  {/* 特殊岁运事件与主题 */}
                  {y.specialEvents && y.specialEvents.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {y.specialEvents.map((evt, eIdx) => (
                        <span
                          key={eIdx}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 常态感应与神煞 */}
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong className="text-slate-700 dark:text-slate-300">太岁神煞：</strong>
                      {y.taiSuiShensha.join('、') || '太岁临门'}
                    </span>
                    <span>
                      <strong className="text-slate-700 dark:text-slate-300">原局交互：</strong>
                      {y.interactionWithNatal.join('；')}
                    </span>
                  </div>

                  {/* 展开的 12 个流月全息大表 */}
                  {isExpanded && y.months && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 overflow-x-auto">
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                        {y.year} ({y.ganZhi}) 年 · 12 个流月干支十神与节气全对照
                      </div>
                      <table className="minglu-table minglu-monthly-table text-xs">
                        <thead>
                          <tr>
                            <th>月份</th>
                            <th>节气交接</th>
                            <th>流月干支</th>
                            <th>天干十神</th>
                            <th>地支十神</th>
                            <th>月柱纳音</th>
                            <th>月令司令</th>
                          </tr>
                        </thead>
                        <tbody>
                          {y.months.map((m) => (
                            <tr key={m.monthIndex}>
                              <td className="font-semibold">{m.monthName}</td>
                              <td className="text-slate-500">{m.solarTerm}</td>
                              <td className="font-bold text-amber-700 dark:text-amber-400">
                                {m.ganZhi}
                              </td>
                              <td>{m.ganTenGod}</td>
                              <td>{m.zhiTenGod}</td>
                              <td className="text-slate-500">{m.nayin}</td>
                              <td className="text-[11px] opacity-85">{m.commander}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
