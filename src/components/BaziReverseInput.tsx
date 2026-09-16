import { useState } from 'react';
import {
  reverseBaziDates,
  type BaziReversePillars,
  type BaziReverseResult,
} from 'mingyu-core/calendar';
import {
  getBaziHourPillarOptions,
  getBaziMonthPillarOptions,
  getSixtyCycle,
} from 'mingyu-core/ganzhi';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';
import {
  resolveBaziReverseCandidate,
  type BaziReverseResolvedInput,
  type BaziReverseSource,
} from '@/lib/bazi-reverse-input';
import './BaziReverseInput.css';

const currentBeijingYear = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();

const EMPTY_PILLARS: BaziReversePillars = {
  year: '',
  month: '',
  day: '',
  hour: '',
};

const PILLAR_FIELDS: Array<{ key: keyof BaziReversePillars; label: string }> = [
  { key: 'year', label: '年柱' },
  { key: 'month', label: '月柱' },
  { key: 'day', label: '日柱' },
  { key: 'hour', label: '时柱' },
];
const GANZHI_OPTIONS = getSixtyCycle();

function getPillarOptions(key: keyof BaziReversePillars, pillars: BaziReversePillars) {
  if (key === 'month') return getBaziMonthPillarOptions(pillars.year);
  if (key === 'hour') return getBaziHourPillarOptions(pillars.day);
  return GANZHI_OPTIONS;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '暂时无法完成反推，请检查四柱和年份。';
}

function formatRepresentative(selection: BaziReverseResolvedInput) {
  return `${String(selection.representativeHour).padStart(2, '0')}:${String(selection.representativeMinute).padStart(2, '0')}:${String(selection.representativeSecond).padStart(2, '0')}`;
}

export type BaziReverseInputProps = {
  onSelect: (selection: BaziReverseResolvedInput) => void;
  source?: BaziReverseSource | null;
  onInvalidate?: () => void;
};

