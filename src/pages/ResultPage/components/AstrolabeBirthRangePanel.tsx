import { memo } from 'react';
import type {
  AstrolabeBirthRange,
  AstrolabeBirthRangeBranch,
} from 'mingyu-core/divination/astrolabe-birth-range';
import type { AstrolabeData } from 'mingyu-core/types';
import type {
  AstrolabeBirthRangeProgress,
  UseAstrolabeBirthRangeResult,
} from '@/hooks/useAstrolabeBirthRange';
import { AstrolabeBoard } from './AstrolabeBoard';

const BEIJING_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1_000;

const POINT_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  Chiron: '凯龙星',
  Ceres: '谷神星',
  Pallas: '智神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  'North Node': '北交点',
  'True North Node': '北交点',
  'Mean North Node': '北交点',
  'South Node': '南交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
  'True Lilith': '莉莉丝',
  'Mean Lilith': '莉莉丝',
  'Part of Fortune': '福点',
  'Part of Spirit': '精神点',
  Ascendant: '上升',
  Midheaven: '天顶',
  Descendant: '下降',
  'Imum Coeli': '天底',
};

const ASPECT_LABELS: Record<string, string> = {
  conjunction: '合相',
  sextile: '六合',
  square: '刑相',
  trine: '拱相',
  opposition: '冲相',
  'semi-sextile': '半六合',
  semisextile: '半六合',
  'semi-square': '半刑',
  semisquare: '半刑',
  quintile: '五分相',
  sesquiquadrate: '补八分相',
  biquintile: '倍五分相',
};

export type AstrolabeBirthRangePanelProps = Pick<
  UseAstrolabeBirthRangeResult,
  'range' | 'loading' | 'error' | 'progress' | 'cancel' | 'retry'
> & {
  selectedIndex: number;
  onSelect: (index: number) => void;
};

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp + BEIJING_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value);
}

function formatContinuousValue(value: number, unit: string): string {
  return unit === '毫秒时间戳' ? `${formatTimestamp(value)}（北京时间）` : formatNumber(value);
}

function formatRange(startTimestamp: number, endTimestamp: number): string {
  return `${formatTimestamp(startTimestamp)} 至 ${formatTimestamp(endTimestamp)}（起点含、终点不含）`;
}

function getPoints(data: AstrolabeData) {
  return [...data.planets, ...data.angles];
}

function getPoint(data: AstrolabeData, name: string) {
  return getPoints(data).find((point) => point.name === name || point.label === name);
}

function pointDisplayLabel(data: AstrolabeData, name: string): string {
  const point = getPoint(data, name);
  return POINT_LABELS[point?.name ?? name] ?? POINT_LABELS[name] ?? point?.label ?? name;
}

function replacePointNames(text: string, data: AstrolabeData): string {
  const labels = new Map<string, string>();
  for (const point of getPoints(data)) {
    labels.set(point.name, point.label);
    labels.set(point.label, point.label);
  }
  for (const [name, label] of Object.entries(POINT_LABELS)) labels.set(name, label);
  return [...labels.entries()]
    .filter(([name, label]) => name !== label)
    .sort(([first], [second]) => second.length - first.length)
    .reduce((current, [name, label]) => current.replaceAll(name, label), text);
}

function formatContinuousLabel(
  item: AstrolabeBirthRangeBranch['continuous'][number],
  data: AstrolabeData,
): string {
  const aspectMatch = /^aspects\[(.+?)↔(.+?)↔(.+?)\]\.(actualAngle|orb|normalizedOrbRatio)$/u.exec(
    item.path,
  );
  if (aspectMatch) {
    const [, first, type, second, field] = aspectMatch;
    const suffix = field === 'actualAngle' ? '实际夹角' : field === 'orb' ? '偏差' : '容许度比例';
    return `${pointDisplayLabel(data, first)}↔${ASPECT_LABELS[type] ?? type}↔${pointDisplayLabel(data, second)}${suffix}`;
  }
  return replacePointNames(item.label, data);
}

function formatPointState(point: AstrolabeData['planets'][number] | undefined): string {
  if (!point) return '未列出';
  const house = point.house > 0 ? `，第${point.house}宫` : '';
  const motion = point.retrograde === undefined ? '' : point.retrograde ? '，逆行' : '，顺行';
  return `${point.formatted}${house}${motion}`;
}

