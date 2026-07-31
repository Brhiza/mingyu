import { Suspense, lazy, memo } from 'react';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import {
  formatAvoidGodPrioritySummary,
  formatBaziDate,
  formatGender,
  formatUsefulGodPrioritySummary,
  joinMultilineText,
} from '../ResultPage.helpers';
import { BaziFortuneLoadingCard } from './skeletons';

const LazyBaziFortuneSelector = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools/BaziFortuneSelector');
  return { default: module.BaziFortuneSelector };
});

export const BaziChartBoard = memo(function BaziChartBoard(props: {
  title: string;
  name: string;
  result: BaziChartResult;
}) {
  const { title, name, result } = props;
  const missingElements = uniqueNonEmptyStrings(result.wuxingStrength.missing);
  const warnings = uniqueNonEmptyStrings(result.warnings);
  const referenceItems: Array<{ label: string; value: string; detail: string }> = [];

  if (result.mingGua) {
    referenceItems.push({
      label: '命卦',
      value: `${result.mingGua.gua}${result.mingGua.number}`,
      detail: `${result.mingGua.eastWest} · ${result.mingGua.element}`,
    });
  }

  if (result.mingGong) {
    referenceItems.push({ label: '命宫', value: result.mingGong, detail: '本命根基' });
  }

  if (result.shenGong) {
    referenceItems.push({ label: '身宫', value: result.shenGong, detail: '后天着力' });
  }
  const pillarRows = [
    {
      label: '天干',
      values: [
        result.pillars.year.gan,
        result.pillars.month.gan,
        result.pillars.day.gan,
        result.pillars.hour.gan,
      ],
      className: 'is-stem',
    },
    {
      label: '地支',
      values: [
        result.pillars.year.zhi,
        result.pillars.month.zhi,
        result.pillars.day.zhi,
        result.pillars.hour.zhi,
      ],
      className: 'is-branch',
    },
    {
      label: '十神',
      values: [result.tenGods.year, result.tenGods.month, result.tenGods.day, result.tenGods.hour],
    },
    {
      label: '藏干',
      values: [
        joinMultilineText(result.hiddenStems.year, '无'),
        joinMultilineText(result.hiddenStems.month, '无'),
        joinMultilineText(result.hiddenStems.day, '无'),
        joinMultilineText(result.hiddenStems.hour, '无'),
      ],
      className: 'is-multiline',
    },
    {
      label: '副星',
      values: [
        joinMultilineText(result.hiddenTenGods.year, '无'),
        joinMultilineText(result.hiddenTenGods.month, '无'),
        joinMultilineText(result.hiddenTenGods.day, '无'),
        joinMultilineText(result.hiddenTenGods.hour, '无'),
      ],
      className: 'is-multiline',
    },
    {
      label: '纳音',
      values: [result.nayin.year, result.nayin.month, result.nayin.day, result.nayin.hour],
    },
    {
      label: '长生',
      values: [
        result.pillarLifeStages.year,
        result.pillarLifeStages.month,
        result.pillarLifeStages.day,
        result.pillarLifeStages.hour,
      ],
    },
    {
      label: '神煞',
      values: [
        joinMultilineText(result.shensha.year.slice(0, 3), '无'),
        joinMultilineText(result.shensha.month.slice(0, 3), '无'),
        joinMultilineText(result.shensha.day.slice(0, 3), '无'),
        joinMultilineText(result.shensha.hour.slice(0, 3), '无'),
      ],
      className: 'is-multiline',
    },
  ];

  return (
    <section className="result-showcase-card bazi-showcase-card">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">{formatGender(result.gender)}</span>
          <span className="result-chip">{formatBaziDate(result)}</span>
          <span className="result-chip">{result.timeInfo.name}时</span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="bazi-warning-list" role="note" aria-label="排盘预警">
          {warnings.map((warning) => (
            <div className="bazi-warning-item" key={warning}>
              <strong>排盘预警</strong>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="result-summary-grid result-summary-grid-bazi">
        <div className="result-stat-card result-stat-card-accent">
          <span>日主</span>
          <strong>{result.dayMaster.gan}</strong>
          <small>
            {result.dayMaster.element} · {result.dayMaster.yinYang}
          </small>
        </div>
        <div className="result-stat-card">
          <span>命格</span>
          <strong>{result.analysis.mingGe.pattern}</strong>
          <small>{result.analysis.dayMasterStrength.status}</small>
        </div>
        <div className="result-stat-card">
          <span>核心用神</span>
          <strong>待定</strong>
          <small>{formatUsefulGodPrioritySummary(result)}</small>
        </div>
        <div className="result-stat-card">
          <span>核心忌神</span>
          <strong>待定</strong>
          <small>{formatAvoidGodPrioritySummary(result)}</small>
        </div>
      </div>

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div className="bazi-pillars-header">
            <h3>四柱盘</h3>
          </div>
          <div className="bazi-pillars-table">
            <div className="bazi-pillars-cell is-label is-head">信息</div>
            <div className="bazi-pillars-cell is-head">年柱</div>
            <div className="bazi-pillars-cell is-head">月柱</div>
            <div className="bazi-pillars-cell is-head is-day-master">日柱</div>
            <div className="bazi-pillars-cell is-head">时柱</div>
            {pillarRows.flatMap((row) => [
              <div key={`${row.label}-label`} className="bazi-pillars-cell is-label">
                {row.label}
              </div>,
              ...row.values.map((value, index) => (
                <div
                  key={`${row.label}-${index}`}
                  className={`bazi-pillars-cell ${row.className ?? ''} ${
                    index === 2 ? 'is-day-master' : ''
                  }`}
                >
                  {value}
                </div>
              )),
            ])}
          </div>
        </div>

        <div className="bazi-side-panel">
          <div className="result-side-card bazi-fortune-card">
            <div className="result-side-head">
              <h3>五行分布</h3>
            </div>
            <div className="result-tag-cloud">
              {result.wuxingStrength.present.map((item) => (
                <span className="result-soft-tag" key={item}>
                  见 {item}
                </span>
              ))}
              {missingElements.map((item) => (
                <span className="result-soft-tag" key={item}>
                  缺 {item}
                </span>
              ))}
            </div>
          </div>

          {referenceItems.length > 0 ? (
            <div className="result-side-card bazi-reference-card">
              <div className="result-side-head">
                <h3>基础参考</h3>
              </div>
              <div className="bazi-reference-grid">
                {referenceItems.map((item) => (
                  <div className="bazi-reference-item" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.detail}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Suspense fallback={<BaziFortuneLoadingCard />}>
            <LazyBaziFortuneSelector result={result} />
          </Suspense>
        </div>
      </div>
    </section>
  );
});
