import React from 'react';
import type { MingluShenShaItem } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  items: MingluShenShaItem[];
}

export const MingluShenShaSection: React.FC<Props> = ({ items }) => {
  return (
    <section id="bazi-shensha-pantheon" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">05</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第五章：全息神煞谱系与典籍考据</h2>
          <p className="minglu-section-subtitle">
            天乙文昌华盖将星驿马羊刃等全盘吉凶神煞（已查考出 {items.length} 尊神煞）
          </p>
        </div>
      </div>

      <div className="minglu-card-grid minglu-card-grid-3">
        {items.map((s) => (
          <div
            key={s.id}
            id={s.anchorId}
            className={`minglu-card minglu-shensha-card is-${s.type === '吉' ? 'lucky' : s.type === '凶' ? 'unlucky' : 'neutral'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  <MingluLink targetAnchorId="glossary-encyclopedia" category="神煞">
                    {s.name}
                  </MingluLink>
                </h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  所在柱位：{s.pillars.join('、')}
                </div>
              </div>
              <span
                className={`minglu-pill is-${s.type === '吉' ? 'green' : s.type === '凶' ? 'red' : 'gray'}`}
              >
                {s.type}神
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
              {s.traditionalDescription}
            </p>

            <div className="text-xs text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-slate-800 pt-2 mt-auto">
              <span className="font-semibold">命理意象：</span>
              {s.significance}
            </div>

            {s.tenGodCombo && (
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                配合：{s.tenGodCombo}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
