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
          <h2 className="minglu-section-title">第七章：十二长生全景矩阵与自坐星运</h2>
          <p className="minglu-section-subtitle">
            十天干生旺死绝十二历程全对照矩阵与四柱干支原局自坐星象
          </p>
        </div>
      </div>

      {/* 原局四柱自坐长生 */}
      <div className="minglu-card-grid minglu-card-grid-4 mb-6">
        {natalStages.map((ns) => (
          <div key={ns.pillar} className="minglu-card">
            <div className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
              {ns.pillarLabel} ({ns.stem}
              {ns.branch})
            </div>
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
              日主临：{ns.dayMasterStage}
            </div>
            <div className="text-xs text-slate-500 mb-2">{ns.dayMasterStageDesc}</div>
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
              干自坐：{ns.ziZuoStage}
            </div>
            <div className="text-xs text-slate-500">{ns.ziZuoStageDesc}</div>
          </div>
        ))}
      </div>

      {/* 10 x 12 全景对照表 */}
      <div className="minglu-subblock">
        <h3 className="minglu-subblock-title">
          十天干十二长生全览大表 (长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养)
        </h3>
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
    </section>
  );
};
