import React from 'react';
import type { MingluFengshuiSectionData } from 'mingyu-core/minglu';

interface Props {
  data: MingluFengshuiSectionData;
}

export const MingluFengshuiSection: React.FC<Props> = ({ data }) => {
  const { mingGua } = data;

  return (
    <section id="fengshui-bazhai-dossier" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">11</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第十一章：宅命相配与八宅九星风水</h2>
          <p className="minglu-section-subtitle">
            本命卦位（{mingGua.gua}卦 · {mingGua.eastWest}）与大游年九星吉凶布局
          </p>
        </div>
      </div>

      <div className="minglu-card-grid minglu-card-grid-2">
        <div className="minglu-card border-emerald-300 dark:border-emerald-800">
          <h4 className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mb-3">
            四吉方布局指引
          </h4>
          <div className="space-y-2">
            {mingGua.beneficialDirections.map((d, i) => (
              <div key={i} className="p-2 rounded bg-emerald-50/60 dark:bg-emerald-950/40 text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-300 mr-2">
                  {d.name} ({d.direction}):
                </span>
                <span>{d.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="minglu-card border-rose-300 dark:border-rose-800">
          <h4 className="text-lg font-bold text-rose-800 dark:text-rose-300 mb-3">
            四凶方避忌指引
          </h4>
          <div className="space-y-2">
            {mingGua.unfavorableDirections.map((d, i) => (
              <div key={i} className="p-2 rounded bg-rose-50/60 dark:bg-rose-950/40 text-xs">
                <span className="font-bold text-rose-700 dark:text-rose-300 mr-2">
                  {d.name} ({d.direction}):
                </span>
                <span>{d.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