export function BaziReverseInput({ onSelect, source, onInvalidate }: BaziReverseInputProps) {
  const [pillars, setPillars] = useState<BaziReversePillars>(source?.pillars ?? EMPTY_PILLARS);
  const [startYear, setStartYear] = useState(source?.intervalStart.slice(0, 4) ?? '1900');
  const [endYear, setEndYear] = useState(
    source?.intervalEnd.slice(0, 4) ?? String(currentBeijingYear),
  );
  const [result, setResult] = useState<BaziReverseResult | null>(null);
  const [error, setError] = useState('');
  const startYearNumber = Number(startYear);
  const endYearNumber = Number(endYear);
  const hasValidYearRange =
    Number.isInteger(startYearNumber) &&
    Number.isInteger(endYearNumber) &&
    startYearNumber >= 1900 &&
    startYearNumber <= 2100 &&
    endYearNumber >= 1900 &&
    endYearNumber <= 2100 &&
    startYearNumber <= endYearNumber;
  const canSearch =
    PILLAR_FIELDS.every((field) => pillars[field.key].length > 0) && hasValidYearRange;

  function updatePillar(key: keyof BaziReversePillars, value: string) {
    setPillars((current) => {
      const next = { ...current, [key]: value };
      if (key === 'year' && next.month && !getBaziMonthPillarOptions(value).includes(next.month)) {
        next.month = '';
      }
      if (key === 'day' && next.hour && !getBaziHourPillarOptions(value).includes(next.hour)) {
        next.hour = '';
      }
      return next;
    });
    setResult(null);
    setError('');
    onInvalidate?.();
  }

  function searchCandidates() {
    onInvalidate?.();
    setError('');
    setResult(null);
    if (!canSearch) {
      setError('请先选择完整四柱，并填写 1900-2100 年内的有效查询范围。');
      return;
    }
    try {
      const nextResult = reverseBaziDates({
        pillars,
        startYear: startYearNumber,
        endYear: endYearNumber,
      });
      setResult(nextResult);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  return (
    <div className="bazi-reverse-input" data-testid="bazi-reverse-input">
      <div className="bazi-reverse-input-intro">
        <strong>选择四柱，查找对应日期</strong>
        <p>
          按北京时间、节气月和 23:00
          子时换日查找可能时段。候选只表示区间，具体时刻仍需结合原始记录核对。
        </p>
      </div>

      <div className="bazi-reverse-input-fields">
        {PILLAR_FIELDS.map((field) => (
          <label className="workspace-ui-field" key={field.key}>
            <span>{field.label}</span>
            <select
              className="workspace-ui-control"
              value={pillars[field.key]}
              data-testid={`bazi-reverse-${field.key}`}
              disabled={
                field.key === 'month' ? !pillars.year : field.key === 'hour' ? !pillars.day : false
              }
              onChange={(event) => updatePillar(field.key, event.target.value)}
            >
              <option value="">
                {field.key === 'month' && !pillars.year
                  ? '请先选择年柱'
                  : field.key === 'hour' && !pillars.day
                    ? '请先选择日柱'
                    : `请选择${field.label}`}
              </option>
              {getPillarOptions(field.key, pillars).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="bazi-reverse-input-years">
        <label className="workspace-ui-field">
          <span>查询起始年</span>
          <input
            className="workspace-ui-control"
            value={startYear}
            type="text"
            inputMode="numeric"
            onChange={(event) => {
              setStartYear(event.target.value.replace(/[^0-9]/g, ''));
              setResult(null);
              setError('');
              onInvalidate?.();
            }}
          />
        </label>
        <label className="workspace-ui-field">
          <span>查询结束年</span>
          <input
            className="workspace-ui-control"
            value={endYear}
            type="text"
            inputMode="numeric"
            onChange={(event) => {
              setEndYear(event.target.value.replace(/[^0-9]/g, ''));
              setResult(null);
              setError('');
              onInvalidate?.();
            }}
          />
        </label>
      </div>
      {!hasValidYearRange ? (
        <p className="bazi-reverse-input-note">
          查询年份需为 1900-2100 的整数，且起始年不能晚于结束年。
        </p>
      ) : null}

      <WorkspaceButton variant="secondary" onClick={searchCandidates} disabled={!canSearch}>
        查找候选时段
      </WorkspaceButton>

      {error ? (
        <div className="workspace-ui-form-error" role="alert">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="bazi-reverse-input-results">
          <div className="bazi-reverse-input-result-summary">
            <strong>找到 {result.candidateCount} 个候选区间</strong>
            <span>北京时间 UTC+8 · 节气交接切换月柱 · 23:00 换日</span>
          </div>
          {result.candidates.length ? (
            <div className="bazi-reverse-input-candidates">
              {result.candidates.map((candidate, index) => {
                const selection = resolveBaziReverseCandidate(candidate);
                return (
                  <article
                    className="bazi-reverse-input-candidate"
                    key={`${candidate.startTimestamp}-${candidate.endTimestamp}`}
                  >
                    <div className="bazi-reverse-input-candidate-copy">
                      <strong>
                        {candidate.start.text} 至 {candidate.end.text}
                      </strong>
                      <small>
                        {index + 1}. 起点含、终点不含 · {candidate.startBoundary.reason} →{' '}
                        {candidate.endBoundary.reason}
                      </small>
                    </div>
                    {selection ? (
                      <WorkspaceButton size="small" onClick={() => onSelect(selection)}>
                        选择此日期（{formatRepresentative(selection)}）
                      </WorkspaceButton>
                    ) : (
                      <span className="bazi-reverse-input-unsupported">
                        无法安全回填，请按区间核对
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="bazi-reverse-input-empty">
              查询范围内没有匹配时段，请检查四柱或扩大年份。
            </p>
          )}
          <p className="bazi-reverse-input-note">
            选定日期会保留完整北京时间区间。请在结果中核对采用的代表时刻或分段范围。
          </p>
        </div>
      ) : null}
    </div>
  );
}
