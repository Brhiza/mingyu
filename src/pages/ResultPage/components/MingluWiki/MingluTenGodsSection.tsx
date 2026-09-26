import React from 'react';
import type { MingluGlossaryEntry, MingluTenGodsSectionData } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluTenGodsSectionData;
  glossaryEntries: MingluGlossaryEntry[];
  onNavigateGlossary: (anchorId: string) => void;
}

export const MingluTenGodsSection: React.FC<Props> = ({
  data,
  glossaryEntries,
  onNavigateGlossary,
}) => {
  const { godsList, flowAnalysis, housesSixKin } = data;
  const glossaryByTerm = new Map(glossaryEntries.map((entry) => [entry.term, entry]));

  return (
    <section id="bazi-ten-gods-symbology" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">06</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第六章：十神透藏与四柱传统取象</h2>
          <p className="minglu-section-subtitle">十神透藏统计、相生关系与四柱六亲取象</p>
        </div>
      </div>

      {/* 十神全量列表 */}
      <div className="minglu-subblock">
        <h3 className="minglu-subblock-title">十神透藏与概念取象</h3>
        <div className="minglu-card-grid minglu-card-grid-2">
          {godsList.map((g) => (
            <div
              key={g.tenGod}
              className={`minglu-card minglu-god-card ${g.count > 0 ? 'is-present' : 'is-absent'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {glossaryByTerm.get(g.tenGod) ? (
                    <MingluLink
                      targetAnchorId={glossaryByTerm.get(g.tenGod)!.anchorId}
                      category="十神"
                      onNavigate={onNavigateGlossary}
                    >
                      {g.tenGod}
                    </MingluLink>
                  ) : (
                    g.tenGod
                  )}
                </span>
                <span className={`minglu-pill ${g.count > 0 ? 'is-primary' : 'is-gray'}`}>
                  {g.count > 0
                    ? `出现 ${g.count} 处 (${g.isExposed ? '透干' : ''}${g.isExposed && g.isHidden ? '兼' : ''}${g.isHidden ? '藏地支' : ''})`
                    : '未记录透藏'}
                </span>
              </div>
              {g.pillars.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  分布柱位：{g.pillars.join('、')}
                </div>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {g.psychology}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 生克流通链 */}
      <div className="minglu-subblock">
        <h3 className="minglu-subblock-title">十神相生关系与柱位</h3>
        <p className="text-xs text-slate-500 mb-3">{flowAnalysis.summary}</p>
        <div className="minglu-flow-container">
          {flowAnalysis.channels.map((ch, idx) => (
            <div key={idx} className="minglu-flow-step">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {ch.from}
              </span>
              <span className="minglu-flow-arrow">→ ({ch.flowType}) →</span>
              <span className="font-bold text-sm text-amber-700 dark:text-amber-400">{ch.to}</span>
              <span className="text-xs text-slate-500 block mt-1">{ch.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 四柱六亲宫位 */}
      <div className="minglu-subblock">
        <h3 className="minglu-subblock-title">四柱六亲与传统取象</h3>
        <div className="minglu-card-grid minglu-card-grid-4">
          {housesSixKin.map((hk) => (
            <div key={hk.pillar} className="minglu-card">
              <div className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                {hk.pillarLabel}
              </div>
              <div className="text-xs text-amber-600 font-semibold mb-2">{hk.ageRange}</div>
              {hk.actualTenGods.length > 0 && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                  <span className="font-semibold">实际十神：</span>
                  {hk.actualTenGods.join('、')}
                </div>
              )}
              <div className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                <span className="font-semibold">六亲象：</span>
                {hk.sixKinSignificance}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-semibold">环境象：</span>
                {hk.environmentSignificance}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
