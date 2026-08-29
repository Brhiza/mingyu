import React from 'react';
import type { MingluCrossSynthesisThemeData } from 'mingyu-core/minglu';

interface Props {
  themes: MingluCrossSynthesisThemeData[];
}

export const MingluCrossSynthesisSection: React.FC<Props> = ({ themes }) => {
  return (
    <section id="cross-synthesis-section" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">12</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第十二章：跨术数命理全景互证</h2>
          <p className="minglu-section-subtitle">
            八字子平、紫微斗数与西方占星在性情、格局、财富与行运维度的多维相互印证
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {themes.map((th) => (
          <div key={th.themeId} className="minglu-card">
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {th.title}
            </h4>
            <p className="text-xs text-slate-500 mb-3">{th.focus}</p>

            <div className="minglu-card-grid minglu-card-grid-3 mb-3">
              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                  八字证据：
                </div>
                <ul className="text-xs space-y-1">
                  {th.baziEvidence.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60">
                <div className="text-xs font-bold text-purple-700 dark:text-purple-400 mb-1">
                  紫微证据：
                </div>
                <ul className="text-xs space-y-1">
                  {th.ziweiEvidence.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>

              {th.astrolabeEvidence && (
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs font-bold text-cyan-700 dark:text-cyan-400 mb-1">
                    占星证据：
                  </div>
                  <ul className="text-xs space-y-1">
                    {th.astrolabeEvidence.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-semibold">互证综述：</span>
              {th.crossVerificationNotes.join(' ')}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
