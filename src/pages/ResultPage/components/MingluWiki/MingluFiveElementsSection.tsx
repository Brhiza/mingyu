import React from 'react';
import type { MingluFiveElementsSectionData } from 'mingyu-core/minglu';

interface Props {
  data: MingluFiveElementsSectionData;
}

const WUXING_COLORS: Record<string, string> = {
  木: '#10b981',
  火: '#ef4444',
  土: '#d97706',
  金: '#eab308',
  水: '#06b6d4',
};

export const MingluFiveElementsSection: React.FC<Props> = ({ data }) => {
  const { elements, dayMasterStrength } = data;

  return (
    <section id="bazi-five-elements" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">02</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第二章：日主精微与五行能量全息剖析</h2>
          <p className="minglu-section-subtitle">
            天干地支加权量化、五行同异类比例、通根透干与旺衰强弱综合判定
          </p>
        </div>
      </div>

      {/* 五行分布条形图与打分 */}
      <div id="bazi-elements-distribution" className="minglu-subblock">
        <h3 className="minglu-subblock-title">五行结构加权分布</h3>
        <div className="minglu-elements-grid">
          {elements.map((el) => (
            <div key={el.wuxing} className="minglu-element-card">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg" style={{ color: WUXING_COLORS[el.wuxing] }}>
                  {el.wuxing}行
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium">
                  {el.seasonStatus}
                </span>
              </div>
              <div className="minglu-element-score-wrap">
                <span className="text-2xl font-black">{el.score}</span>
                <span className="text-xs text-slate-500 ml-1">加权计数 ({el.percentage}%)</span>
              </div>
              <div className="minglu-progress-bar-bg">
                <div
                  className="minglu-progress-bar-fill"
                  style={{
                    width: `${el.percentage}%`,
                    backgroundColor: WUXING_COLORS[el.wuxing],
                  }}
                />
              </div>
              <div className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>干支本气次数: {el.count}</span>
                <span>
                  {el.isDominant
                    ? '计数最多'
                    : el.isMissing
                      ? '缺此行'
                      : el.isWeakest
                        ? '计数最少'
                        : '有分布'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 日主旺衰与同异类比值 */}
      <div id="bazi-daymaster-strength" className="minglu-subblock">
        <h3 className="minglu-subblock-title">日主旺衰与同异类力量比值</h3>
        <div className="minglu-strength-dashboard">
          <div className="minglu-strength-main-card">
            <div className="text-sm font-semibold text-slate-500 mb-1">综合旺衰评定</div>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-2">
              【{dayMasterStrength.status}】
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
              {dayMasterStrength.judgmentSummary}
            </p>

            {/* 同类 vs 异类比值 */}
            <div className="minglu-ratio-container">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-600">
                  同类生扶 (印比帮身): {dayMasterStrength.sameKindScore}分 (
                  {dayMasterStrength.sameRatio}%)
                </span>
                <span className="text-rose-600">
                  异类耗泄 (财官伤食): {dayMasterStrength.diffKindScore}分 (
                  {dayMasterStrength.diffRatio}%)
                </span>
              </div>
              <div className="minglu-dual-progress">
                <div
                  className="minglu-dual-bar is-same"
                  style={{ width: `${dayMasterStrength.sameRatio}%` }}
                />
                <div
                  className="minglu-dual-bar is-diff"
                  style={{ width: `${dayMasterStrength.diffRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* 判定维度指标卡 */}
          <div className="minglu-dimensions-grid">
            <div
              className={`minglu-dim-item ${dayMasterStrength.dimensions.timely ? 'is-true' : 'is-false'}`}
            >
              <span className="minglu-dim-label">得令 (月令提纲)</span>
              <span className="minglu-dim-val">
                {dayMasterStrength.dimensions.timely ? '得令' : '不得令'} (
                {dayMasterStrength.dimensions.seasonalEffect})
              </span>
            </div>
            <div
              className={`minglu-dim-item ${dayMasterStrength.dimensions.hasRoot ? 'is-true' : 'is-false'}`}
            >
              <span className="minglu-dim-label">得地 (地支通根)</span>
              <span className="minglu-dim-val">
                {dayMasterStrength.dimensions.hasStrongRoot
                  ? '得强根'
                  : dayMasterStrength.dimensions.hasRoot
                    ? '有通根'
                    : '无明显根'}
              </span>
            </div>
            <div
              className={`minglu-dim-item ${dayMasterStrength.dimensions.supported ? 'is-true' : 'is-false'}`}
            >
              <span className="minglu-dim-label">得生 (印星生扶)</span>
              <span className="minglu-dim-val">
                {dayMasterStrength.dimensions.supported ? '得印星生' : '无印生'}
              </span>
            </div>
            <div
              className={`minglu-dim-item ${dayMasterStrength.dimensions.assisted ? 'is-true' : 'is-false'}`}
            >
              <span className="minglu-dim-label">得助 (比劫帮扶)</span>
              <span className="minglu-dim-val">
                {dayMasterStrength.dimensions.assisted ? '透干有比劫' : '透干无比劫'}
              </span>
            </div>
          </div>
        </div>

        {/* 规则依据追溯 */}
        {dayMasterStrength.ruleBasis && dayMasterStrength.ruleBasis.length > 0 && (
          <div className="minglu-rules-trace mt-4">
            <div className="text-xs font-bold text-slate-500 mb-2">判定规则依据链：</div>
            <ul className="minglu-trace-list">
              {dayMasterStrength.ruleBasis.map((r, i) => (
                <li key={i} className="minglu-trace-item">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};
