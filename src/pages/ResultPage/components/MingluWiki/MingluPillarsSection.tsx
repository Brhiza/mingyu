import React from 'react';
import type { MingluPillarsSectionData, MingluMetadata } from 'mingyu-core/minglu';
import { MingluLink } from './MingluLink';

interface Props {
  data: MingluPillarsSectionData;
  metadata: MingluMetadata;
}

export const MingluPillarsSection: React.FC<Props> = ({ data, metadata }) => {
  return (
    <section id="bazi-pillars-matrix" className="minglu-section">
      <div className="minglu-section-header">
        <span className="minglu-section-num">01</span>
        <div className="minglu-section-title-wrap">
          <h2 className="minglu-section-title">第一章：命录提纲与四柱全息矩阵</h2>
          <p className="minglu-section-subtitle">
            天干地支、藏干十神、纳音五行、三垣胎元胎息与月令司令权柄之全景建构
          </p>
        </div>
      </div>

      {/* 命盘基本元信息卡片 */}
      <div className="minglu-meta-grid">
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">命主身份</span>
          <span className="minglu-meta-value font-bold">
            {metadata.subjectName} ({metadata.genderLabel})
          </span>
        </div>
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">公历生辰</span>
          <span className="minglu-meta-value">
            {metadata.solarDateStr} {metadata.exactBirthTime || metadata.shichenName}
          </span>
        </div>
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">农历生辰</span>
          <span className="minglu-meta-value">
            {metadata.lunarDateStr} ({metadata.zodiac}年 / {metadata.constellation})
          </span>
        </div>
        <div className="minglu-meta-item">
          <span className="minglu-meta-label">真太阳时</span>
          <span className="minglu-meta-value">
            {metadata.isTrueSolarTime ? `已校正 (${metadata.trueSolarTimeStr})` : '未开启校正'}
            {metadata.birthPlace && ` · ${metadata.birthPlace}`}
          </span>
        </div>
      </div>

      {/* 四柱全息大矩阵表格 */}
      <div id="bazi-matrix-table" className="minglu-table-wrap">
        <table className="minglu-table minglu-matrix-table">
          <thead>
            <tr>
              <th className="minglu-th-corner">柱位特征</th>
              {data.columns.map((col) => (
                <th
                  key={col.key}
                  className={`minglu-th-pillar ${col.isDayMaster ? 'is-daymaster-col' : ''}`}
                >
                  <div className="minglu-pillar-th-title">{col.label}</div>
                  {col.caption && <div className="minglu-pillar-th-sub">{col.caption}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="minglu-td-label">天干十神</td>
              {data.columns.map((col) => (
                <td
                  key={col.key}
                  className="minglu-td-cell font-medium text-amber-700 dark:text-amber-300"
                >
                  {col.isDayMaster ? (
                    <span className="minglu-pill is-primary">{col.ganTenGod}</span>
                  ) : (
                    <MingluLink targetAnchorId="bazi-ten-gods-symbology" category="十神">
                      {col.ganTenGod}
                    </MingluLink>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">天干字样</td>
              {data.columns.map((col) => (
                <td
                  key={col.key}
                  className={`minglu-td-cell font-bolder text-xl ${col.isDayMaster ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600' : ''}`}
                >
                  <MingluLink targetAnchorId={`glossary-${col.gan}`} category="天干">
                    {col.gan}
                  </MingluLink>
                  <span className="minglu-sub-wuxing">({col.ganWuxing})</span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">地支字样</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell font-bolder text-xl">
                  <MingluLink targetAnchorId={`glossary-${col.zhi}`} category="地支">
                    {col.zhi}
                  </MingluLink>
                  <span className="minglu-sub-wuxing">({col.zhiWuxing})</span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">地支本气</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-sm">
                  {col.zhiTenGod}
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">支藏人元</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-xs">
                  <div className="minglu-hidden-stems-flex">
                    {col.hiddenStems.map((hs, i) => (
                      <span key={i} className={`minglu-hidden-stem-tag is-${hs.role}`}>
                        <span className="font-semibold">{hs.stem}</span>
                        <span className="opacity-75">({hs.tenGod})</span>
                        <span className="minglu-role-badge">{hs.role}</span>
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">纳音五行</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-sm font-medium">
                  {col.nayin}
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">日元长生</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-sm">
                  <MingluLink targetAnchorId="bazi-life-stages-matrix" category="长生">
                    {col.lifeStage}
                  </MingluLink>
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">干支自坐</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-sm text-slate-500">
                  {col.ziZuo}
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">空亡支位</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-sm text-slate-400">
                  {col.kongWang.join('、')}
                </td>
              ))}
            </tr>
            <tr>
              <td className="minglu-td-label">柱带神煞</td>
              {data.columns.map((col) => (
                <td key={col.key} className="minglu-td-cell text-xs">
                  <div className="minglu-shensha-tags-wrap">
                    {col.shensha.length > 0 ? (
                      col.shensha.map((s, i) => (
                        <MingluLink
                          key={i}
                          targetAnchorId={`shensha-${s}`}
                          category="神煞"
                          className="minglu-shensha-tag"
                        >
                          {s}
                        </MingluLink>
                      ))
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 三垣与命身宫全览 */}
      <div id="bazi-sanyuan" className="minglu-subblock">
        <h3 className="minglu-subblock-title">三垣胎元胎息与命身宫</h3>
        <div className="minglu-card-grid minglu-card-grid-4">
          <div className="minglu-card">
            <div className="minglu-card-header">
              <span className="minglu-card-badge">受气之源</span>
              <h4 className="minglu-card-title">胎元 · {data.sanYuan.taiYuan.ganZhi}</h4>
            </div>
            <p className="minglu-card-sub">纳音：{data.sanYuan.taiYuan.nayin}</p>
            <p className="minglu-card-body">{data.sanYuan.taiYuan.desc}</p>
          </div>
          <div className="minglu-card">
            <div className="minglu-card-header">
              <span className="minglu-card-badge">精神归聚</span>
              <h4 className="minglu-card-title">胎息 · {data.sanYuan.taiXi.ganZhi}</h4>
            </div>
            <p className="minglu-card-sub">纳音：{data.sanYuan.taiXi.nayin}</p>
            <p className="minglu-card-body">{data.sanYuan.taiXi.desc}</p>
          </div>
          <div className="minglu-card">
            <div className="minglu-card-header">
              <span className="minglu-card-badge">立命安身</span>
              <h4 className="minglu-card-title">命宫 · {data.sanYuan.mingGong.ganZhi}</h4>
            </div>
            <p className="minglu-card-sub">纳音：{data.sanYuan.mingGong.nayin}</p>
            <p className="minglu-card-body">{data.sanYuan.mingGong.desc}</p>
          </div>
          <div className="minglu-card">
            <div className="minglu-card-header">
              <span className="minglu-card-badge">后天修为</span>
              <h4 className="minglu-card-title">身宫 · {data.sanYuan.shenGong.ganZhi}</h4>
            </div>
            <p className="minglu-card-sub">纳音：{data.sanYuan.shenGong.nayin}</p>
            <p className="minglu-card-body">{data.sanYuan.shenGong.desc}</p>
          </div>
        </div>
      </div>

      {/* 节气令星与月令司令 */}
      <div id="bazi-season" className="minglu-subblock">
        <h3 className="minglu-subblock-title">节气令星与月令司令</h3>
        <div className="minglu-notice-banner">
          <div className="minglu-notice-content">
            <div className="font-bold text-base mb-1">
              当前节气：{data.seasonInfo.jieqiName}（{data.seasonInfo.currentSeason}）· 司令用事：【
              {data.seasonInfo.monthCommander}】
            </div>
            <p className="text-sm opacity-90">{data.seasonInfo.monthCommanderDesc}</p>
          </div>
        </div>
      </div>

      {/* 命卦吉凶方位 */}
      {data.mingGuaInfo && (
        <div className="minglu-subblock">
          <h3 className="minglu-subblock-title">
            本命卦位与八方吉凶 ({data.mingGuaInfo.name} · {data.mingGuaInfo.eastWest})
          </h3>
          <div className="minglu-card-grid minglu-card-grid-3">
            {data.mingGuaInfo.directions.map((dir, idx) => (
              <div
                key={idx}
                className={`minglu-card minglu-direction-card is-${dir.type === '吉' ? 'auspicious' : 'inauspicious'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-base">{dir.name}</span>
                  <span className={`minglu-pill is-${dir.type === '吉' ? 'green' : 'red'}`}>
                    {dir.type}
                  </span>
                </div>
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  方位：{dir.direction}
                </div>
                <div className="text-xs opacity-80">{dir.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