function pointStateKey(point: AstrolabeData['planets'][number] | undefined): string {
  if (!point) return '缺失';
  return [point.sign, point.house, point.retrograde, point.dignity, point.dignityLabel].join('|');
}

function formatPointChanges(first: AstrolabeData, last: AstrolabeData): string {
  const names = [
    ...first.planets.map((point) => point.name),
    ...first.angles.map((point) => point.name),
    ...last.planets.map((point) => point.name),
    ...last.angles.map((point) => point.name),
  ];
  const uniqueNames = [...new Set(names)];
  const changes = uniqueNames
    .map((name) => {
      const before = getPoint(first, name);
      const after = getPoint(last, name);
      if (pointStateKey(before) === pointStateKey(after)) return null;
      const label = after
        ? pointDisplayLabel(last, after.name)
        : before
          ? pointDisplayLabel(first, before.name)
          : pointDisplayLabel(first, name);
      return `${label}：${formatPointState(before)} → ${formatPointState(after)}`;
    })
    .filter((value): value is string => value !== null);
  return changes.length ? changes.join('；') : '本段首末星体、四轴离散状态一致';
}

function formatAspectKey(aspect: AstrolabeData['aspects'][number]): string {
  return `${aspect.body1}${aspect.symbol}${aspect.body2}${aspect.type}`;
}

function formatAspectDisplay(
  aspect: AstrolabeData['aspects'][number],
  data: AstrolabeData,
): string {
  return `${pointDisplayLabel(data, aspect.body1)}${aspect.symbol}${pointDisplayLabel(data, aspect.body2)}${ASPECT_LABELS[aspect.type] ?? aspect.type}`;
}

function formatAspectChanges(first: AstrolabeData, last: AstrolabeData): string {
  const before = new Map(first.aspects.map((aspect) => [formatAspectKey(aspect), aspect]));
  const after = new Map(last.aspects.map((aspect) => [formatAspectKey(aspect), aspect]));
  const added = [...after.entries()]
    .filter(([key]) => !before.has(key))
    .map(([, aspect]) => formatAspectDisplay(aspect, last));
  const removed = [...before.entries()]
    .filter(([key]) => !after.has(key))
    .map(([, aspect]) => formatAspectDisplay(aspect, first));
  const changes = [
    added.length ? `新增${added.join('、')}` : '',
    removed.length ? `减少${removed.join('、')}` : '',
  ].filter(Boolean);
  return changes.length ? changes.join('；') : '本段首末相位成员与类型一致';
}

function formatBoundaryChanges(
  previous: AstrolabeBirthRangeBranch | undefined,
  current: AstrolabeBirthRangeBranch,
): string {
  if (!previous) return '这是第一个分段，暂无上一分段对照。';
  const pointChanges = formatPointChanges(previous.last, current.representative);
  const aspectChanges = formatAspectChanges(previous.last, current.representative);
  return `上一分段末秒至本段起点：${pointChanges}；${aspectChanges}`;
}

function formatProgress(progress: AstrolabeBirthRangeProgress): string {
  if (progress.total <= 0) return '正在准备逐秒计算…';
  return `逐秒计算中：${formatNumber(progress.completed)} / ${formatNumber(progress.total)} 秒`;
}

