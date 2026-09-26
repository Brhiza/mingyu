import React, { useState } from 'react';
import type { MingluLuckChronicleSectionData } from 'mingyu-core/minglu';

interface Props {
  data: MingluLuckChronicleSectionData;
}

const hasValue = (value: string) => Boolean(value && value !== '—');

export const MingluLuckChronicleSection: React.FC<Props> = ({ data }) => {
  const { startAge, handoverInfo, direction, cycles } = data;
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);
  const [expandedYearSet, setExpandedYearSet] = useState<Set<number>>(new Set());

  const activeCycle = cycles[selectedCycleIndex] || cycles[0];
  const isChildhoodCycle = activeCycle?.entryType === '小运' || activeCycle?.isXiaoyun;
  const cycleName = activeCycle
    ? isChildhoodCycle
      ? '童限（小运）'
      : `${activeCycle.ganZhi}大运`
    : '';
  const yearsWithMonths = activeCycle?.annualYears.filter((year) => year.months.length > 0) || [];

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
    const allYearNums = yearsWithMonths.map((y) => y.year);
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
          <h2 className="minglu-section-title">第八章：岁运与流年流月</h2>
          <p className="minglu-section-subtitle">起运时间、童限与大运，以及所列流年流月资料</p>
        </div>
      </div>

      {/* 起运交运基本参数 */}
      <div className="minglu-meta-grid mb-6">
        {cycles.some((cycle) => cycle.entryType === '大运') && (
          <div className="minglu-meta-item">
            <span className="minglu-meta-label">起运年龄</span>
            <span className="minglu-meta-value font-bold text-amber-700 dark:text-amber-300">
              约 {startAge} 岁起运
            </span>
          </div>
        )}
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">大运流向</span>
          <span className="minglu-meta-value font-bold">{direction}</span>
        </div>
        <div className="minglu-meta-item col-span-2">
          <span className="minglu-meta-label">交运时间考据</span>
          <span className="minglu-meta-value">{handoverInfo}</span>
        </div>
      </div>

      {/* 童限与大运导航 */}
      {cycles.length > 0 && (
        <div className="minglu-subblock mb-6">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
            童限与大运（点击切换）：
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
                <span className="font-black text-lg block my-0.5">
                  {c.entryType === '小运' || c.isXiaoyun ? '童限（小运）' : c.ganZhi}
                </span>
                {hasValue(c.tenGod) && c.entryType !== '小运' && !c.isXiaoyun && (
                  <span className="text-xs font-medium opacity-90">{c.tenGod}</span>
                )}
                {hasValue(c.lifeStage) && c.entryType !== '小运' && !c.isXiaoyun && (
                  <span className="text-[10px] opacity-70 block">十二长生：{c.lifeStage}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 当前周期与实际覆盖的流年 */}
      {activeCycle && (
        <div className="minglu-subblock">
          {/* 当前周期资料 */}
          <div className="minglu-card minglu-active-luck-card mb-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4 pb-4 border-b border-amber-200/50 dark:border-amber-800/40">
              <div>
                <span className="minglu-card-badge">
                  {isChildhoodCycle ? '童限（小运）' : '大运'}
                </span>
                <h4 className="text-3xl font-black text-amber-800 dark:text-amber-300 mt-1">
                  【{cycleName}】
                  <span className="text-base font-normal text-slate-600 dark:text-slate-400 ml-2">
                    （所列年龄 {activeCycle.startAge}-{activeCycle.endAge} 岁）
                  </span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  北京时间 {activeCycle.startDateTime} 起，至 {activeCycle.endDateTime} 前
                </p>
              </div>
              {!isChildhoodCycle && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {hasValue(activeCycle.tenGod) && (
                    <span className="minglu-pill is-primary font-bold">
                      运干十神：{activeCycle.tenGod}
                    </span>
                  )}
                  {hasValue(activeCycle.zhiTenGod) && (
                    <span className="minglu-pill is-primary font-bold">
                      运支本气十神：{activeCycle.zhiTenGod}
                    </span>
                  )}
                  {hasValue(activeCycle.nayin) && (
                    <span className="minglu-pill is-secondary">纳音：{activeCycle.nayin}</span>
                  )}
                  {hasValue(activeCycle.lifeStage) && (
                    <span className="minglu-pill is-secondary">
                      日主十二长生：{activeCycle.lifeStage}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 已有岁运资料 */}
            {(activeCycle.lifeTheme || (!isChildhoodCycle && activeCycle.careerAdvice)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
                {activeCycle.lifeTheme && (
                  <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-slate-800">
                    <div className="font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1">
                      <span>{isChildhoodCycle ? '童限资料' : '大运干支与十神'}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {activeCycle.lifeTheme}
                    </p>
                  </div>
                )}
                {!isChildhoodCycle && activeCycle.careerAdvice && (
                  <div className="bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-100 dark:border-slate-800">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-1">
                      <span>十神取象与本局取用</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {activeCycle.careerAdvice}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 实际覆盖的流年与流月 */}
          {activeCycle.annualYears.length > 0 && (
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-200">
                【{cycleName}】所列 {activeCycle.annualYears.length} 个流年
              </h4>
              {yearsWithMonths.length > 0 && (
                <button
                  type="button"
                  className="minglu-btn-toggle-all"
                  onClick={expandAllYearsInCycle}
                >
                  {yearsWithMonths.every((y) => expandedYearSet.has(y.year))
                    ? '收起全部流月明细'
                    : '展开全部流月明细'}
                </button>
              )}
            </div>
          )}

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
                        {y.year} 立春年
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        {y.age} 岁
                      </span>
                      <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                        {y.ganZhi}
                      </span>
                      {hasValue(y.tenGod) && hasValue(y.zhiTenGod) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium border border-amber-200/40">
                          {y.tenGod} / {y.zhiTenGod}
                        </span>
                      )}
                      {hasValue(y.nayin) && (
                        <span className="text-xs text-slate-500">纳音：{y.nayin}</span>
                      )}
                    </div>

                    {y.months.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="minglu-btn-expand-months"
                          onClick={() => toggleYearMonths(y.year)}
                        >
                          {isExpanded ? '收起流月' : `查看 ${y.months.length} 个流月`}
                        </button>
                      </div>
                    )}
                  </div>

                  {y.startDateTime && y.endDateTime && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      本周期覆盖：北京时间 {y.startDateTime} 起，至 {y.endDateTime} 前
                    </div>
                  )}
                  {y.xiaoyun && (
                    <div className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                      童限小运：{y.xiaoyun.ganZhi}
                      {hasValue(y.xiaoyun.tenGod) && ` · 天干十神 ${y.xiaoyun.tenGod}`}
                      {hasValue(y.xiaoyun.tenGodZhi) && ` · 地支本气十神 ${y.xiaoyun.tenGodZhi}`}
                    </div>
                  )}

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

                  {/* 与原局有记录的交互 */}
                  {y.interactionWithNatal.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <strong className="text-slate-700 dark:text-slate-300">原局交互：</strong>
                        {y.interactionWithNatal.join('；')}
                      </span>
                    </div>
                  )}

                  {/* 当前流年覆盖的流月 */}
                  {isExpanded && y.months.length > 0 && (
                    <div className="minglu-table-wrap mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                        {y.year} ({y.ganZhi}) 年 · 所列 {y.months.length} 个流月
                      </div>
                      <table className="minglu-table minglu-monthly-table text-xs">
                        <thead>
                          <tr>
                            <th>月份</th>
                            <th>节气交接</th>
                            <th>本周期覆盖</th>
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
                              <td className="text-slate-500 whitespace-nowrap">
                                {m.startDateTime} 起，至 {m.endDateTime} 前
                              </td>
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
