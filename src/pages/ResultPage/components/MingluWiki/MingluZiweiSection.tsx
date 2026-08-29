import React from 'react';
import type { MingluZiweiSectionData } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluZiweiSectionData;
}

export const MingluZiweiSection: React.FC<Props> = ({ data }) => {
  const { bureau, soulMaster, bodyMaster, palaces, patterns, mutagens } = data;

  return (
    <section id="ziwei-twelve-palaces" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">09</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第九章：紫微斗数十二宫全息图谱</h2>
          <p className="minglu-section-subtitle">
            {bureau} · 命主{soulMaster} · 身主{bodyMaster} · 十二宫星曜会照与生年四化格局
          </p>
        </div>
      </div>

      {/* 十二宫九宫格全景大图 */}
      <div id="ziwei-palaces-grid" className="minglu-subblock">
        <h3 className="minglu-subblock-title">十二宫位星曜三方四正全览</h3>
        <div className="minglu-ziwei-palaces-grid">
          {palaces.map((pal) => (
            <div
              key={pal.index}
              id={pal.anchorId}
              className={`minglu-ziwei-palace-card ${pal.isOriginSoulPalace ? 'is-soul' : ''} ${pal.isBodyPalace ? 'is-body' : ''}`}
            >
              <div className="minglu-palace-card-header">
                <span className="font-bold text-base">
                  {pal.name}
                  {pal.isOriginSoulPalace && (
                    <span className="minglu-palace-badge is-soul">命宫</span>
                  )}
                  {pal.isBodyPalace && <span className="minglu-palace-badge is-body">身宫</span>}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {pal.heavenlyStem}
                  {pal.earthlyBranch} ({pal.decadalRange[0]}-{pal.decadalRange[1]})
                </span>
              </div>

              {/* 主星列表 */}
              <div className="minglu-palace-major-stars">
                {pal.majorStars.length > 0 ? (
                  pal.majorStars.map((s, idx) => (
                    <span key={idx} className="minglu-major-star-tag">
                      <MingluLink targetAnchorId="glossary-encyclopedia" category="星曜">
                        {s.name}
                      </MingluLink>
                      {s.brightness && <span className="minglu-star-bright">[{s.brightness}]</span>}
                      {s.birthMutagen && (
                        <span className="minglu-star-mutagen">化{s.birthMutagen}</span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    空宫（借对宫【{pal.oppositePalaceName}】安星）
                  </span>
                )}
              </div>

              {/* 辅星吉煞 */}
              <div className="minglu-palace-minor-stars">
                {pal.minorStars.map((s, idx) => (
                  <span key={idx} className="minglu-minor-star-tag">
                    {s.name}
                  </span>
                ))}
                {pal.maleficStars.map((s, idx) => (
                  <span key={idx} className="minglu-malefic-star-tag">
                    {s.name}
                  </span>
                ))}
              </div>

              {/* 宫位三方四正指示 */}
              <div className="minglu-palace-footer-info">
                <span>对宫: {pal.oppositePalaceName}</span>
                <span>长生: {pal.changsheng12}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 生年四化 */}
      <div id="ziwei-mutagens-flow" className="minglu-subblock">
        <h3 className="minglu-subblock-title">生年四化能量落宫</h3>
        <div className="minglu-card-grid minglu-card-grid-4">
          {mutagens.map((m, idx) => (
            <div key={idx} className="minglu-card">
              <span className="minglu-pill is-primary font-bold">
                化{m.mutagen} · {m.star}
              </span>
              <div className="text-sm font-semibold mt-2">入【{m.palaceName}】</div>
              <p className="text-xs text-slate-500 mt-1">{m.significance}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 格局检测 */}
      {patterns.length > 0 && (
        <div id="ziwei-patterns-list" className="minglu-subblock">
          <h3 className="minglu-subblock-title">经典紫微格局检测考据</h3>
          <div className="minglu-card-grid minglu-card-grid-2">
            {patterns.map((p, idx) => (
              <div key={idx} className="minglu-card">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {p.name}
                  </span>
                  <span className={`minglu-pill is-${p.type === '吉格' ? 'green' : 'red'}`}>
                    {p.type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-2">出处：{p.sourceTitle}</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mb-2 leading-relaxed">
                  {p.traditionalInterpretation}
                </p>
                {p.sourceQuote && (
                  <blockquote className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded">
                    “{p.sourceQuote}”
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
