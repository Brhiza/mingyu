import { memo } from 'react';
import type { QizhengBirthRange, QizhengResult } from 'mingyu-core/qizheng';
import type {
  QizhengBirthRangeProgress,
  UseQizhengBirthRangeResult,
} from '@/hooks/useQizhengBirthRange';

const BEIJING_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1_000;
type QizhengBirthRangeBranch = QizhengBirthRange['branches'][number];

export type QizhengBirthRangePanelProps = Pick<
  UseQizhengBirthRangeResult,
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
  return `${formatTimestamp(startTimestamp)} 至 ${formatTimestamp(endTimestamp)}（终点不含）`;
}

function getPalace(result: QizhengResult, signIndex: number) {
  return result.twelvePalaces.find((palace) => palace.signIndex === signIndex);
}

function formatPalace(result: QizhengResult, signIndex: number): string {
  const palace = getPalace(result, signIndex);
  return palace ? `${palace.signBranch}宫 · ${palace.palace}` : '宫位未定';
}

function formatComparison<T>(first: T, last: T, format: (value: T) => string): string {
  const firstText = format(first);
  const lastText = format(last);
  return firstText === lastText
    ? `首末一致：${firstText}`
    : `首秒：${firstText}；末秒：${lastText}`;
}

function formatStarFact(star: QizhengResult['stars'][number]): string {
  const motion = star.retrograde === undefined ? '' : ` · ${star.retrograde ? '逆行' : '顺行'}`;
  return `${star.signBranch}宫${star.palace} · ${star.xiu}宿${motion}`;
}

function formatAspectFact(aspect: QizhengResult['aspects'][number]): string {
  return `${aspect.star1}－${aspect.star2}${aspect.type} · ${aspect.closeness}`;
}

function getStarChanges(first: QizhengResult, last: QizhengResult): string {
  const firstByName = new Map(first.stars.map((star) => [star.name, formatStarFact(star)]));
  const lastByName = new Map(last.stars.map((star) => [star.name, formatStarFact(star)]));
  const changed = [...firstByName.keys()]
    .filter((name) => lastByName.has(name) && firstByName.get(name) !== lastByName.get(name))
    .map((name) => `${name}（${firstByName.get(name)} → ${lastByName.get(name)}）`);
  const added = [...lastByName.keys()].filter((name) => !firstByName.has(name));
  const removed = [...firstByName.keys()].filter((name) => !lastByName.has(name));
  const changes = [
    added.length ? `新增${added.join('、')}` : '',
    removed.length ? `移除${removed.join('、')}` : '',
    changed.length ? `变化${changed.join('；')}` : '',
  ].filter(Boolean);
  return changes.length ? changes.join('；') : '星曜落宫、落宿与顺逆保持一致';
}

function getAspectChanges(first: QizhengResult, last: QizhengResult): string {
  const firstFacts = new Set(first.aspects.map(formatAspectFact));
  const lastFacts = new Set(last.aspects.map(formatAspectFact));
  const added = [...lastFacts].filter((fact) => !firstFacts.has(fact));
  const removed = [...firstFacts].filter((fact) => !lastFacts.has(fact));
  const changes = [
    added.length ? `新增${added.join('、')}` : '',
    removed.length ? `移除${removed.join('、')}` : '',
  ].filter(Boolean);
  return changes.length ? changes.join('；') : '吊照关系保持一致';
}

function formatEnNan(value: QizhengResult['enNan']): string {
  if (!value) return '未提供恩难仇用资料';
  return `${value.sect} · 命主${value.mingZhu} · 恩星${value.enStars.join('、') || '无'} · 难星${value.nanStars.join('、') || '无'}`;
}

function getEnNanChanges(first: QizhengResult, last: QizhengResult): string {
  return formatComparison(first.enNan, last.enNan, formatEnNan);
}

function renderSegmentBoundaryChanges(previous: QizhengResult | undefined, current: QizhengResult) {
  if (!previous) {
    return <p style={{ margin: 0 }}>这是第一段，没有上一段可供对照；以下事实构成本段分段起点。</p>;
  }
  const transition = (before: string, after: string) =>
    before === after ? `保持${after}` : `${before} → ${after}`;
  return (
    <div className="result-meta-lines" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div>
        <span>命宫</span>
        <strong>
          {transition(
            formatPalace(previous, previous.mingGong),
            formatPalace(current, current.mingGong),
          )}
        </strong>
      </div>
      <div>
        <span>身宫</span>
        <strong>
          {transition(
            formatPalace(previous, previous.shenGong),
            formatPalace(current, current.shenGong),
          )}
        </strong>
      </div>
      <div>
        <span>星曜落宿</span>
        <strong>{getStarChanges(previous, current)}</strong>
      </div>
      <div>
        <span>吊照增删</span>
        <strong>{getAspectChanges(previous, current)}</strong>
      </div>
    </div>
  );
}

function formatProgress(progress: QizhengBirthRangeProgress): string {
  if (progress.total <= 0) return '正在准备逐秒计算…';
  return `逐秒计算中：${formatNumber(progress.completed)} / ${formatNumber(progress.total)} 秒`;
}

