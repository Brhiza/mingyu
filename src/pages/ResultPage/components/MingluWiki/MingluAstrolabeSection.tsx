import React from 'react';
import type { MingluAstrolabeSectionData } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluAstrolabeSectionData;
}

export const MingluAstrolabeSection: React.FC<Props> = ({ data }) => {
  const { points, angles, aspects, distributions, dayNight } = data;

  return (
    <section id="astrolabe-chart-dossier" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">10</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第十章：西洋占星本命图谱与相位网格</h2>
          <p className="minglu-section-subtitle">
            十大行星、四轴四宫、全量本命相位网格与元素形态分布（
            {dayNight.isDayChart ? '日生盘' : '夜生盘'}）
          </p>
        </div>
      </div>

      {/* 行星与四轴落宫表格 */}
      <div id="astrolabe-planets-table" className="minglu-subblock">
        <h3 className="minglu-subblock-title">十大星体与四轴落点</h3>
        <div className="minglu-table-wrap">
          <table className="minglu-table">
            <thead>
              <tr>
                <th>星体/轴点</th>
                <th>黄道星座</th>
                <th>度数分秒</th>
                <th>落入宫位</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {[...points, ...angles].map((p, idx) => (
                <tr key={idx}>
                  <td className="font-bold">
                    <MingluLink targetAnchorId="glossary-encyclopedia" category="占星">
                      {p.label} ({p.name})
                    </MingluLink>
                  </td>
                  <td className="font-medium text-amber-700 dark:text-amber-400">{p.sign}</td>
                  <td className="font-mono text-sm">{p.formatted}</td>
                  <td>第 {p.house} 宫</td>
                  <td>{p.isRetrograde ? '逆行 ℞' : '顺行'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 相位网格 */}
      <div id="astrolabe-aspects-grid" className="minglu-subblock">
        <h3 className="minglu-subblock-title">本命相位全景网格 (共 {aspects.length} 组相位)</h3>
        <div className="minglu-card-grid minglu-card-grid-3">
          {aspects.map((asp, idx) => (
            <div
              key={idx}
              className={`minglu-card is-${asp.nature === '和谐' ? 'good' : asp.nature === '挑战' ? 'bad' : 'neutral'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm">
                  {asp.body1} ↔ {asp.body2}
                </span>
                <span
                  className={`minglu-pill is-${asp.nature === '和谐' ? 'green' : asp.nature === '挑战' ? 'red' : 'gray'}`}
                >
                  {asp.type} ({asp.angle}°)
                </span>
              </div>
              <div className="text-xs text-slate-500">
                容许度: {asp.orb.toFixed(2)}° · {asp.closeness}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 四元素与三形态 */}
      <div id="astrolabe-elements-chart" className="minglu-subblock">
        <h3 className="minglu-subblock-title">四元素与三形态能量分布</h3>
        <div className="minglu-card-grid minglu-card-grid-2">
          <div className="minglu-card">
            <h4 className="font-bold text-base mb-3">四元素能量比例</h4>
            {Object.entries(distributions.elements).map(([elem, info]) => (
              <div key={elem} className="mb-2">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>
                    {elem}元素 ({info.points.join('、') || '无'})
                  </span>
                  <span>
                    {info.percentage}% ({info.count}星)
                  </span>
                </div>
                <div className="minglu-progress-bar-bg">
                  <div
                    className="minglu-progress-bar-fill"
                    style={{ width: `${info.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="minglu-card">
            <h4 className="font-bold text-base mb-3">三形态能量分布</h4>
            {Object.entries(distributions.modalities).map(([mod, info]) => (
              <div key={mod} className="mb-2">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>
                    {mod}形态 ({info.points.join('、') || '无'})
                  </span>
                  <span>
                    {info.percentage}% ({info.count}星)
                  </span>
                </div>
                <div className="minglu-progress-bar-bg">
                  <div
                    className="minglu-progress-bar-fill"
                    style={{ width: `${info.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
