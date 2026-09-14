import { useState } from 'react';
import {
  reverseBaziDates,
  type BaziReversePillars,
  type BaziReverseResult,
} from 'mingyu-core/calendar';
import { WorkspaceButton } from '@/components/workspace/WorkspaceUI';
import {
  resolveBaziReverseCandidate,
  type BaziReverseResolvedInput,
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '暂时无法完成反推，请检查四柱和年份。';
}

function formatRepresentative(selection: BaziReverseResolvedInput) {
  return `${String(selection.representativeHour).padStart(2, '0')}:${String(selection.representativeMinute).padStart(2, '0')}:${String(selection.representativeSecond).padStart(2, '0')}`;
}

export type BaziReverseInputProps = {
  onSelect: (selection: BaziReverseResolvedInput) => void;
};

export function BaziReverseInput({ onSelect }: BaziReverseInputProps) {
  const [pillars, setPillars] = useState<BaziReversePillars>(EMPTY_PILLARS);
  const [startYear, setStartYear] = useState('1900');
  const [endYear, setEndYear] = useState(String(currentBeijingYear));
  const [result, setResult] = useState<BaziReverseResult | null>(null);
  const [error, setError] = useState('');

  function searchCandidates() {
    setError('');
    setResult(null);
    try {
      const nextResult = reverseBaziDates({
        pillars,
        startYear: Number(startYear),
        endYear: Number(endYear),
      });
      setResult(nextResult);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  return (
    <div className="bazi-reverse-input" data-testid="bazi-reverse-input">
      <div className="bazi-reverse-input-intro">
        <strong>按已知四柱反推公历日期</strong>
        <p>
          按北京时间、节气月和 23:00
          子时换日查找可能时段。候选只表示区间，不能把出生时刻确定为某一秒。
        </p>
      </div>

      <div className="bazi-reverse-input-fields">
        {PILLAR_FIELDS.map((field) => (
          <label className="workspace-ui-field" key={field.key}>
            <span>{field.label}</span>
            <input
              className="workspace-ui-control"
              value={pillars[field.key]}
              maxLength={2}
              inputMode="text"
              autoComplete="off"
              placeholder="如甲子"
              onChange={(event) => {
                setPillars((current) => ({ ...current, [field.key]: event.target.value }));
                setResult(null);
                setError('');
              }}
            />
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
            }}
          />
        </label>
      </div>

      <WorkspaceButton variant="secondary" onClick={searchCandidates}>
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
                        按 {formatRepresentative(selection)} 回填
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
            回填采用候选区间起点作为区间代表时刻，写入精确到秒的标准公历北京时间并复核四柱；这不是对真实出生秒数的确定，也不会再次套用真太阳时。
          </p>
        </div>
      ) : null}
    </div>
  );
}
