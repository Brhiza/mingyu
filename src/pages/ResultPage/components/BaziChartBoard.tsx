import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  filterCommonBaziShenSha,
  getShenShaType,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
  isGanZhiPair,
  ShenShaCalculator,
  type BaziChartResult,
} from 'mingyu-core/bazi';
import { HIDDEN_STEMS, NAYIN_MAP } from '@core/bazi/baziMappingsData';
import { getLifeStage } from '@core/bazi/baziValues';
import { calculateKongWangBranches } from '@core/bazi/kongWang';
import { uniqueNonEmptyStrings } from '@/lib/array-utils';
import {
  BaziFortuneSelector,
  type BaziFortuneDisplayColumn,
} from '@/components/BaziFortuneTools/BaziFortuneSelector';
import {
  formatAvoidGodPrioritySummary,
  formatBaziDate,
  formatGender,
  formatUsefulGodPrioritySummary,
  joinMultilineText,
} from '../ResultPage.helpers';
const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;
const fortuneShenShaCalculator = new ShenShaCalculator();

type BaziBoardColumn = {
  key: string;
  label: string;
  caption?: string;
  gan: string;
  zhi: string;
  ganTenGod: string;
  zhiTenGod: string;
  hiddenStems: string[];
  hiddenTenGods: string[];
  nayin: string;
  ziZuo: string;
  lifeStage: string;
  kongWang: string[];
  shensha: string[];
  isDayMaster?: boolean;
};

function filterBaziBoardShensha(items: string[]) {
  return filterCommonBaziShenSha(uniqueNonEmptyStrings(items));
}

function calculateBaziFortuneShensha(result: BaziChartResult, gan: string, zhi: string) {
  const comparisonPillars: Parameters<ShenShaCalculator['calculateAllShenSha']>[0] = [
    [result.pillars.year.gan, result.pillars.year.zhi],
    [result.pillars.month.gan, result.pillars.month.zhi],
    [result.pillars.day.gan, result.pillars.day.zhi],
    [gan, zhi],
  ];
  const shensha = fortuneShenShaCalculator.calculateAllShenSha(
    comparisonPillars,
    result.gender,
  ).hour;
  return filterBaziBoardShensha(shensha);
}

function BaziGanZhiValue(props: { value: string }) {
  const wuxing = getWuxing(props.value);

  return (
    <span className="bazi-ganzhi-value">
      <strong
        className="bazi-ganzhi-symbol"
        data-wuxing={wuxing}
        aria-label={`${props.value}，五行属${wuxing}`}
      >
        {props.value}
      </strong>
    </span>
  );
}

function BaziPillarValue(props: {
  gan: string;
  zhi: string;
  ganTenGod: string;
  zhiTenGod: string;
}) {
  return (
    <span className="bazi-pillar-value">
      <small>{props.ganTenGod}</small>
      <span className="bazi-pillar-ganzhi">
        <BaziGanZhiValue value={props.gan} />
        <BaziGanZhiValue value={props.zhi} />
      </span>
      <em>{props.zhiTenGod}</em>
    </span>
  );
}

function BaziHiddenStemList(props: { stems: string[]; tenGods: string[] }) {
  if (props.stems.length === 0) {
    return <span className="bazi-shensha-empty">无</span>;
  }

  return (
    <span className="bazi-hidden-stem-list">
      {props.stems.map((stem, index) => {
        const wuxing = getWuxing(stem);
        return (
          <span key={`${stem}-${index}`}>
            <strong data-wuxing={wuxing}>{stem}</strong>
            <small>{props.tenGods[index] ?? ''}</small>
          </span>
        );
      })}
    </span>
  );
}

function BaziShenShaList(props: { items: string[] }) {
  const items = filterBaziBoardShensha(props.items);

  if (items.length === 0) {
    return <span className="bazi-shensha-empty">无</span>;
  }

  return (
    <span className="bazi-shensha-list">
      {items.map((item) => {
        const type = getShenShaType(item === '天罗地网' ? '天罗' : item);
        const toneClassName =
          type === '吉' ? 'is-lucky' : type === '凶' ? 'is-unlucky' : 'is-neutral';

        return (
          <span
            className={`bazi-shensha-tag ${toneClassName}`}
            aria-label={`${item}（${type}）`}
            key={item}
          >
            {item}
          </span>
        );
      })}
    </span>
  );
}

