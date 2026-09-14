import { useState, type FormEvent } from 'react';
import {
  reverseBaziDates,
  type BaziReversePillars,
  type BaziReverseResult,
} from 'mingyu-core/calendar';
import {
  WorkspaceButton,
  WorkspacePage,
  WorkspaceSurface,
} from '@/components/workspace/WorkspaceUI';
import './BaziReversePage.css';

const currentYear = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();

const DEFAULT_PILLARS: BaziReversePillars = {
  year: '甲子',
  month: '丙寅',
  day: '戊戌',
  hour: '庚申',
};

const PILLAR_FIELDS: Array<{ key: keyof BaziReversePillars; label: string; hint: string }> = [
  { key: 'year', label: '年柱', hint: '例如：甲子' },
  { key: 'month', label: '月柱', hint: '例如：丙寅' },
  { key: 'day', label: '日柱', hint: '例如：戊戌' },
  { key: 'hour', label: '时柱', hint: '例如：庚申' },
];

function formatResult(result: BaziReverseResult): string {
  const lines = [
    `四柱：${result.pillars.year} ${result.pillars.month} ${result.pillars.day} ${result.pillars.hour}`,
    `范围：${result.startYear}-${result.endYear}`,
    `口径：北京时间 UTC+8；节气月；子时 23:00 换日；区间为起点包含、终点不包含`,
    ...result.candidates.map(
      (candidate, index) =>
        `${index + 1}. ${candidate.start.text} 至 ${candidate.end.text}（${candidate.startBoundary.reason} → ${candidate.endBoundary.reason}）`,
    ),
  ];
  return lines.join('\n');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '暂时无法完成反推，请检查四柱和年份。';
}

function PillarField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="bazi-reverse-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
        maxLength={2}
        inputMode="text"
        autoComplete="off"
      />
    </label>
  );
}

export function BaziReversePage() {
  const [pillars, setPillars] = useState<BaziReversePillars>(DEFAULT_PILLARS);
  const [startYear, setStartYear] = useState(1900);
  const [endYear, setEndYear] = useState(currentYear);
  const [result, setResult] = useState<BaziReverseResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCopied(false);
    try {
      setResult(reverseBaziDates({ pillars, startYear, endYear }));
    } catch (cause) {
      setResult(null);
      setError(getErrorMessage(cause));
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatResult(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('复制失败，请直接选中结果文字复制。');
    }
  }

  return (
    <WorkspacePage
      title="八字反推日期"
      width="wide"
      className="bazi-reverse-page"
      data-testid="bazi-reverse-page"
    >
      <section className="bazi-reverse-intro">
        <p className="bazi-reverse-eyebrow">四柱 → 公历时段</p>
        <h2>从已知四柱找回可能的出生时间</h2>
        <p>
          输入年、月、日、时四柱，按年份范围查找所有符合当前排盘口径的北京时间区间。结果保留交节、时辰和子时换日边界，便于继续核对出生记录。
        </p>
      </section>

      <div className="bazi-reverse-layout">
        <WorkspaceSurface as="section" className="bazi-reverse-form-surface">
          <div className="bazi-reverse-section-heading">
            <div>
              <h2>输入四柱</h2>
              <p>每项填写一个六十甲子名称</p>
            </div>
          </div>
          <form className="bazi-reverse-form" onSubmit={handleSubmit}>
            <div className="bazi-reverse-pillar-grid">
              {PILLAR_FIELDS.map((field) => (
                <PillarField
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  value={pillars[field.key]}
                  onChange={(value) =>
                    setPillars((current) => ({ ...current, [field.key]: value }))
                  }
                />
              ))}
            </div>
            <div className="bazi-reverse-year-grid">
              <label className="bazi-reverse-field">
                <span>开始年份</span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={startYear}
                  onChange={(event) => setStartYear(Number(event.target.value))}
                />
              </label>
              <label className="bazi-reverse-field">
                <span>结束年份</span>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={endYear}
                  onChange={(event) => setEndYear(Number(event.target.value))}
                />
              </label>
            </div>
            <button className="bazi-reverse-primary" type="submit">
              查找候选时段
            </button>
          </form>
          <div className="bazi-reverse-policy">
            <strong>计算口径</strong>
            <span>北京时间（Asia/Shanghai，UTC+8）</span>
            <span>节气交接切换月柱</span>
            <span>23:00 起进入次日子时</span>
          </div>
        </WorkspaceSurface>

        <WorkspaceSurface as="section" className="bazi-reverse-result-surface">
          <div className="bazi-reverse-section-heading">
            <div>
              <h2>候选时段</h2>
              <p>
                {result ? `找到 ${result.candidateCount} 个连续区间` : '提交后显示正向复核结果'}
              </p>
              {result ? (
                <p>
                  {result.pillars.year} {result.pillars.month} {result.pillars.day}{' '}
                  {result.pillars.hour} · {result.startYear}—{result.endYear}年
                </p>
              ) : null}
            </div>
            {result ? (
              <WorkspaceButton size="small" onClick={() => void copyResult()}>
                {copied ? '已复制' : '复制结果'}
              </WorkspaceButton>
            ) : null}
          </div>

          {error ? (
            <div className="bazi-reverse-error" role="alert">
              {error}
            </div>
          ) : null}

          {result ? (
            result.candidates.length ? (
              <div className="bazi-reverse-candidate-list">
                {result.candidates.map((candidate, index) => (
                  <article
                    className="bazi-reverse-candidate"
                    key={`${candidate.startTimestamp}-${candidate.endTimestamp}`}
                  >
                    <div className="bazi-reverse-candidate-index">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="bazi-reverse-candidate-main">
                      <strong>
                        {candidate.start.text} <span>至</span> {candidate.end.text}
                      </strong>
                      <small>终点不包含 · 区间内任一秒均复核为所填四柱</small>
                    </div>
                    <div className="bazi-reverse-boundaries">
                      <span>起点：{candidate.startBoundary.reason}</span>
                      <span>终点：{candidate.endBoundary.reason}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="bazi-reverse-empty">
                <span>无</span>
                <h3>范围内没有匹配时段</h3>
                <p>请检查四柱是否完整，或扩大公历年份范围。</p>
              </div>
            )
          ) : (
            <div className="bazi-reverse-empty">
              <span>溯</span>
              <h3>候选区间会显示在这里</h3>
              <p>每个结果都经过正向四柱复核，不能据此把出生时间确定为单一时刻。</p>
            </div>
          )}
        </WorkspaceSurface>
      </div>
    </WorkspacePage>
  );
}
