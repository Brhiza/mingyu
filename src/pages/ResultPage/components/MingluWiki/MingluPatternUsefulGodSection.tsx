import React from 'react';
import type { MingluPatternUsefulGodSectionData } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluPatternUsefulGodSectionData;
}

export const MingluPatternUsefulGodSection: React.FC<Props> = ({ data }) => {
  const {
    pattern,
    usefulGods,
    qiongtongAdvice,
    ditiansuiAdvice,
    zipingAdvice,
    unknownTimeAnalysis,
  } = data;

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
          {pattern.transformation && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <span>化气判定：</span>
                <span className="minglu-pill is-green">{pattern.transformation.status}</span>
                <span>化神{pattern.transformation.element}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                判定依据：{pattern.transformation.basis}
              </p>
              {pattern.transformation.evidence.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {pattern.transformation.evidence.map((item, index) => (
                    <li key={`evidence-${index}-${item}`}>化气证据：{item}</li>
                  ))}
                </ul>
              ) : null}
              {pattern.transformation.conditions.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {pattern.transformation.conditions.map((item, index) => (
                    <li key={`condition-${index}-${item}`}>化气条件：{item}</li>
                  ))}
                </ul>
              ) : null}
              {pattern.transformation.status === '成化' ? (
                <p className="mt-2 text-xs font-semibold leading-relaxed text-emerald-800 dark:text-emerald-300">
                  取用主体：化神{pattern.transformation.element}
                  ；原日主旺衰与十神作为本命事实，取用按化神及其条件核验。
                </p>
              ) : null}
            </div>
          )}
          {unknownTimeAnalysis && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                出生时辰待补
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                {unknownTimeAnalysis.summary}
              </p>
              <div className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                候选场景（仅供补时比较）
              </div>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {unknownTimeAnalysis.scenarios.map((scenario) => (
                  <li key={`${scenario.timeIndex}-${scenario.timeName}`}>
                    {scenario.timeName}：{scenario.pillars.year.ganZhi || '—'}{' '}
                    {scenario.pillars.month.ganZhi || '—'} {scenario.pillars.day.ganZhi || '—'}{' '}
                    {scenario.pillars.hour.ganZhi || '—'}；旺衰{scenario.strength}；格局
                    {scenario.pattern}
                    {scenario.favorableWuxing.length
                      ? `；喜用${scenario.favorableWuxing.join('、')}`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pattern.fulfillment && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span>成败状态：</span>
                <span className="minglu-pill is-primary">{pattern.fulfillment.status}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                判定依据：{pattern.fulfillment.basis}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {pattern.fulfillment.summary}
              </p>
              {pattern.fulfillment.contradiction && (
                <p className="mt-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                  相互制约：{pattern.fulfillment.contradiction}
                </p>
              )}
              {pattern.fulfillment.conditions?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    成立条件
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {pattern.fulfillment.conditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {pattern.fulfillment.conditionFacts?.filter(
                (condition) => !condition.key.startsWith('path.'),
              ).length ? (
                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    条件核验
                  </div>
                  <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {pattern.fulfillment.conditionFacts
                      .filter((condition) => !condition.key.startsWith('path.'))
                      .map((condition) => (
                        <li key={condition.key}>
                          <span className="font-semibold">{condition.status}：</span>
                          {condition.detail}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              {pattern.fulfillment.pathEvaluations?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    制化路径
                  </div>
                  <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {pattern.fulfillment.pathEvaluations.map((path) => (
                      <li key={path.key}>
                        <span className="font-semibold">
                          {path.label}（{path.position}）：{path.status}；
                        </span>
                        {path.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* 核心用神与喜忌仇闲 */}
      <div id="bazi-useful-god-detail" className="minglu-subblock">
        <h3 className="minglu-subblock-title">核心用神与喜忌体系</h3>
        <div className="minglu-card-grid minglu-card-grid-2">
          <div className="minglu-card border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-lg">
                {pattern.transformation?.status === '成化'
                  ? '化神取用 / 原日主十神'
                  : '核心用神 / 喜神'}
              </span>
              <span className="minglu-pill is-green">{usefulGods.usefulGodCategory}</span>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-2">
              {pattern.transformation?.status === '成化'
                ? `化神${pattern.transformation.element}`
                : usefulGods.primaryUseful}
            </div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              喜用五行：{usefulGods.favorable.join('、') || '顺应大势'}
            </div>
            {pattern.transformation?.status === '成化' ? (
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                原日主十神映射：{usefulGods.primaryUseful}（本命事实）
              </div>
            ) : null}
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