export const BaziChartBoard = memo(function BaziChartBoard(props: {
  title: string;
  name: string;
  result: BaziChartResult;
  isInstant?: boolean;
  timeBasisLabel?: string;
}) {
  const { title, name, result, isInstant = false, timeBasisLabel } = props;
  const [fortuneColumns, setFortuneColumns] = useState<BaziFortuneDisplayColumn[]>([]);
  const missingElements = uniqueNonEmptyStrings(result.wuxingStrength.missing);
  const warnings = uniqueNonEmptyStrings(result.warnings);
  const referenceItems: Array<{ label: string; value: string; detail: string }> = [];

  if (!isInstant && result.mingGua) {
    referenceItems.push({
      label: '命卦',
      value: `${result.mingGua.gua}${result.mingGua.number}`,
      detail: `${result.mingGua.eastWest} · ${result.mingGua.element}`,
    });
  }

  if (!isInstant && result.mingGong) {
    referenceItems.push({ label: '命宫', value: result.mingGong, detail: '本命根基' });
  }

  if (!isInstant && result.shenGong) {
    referenceItems.push({ label: '身宫', value: result.shenGong, detail: '后天着力' });
  }
  const dayOwnerLabel = isInstant
    ? '日元'
    : result.gender === 'male'
      ? '元男'
      : result.gender === 'female'
        ? '元女'
        : '';
  const natalColumns: BaziBoardColumn[] = PILLAR_KEYS.map((key, index) => ({
    key,
    label: PILLAR_LABELS[index],
    gan: result.pillars[key].gan,
    zhi: result.pillars[key].zhi,
    ganTenGod: key === 'day' && dayOwnerLabel ? dayOwnerLabel : result.tenGods[key],
    zhiTenGod: getTenGodForBranch(result.pillars[key].zhi, result.dayMaster.gan),
    hiddenStems: result.hiddenStems[key],
    hiddenTenGods: result.hiddenTenGods[key],
    nayin: result.nayin[key],
    ziZuo: result.ziZuo[key],
    lifeStage: result.lifeStages[key],
    kongWang: result.kongWang[key],
    shensha:
      key === 'year'
        ? [...(result.shensha.global ?? []), ...result.shensha[key]]
        : result.shensha[key],
    isDayMaster: key === 'day',
  }));
  const activeFortuneColumns: BaziBoardColumn[] = fortuneColumns.flatMap((column) => {
    if (!isGanZhiPair(column.ganZhi[0], column.ganZhi[1])) return [];
    const [gan, zhi] = column.ganZhi.split('');
    const hiddenStems = HIDDEN_STEMS[zhi] ?? [];
    return [
      {
        ...column,
        key: `fortune-${column.key}`,
        gan,
        zhi,
        ganTenGod: getTenGod(gan, result.dayMaster.gan),
        zhiTenGod: getTenGodForBranch(zhi, result.dayMaster.gan),
        hiddenStems,
        hiddenTenGods: hiddenStems.map((stem) => getTenGod(stem, result.dayMaster.gan)),
        nayin: NAYIN_MAP[column.ganZhi] ?? '—',
        ziZuo: getLifeStage(gan, zhi),
        lifeStage: getLifeStage(result.dayMaster.gan, zhi),
        kongWang: calculateKongWangBranches(gan, zhi),
        shensha: calculateBaziFortuneShensha(result, gan, zhi),
      },
    ];
  });
  const boardColumns = [...natalColumns, ...activeFortuneColumns];
  const boardStyle = {
    '--bazi-display-column-count': boardColumns.length,
    '--bazi-table-min-width': `${58 + boardColumns.length * 68}px`,
    '--bazi-mobile-table-min-width': `${38 + boardColumns.length * 48}px`,
    '--bazi-small-mobile-table-min-width': `${34 + boardColumns.length * 44}px`,
  } as CSSProperties;
  const pillarRows: Array<{
    label: string;
    values: ReactNode[];
    className?: string;
  }> = [
    {
      label: '命式',
      values: boardColumns.map((column) => (
        <BaziPillarValue
          key={column.key}
          gan={column.gan}
          zhi={column.zhi}
          ganTenGod={column.ganTenGod}
          zhiTenGod={column.zhiTenGod}
        />
      )),
      className: 'is-pillar',
    },
    {
      label: '藏干',
      values: boardColumns.map((column) => (
        <BaziHiddenStemList
          key={column.key}
          stems={column.hiddenStems}
          tenGods={column.hiddenTenGods}
        />
      )),
      className: 'is-hidden-stems',
    },
    {
      label: '纳音',
      values: boardColumns.map((column) => column.nayin),
    },
    {
      label: '自坐',
      values: boardColumns.map((column) => column.ziZuo),
    },
    {
      label: '长生',
      values: boardColumns.map((column) => column.lifeStage),
    },
    {
      label: '空亡',
      values: boardColumns.map((column) => joinMultilineText(column.kongWang, '无')),
      className: 'is-multiline',
    },
    {
      label: '神煞',
      values: boardColumns.map((column) => (
        <BaziShenShaList items={column.shensha} key={column.key} />
      )),
      className: 'is-shensha',
    },
  ].filter((row) => !isInstant || row.label !== '神煞');

  return (
    <section className="result-showcase-card bazi-showcase-card traditional-chart-layout">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">{title}</p>
          <h2>{name}</h2>
        </div>
        <div className="result-chip-row">
          {!isInstant ? <span className="result-chip">{formatGender(result.gender)}</span> : null}
          {isInstant && timeBasisLabel ? (
            <span className="result-chip result-chip-highlight">{timeBasisLabel}</span>
          ) : null}
          <span className="result-chip">{formatBaziDate(result)}</span>
          <span className="result-chip">{result.timeInfo.name}</span>
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

      {!isInstant ? (
        <div className="result-summary-grid result-summary-grid-bazi">
          <div className="result-stat-card result-stat-card-accent">
            <span>旺衰</span>
            <strong>{result.analysis.dayMasterStrength.status}</strong>
            <small>
              月令{result.analysis.dayMasterStrength.details.seasonalEffect} ·{' '}
              {result.analysis.dayMasterStrength.details.hasRoot ? '有根' : '无根'}
            </small>
          </div>
          <div className="result-stat-card">
            <span>命格</span>
            <strong>{result.analysis.mingGe.pattern}</strong>
            <small>{result.analysis.mingGe.isSpecial ? '特殊格局' : '月令取格'}</small>
          </div>
          <div className="result-stat-card">
            <span>核心用神</span>
            <strong>
              {result.analysis.usefulGod.primaryUseful ||
                result.analysis.usefulGod.useful ||
                '待定'}
            </strong>
            <small>{formatUsefulGodPrioritySummary(result)}</small>
          </div>
          <div className="result-stat-card">
            <span>核心忌神</span>
            <strong>
              {result.analysis.usefulGod.primaryAvoid || result.analysis.usefulGod.avoid || '待定'}
            </strong>
            <small>{formatAvoidGodPrioritySummary(result)}</small>
          </div>
        </div>
      ) : null}

      <div className="bazi-core-layout">
        <div className="bazi-pillars-card">
          <div className="bazi-pillars-header">
            <h3>四柱盘</h3>
          </div>
          <div className="bazi-pillars-scroll">
            <div
              className={`bazi-pillars-table ${activeFortuneColumns.length ? 'has-fortune' : ''}`}
              style={boardStyle}
            >
              <div className="bazi-pillars-cell is-label is-head">信息</div>
              {boardColumns.map((column, index) => (
                <div
                  className={`bazi-pillars-cell is-head ${
                    column.isDayMaster ? 'is-day-master' : ''
                  } ${index === natalColumns.length ? 'is-fortune-start' : ''}`}
                  key={column.key}
                >
                  <span>{column.label}</span>
                  {column.caption ? <small>{column.caption}</small> : null}
                </div>
              ))}
              {pillarRows.flatMap((row) => [
                <div key={`${row.label}-label`} className="bazi-pillars-cell is-label">
                  {row.label}
                </div>,
                ...row.values.map((value, index) => (
                  <div
                    key={`${row.label}-${index}`}
                    className={`bazi-pillars-cell ${row.className ?? ''} ${
                      boardColumns[index]?.isDayMaster ? 'is-day-master' : ''
                    } ${index === natalColumns.length ? 'is-fortune-start' : ''}`}
                  >
                    {value}
                  </div>
                )),
              ])}
            </div>
          </div>
        </div>
      </div>

      <div className="bazi-context-grid">
        <div className="result-side-card bazi-fortune-card">
          <div className="result-side-head">
            <h3>五行分布</h3>
          </div>
          <div className="result-tag-cloud">
            {result.wuxingStrength.present.map((item) => (
              <span className="result-soft-tag" key={item}>
                见 {item}
                {result.wuxingStrength.dominantByRule.includes(item) ? '（结构比较优先）' : ''}
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
      </div>

      {!isInstant ? (
        <div className="bazi-fortune-board">
          <BaziFortuneSelector result={result} onSelectionChange={setFortuneColumns} />
        </div>
      ) : null}
    </section>
  );
});