function renderProgress(
  loading: boolean,
  error: string | null,
  progress: AstrolabeBirthRangeProgress,
  cancel: () => void,
  retry: () => void,
) {
  if (!loading && !error) return null;
  const percentage = progress.total
    ? Math.min(100, Math.max(0, (progress.completed / progress.total) * 100))
    : 0;
  return (
    <div className="result-side-card" style={{ display: 'grid', gap: '0.75rem' }}>
      <div className="result-side-head">
        <h3>{error ? '西占本命出生区间计算未完成' : '正在核对西占本命出生区间'}</h3>
        <p>{error || '页面按每秒一个出生时刻计算本命盘。'}</p>
      </div>
      {loading ? (
        <div
          aria-label="西占本命出生区间计算进度"
          aria-valuemax={progress.total || undefined}
          aria-valuemin={0}
          aria-valuenow={progress.total ? progress.completed : undefined}
          role="progressbar"
          style={{
            background: 'var(--surface-muted, #eef2f7)',
            borderRadius: '999px',
            height: '0.5rem',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              background: 'var(--accent, #2563eb)',
              display: 'block',
              height: '100%',
              transition: 'width 160ms ease',
              width: `${percentage}%`,
            }}
          />
        </div>
      ) : null}
      <div style={{ alignItems: 'center', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span aria-live="polite">{loading ? formatProgress(progress) : error}</span>
        {loading ? (
          <button type="button" className="result-chip" onClick={cancel}>
            取消计算
          </button>
        ) : null}
        {error ? (
          <button type="button" className="result-chip result-chip-highlight" onClick={retry}>
            重试
          </button>
        ) : null}
      </div>
    </div>
  );
}

function renderRangeSummary(range: AstrolabeBirthRange) {
  return (
    <>
      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>扫描范围</span>
          <strong>{range.branches.length} 段</strong>
          <small>{range.sampleCount} 个整秒样本</small>
        </div>
        <div className="result-stat-card">
          <span>分辨率</span>
          <strong>每秒</strong>
          <small>起点含、终点不含</small>
        </div>
        <div className="result-stat-card">
          <span>分段事实</span>
          <strong>{range.status === 'stable' ? '全段一致' : '存在变化'}</strong>
          <small>按离散星盘事实分段</small>
        </div>
        <div className="result-stat-card">
          <span>北京时间</span>
          <strong>{formatTimestamp(range.source.startTimestamp).slice(0, 16)}</strong>
          <small>至 {formatTimestamp(range.source.endTimestamp).slice(0, 16)}</small>
        </div>
      </div>
      <div
        className="result-side-card"
        style={{ background: 'var(--surface-subtle, #f8fafc)', lineHeight: 1.7 }}
      >
        <strong>结果范围</strong>
        <p style={{ margin: '0.35rem 0 0' }}>
          本命盘按北京时间整秒扫描；每个分段保留代表盘、末秒盘和连续事实范围，供逐段对照。
        </p>
      </div>
    </>
  );
}

function renderBranchSelector(
  branches: AstrolabeBirthRangeBranch[],
  selectedIndex: number,
  onSelect: (index: number) => void,
) {
  return (
    <div
      role="tablist"
      aria-label="西占本命出生区间分段"
      style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      {branches.map((branch, index) => (
        <button
          key={`${branch.startTimestamp}-${branch.endTimestamp}`}
          type="button"
          role="tab"
          aria-selected={selectedIndex === index}
          className={selectedIndex === index ? 'result-chip result-chip-highlight' : 'result-chip'}
          onClick={() => onSelect(index)}
        >
          时段 {index + 1} · {branch.sampleCount} 秒
        </button>
      ))}
    </div>
  );
}

function renderContinuousFacts(branch: AstrolabeBirthRangeBranch) {
  return (
    <details className="result-side-card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
        连续事实（{branch.continuous.length} 项）
      </summary>
      <div
        className="result-meta-lines"
        style={{
          marginTop: '0.8rem',
          maxHeight: '32rem',
          overflow: 'auto',
          gridTemplateColumns: 'minmax(0, 1fr)',
        }}
      >
        {branch.continuous.map((item) => (
          <div key={`${item.path}-${item.unit}`}>
            <span>{formatContinuousLabel(item, branch.representative)}</span>
            <strong>
              首值 {formatContinuousValue(item.first, item.unit)}；末值{' '}
              {formatContinuousValue(item.last, item.unit)}；范围{' '}
              {formatContinuousValue(item.min, item.unit)} 至{' '}
              {formatContinuousValue(item.max, item.unit)}{' '}
              {item.unit === '毫秒时间戳' ? '' : item.unit || '数值'}
              {item.circular ? (
                <small>（首值、末值保留原始值；范围按相对首值的最短弧展开统计。）</small>
              ) : null}
            </strong>
          </div>
        ))}
      </div>
    </details>
  );
}

function renderBranchDetail(
  branch: AstrolabeBirthRangeBranch,
  previousBranch: AstrolabeBirthRangeBranch | undefined,
) {
  const first = branch.representative;
  const last = branch.last;
  const selectedId = `astrolabe-birth-range-branch-${branch.startTimestamp}`;
  return (
    <div id={selectedId} role="tabpanel" style={{ display: 'grid', gap: '1rem' }}>
      <div className="result-side-head">
        <h3>时段范围</h3>
        <p style={{ display: 'block' }}>
          {formatRange(branch.startTimestamp, branch.endTimestamp)}，共 {branch.sampleCount}{' '}
          秒；代表时刻为本段起点。
        </p>
      </div>
      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>代表时刻</span>
          <strong>{formatTimestamp(branch.startTimestamp).slice(11)}</strong>
          <small>本段起点盘</small>
        </div>
        <div className="result-stat-card">
          <span>末秒时刻</span>
          <strong>{formatTimestamp(branch.endTimestamp - 1_000).slice(11)}</strong>
          <small>用于首末事实对照</small>
        </div>
        <div className="result-stat-card">
          <span>星体与四轴</span>
          <strong>{first.planets.length + first.angles.length}</strong>
          <small>本段代表盘记录</small>
        </div>
        <div className="result-stat-card">
          <span>相位</span>
          <strong>{first.aspects.length}</strong>
          <small>代表盘相位成员</small>
        </div>
      </div>
      <div className="result-side-card">
        <div className="result-side-head">
          <h3>与上一段的分界对照</h3>
          <p>分段按离散星盘事实变化形成；连续量变化在下方单独展开。</p>
        </div>
        <div className="result-meta-lines" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div>
            <span>分界事实</span>
            <strong>{formatBoundaryChanges(previousBranch, branch)}</strong>
          </div>
        </div>
      </div>
      <div className="result-side-card">
        <div className="result-side-head">
          <h3>首末变化对照</h3>
          <p>首秒代表本段起点，末秒为本段终点前一秒。</p>
        </div>
        <div className="result-meta-lines" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div>
            <span>星体与四轴</span>
            <strong>{formatPointChanges(first, last)}</strong>
          </div>
          <div>
            <span>相位成员</span>
            <strong>{formatAspectChanges(first, last)}</strong>
          </div>
        </div>
      </div>
      <AstrolabeBoard
        title="西占本命区间分段盘"
        name={first.birth.name || '当前命盘'}
        data={first}
        representativeTime={formatTimestamp(branch.startTimestamp)}
      />
      {renderContinuousFacts(branch)}
    </div>
  );
}

export const AstrolabeBirthRangePanel = memo(function AstrolabeBirthRangePanel({
  range,
  loading,
  error,
  progress,
  cancel,
  retry,
  selectedIndex,
  onSelect,
}: AstrolabeBirthRangePanelProps) {
  const activeIndex = range
    ? Math.min(Math.max(selectedIndex, 0), Math.max(range.branches.length - 1, 0))
    : 0;
  const branch = range?.branches[activeIndex];
  const previousBranch = range?.branches[activeIndex - 1];

  return (
    <section className="result-showcase-card astrolabe-showcase-card traditional-chart-layout">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">西洋占星本命出生区间</p>
          <h2>出生时刻边界核对</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">固定东八区</span>
          <span className="result-chip result-chip-highlight">整秒扫描</span>
          {range ? <span className="result-chip">出生区间 {range.sampleCount} 秒</span> : null}
        </div>
      </div>
      {renderProgress(loading, error, progress, cancel, retry)}
      {range ? renderRangeSummary(range) : null}
      {range && range.branches.length ? (
        <div className="result-side-card" style={{ display: 'grid', gap: '1rem' }}>
          <div className="result-side-head">
            <h3>出生区间分段</h3>
            <p>选择分段查看该段代表盘、首末差异与连续事实。</p>
          </div>
          {renderBranchSelector(range.branches, activeIndex, onSelect)}
          {branch ? renderBranchDetail(branch, previousBranch) : null}
        </div>
      ) : null}
      {!range && !loading && !error ? (
        <div className="result-side-card">
          <p style={{ margin: 0 }}>准备好完整的四柱反推区间后，将在此按整秒核对西占本命盘。</p>
        </div>
      ) : null}
    </section>
  );
});
