import * as React from 'react';
import '../../../v2-ui/styles/BaziReverseInput.css';
import { loadGlobalRules } from '../../../web-settings';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import {
  BRANCH_WUXING,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  SIXTY_CYCLE,
  STEM_WUXING,
  type EarthlyBranch,
  type HeavenlyStem,
} from '../../../systems/ganzhi-foundation';
import {
  getTimeIndexFromClock,
  type BaziReversePillars,
  type BaziReverseSource,
} from '../../../v2-ui/cases-store';
import { getBaziHourPillarOptions, getBaziMonthPillarOptions } from './person-form-helpers';

interface BaziReverseCandidateItem {
  start: string;
  end: string;
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  startBoundary: string;
  endBoundary: string;
}

interface BaziReverseDynasty {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
}

const BAZI_REVERSE_DYNASTIES: readonly BaziReverseDynasty[] = [
  { id: 'modern', label: '现代', startYear: 1912, endYear: 2099 },
  { id: 'qing', label: '清朝', startYear: 1644, endYear: 1911 },
  { id: 'ming', label: '明朝', startYear: 1368, endYear: 1643 },
  { id: 'yuan', label: '元朝', startYear: 1271, endYear: 1367 },
  { id: 'song-wudai', label: '宋朝~五代十国', startYear: 908, endYear: 1279 },
  { id: 'tang', label: '唐朝', startYear: 618, endYear: 907 },
  { id: 'jin-nanbei-sui', label: '晋~南北朝~隋朝', startYear: 265, endYear: 617 },
  { id: 'han-sanguo', label: '汉朝~三国', startYear: 1, endYear: 280 },
];

const WUXING_CSS_COLOR: Record<string, string> = {
  木: 'var(--wuxing-mu)',
  火: 'var(--wuxing-huo)',
  土: 'var(--wuxing-tu)',
  金: 'var(--wuxing-jin)',
  水: 'var(--wuxing-shui)',
};

const PILLAR_FIELDS: ReadonlyArray<{
  key: keyof BaziReversePillars;
  label: string;
  shortLabel: string;
}> = [
  { key: 'year', label: '年柱', shortLabel: '年' },
  { key: 'month', label: '月柱', shortLabel: '月' },
  { key: 'day', label: '日柱', shortLabel: '日' },
  { key: 'hour', label: '时柱', shortLabel: '时' },
];

function parseIsoOrCivilBeijingStart(isoText: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  displayText: string;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(isoText.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    displayText: `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`,
  };
}

function findDynastyForYear(yearText: string | undefined): BaziReverseDynasty {
  const match = /^(\d{1,4})-/.exec(yearText?.trim() ?? '');
  if (match) {
    const year = Number(match[1]);
    const found = BAZI_REVERSE_DYNASTIES.find((d) => year >= d.startYear && year <= d.endYear);
    if (found) return found;
  }
  return BAZI_REVERSE_DYNASTIES[0]!;
}

function buildInitialPendingStems(
  src?: BaziReverseSource | null,
): Partial<Record<keyof BaziReversePillars, HeavenlyStem>> {
  const out: Partial<Record<keyof BaziReversePillars, HeavenlyStem>> = {};
  if (!src) return out;
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    if (src.pillars[key]?.length === 2) {
      out[key] = src.pillars[key][0] as HeavenlyStem;
    }
  }
  return out;
}

export interface BaziReversePanelProps {
  source?: BaziReverseSource | null;
  onSelect: (selection: {
    year: string;
    month: string;
    day: string;
    timeIndex: number;
    birthHour: string;
    birthMinute: string;
    birthSecond: string;
    source: BaziReverseSource;
  }) => void;
  onInvalidate?: () => void;
}

