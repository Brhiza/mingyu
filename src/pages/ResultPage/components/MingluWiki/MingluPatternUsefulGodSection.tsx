import React from 'react';
import type { MingluPatternUsefulGodSectionData } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluPatternUsefulGodSectionData;
}

export const MingluPatternUsefulGodSection: React.FC<Props> = ({ data }) => {
  const { pattern, usefulGods, qiongtongAdvice, ditiansuiAdvice, zipingAdvice } = data;

  return (
    <section id="bazi-pattern-gods" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">03</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第三章：格局成败与用神喜忌精微</h2>
          <p className="minglu-section-subtitle">
            定格立局、扶抑调候通关取用、喜忌仇闲体系与三部经典典籍考据
          </p>
        </div>
      </div>

      {/* 主格定性 */}
      <div id="bazi-pattern-detail" className="minglu-subblock">
        <h3 className="minglu-subblock-title">主格定性与立格成败</h3>
        <div className="minglu-card minglu-pattern-hero-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <span className="minglu-card-badge">{pattern.type}</span>
              <h4 className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                【{pattern.name}】
              </h4>
            </div>
            <MingluLink
              targetAnchorId="glossary-encyclopedia"
              category="格局"
              className="minglu-pill is-primary"
            >
              查阅格局百科
            </MingluLink>
          </div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            立格依据：{pattern.basis}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {pattern.formationAnalysis}
          </p>
        </div>
      </div>

      {/* 核心用神与喜忌仇闲 */}
      <div id="bazi-useful-god-detail" className="minglu-subblock">
        <h3 className="minglu-subblock-title">核心用神与喜忌体系</h3>
        <div className="minglu-card-grid minglu-card-grid-2">
          <div className="minglu-card border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                核心用神 / 喜神
              </span>
              <span className="minglu-pill is-green">{usefulGods.usefulGodCategory}</span>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-2">
              {usefulGods.primaryUseful}
            </div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              喜用五行：{usefulGods.favorable.join('、') || '顺应大势'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {usefulGods.reasoning}
            </p>
          </div>

          <div className="minglu-card border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-rose-800 dark:text-rose-300 text-lg">
                核心忌神 / 仇神
              </span>
              <span className="minglu-pill is-red">防微杜渐</span>
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mb-2">
              {usefulGods.primaryAvoid}
            </div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              忌讳五行：{usefulGods.unfavorable.join('、') || '暂无明显大忌'}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              岁运逢忌神干支透干会局时，宜守成求稳、注重修身静气。
            </p>
          </div>
        </div>
      </div>

      {/* 古籍评注三篇 */}
      <div id="bazi-classics-advice" className="minglu-subblock">
        <h3 className="minglu-subblock-title">典籍精微考据与古籍原文评注</h3>
        <div className="minglu-classics-list">
          {ditiansuiAdvice && (
            <div className="minglu-classic-box">
              <div className="minglu-classic-header">
                <span className="minglu-classic-source">{ditiansuiAdvice.source}</span>
                <span className="font-bold text-base text-amber-800 dark:text-amber-300">
                  {ditiansuiAdvice.title}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                {ditiansuiAdvice.summary}
              </p>
              <div className="minglu-quotes-block">
                {ditiansuiAdvice.quotes.map((q, i) => (
                  <blockquote key={i} className="minglu-quote-line">
                    “{q}”
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {qiongtongAdvice && (
            <div className="minglu-classic-box">
              <div className="minglu-classic-header">
                <span className="minglu-classic-source">{qiongtongAdvice.source}</span>
                <span className="font-bold text-base text-amber-800 dark:text-amber-300">
                  {qiongtongAdvice.title}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                {qiongtongAdvice.summary}
              </p>
              <div className="minglu-quotes-block">
                {qiongtongAdvice.quotes.map((q, i) => (
                  <blockquote key={i} className="minglu-quote-line">
                    “{q}”
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {zipingAdvice && (
            <div className="minglu-classic-box">
              <div className="minglu-classic-header">
                <span className="minglu-classic-source">{zipingAdvice.source}</span>
                <span className="font-bold text-base text-amber-800 dark:text-amber-300">
                  {zipingAdvice.title}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                {zipingAdvice.summary}
              </p>
              <div className="minglu-quotes-block">
                {zipingAdvice.quotes.map((q, i) => (
                  <blockquote key={i} className="minglu-quote-line">
                    “{q}”
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
