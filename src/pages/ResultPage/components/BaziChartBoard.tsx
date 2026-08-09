import { Suspense, lazy, memo, type ReactNode } from 'react';
import {
  getShenShaType,
  getTenGodForBranch,
  getWuxing,
  type BaziChartResult,
} from 'mingyu-core/bazi';
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

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const BAZI_BOARD_COMMON_SHENSHA = new Set([
  '天乙贵人',
  '天德贵人',
  '月德贵人',
  '天德合',
  '月德合',
  '天赦日',
  '禄神',
  '驿马',
  '太极贵人',
  '将星',
  '学堂',
  '词馆',
  '国印贵人',
  '三奇贵人',
  '文昌贵人',
  '华盖',
  '天医',
  '金舆',
  '空亡',
  '灾煞',
  '劫煞',
  '亡神',
  '羊刃',
  '飞刃',
  '血刃',
  '流霞',
  '四废日',
  '天罗地网',
  '桃花',
  '孤辰',
  '寡宿',
  '阴差阳错',
  '魁罡',
  '孤鸾煞',
  '红鸾',
  '天喜',
  '勾绞煞',
  '红艳煞',
  '十恶大败',
  '元辰',
  '金神',
  '天转',
  '地转',
  '丧门',
  '吊客',
  '披麻',
  '十灵日',
  '六秀日',
  '八专',
  '九丑',
  '童子煞',
  '天厨贵人',
  '福星贵人',
  '德秀贵人',
  '拱禄',
]);

const BAZI_BOARD_SHENSHA_DISPLAY_NAMES: Record<string, string> = {
  天乙: '天乙贵人',
  天德: '天德贵人',
  月德: '月德贵人',
  太极: '太极贵人',
  国印: '国印贵人',
  文昌: '文昌贵人',
  天厨: '天厨贵人',
  福星: '福星贵人',
  德秀: '德秀贵人',
  天罗: '天罗地网',
  地网: '天罗地网',
  孤鸾: '孤鸾煞',
  勾绞: '勾绞煞',
  红艳: '红艳煞',
  童子: '童子煞',
};

function filterBaziBoardShensha(items: string[]) {
  return uniqueNonEmptyStrings(
    items.map((item) => BAZI_BOARD_SHENSHA_DISPLAY_NAMES[item] ?? item),
  ).filter((item) => BAZI_BOARD_COMMON_SHENSHA.has(item));
}

function BaziGanZhiValue(props: { value: string }) {
  const wuxing = getWuxing(props.value);

  return (
    <span className="bazi-ganzhi-value">
      <strong className="bazi-ganzhi-symbol">{props.value}</strong>
      <small className="bazi-wuxing-label" data-wuxing={wuxing}>
        {wuxing}
      </small>
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
  const dayOwnerLabel =
    result.gender === 'male' ? '元男' : result.gender === 'female' ? '元女' : '';
  const pillarRows: Array<{
    label: string;
    values: ReactNode[];
    className?: string;
  }> = [
    {
      label: '天干十神',
      values: PILLAR_KEYS.map((key) =>
        key === 'day' && dayOwnerLabel ? dayOwnerLabel : result.tenGods[key],
      ),
    },
    {
      label: '天干',
      values: PILLAR_KEYS.map((key) => (
        <BaziGanZhiValue key={key} value={result.pillars[key].gan} />
      )),
      className: 'is-stem',
    },
    {
      label: '地支',
      values: PILLAR_KEYS.map((key) => (
        <BaziGanZhiValue key={key} value={result.pillars[key].zhi} />
      )),
      className: 'is-branch',
    },
    {
      label: '地支十神',
      values: PILLAR_KEYS.map((key) =>
        getTenGodForBranch(result.pillars[key].zhi, result.dayMaster.gan),
      ),
    },
    {
      label: '藏干',
      values: PILLAR_KEYS.map((key) => joinMultilineText(result.hiddenStems[key], '无')),
      className: 'is-multiline',
    },
    {
      label: '藏干十神',
      values: PILLAR_KEYS.map((key) => joinMultilineText(result.hiddenTenGods[key], '无')),
      className: 'is-multiline',
    },
    {
      label: '纳音',
      values: PILLAR_KEYS.map((key) => result.nayin[key]),
    },
    {
      label: '自坐',
      values: PILLAR_KEYS.map((key) => result.ziZuo[key]),
    },
    {
      label: '长生',
      values: PILLAR_KEYS.map((key) => result.pillarLifeStages[key]),
    },
    {
      label: '空亡',
      values: PILLAR_KEYS.map((key) => joinMultilineText(result.kongWang[key], '无')),
      className: 'is-multiline',
    },
    {
      label: '神煞',
      values: PILLAR_KEYS.map((key) => (
        <BaziShenShaList
          items={
            key === 'year'
              ? [...(result.shensha.global ?? []), ...result.shensha[key]]
              : result.shensha[key]
          }
          key={key}
        />
      )),
      className: 'is-shensha',
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
          <strong>
            {result.analysis.usefulGod.primaryUseful || result.analysis.usefulGod.useful || '待定'}
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

          <Suspense fallback={<BaziFortuneLoadingCard />}>
            <LazyBaziFortuneSelector result={result} />
          </Suspense>
        </div>
      </div>
    </section>
  );
});
