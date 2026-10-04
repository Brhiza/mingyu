import React from 'react';
import type { MingluLifeStagesSectionData } from 'mingyu-core/minglu';
import { EARTHLY_BRANCHES } from 'mingyu-core/bazi';

interface Props {
  data: MingluLifeStagesSectionData;
}

export const MingluLifeStagesSection: React.FC<Props> = ({ data }) => {
  const { tableMatrix, natalStages } = data;

  return (
    <section id="bazi-life-stages-matrix" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">07</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第七章：十二长生阶段与四柱自坐</h2>
          <p className="minglu-section-subtitle">十天干在十二地支的长生阶段对照与本局四柱对应</p>
        </div>
      </div>

      {/* 原局四柱自坐长生 */}
      {natalStages.length > 0 && (
        <div className="minglu-card-grid minglu-card-grid-4 mb-6">
          {natalStages.map((ns) => {
            const hasPillar = Boolean(ns.stem && ns.branch);
            const hasDayMasterStage = hasPillar && ns.dayMasterStage !== '待补时';
            const hasZiZuoStage = hasPillar && ns.ziZuoStage !== '待补时';
            return (
              <div key={ns.pillar} className="minglu-card">
                <div className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                  {ns.pillarLabel} {hasPillar ? `(${ns.stem}${ns.branch})` : '（待补时）'}
                </div>
                {hasDayMasterStage && (
                  <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    日主在{ns.branch}支：{ns.dayMasterStage}
                  </div>
                )}
                {hasZiZuoStage && (
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                    {ns.stem}干自坐{ns.branch}支：{ns.ziZuoStage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 10 x 12 全景对照表 */}
      {tableMatrix.length > 0 && (
        <div className="minglu-subblock">
          <h3 className="minglu-subblock-title">十天干十二长生阶段对照</h3>
          <div className="minglu-table-wrap">
            <table className="minglu-table minglu-lifestages-table">
              <thead>
                <tr>
                  <th>天干</th>
                  <th>五行</th>
                  {EARTHLY_BRANCHES.map((b) => (
                    <th key={b}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableMatrix.map((row) => (
                  <tr key={row.stem}>
                    <td className="font-bold">{row.stem}</td>
                    <td>{row.wuxing}</td>
                    {EARTHLY_BRANCHES.map((b) => {
                      const stage = row.stages[b];
                      const isPeak = stage === '帝旺' || stage === '临官' || stage === '长生';
                      return (
                        <td key={b} className={`minglu-td-stage ${isPeak ? 'is-peak' : ''}`}>
                          {stage}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