export function BaziReversePanel({ source, onSelect, onInvalidate }: BaziReversePanelProps) {
  const [pillars, setPillars] = React.useState<BaziReversePillars>(() => ({
    year: source?.pillars.year ?? '',
    month: source?.pillars.month ?? '',
    day: source?.pillars.day ?? '',
    hour: source?.pillars.hour ?? '',
  }));
  const [pendingStems, setPendingStems] = React.useState<
    Partial<Record<keyof BaziReversePillars, HeavenlyStem>>
  >(() => buildInitialPendingStems(source));
  const [selectedDynasty, setSelectedDynasty] = React.useState<BaziReverseDynasty>(() =>
    findDynastyForYear(source?.intervalStart),
  );
  const [activePillar, setActivePillar] = React.useState<keyof BaziReversePillars>(() => {
    const p: BaziReversePillars = {
      year: source?.pillars.year ?? '',
      month: source?.pillars.month ?? '',
      day: source?.pillars.day ?? '',
      hour: source?.pillars.hour ?? '',
    };
    return (['year', 'month', 'day', 'hour'] as const).find((k) => p[k].length !== 2) ?? 'year';
  });
  const [activeStep, setActiveStep] = React.useState<'stem' | 'branch'>('stem');
  const [candidates, setCandidates] = React.useState<BaziReverseCandidateItem[]>([]);
  const [candidateCount, setCandidateCount] = React.useState(0);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [errorText, setErrorText] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);

  const isPillarLocked = (key: keyof BaziReversePillars, targetPillars = pillars): boolean => {
    if (key === 'month') return targetPillars.year.length !== 2;
    if (key === 'hour') return targetPillars.day.length !== 2;
    return false;
  };

  const getValidCycles = (key: keyof BaziReversePillars): readonly string[] => {
    if (key === 'month') return getBaziMonthPillarOptions(pillars.year);
    if (key === 'hour') return getBaziHourPillarOptions(pillars.day);
    return SIXTY_CYCLE;
  };

  const getValidStems = (key: keyof BaziReversePillars): readonly HeavenlyStem[] => {
    const cycles = getValidCycles(key);
    return HEAVENLY_STEMS.filter((stem) => cycles.some((gz) => gz[0] === stem));
  };

  const getValidBranches = (
    key: keyof BaziReversePillars,
    stem: HeavenlyStem,
  ): readonly EarthlyBranch[] => {
    const cycles = getValidCycles(key);
    return EARTHLY_BRANCHES.filter((branch) => cycles.includes(`${stem}${branch}`));
  };

  const invalidateResults = () => {
    setCandidates([]);
    setCandidateCount(0);
    setHasSearched(false);
    setErrorText('');
    onInvalidate?.();
  };

  const canSearch = PILLAR_FIELDS.every((f) => pillars[f.key].length === 2) && !isSearching;

  const runSearch = async () => {
    onInvalidate?.();
    setErrorText('');
    setCandidates([]);
    setCandidateCount(0);
    if (!PILLAR_FIELDS.every((f) => pillars[f.key].length === 2)) {
      setErrorText('请先选齐完整四柱。');
      return;
    }
    setIsSearching(true);
    try {
      const res = (await runCalculateInBackground(
        'bazi-reverse',
        {
          pillars: { ...pillars },
          startYear: selectedDynasty.startYear,
          endYear: selectedDynasty.endYear,
        },
        { promptGuidance: loadGlobalRules().prompt },
      )) as {
        data?: {
          candidates?: BaziReverseCandidateItem[];
          candidateCount?: number;
        };
      };
      const next = res.data?.candidates ?? [];
      setCandidates(next);
      setCandidateCount(res.data?.candidateCount ?? next.length);
      setHasSearched(true);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '暂时无法完成四柱反推，请检查四柱选择。');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStem = (stem: HeavenlyStem) => {
    const nextPillars = { ...pillars };
    const nextPending = { ...pendingStems, [activePillar]: stem };
    if (nextPillars[activePillar] && nextPillars[activePillar][0] !== stem) {
      nextPillars[activePillar] = '';
      if (
        activePillar === 'year' &&
        nextPillars.month &&
        !getBaziMonthPillarOptions(nextPillars.year).includes(nextPillars.month)
      ) {
        nextPillars.month = '';
        delete nextPending.month;
      }
      if (
        activePillar === 'day' &&
        nextPillars.hour &&
        !getBaziHourPillarOptions(nextPillars.day).includes(nextPillars.hour)
      ) {
        nextPillars.hour = '';
        delete nextPending.hour;
      }
    }
    setPillars(nextPillars);
    setPendingStems(nextPending);
    invalidateResults();
    setActiveStep('branch');
  };

  const handleSelectBranch = (branch: EarthlyBranch, activeStem: HeavenlyStem) => {
    const nextPillars = { ...pillars, [activePillar]: `${activeStem}${branch}` };
    const nextPending = { ...pendingStems };
    if (
      activePillar === 'year' &&
      nextPillars.month &&
      !getBaziMonthPillarOptions(nextPillars.year).includes(nextPillars.month)
    ) {
      nextPillars.month = '';
      delete nextPending.month;
    }
    if (
      activePillar === 'day' &&
      nextPillars.hour &&
      !getBaziHourPillarOptions(nextPillars.day).includes(nextPillars.hour)
    ) {
      nextPillars.hour = '';
      delete nextPending.hour;
    }
    setPillars(nextPillars);
    setPendingStems(nextPending);
    invalidateResults();

    const order: ReadonlyArray<keyof BaziReversePillars> = ['year', 'month', 'day', 'hour'];
    const currentIdx = order.indexOf(activePillar);
    let nextIncomplete: keyof BaziReversePillars | undefined;
    for (let offset = 1; offset <= order.length; offset++) {
      const candidateKey = order[(currentIdx + offset) % order.length]!;
      if (nextPillars[candidateKey].length !== 2 && !isPillarLocked(candidateKey, nextPillars)) {
        nextIncomplete = candidateKey;
        break;
      }
    }
    if (nextIncomplete) {
      setActivePillar(nextIncomplete);
      setActiveStep(nextPending[nextIncomplete] ? 'branch' : 'stem');
    }
  };

  const activeField = PILLAR_FIELDS.find((f) => f.key === activePillar)!;
  const locked = isPillarLocked(activePillar);
  const activeStem = pendingStems[activePillar];
  const hasAnyValue = PILLAR_FIELDS.some(
    (f) => Boolean(pillars[f.key]) || Boolean(pendingStems[f.key]),
  );

  return (
    <div className="bazi-reverse-input" data-testid="bazi-reverse-input">
      <div className="bazi-reverse-board" data-testid="bazi-reverse-board">
        {PILLAR_FIELDS.map((field) => {
          const colLocked = isPillarLocked(field.key);
          const isColActive = activePillar === field.key;
          const stemChar = (pillars[field.key][0] ||
            pendingStems[field.key] ||
            '') as HeavenlyStem | '';
          const branchChar = (pillars[field.key][1] || '') as EarthlyBranch | '';
          return (
            <div
              key={field.key}
              className={`bazi-reverse-pillar${isColActive ? ' is-active-col' : ''}${colLocked ? ' is-locked' : ''}`}
            >
              <span className="bazi-reverse-pillar-label">{field.label}</span>
              <button
                type="button"
                className={`bazi-reverse-cell is-stem${stemChar ? ' is-filled' : ' is-empty'}${
                  isColActive && activeStep === 'stem' ? ' is-active' : ''
                }`}
                data-testid={`bazi-reverse-${field.key}-stem`}
                aria-label={`${field.label}天干${stemChar ? `：${stemChar}` : '（未选）'}`}
                style={stemChar ? { color: WUXING_CSS_COLOR[STEM_WUXING[stemChar]] ?? '' } : undefined}
                onClick={() => {
                  setActivePillar(field.key);
                  setActiveStep('stem');
                }}
              >
                {stemChar || '干'}
              </button>
              <button
                type="button"
                className={`bazi-reverse-cell is-branch${branchChar ? ' is-filled' : ' is-empty'}${
                  isColActive && activeStep === 'branch' ? ' is-active' : ''
                }`}
                data-testid={`bazi-reverse-${field.key}-branch`}
                aria-label={`${field.label}地支${branchChar ? `：${branchChar}` : '（未选）'}`}
                style={
                  branchChar ? { color: WUXING_CSS_COLOR[BRANCH_WUXING[branchChar]] ?? '' } : undefined
                }
                onClick={() => {
                  setActivePillar(field.key);
                  if (
                    !isPillarLocked(field.key) &&
                    (pendingStems[field.key] || pillars[field.key].length === 2)
                  ) {
                    if (!pendingStems[field.key] && pillars[field.key].length === 2) {
                      setPendingStems((prev) => ({
                        ...prev,
                        [field.key]: pillars[field.key][0] as HeavenlyStem,
                      }));
                    }
                    setActiveStep('branch');
                  } else {
                    setActiveStep('stem');
                  }
                }}
              >
                {branchChar || '支'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bazi-reverse-picker">
        <div className="bazi-reverse-picker-head">
          <span className="bazi-reverse-picker-title">
            {locked
              ? activePillar === 'month'
                ? '月柱 · 请先选定年柱'
                : '时柱 · 请先选定日柱'
              : activeStep === 'branch' && activeStem
                ? `${activeField.label} · 已选天干「${activeStem}」，请选择地支`
                : `${activeField.label}${
                    activePillar === 'month'
                      ? '（五虎遁）'
                      : activePillar === 'hour'
                        ? '（五鼠遁）'
                        : ''
                  } · 请选择天干`}
          </span>
          <div className="bazi-reverse-picker-actions">
            {!locked && activeStep === 'branch' ? (
              <button
                type="button"
                className="bazi-reverse-picker-link"
                onClick={() => setActiveStep('stem')}
              >
                ← 重选天干
              </button>
            ) : null}
            {hasAnyValue ? (
              <button
                type="button"
                className="bazi-reverse-picker-link"
                onClick={() => {
                  setPillars({ year: '', month: '', day: '', hour: '' });
                  setPendingStems({});
                  setActivePillar('year');
                  setActiveStep('stem');
                  invalidateResults();
                }}
              >
                清空
              </button>
            ) : null}
          </div>
        </div>

        {locked ? (
          <div className="bazi-reverse-picker-locked">
            <span>
              {activePillar === 'month'
                ? '月柱需根据年干五虎遁确定，请先选定年柱。'
                : '时柱需根据日干五鼠遁确定，请先选定日柱。'}
            </span>
            <button
              type="button"
              className="workspace-ui-button is-secondary is-small"
              onClick={() => {
                const prereqKey: keyof BaziReversePillars =
                  activePillar === 'month' ? 'year' : 'day';
                setActivePillar(prereqKey);
                setActiveStep(
                  pendingStems[prereqKey] && pillars[prereqKey].length !== 2 ? 'branch' : 'stem',
                );
              }}
            >
              {`去选${activePillar === 'month' ? '年柱' : '日柱'}`}
            </button>
          </div>
        ) : activeStep === 'branch' && activeStem ? (
          <div className="bazi-reverse-picker-grid is-branch-grid">
            {getValidBranches(activePillar, activeStem).map((branch) => {
              const currentBranch = pillars[activePillar][1] ?? '';
              return (
                <button
                  key={branch}
                  type="button"
                  className={`bazi-reverse-option-btn${currentBranch === branch ? ' is-selected' : ''}`}
                  data-testid={`bazi-reverse-branch-${branch}`}
                  onClick={() => handleSelectBranch(branch, activeStem)}
                >
                  <strong style={{ color: WUXING_CSS_COLOR[BRANCH_WUXING[branch]] ?? '' }}>
                    {branch}
                  </strong>
                  <small>{`${activeStem}${branch}`}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bazi-reverse-picker-grid is-stem-grid">
            {getValidStems(activePillar).map((stem) => (
              <button
                key={stem}
                type="button"
                className={`bazi-reverse-option-btn${activeStem === stem ? ' is-selected' : ''}`}
                data-testid={`bazi-reverse-stem-${stem}`}
                onClick={() => handleSelectStem(stem)}
              >
                <strong style={{ color: WUXING_CSS_COLOR[STEM_WUXING[stem]] ?? '' }}>{stem}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bazi-reverse-dynasty-section">
        <div className="bazi-reverse-dynasty-head">
          <span>查找朝代</span>
          <small>{`${selectedDynasty.label} ${selectedDynasty.startYear}~${selectedDynasty.endYear}`}</small>
        </div>
        <div
          className="bazi-reverse-dynasties"
          role="radiogroup"
          aria-label="查找朝代时间范围"
        >
          {BAZI_REVERSE_DYNASTIES.map((dynasty) => {
            const isSelected = dynasty.id === selectedDynasty.id;
            return (
              <button
                key={dynasty.id}
                type="button"
                className={`bazi-reverse-dynasty-chip${isSelected ? ' is-active' : ''}`}
                data-testid={`bazi-reverse-dynasty-${dynasty.id}`}
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  if (dynasty.id === selectedDynasty.id) return;
                  setSelectedDynasty(dynasty);
                  invalidateResults();
                }}
              >
                <span className="bazi-reverse-dynasty-name">{dynasty.label}</span>
                <span className="bazi-reverse-dynasty-years">
                  {`${dynasty.startYear}~${dynasty.endYear}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="workspace-ui-button is-secondary is-medium"
        disabled={!canSearch}
        onClick={() => void runSearch()}
      >
        {isSearching ? '查找中…' : '查找时段'}
      </button>

      {errorText ? (
        <div className="workspace-ui-form-error" role="alert">
          {errorText}
        </div>
      ) : null}

      {candidates.length > 0 || candidateCount > 0 ? (
        <div className="bazi-reverse-input-results">
          <div className="bazi-reverse-input-result-summary">
            <strong>{`在「${selectedDynasty.label}」找到 ${candidateCount} 个候选区间`}</strong>
            <span>北京时间 UTC+8 · 节气交接切换月柱 · 23:00 换日</span>
          </div>
          <div className="bazi-reverse-input-candidates">
            {candidates.map((cand, idx) => {
              const parsedStart = parseIsoOrCivilBeijingStart(cand.start);
              const parsedEnd = parseIsoOrCivilBeijingStart(cand.end);
              return (
                <article
                  key={`${cand.start}-${idx}`}
                  className="bazi-reverse-input-candidate"
                >
                  <div className="bazi-reverse-input-candidate-copy">
                    <strong>
                      {`${parsedStart?.displayText ?? cand.start} 至 ${parsedEnd?.displayText ?? cand.end}`}
                    </strong>
                    <small>
                      {`${idx + 1}. 起点含、终点不含 · ${cand.startBoundary} → ${cand.endBoundary}`}
                    </small>
                  </div>
                  {parsedStart && parsedStart.year >= 1900 && parsedStart.year <= 2100 ? (
                    <button
                      type="button"
                      className="workspace-ui-button is-secondary is-small"
                      onClick={() => {
                        const timeIndex = Math.max(
                          0,
                          getTimeIndexFromClock(parsedStart.hour, parsedStart.minute),
                        );
                        onSelect({
                          year: String(parsedStart.year),
                          month: String(parsedStart.month),
                          day: String(parsedStart.day),
                          timeIndex,
                          birthHour: String(parsedStart.hour).padStart(2, '0'),
                          birthMinute: String(parsedStart.minute).padStart(2, '0'),
                          birthSecond: String(parsedStart.second).padStart(2, '0'),
                          source: {
                            pillars: { ...pillars },
                            intervalStart: parsedStart.displayText,
                            intervalEnd: parsedEnd?.displayText ?? cand.end,
                            startTimestamp: cand.startTimestamp,
                            endTimestamp: cand.endTimestamp,
                            endExclusive: true,
                            timezone: 8,
                            representativeYear: parsedStart.year,
                            representativeMonth: parsedStart.month,
                            representativeDay: parsedStart.day,
                            representativeHour: parsedStart.hour,
                            representativeMinute: parsedStart.minute,
                            representativeSecond: parsedStart.second,
                          },
                        });
                      }}
                    >
                      {`选择此日期（${String(parsedStart.hour).padStart(2, '0')}:${String(
                        parsedStart.minute,
                      ).padStart(2, '0')}）`}
                    </button>
                  ) : parsedStart ? (
                    <span className="bazi-reverse-input-unsupported">1900 年前仅查时段</span>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : hasSearched && !errorText && !isSearching ? (
        <p className="bazi-reverse-input-empty">
          {`「${selectedDynasty.label}（${selectedDynasty.startYear}~${selectedDynasty.endYear}）」内未找到符合四柱的时段，可切换其他朝代再查。`}
        </p>
      ) : null}
    </div>
  );
}