function renderProgress(
  loading: boolean,
  error: string | null,
  progress: QizhengBirthRangeProgress,
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
        <h3>{error ? '七政四余出生区间计算未完成' : '正在核对出生区间'}</h3>
        <p>{error || '页面按每秒一个本命样本计算。'}</p>
      </div>
      {loading ? (
        <div
          aria-label="七政四余出生区间计算进度"
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

function renderRangeSummary(range: QizhengBirthRange) {
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
          <span>本命覆盖</span>
          <strong>{range.status === 'stable' ? '全段一致' : '存在变化'}</strong>
          <small>按离散事实分段</small>
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
        <p style={{ margin: '0.35rem 0 0' }}>本次展示本命变化，流年与行限不在此次结果中。</p>
      </div>
    </>
  );
}

function renderBranchSelector(
  branches: QizhengBirthRangeBranch[],
  selectedIndex: number,
  onSelect: (index: number) => void,
) {
  return (
    <div
      role="tablist"
      aria-label="七政四余出生区间分段"
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

function renderBranchDetail(
  branch: QizhengBirthRangeBranch,
  previousBranch: QizhengBirthRangeBranch | undefined,
) {
  const first = branch.representative;
  const last = branch.last;
  const selectedId = `qizheng-birth-range-branch-${branch.startTimestamp}`;
  return (
    <div id={selectedId} role="tabpanel" style={{ display: 'grid', gap: '1rem' }}>
      <div className="result-side-head">
        <h3>时段范围</h3>
        <p style={{ display: 'block' }}>
          {formatRange(branch.startTimestamp, branch.endTimestamp)}，共 {branch.sampleCount} 秒。
        </p>
      </div>
      <div className="result-summary-grid">
        <div className="result-stat-card result-stat-card-accent">
          <span>命宫</span>
          <strong>{formatPalace(first, first.mingGong)}</strong>
          <small>
            {formatComparison(
              formatPalace(first, first.mingGong),
              formatPalace(last, last.mingGong),
              (value) => value,
            )}
          </small>
        </div>
        <div className="result-stat-card">
          <span>身宫</span>
          <strong>{formatPalace(first, first.shenGong)}</strong>
          <small>
            {formatComparison(
              formatPalace(first, first.shenGong),
              formatPalace(last, last.shenGong),
              (value) => value,
            )}
          </small>
        </div>
        <div className="result-stat-card">
          <span>命主</span>
          <strong>{first.mingZhu}</strong>
          <small>{formatComparison(first.mingZhu, last.mingZhu, (value) => value)}</small>
        </div>
        <div className="result-stat-card">
          <span>末秒盘</span>
          <strong>{formatTimestamp(branch.endTimestamp - 1_000).slice(11)}</strong>
          <small>用于首末事实对照</small>
        </div>
      </div>
      <div className="result-side-card">
        <div className="result-side-head">
          <h3>与上一段的分界对照</h3>
          <p>分段按离散本命事实变化形成；连续量变化在下方单独展开。</p>
        </div>
        {renderSegmentBoundaryChanges(previousBranch?.last, first)}
      </div>
      <div className="result-side-card">
        <div className="result-side-head">
          <h3>首末变化对照</h3>
          <p>首秒取代表盘，末秒取本段终点前一秒；连续量另在下方展开。</p>
        </div>
        <div className="result-meta-lines" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div>
            <span>星曜落点</span>
            <strong>{getStarChanges(first, last)}</strong>
          </div>
          <div>
            <span>吊照关系</span>
            <strong>{getAspectChanges(first, last)}</strong>
          </div>
          <div>
            <span>恩难仇用</span>
            <strong>{getEnNanChanges(first, last)}</strong>
          </div>
          <div>
            <span>月相与光照</span>
            <strong>
              {formatComparison(
                `${first.calculationContext.moonPhase.eightPhaseName} · ${first.calculationContext.solarIllumination.status}`,
                `${last.calculationContext.moonPhase.eightPhaseName} · ${last.calculationContext.solarIllumination.status}`,
                (value) => value,
              )}
            </strong>
          </div>
        </div>
      </div>
      <details className="result-side-card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
          连续量（{branch.continuous.length} 项）
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
            <div key={`${item.label}-${item.unit}`}>
              <span>{item.label}</span>
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
    </div>
  );
}

export const QizhengBirthRangePanel = memo(function QizhengBirthRangePanel({
  range,
  loading,
  error,
  progress,
  cancel,
  retry,
  selectedIndex,
  onSelect,
}: QizhengBirthRangePanelProps) {
  const activeIndex = range
    ? Math.min(Math.max(selectedIndex, 0), Math.max(range.branches.length - 1, 0))
    : 0;
  const branch = range?.branches[activeIndex];
  const previousBranch = range?.branches[activeIndex - 1];

  return (
    <section className="result-showcase-card qizheng-showcase-card traditional-chart-layout">
      <div className="result-showcase-head">
        <div>
          <p className="result-section-kicker">七政四余出生区间</p>
          <h2>本命时刻边界核对</h2>
        </div>
        <div className="result-chip-row">
          <span className="result-chip">固定东八区</span>
          <span className="result-chip result-chip-highlight">整秒扫描</span>
          {range ? <span className="result-chip">本命 {range.sampleCount} 秒</span> : null}
        </div>
      </div>
      {renderProgress(loading, error, progress, cancel, retry)}
      {range ? renderRangeSummary(range) : null}
      {range && range.branches.length ? (
        <div className="result-side-card" style={{ display: 'grid', gap: '1rem' }}>
          <div className="result-side-head">
            <h3>本命分段</h3>
            <p>选择分段查看该段首末命身宫与事实变化。</p>
          </div>
          {renderBranchSelector(range.branches, activeIndex, onSelect)}
          {branch ? renderBranchDetail(branch, previousBranch) : null}
        </div>
      ) : null}
      {!range && !loading && !error ? (
        <div className="result-side-card">
          <p style={{ margin: 0 }}>准备好完整的四柱反推区间后，将在此按整秒核对七政四余本命盘。</p>
        </div>
      ) : null}
    </section>
  );
});
