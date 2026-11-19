import { calculate } from '../calculate';
import type { Method } from '../schema';
import {
  BRANCH_WUXING,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  SIXTY_CYCLE,
  STEM_WUXING,
  type EarthlyBranch,
  type HeavenlyStem,
} from '../systems/ganzhi-foundation';
import {
  createBirthPlaceModal,
  type BirthPlaceModalController,
  type BirthPlaceSelection,
} from './birth-place-modal';
import {
  clampNumericField,
  createDefaultPersonalCase,
  formatCaseSummary,
  getBirthTimeDropdownOptions,
  getTimeIndexFromClock,
  getTrueSolarTimeHintLabel,
  loadPersonalCases,
  setActiveCaseId,
  toV2BirthPayload,
  upsertCompatibilityRecord,
  upsertPersonalCase,
  validatePersonalCase,
  type BaziReversePillars,
  type BaziReverseSource,
  type PersonalCase,
  type TimeIndexValue,
  type ValidationResult,
} from './cases-store';

export type PersonRole = 'self' | 'partner';
export type PersonInputMode = 'solar' | 'lunar' | 'pillars';

const FIRST_MONTH_STEM_BY_YEAR_STEM: Record<HeavenlyStem, HeavenlyStem> = {
  甲: '丙',
  乙: '戊',
  丙: '庚',
  丁: '壬',
  戊: '甲',
  己: '丙',
  庚: '戊',
  辛: '庚',
  壬: '壬',
  癸: '甲',
};

const FIRST_HOUR_STEM_BY_DAY_STEM: Record<HeavenlyStem, HeavenlyStem> = {
  甲: '甲',
  乙: '丙',
  丙: '戊',
  丁: '庚',
  戊: '壬',
  己: '甲',
  庚: '丙',
  辛: '戊',
  壬: '庚',
  癸: '壬',
};

const MONTH_BRANCHES = [...EARTHLY_BRANCHES.slice(2), ...EARTHLY_BRANCHES.slice(0, 2)] as const;

function buildPillarCycleOptions(firstStem: HeavenlyStem, branches: readonly string[]): string[] {
  const firstIdx = HEAVENLY_STEMS.indexOf(firstStem);
  return branches.map(
    (branch, offset) => `${HEAVENLY_STEMS[(firstIdx + offset) % HEAVENLY_STEMS.length]}${branch}`,
  );
}

/** 五虎遁：根据年柱返回有效的 12 个月柱。 */
export function getBaziMonthPillarOptions(yearPillar: string): string[] {
  if (!yearPillar || !SIXTY_CYCLE.includes(yearPillar)) return [];
  const stem = yearPillar[0] as HeavenlyStem;
  return buildPillarCycleOptions(FIRST_MONTH_STEM_BY_YEAR_STEM[stem], MONTH_BRANCHES);
}

/** 五鼠遁：根据日柱返回有效的 12 个时柱。 */
export function getBaziHourPillarOptions(dayPillar: string): string[] {
  if (!dayPillar || !SIXTY_CYCLE.includes(dayPillar)) return [];
  const stem = dayPillar[0] as HeavenlyStem;
  return buildPillarCycleOptions(FIRST_HOUR_STEM_BY_DAY_STEM[stem], EARTHLY_BRANCHES);
}

export interface SegmentedOption<T extends string | number | boolean> {
  label: string;
  value: T;
}

/**
 * 1:1 复刻 V1 `SegmentedControl.tsx` 分段选择器 DOM。
 */
export function createSegmentedControl<T extends string | number | boolean>(props: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}): HTMLDivElement {
  const { value, options, onChange } = props;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const width = `${100 / Math.max(1, options.length)}%`;
  const left = `${(100 / Math.max(1, options.length)) * activeIndex}%`;

  const container = document.createElement('div');
  container.className = 'workspace-ui-segmented';

  const indicator = document.createElement('div');
  indicator.className = 'workspace-ui-segmented-indicator';
  indicator.style.width = width;
  indicator.style.left = left;
  container.appendChild(indicator);

  options.forEach((option, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `workspace-ui-segmented-item${option.value === value ? ' is-active' : ''}`;
    btn.textContent = option.label;
    btn.addEventListener('click', () => {
      if (option.value === value) return;
      indicator.style.left = `${(100 / Math.max(1, options.length)) * idx}%`;
      onChange(option.value);
    });
    container.appendChild(btn);
  });

  return container;
}

interface BaziReverseCandidateItem {
  start: string;
  end: string;
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  startBoundary: string;
  endBoundary: string;
  birthRange: {
    start: string;
    end: string;
    timezone: 8;
    pillars: BaziReversePillars;
  };
}

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

function findDynastyForYear(yearText: string | undefined): BaziReverseDynasty {
  const match = /^(\d{1,4})-/.exec(yearText?.trim() ?? '');
  if (match) {
    const year = Number(match[1]);
    const found = BAZI_REVERSE_DYNASTIES.find((d) => year >= d.startYear && year <= d.endYear);
    if (found) return found;
  }
  return BAZI_REVERSE_DYNASTIES[0]!;
}

/**
 * 四柱反推面板（八字八格展示 + 天干/地支两步选择器 + 朝代时间范围）。
 */
export function createBaziReversePanel(options: {
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
}): HTMLDivElement {
  const pillars: BaziReversePillars = {
    year: options.source?.pillars.year ?? '',
    month: options.source?.pillars.month ?? '',
    day: options.source?.pillars.day ?? '',
    hour: options.source?.pillars.hour ?? '',
  };
  const pendingStems: Partial<Record<keyof BaziReversePillars, HeavenlyStem>> = {};
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    if (pillars[key].length === 2) {
      pendingStems[key] = pillars[key][0] as HeavenlyStem;
    }
  }

  let selectedDynasty: BaziReverseDynasty = findDynastyForYear(options.source?.intervalStart);
  let activePillar: keyof BaziReversePillars =
    (['year', 'month', 'day', 'hour'] as const).find((k) => pillars[k].length !== 2) ?? 'year';
  let activeStep: 'stem' | 'branch' = 'stem';
  let candidates: BaziReverseCandidateItem[] = [];
  let candidateCount = 0;
  let hasSearched = false;
  let errorText = '';
  let isSearching = false;

  const root = document.createElement('div');
  root.className = 'bazi-reverse-input';
  root.dataset.testid = 'bazi-reverse-input';

  const pillarFields: ReadonlyArray<{ key: keyof BaziReversePillars; label: string; shortLabel: string }> = [
    { key: 'year', label: '年柱', shortLabel: '年' },
    { key: 'month', label: '月柱', shortLabel: '月' },
    { key: 'day', label: '日柱', shortLabel: '日' },
    { key: 'hour', label: '时柱', shortLabel: '时' },
  ];

  function isPillarLocked(key: keyof BaziReversePillars): boolean {
    if (key === 'month') return pillars.year.length !== 2;
    if (key === 'hour') return pillars.day.length !== 2;
    return false;
  }

  function getValidCycles(key: keyof BaziReversePillars): readonly string[] {
    if (key === 'month') return getBaziMonthPillarOptions(pillars.year);
    if (key === 'hour') return getBaziHourPillarOptions(pillars.day);
    return SIXTY_CYCLE;
  }

  function getValidStems(key: keyof BaziReversePillars): readonly HeavenlyStem[] {
    const cycles = getValidCycles(key);
    return HEAVENLY_STEMS.filter((stem) => cycles.some((gz) => gz[0] === stem));
  }

  function getValidBranches(key: keyof BaziReversePillars, stem: HeavenlyStem): readonly EarthlyBranch[] {
    const cycles = getValidCycles(key);
    return EARTHLY_BRANCHES.filter((branch) => cycles.includes(`${stem}${branch}`));
  }

  function clearDependentPillar(changedKey: keyof BaziReversePillars): void {
    if (
      changedKey === 'year' &&
      pillars.month &&
      !getBaziMonthPillarOptions(pillars.year).includes(pillars.month)
    ) {
      pillars.month = '';
      delete pendingStems.month;
    }
    if (
      changedKey === 'day' &&
      pillars.hour &&
      !getBaziHourPillarOptions(pillars.day).includes(pillars.hour)
    ) {
      pillars.hour = '';
      delete pendingStems.hour;
    }
  }

  function invalidateResults(): void {
    candidates = [];
    candidateCount = 0;
    hasSearched = false;
    errorText = '';
    options.onInvalidate?.();
  }

  function canSearch(): boolean {
    return pillarFields.every((f) => pillars[f.key].length === 2) && !isSearching;
  }

  async function runSearch(): Promise<void> {
    options.onInvalidate?.();
    errorText = '';
    candidates = [];
    candidateCount = 0;
    if (!canSearch()) {
      errorText = '请先选齐完整四柱。';
      render();
      return;
    }
    isSearching = true;
    render();
    try {
      const res = (await calculate('bazi-reverse', {
        pillars: { ...pillars },
        startYear: selectedDynasty.startYear,
        endYear: selectedDynasty.endYear,
      })) as {
        data?: {
          candidates?: BaziReverseCandidateItem[];
          candidateCount?: number;
        };
      };
      candidates = res.data?.candidates ?? [];
      candidateCount = res.data?.candidateCount ?? candidates.length;
      hasSearched = true;
    } catch (err) {
      errorText = err instanceof Error ? err.message : '暂时无法完成四柱反推，请检查四柱选择。';
    } finally {
      isSearching = false;
      render();
    }
  }

  function render(): void {
    root.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'bazi-reverse-input-intro';
    const introTitle = document.createElement('strong');
    introTitle.textContent = '选择四柱，按朝代反推时间';
    const introDesc = document.createElement('p');
    introDesc.textContent = '先点选八字格子再选天干与对应地支；1900 年及之后候选可直接回填排盘。';
    intro.append(introTitle, introDesc);
    root.appendChild(intro);

    // 1. 上方：八字八个格子（4柱 × 天干/地支）
    const board = document.createElement('div');
    board.className = 'bazi-reverse-board';
    board.dataset.testid = 'bazi-reverse-board';

    for (const field of pillarFields) {
      const locked = isPillarLocked(field.key);
      const isColActive = activePillar === field.key;
      const stemChar = (pillars[field.key][0] || pendingStems[field.key] || '') as HeavenlyStem | '';
      const branchChar = (pillars[field.key][1] || '') as EarthlyBranch | '';

      const col = document.createElement('div');
      col.className = `bazi-reverse-pillar${isColActive ? ' is-active-col' : ''}${locked ? ' is-locked' : ''}`;

      const colLabel = document.createElement('span');
      colLabel.className = 'bazi-reverse-pillar-label';
      colLabel.textContent = field.label;

      const stemBtn = document.createElement('button');
      stemBtn.type = 'button';
      stemBtn.className = `bazi-reverse-cell is-stem${stemChar ? ' is-filled' : ' is-empty'}${
        isColActive && activeStep === 'stem' ? ' is-active' : ''
      }`;
      stemBtn.dataset.testid = `bazi-reverse-${field.key}-stem`;
      stemBtn.setAttribute('aria-label', `${field.label}天干${stemChar ? `：${stemChar}` : '（未选）'}`);
      stemBtn.textContent = stemChar || '干';
      if (stemChar) {
        stemBtn.style.color = WUXING_CSS_COLOR[STEM_WUXING[stemChar]] ?? '';
      }
      stemBtn.addEventListener('click', () => {
        activePillar = field.key;
        activeStep = 'stem';
        render();
      });

      const branchBtn = document.createElement('button');
      branchBtn.type = 'button';
      branchBtn.className = `bazi-reverse-cell is-branch${branchChar ? ' is-filled' : ' is-empty'}${
        isColActive && activeStep === 'branch' ? ' is-active' : ''
      }`;
      branchBtn.dataset.testid = `bazi-reverse-${field.key}-branch`;
      branchBtn.setAttribute('aria-label', `${field.label}地支${branchChar ? `：${branchChar}` : '（未选）'}`);
      branchBtn.textContent = branchChar || '支';
      if (branchChar) {
        branchBtn.style.color = WUXING_CSS_COLOR[BRANCH_WUXING[branchChar]] ?? '';
      }
      branchBtn.addEventListener('click', () => {
        activePillar = field.key;
        if (!isPillarLocked(field.key) && (pendingStems[field.key] || pillars[field.key].length === 2)) {
          if (!pendingStems[field.key] && pillars[field.key].length === 2) {
            pendingStems[field.key] = pillars[field.key][0] as HeavenlyStem;
          }
          activeStep = 'branch';
        } else {
          activeStep = 'stem';
        }
        render();
      });

      col.append(colLabel, stemBtn, branchBtn);
      board.appendChild(col);
    }
    root.appendChild(board);

    // 2. 下方：天干 -> 对应地支 两步选择器
    const activeField = pillarFields.find((f) => f.key === activePillar)!;
    const locked = isPillarLocked(activePillar);
    const activeStem = pendingStems[activePillar];
    const hasAnyValue =
      pillarFields.some((f) => Boolean(pillars[f.key]) || Boolean(pendingStems[f.key]));

    const picker = document.createElement('div');
    picker.className = 'bazi-reverse-picker';

    const pickerHead = document.createElement('div');
    pickerHead.className = 'bazi-reverse-picker-head';

    const pickerTitle = document.createElement('span');
    pickerTitle.className = 'bazi-reverse-picker-title';
    if (locked) {
      pickerTitle.textContent =
        activePillar === 'month' ? '月柱 · 请先选定年柱' : '时柱 · 请先选定日柱';
    } else if (activeStep === 'branch' && activeStem) {
      pickerTitle.textContent = `${activeField.label} · 已选天干「${activeStem}」，请选择地支`;
    } else {
      const ruleHint =
        activePillar === 'month' ? '（五虎遁）' : activePillar === 'hour' ? '（五鼠遁）' : '';
      pickerTitle.textContent = `${activeField.label}${ruleHint} · 请选择天干`;
    }

    const pickerActions = document.createElement('div');
    pickerActions.className = 'bazi-reverse-picker-actions';
    if (!locked && activeStep === 'branch') {
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'bazi-reverse-picker-link';
      backBtn.textContent = '← 重选天干';
      backBtn.addEventListener('click', () => {
        activeStep = 'stem';
        render();
      });
      pickerActions.appendChild(backBtn);
    }
    if (hasAnyValue) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'bazi-reverse-picker-link';
      clearBtn.textContent = '清空';
      clearBtn.addEventListener('click', () => {
        for (const f of pillarFields) {
          pillars[f.key] = '';
          delete pendingStems[f.key];
        }
        activePillar = 'year';
        activeStep = 'stem';
        invalidateResults();
        render();
      });
      pickerActions.appendChild(clearBtn);
    }

    pickerHead.append(pickerTitle, pickerActions);
    picker.appendChild(pickerHead);

    if (locked) {
      const prereqKey: keyof BaziReversePillars = activePillar === 'month' ? 'year' : 'day';
      const prereqLabel = activePillar === 'month' ? '年柱' : '日柱';
      const lockNotice = document.createElement('div');
      lockNotice.className = 'bazi-reverse-picker-locked';
      const lockText = document.createElement('span');
      lockText.textContent =
        activePillar === 'month'
          ? '月柱需根据年干五虎遁确定，请先选定年柱。'
          : '时柱需根据日干五鼠遁确定，请先选定日柱。';
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'workspace-ui-button is-secondary is-small';
      jumpBtn.textContent = `去选${prereqLabel}`;
      jumpBtn.addEventListener('click', () => {
        activePillar = prereqKey;
        activeStep = pendingStems[prereqKey] && pillars[prereqKey].length !== 2 ? 'branch' : 'stem';
        render();
      });
      lockNotice.append(lockText, jumpBtn);
      picker.appendChild(lockNotice);
    } else if (activeStep === 'branch' && activeStem) {
      const branches = getValidBranches(activePillar, activeStem);
      const branchGrid = document.createElement('div');
      branchGrid.className = 'bazi-reverse-picker-grid is-branch-grid';
      const currentBranch = pillars[activePillar][1] ?? '';

      for (const branch of branches) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `bazi-reverse-option-btn${currentBranch === branch ? ' is-selected' : ''}`;
        btn.dataset.testid = `bazi-reverse-branch-${branch}`;
        const charSpan = document.createElement('strong');
        charSpan.textContent = branch;
        charSpan.style.color = WUXING_CSS_COLOR[BRANCH_WUXING[branch]] ?? '';
        const pairSpan = document.createElement('small');
        pairSpan.textContent = `${activeStem}${branch}`;
        btn.append(charSpan, pairSpan);
        btn.addEventListener('click', () => {
          pillars[activePillar] = `${activeStem}${branch}`;
          clearDependentPillar(activePillar);
          invalidateResults();

          const order: ReadonlyArray<keyof BaziReversePillars> = ['year', 'month', 'day', 'hour'];
          const currentIdx = order.indexOf(activePillar);
          let nextIncomplete: keyof BaziReversePillars | undefined;
          for (let offset = 1; offset <= order.length; offset++) {
            const candidateKey = order[(currentIdx + offset) % order.length]!;
            if (pillars[candidateKey].length !== 2 && !isPillarLocked(candidateKey)) {
              nextIncomplete = candidateKey;
              break;
            }
          }
          if (nextIncomplete) {
            activePillar = nextIncomplete;
            activeStep = pendingStems[nextIncomplete] ? 'branch' : 'stem';
          }
          render();
        });
        branchGrid.appendChild(btn);
      }
      picker.appendChild(branchGrid);
    } else {
      const stems = getValidStems(activePillar);
      const stemGrid = document.createElement('div');
      stemGrid.className = 'bazi-reverse-picker-grid is-stem-grid';

      for (const stem of stems) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `bazi-reverse-option-btn${activeStem === stem ? ' is-selected' : ''}`;
        btn.dataset.testid = `bazi-reverse-stem-${stem}`;
        const charSpan = document.createElement('strong');
        charSpan.textContent = stem;
        charSpan.style.color = WUXING_CSS_COLOR[STEM_WUXING[stem]] ?? '';
        btn.appendChild(charSpan);
        btn.addEventListener('click', () => {
          pendingStems[activePillar] = stem;
          if (pillars[activePillar] && pillars[activePillar][0] !== stem) {
            pillars[activePillar] = '';
            clearDependentPillar(activePillar);
          }
          invalidateResults();
          activeStep = 'branch';
          render();
        });
        stemGrid.appendChild(btn);
      }
      picker.appendChild(stemGrid);
    }
    root.appendChild(picker);

    // 3. 朝代时间范围选择器（紧凑标签，无需手动输入）
    const dynastySection = document.createElement('div');
    dynastySection.className = 'bazi-reverse-dynasty-section';

    const dynastyHead = document.createElement('div');
    dynastyHead.className = 'bazi-reverse-dynasty-head';
    const dynastyLabel = document.createElement('span');
    dynastyLabel.textContent = '查找朝代';
    const dynastyRange = document.createElement('small');
    dynastyRange.textContent = `${selectedDynasty.label} ${selectedDynasty.startYear}~${selectedDynasty.endYear}`;
    dynastyHead.append(dynastyLabel, dynastyRange);

    const dynastyGrid = document.createElement('div');
    dynastyGrid.className = 'bazi-reverse-dynasties';
    dynastyGrid.setAttribute('role', 'radiogroup');
    dynastyGrid.setAttribute('aria-label', '查找朝代时间范围');

    for (const dynasty of BAZI_REVERSE_DYNASTIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      const isSelected = dynasty.id === selectedDynasty.id;
      chip.className = `bazi-reverse-dynasty-chip${isSelected ? ' is-active' : ''}`;
      chip.dataset.testid = `bazi-reverse-dynasty-${dynasty.id}`;
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(isSelected));

      const nameEl = document.createElement('span');
      nameEl.className = 'bazi-reverse-dynasty-name';
      nameEl.textContent = dynasty.label;
      const yearsEl = document.createElement('span');
      yearsEl.className = 'bazi-reverse-dynasty-years';
      yearsEl.textContent = `${dynasty.startYear}~${dynasty.endYear}`;
      chip.append(nameEl, yearsEl);

      chip.addEventListener('click', () => {
        if (dynasty.id === selectedDynasty.id) return;
        selectedDynasty = dynasty;
        invalidateResults();
        render();
      });
      dynastyGrid.appendChild(chip);
    }

    dynastySection.append(dynastyHead, dynastyGrid);
    root.appendChild(dynastySection);

    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.className = 'workspace-ui-button is-secondary is-medium';
    searchBtn.disabled = !canSearch();
    searchBtn.textContent = isSearching ? '正在查找候选时段…' : '查找候选时段';
    searchBtn.addEventListener('click', () => {
      void runSearch();
    });
    root.appendChild(searchBtn);

    if (errorText) {
      const errBox = document.createElement('div');
      errBox.className = 'workspace-ui-form-error';
      errBox.setAttribute('role', 'alert');
      errBox.textContent = errorText;
      root.appendChild(errBox);
    }

    if (candidates.length > 0 || candidateCount > 0) {
      const resultsWrap = document.createElement('div');
      resultsWrap.className = 'bazi-reverse-input-results';

      const summary = document.createElement('div');
      summary.className = 'bazi-reverse-input-result-summary';
      const summaryStrong = document.createElement('strong');
      summaryStrong.textContent = `在「${selectedDynasty.label}」找到 ${candidateCount} 个候选区间`;
      const summarySpan = document.createElement('span');
      summarySpan.textContent = '北京时间 UTC+8 · 节气交接切换月柱 · 23:00 换日';
      summary.append(summaryStrong, summarySpan);
      resultsWrap.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'bazi-reverse-input-candidates';

      candidates.forEach((cand, idx) => {
        const parsedStart = parseIsoOrCivilBeijingStart(cand.start);
        const parsedEnd = parseIsoOrCivilBeijingStart(cand.end);
        const article = document.createElement('article');
        article.className = 'bazi-reverse-input-candidate';

        const copy = document.createElement('div');
        copy.className = 'bazi-reverse-input-candidate-copy';
        const strong = document.createElement('strong');
        strong.textContent = `${parsedStart?.displayText ?? cand.start} 至 ${parsedEnd?.displayText ?? cand.end}`;
        const small = document.createElement('small');
        small.textContent = `${idx + 1}. 起点含、终点不含 · ${cand.startBoundary} → ${cand.endBoundary}`;
        copy.append(strong, small);
        article.appendChild(copy);

        if (parsedStart && parsedStart.year >= 1900 && parsedStart.year <= 2100) {
          const repTimeText = `${String(parsedStart.hour).padStart(2, '0')}:${String(parsedStart.minute).padStart(2, '0')}`;
          const chooseBtn = document.createElement('button');
          chooseBtn.type = 'button';
          chooseBtn.className = 'workspace-ui-button is-secondary is-small';
          chooseBtn.textContent = `选择此日期（${repTimeText}）`;
          chooseBtn.addEventListener('click', () => {
            const timeIndex = Math.max(0, getTimeIndexFromClock(parsedStart.hour, parsedStart.minute));
            const source: BaziReverseSource = {
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
            };
            options.onSelect({
              year: String(parsedStart.year),
              month: String(parsedStart.month),
              day: String(parsedStart.day),
              timeIndex,
              birthHour: String(parsedStart.hour).padStart(2, '0'),
              birthMinute: String(parsedStart.minute).padStart(2, '0'),
              birthSecond: String(parsedStart.second).padStart(2, '0'),
              source,
            });
          });
          article.appendChild(chooseBtn);
        } else if (parsedStart) {
          const unsupported = document.createElement('span');
          unsupported.className = 'bazi-reverse-input-unsupported';
          unsupported.textContent = '1900 年前仅查时段';
          article.appendChild(unsupported);
        }

        list.appendChild(article);
      });

      resultsWrap.appendChild(list);
      root.appendChild(resultsWrap);
    } else if (hasSearched && !errorText && !isSearching) {
      const empty = document.createElement('p');
      empty.className = 'bazi-reverse-input-empty';
      empty.textContent = `「${selectedDynasty.label}（${selectedDynasty.startYear}~${selectedDynasty.endYear}）」内未找到符合四柱的时段，可切换其他朝代再查。`;
      root.appendChild(empty);
    }
  }

  render();
  return root;
}

/**
 * 当外部未传入 `onRequestCasePicker` 时，唤醒工作台全局「个人档案」右侧抽屉。
 */
export function openCasePickerModal(options: {
  roleLabel?: string;
  activeCaseId?: string | null;
  allowTemporaryOption?: boolean;
  onSelect: (selectedCase: PersonalCase, isTemporary: boolean) => void;
  onClose?: () => void;
}): { close: () => void } {
  const role: PersonRole = options.roleLabel?.includes('二') ? 'partner' : 'self';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('mingyu:open-case-picker', {
        detail: {
          role,
          applyCase: (person: PersonalCase, isTemporary: boolean) =>
            options.onSelect(person, isTemporary),
        },
      }),
    );
  }
  return {
    close: () => {
      options.onClose?.();
    },
  };
}

export interface PersonFormCardOptions {
  role?: PersonRole;
  sectionTitle?: string;
  initialCase?: Partial<PersonalCase>;
  /** 星盘(astrolabe)或七政(qizheng)等强制使用精准时间与出生地 */
  forcePreciseBirthPlace?: boolean;
  /** 是否允许选择「未知时辰」 */
  allowUnknownTime?: boolean;
  /** 是否允许四柱反推输入模式 */
  allowPillarsMode?: boolean;
  /** 是否显示姓名输入框 */
  showNameField?: boolean;
  /** 是否显示右上角「从档案选择」快捷按钮 */
  showCasePickerButton?: boolean;
  /** 是否显示底部「保存到命例档案」复选框 */
  showSaveToCaseOption?: boolean;
  defaultSaveToCase?: boolean;
  footerHint?: string;
  birthPlaceModal?: BirthPlaceModalController;
  onRequestCasePicker?: (
    role: PersonRole,
    applyCase: (selected: PersonalCase, isTemporary: boolean) => void,
  ) => void;
  onOpenTimeReverse?: (person: PersonalCase, role: PersonRole) => void;
  onOpenRangeScan?: (person: PersonalCase, role: PersonRole) => void;
  onChange?: (person: PersonalCase, meta: { inputMode: PersonInputMode; saveToCase: boolean }) => void;
}

export interface PersonFormCardController {
  element: HTMLElement;
  getPerson: () => PersonalCase;
  setPerson: (next: Partial<PersonalCase>) => void;
  getInputMode: () => PersonInputMode;
  setInputMode: (mode: PersonInputMode) => void;
  shouldSaveToCase: () => boolean;
  validate: () => ValidationResult;
  saveToCasesStore: () => PersonalCase;
  destroy: () => void;
}

/**
 * 创建单个 1:1 复刻 V1 `PersonForm.tsx` 的生辰输入卡片 (`.workspace-ui-form-surface`)。
 */
export function createPersonFormCard(options: PersonFormCardOptions = {}): PersonFormCardController {
  const role: PersonRole = options.role ?? 'self';
  const showNameField = options.showNameField ?? true;
  const allowUnknownTime = options.allowUnknownTime ?? true;
  const allowPillarsMode = options.allowPillarsMode ?? true;
  const showCasePickerButton = options.showCasePickerButton ?? true;
  const showSaveToCaseOption = options.showSaveToCaseOption ?? true;

  let forcePrecise = Boolean(options.forcePreciseBirthPlace);
  let saveToCase = Boolean(options.defaultSaveToCase ?? false);
  let person: PersonalCase = createDefaultPersonalCase({
    ...options.initialCase,
    ...(forcePrecise ? { useTrueSolarTime: true } : {}),
  });

  if (forcePrecise && (person.birthHour === '' || person.birthMinute === '')) {
    person.birthHour = '12';
    person.birthMinute = '00';
  }

  let inputMode: PersonInputMode = person.reverseSource
    ? 'pillars'
    : person.calendar === 'lunar'
      ? 'lunar'
      : 'solar';

  let ownedModal: BirthPlaceModalController | null = null;
  const modalController =
    options.birthPlaceModal ??
    (ownedModal = createBirthPlaceModal());

  const section = document.createElement('section');
  section.className = `workspace-ui-form-surface${role === 'partner' ? ' is-second-person' : ''}`;

  function notifyChange(): void {
    options.onChange?.(person, { inputMode, saveToCase });
  }

  function clearReverseIfNeeded(): void {
    if (person.reverseSource) {
      person = { ...person, reverseSource: null };
    }
  }

  function handleOpenPlaceModal(): void {
    modalController.open({
      purpose: 'birth',
      initialPlace: person.birthPlace,
      initialDistrictId: person.districtId,
      onConfirm: (selection: BirthPlaceSelection) => {
        person = {
          ...person,
          birthPlace: selection.displayName,
          provinceId: selection.provinceId,
          provinceName: selection.provinceName,
          cityId: selection.cityId,
          cityName: selection.cityName,
          districtId: selection.districtId,
          districtName: selection.districtName,
          longitude: selection.longitude,
          latitude: selection.latitude,
          ...(selection.timezone !== undefined ? { timezone: selection.timezone } : {}),
          ...(selection.timeZoneId ? { timeZoneId: selection.timeZoneId } : { timeZoneId: undefined }),
        };
        render();
        notifyChange();
      },
    });
  }

  function render(): void {
    section.innerHTML = '';

    // 1. Heading (.workspace-ui-form-heading)
    const heading = document.createElement('div');
    heading.className = 'workspace-ui-form-heading';
    const h2 = document.createElement('h2');
    h2.textContent =
      options.sectionTitle || (role === 'partner' ? '命主二' : '出生资料');
    heading.appendChild(h2);

    function applySelectedCase(selected: Partial<PersonalCase>, isTemporary: boolean): void {
      if (role === 'self') {
        setActiveCaseId(isTemporary || !selected.id ? null : selected.id);
      }
      person = createDefaultPersonalCase({
        ...selected,
        ...(forcePrecise ? { useTrueSolarTime: true } : {}),
      });
      if (forcePrecise && (person.birthHour === '' || person.birthMinute === '')) {
        person.birthHour = '12';
        person.birthMinute = '00';
      }
      inputMode = person.reverseSource
        ? 'pillars'
        : person.calendar === 'lunar'
          ? 'lunar'
          : 'solar';
      render();
      notifyChange();
    }

    function openPickerDialog(): void {
      if (options.onRequestCasePicker) {
        options.onRequestCasePicker(role, (selected, isTemporary) => {
          applySelectedCase(selected, isTemporary);
        });
        return;
      }
      openCasePickerModal({
        roleLabel: role === 'partner' ? '命主二' : '命主一',
        activeCaseId: person.isTemporary ? null : person.id,
        allowTemporaryOption: role === 'self',
        onSelect: (selected, isTemporary) => {
          applySelectedCase(selected, isTemporary);
        },
      });
    }

    if (showCasePickerButton) {
      const pickerBtn = document.createElement('button');
      pickerBtn.type = 'button';
      pickerBtn.className = 'workspace-ui-button is-secondary is-small';
      pickerBtn.textContent = '📁 从档案调取';
      pickerBtn.addEventListener('click', openPickerDialog);
      heading.appendChild(pickerBtn);
    }

    section.appendChild(heading);

    // 2. Body (.workspace-ui-form-body)
    const body = document.createElement('div');
    body.className = 'workspace-ui-form-body';

    // 2.1 + 2.2 姓名与性别同排 (.person-name-gender-row)
    const row1 = document.createElement('div');
    row1.className = showNameField
      ? 'workspace-ui-form-row form-row-flex person-name-gender-row'
      : 'workspace-ui-form-row';

    if (showNameField) {
      const nameField = document.createElement('div');
      nameField.className = 'workspace-ui-field';
      const nameLabel = document.createElement('label');
      nameLabel.htmlFor = `${role}-name-input`;
      nameLabel.textContent = '姓名';
      const nameInput = document.createElement('input');
      nameInput.id = `${role}-name-input`;
      nameInput.type = 'text';
      nameInput.className = 'workspace-ui-control';
      nameInput.placeholder = '请输入姓名';
      nameInput.value = person.name;
      nameInput.addEventListener('input', () => {
        person = { ...person, name: nameInput.value };
        notifyChange();
      });
      nameField.append(nameLabel, nameInput);
      row1.appendChild(nameField);
    }

    const genderField = document.createElement('div');
    genderField.className = 'workspace-ui-field';
    const genderLabel = document.createElement('label');
    genderLabel.textContent = '性别';
    const genderControl = createSegmentedControl<'male' | 'female'>({
      value: person.gender,
      options: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
      onChange: (val) => {
        person = { ...person, gender: val };
        render();
        notifyChange();
      },
    });
    genderField.append(genderLabel, genderControl);
    row1.appendChild(genderField);
    body.appendChild(row1);

    // 2.3 日期输入（分段选择器：公历 / 农历 / 四柱）
    const modeRow = document.createElement('div');
    modeRow.className = 'workspace-ui-form-row';
    const modeField = document.createElement('div');
    modeField.className = 'workspace-ui-field';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = '日期输入';
    const modeOptions: SegmentedOption<PersonInputMode>[] = [
      { label: '公历', value: 'solar' },
      { label: '农历', value: 'lunar' },
      ...(allowPillarsMode ? [{ label: '四柱', value: 'pillars' as const }] : []),
    ];
    const modeControl = createSegmentedControl<PersonInputMode>({
      value: inputMode,
      options: modeOptions,
      onChange: (nextMode) => {
        inputMode = nextMode;
        if (nextMode !== 'pillars') {
          person = {
            ...person,
            calendar: nextMode,
            dateType: nextMode,
            ...(nextMode === 'solar' ? { isLeapMonth: false } : {}),
            reverseSource: null,
          };
        }
        render();
        notifyChange();
      },
    });
    modeField.append(modeLabel, modeControl);
    modeRow.appendChild(modeField);
    body.appendChild(modeRow);

    const isLunar = person.calendar === 'lunar';
    const useTrueSolarTime = forcePrecise || Boolean(person.useTrueSolarTime);

    if (inputMode === 'pillars') {
      const reversePanel = createBaziReversePanel({
        source: person.reverseSource,
        onInvalidate: () => {
          if (person.reverseSource) {
            person = { ...person, reverseSource: null };
            notifyChange();
          }
        },
        onSelect: (selection) => {
          person = {
            ...person,
            calendar: 'solar',
            dateType: 'solar',
            isLeapMonth: false,
            year: selection.year,
            month: selection.month,
            day: selection.day,
            timeIndex: selection.timeIndex,
            birthHour: selection.birthHour,
            birthMinute: selection.birthMinute,
            birthSecond: selection.birthSecond,
            reverseSource: selection.source,
          };
          render();
          notifyChange();
        },
      });
      body.appendChild(reversePanel);
    } else {
      // 2.4 农历月别（平月 / 闰月）
      if (isLunar) {
        const leapRow = document.createElement('div');
        leapRow.className = 'workspace-ui-form-row';
        const leapField = document.createElement('div');
        leapField.className = 'workspace-ui-field';
        const leapLabel = document.createElement('label');
        leapLabel.textContent = '月别';
        const leapControl = createSegmentedControl<boolean>({
          value: Boolean(person.isLeapMonth),
          options: [
            { label: '平月', value: false },
            { label: '闰月', value: true },
          ],
          onChange: (val) => {
            clearReverseIfNeeded();
            person = { ...person, isLeapMonth: val };
            render();
            notifyChange();
          },
        });
        leapField.append(leapLabel, leapControl);
        leapRow.appendChild(leapField);
        body.appendChild(leapRow);
      }

      // 2.5 年 / 月 / 日 三格数字输入行 (.workspace-ui-date-row)
      const dateRow = document.createElement('div');
      dateRow.className = 'workspace-ui-form-row workspace-ui-date-row';

      const dateConfigs: ReadonlyArray<{
        key: 'year' | 'month' | 'day';
        label: string;
        placeholder: string;
      }> = [
        { key: 'year', label: '年', placeholder: '2000' },
        { key: 'month', label: '月', placeholder: '1-12' },
        { key: 'day', label: '日', placeholder: '1-31' },
      ];

      for (const cfg of dateConfigs) {
        const field = document.createElement('div');
        field.className = 'workspace-ui-field';
        const label = document.createElement('label');
        label.htmlFor = `${role}-${cfg.key}-input`;
        label.textContent = cfg.label;
        const input = document.createElement('input');
        input.id = `${role}-${cfg.key}-input`;
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.placeholder = cfg.placeholder;
        input.className = 'workspace-ui-control';
        input.value = person[cfg.key];
        input.addEventListener('input', () => {
          const clamped = clampNumericField(cfg.key, input.value);
          input.value = clamped;
          clearReverseIfNeeded();
          person = { ...person, [cfg.key]: clamped };
          notifyChange();
        });
        field.append(label, input);
        dateRow.appendChild(field);
      }
      body.appendChild(dateRow);

      // 2.6 ☑ 使用真太阳时（需精准时分和出生地）复选框（当 forcePreciseBirthPlace=true 时隐藏并自动启用）
      if (!forcePrecise) {
        const tstRow = document.createElement('div');
        tstRow.className = 'workspace-ui-form-row';
        const tstLabel = document.createElement('label');
        tstLabel.className = 'workspace-ui-checkbox';
        tstLabel.htmlFor = `${role}-true-solar-time-input`;
        const tstCheckbox = document.createElement('input');
        tstCheckbox.id = `${role}-true-solar-time-input`;
        tstCheckbox.type = 'checkbox';
        tstCheckbox.checked = Boolean(person.useTrueSolarTime);
        tstCheckbox.addEventListener('change', () => {
          clearReverseIfNeeded();
          const checked = tstCheckbox.checked;
          let birthHour = person.birthHour;
          let birthMinute = person.birthMinute;
          if (checked && (birthHour === '' || birthMinute === '')) {
            birthHour = '12';
            birthMinute = '00';
          }
          person = {
            ...person,
            useTrueSolarTime: checked,
            birthHour,
            birthMinute,
          };
          render();
          notifyChange();
        });
        const tstSpan = document.createElement('span');
        tstSpan.textContent = '使用真太阳时（需精准时分和出生地）';
        tstLabel.append(tstCheckbox, tstSpan);
        tstRow.appendChild(tstLabel);
        body.appendChild(tstRow);
      }

      // 2.7 未勾选真太阳时：干净的「时辰」下拉选择；勾选真太阳时（或星盘/七政）：精准时间 <input type="time">
      if (useTrueSolarTime) {
        const timeRow = document.createElement('div');
        timeRow.className = 'workspace-ui-form-row';
        const timeField = document.createElement('div');
        timeField.className = 'workspace-ui-field';
        const timeLabel = document.createElement('label');
        timeLabel.htmlFor = `${role}-birth-time-input`;
        timeLabel.textContent = '精准时间';

        const timeInput = document.createElement('input');
        timeInput.id = `${role}-birth-time-input`;
        timeInput.type = 'time';
        timeInput.className = 'workspace-ui-control';
        timeInput.value =
          person.birthHour !== '' && person.birthMinute !== ''
            ? `${person.birthHour.padStart(2, '0')}:${person.birthMinute.padStart(2, '0')}`
            : '';

        const hintBox = document.createElement('div');
        hintBox.className = 'workspace-ui-field-hint';
        const initialHint = getTrueSolarTimeHintLabel(person.birthHour, person.birthMinute);
        hintBox.textContent = initialHint;
        hintBox.style.display = initialHint ? '' : 'none';

        timeInput.addEventListener('input', () => {
          clearReverseIfNeeded();
          if (!timeInput.value) {
            person = { ...person, birthHour: '', birthMinute: '', birthSecond: '' };
          } else {
            const [hh = '', mm = ''] = timeInput.value.split(':');
            const hourNum = Number(hh);
            const minNum = Number(mm);
            const matchedIdx = getTimeIndexFromClock(hourNum, minNum);
            person = {
              ...person,
              birthHour: hh,
              birthMinute: mm,
              birthSecond: '0',
              ...(matchedIdx >= 0 ? { timeIndex: matchedIdx } : {}),
            };
          }
          const nextHint = getTrueSolarTimeHintLabel(person.birthHour, person.birthMinute);
          hintBox.textContent = nextHint;
          hintBox.style.display = nextHint ? '' : 'none';
          notifyChange();
        });

        timeField.append(timeLabel, timeInput, hintBox);
        timeRow.appendChild(timeField);
        body.appendChild(timeRow);
      } else {
        const shichenRow = document.createElement('div');
        shichenRow.className = 'workspace-ui-form-row';
        const shichenField = document.createElement('div');
        shichenField.className = 'workspace-ui-field';
        const shichenLabel = document.createElement('label');
        shichenLabel.htmlFor = `${role}-time-index-input`;
        shichenLabel.textContent = '时辰';

        const shichenSelect = document.createElement('select');
        shichenSelect.id = `${role}-time-index-input`;
        shichenSelect.className = 'workspace-ui-control';

        const dropdownOptions = getBirthTimeDropdownOptions(allowUnknownTime);
        const currentValue =
          person.timeIndex === 'unknown'
            ? 'unknown'
            : person.timeIndex === ''
              ? ''
              : String(person.timeIndex);

        for (const opt of dropdownOptions) {
          const optionEl = document.createElement('option');
          optionEl.value = opt.value;
          optionEl.textContent = opt.label;
          if (opt.value === currentValue) optionEl.selected = true;
          shichenSelect.appendChild(optionEl);
        }

        shichenSelect.addEventListener('change', () => {
          clearReverseIfNeeded();
          const val = shichenSelect.value;
          const nextTimeIndex: TimeIndexValue =
            val === 'unknown' ? 'unknown' : val === '' ? '' : Number(val);
          person = {
            ...person,
            timeIndex: nextTimeIndex,
            birthHour: '',
            birthMinute: '',
            birthSecond: '',
          };
          notifyChange();
        });

        shichenField.append(shichenLabel, shichenSelect);
        shichenRow.appendChild(shichenField);
        body.appendChild(shichenRow);
      }

      if (options.onOpenTimeReverse && allowUnknownTime) {
        const reverseHelperRow = document.createElement('div');
        reverseHelperRow.className = 'workspace-ui-form-row person-unknown-time-row';
        const reverseHelperBtn = document.createElement('button');
        reverseHelperBtn.type = 'button';
        reverseHelperBtn.className = 'person-unknown-time-trigger';
        reverseHelperBtn.dataset.testid = `${role}-unknown-time-reverse-btn`;
        const titleSpan = document.createElement('strong');
        titleSpan.textContent = '我不知道时辰';
        const subSpan = document.createElement('span');
        subSpan.textContent = '通过过往经历与节点逆推 →';
        reverseHelperBtn.append(titleSpan, subSpan);
        reverseHelperBtn.addEventListener('click', () => {
          options.onOpenTimeReverse?.({ ...person }, role);
        });
        reverseHelperRow.appendChild(reverseHelperBtn);
        body.appendChild(reverseHelperRow);
      }
    }

    // 2.8 出生地触发按钮 .address-trigger（当勾选真太阳时或星盘/七政时显示）
    if (useTrueSolarTime) {
      const placeRow = document.createElement('div');
      placeRow.className = 'workspace-ui-form-row';
      const placeField = document.createElement('div');
      placeField.className = 'workspace-ui-field';
      const placeLabel = document.createElement('label');
      placeLabel.htmlFor = `${role}-birth-place-input`;
      placeLabel.textContent = '出生地';

      const placeBtn = document.createElement('button');
      placeBtn.id = `${role}-birth-place-input`;
      placeBtn.type = 'button';
      placeBtn.className = 'workspace-ui-control address-trigger';
      const placeTextSpan = document.createElement('span');
      placeTextSpan.textContent = person.birthPlace || '请选择出生地';
      const placeArrowSpan = document.createElement('span');
      placeArrowSpan.className = 'address-trigger-arrow';
      placeArrowSpan.textContent = '选择';
      placeBtn.append(placeTextSpan, placeArrowSpan);
      placeBtn.addEventListener('click', handleOpenPlaceModal);

      placeField.append(placeLabel, placeBtn);
      placeRow.appendChild(placeField);
      body.appendChild(placeRow);

      if (options.onOpenRangeScan) {
        const rangeHelperRow = document.createElement('div');
        rangeHelperRow.className = 'workspace-ui-form-row person-unknown-time-row';
        const rangeHelperBtn = document.createElement('button');
        rangeHelperBtn.type = 'button';
        rangeHelperBtn.className = 'person-unknown-time-trigger';
        rangeHelperBtn.dataset.testid = `${role}-unknown-minute-range-btn`;
        const titleSpan = document.createElement('strong');
        titleSpan.textContent = '我不知道具体分秒';
        const subSpan = document.createElement('span');
        subSpan.textContent = '按时间段逐秒排查宫位/命度边界 →';
        rangeHelperBtn.append(titleSpan, subSpan);
        rangeHelperBtn.addEventListener('click', () => {
          options.onOpenRangeScan?.({ ...person }, role);
        });
        rangeHelperRow.appendChild(rangeHelperBtn);
        body.appendChild(rangeHelperRow);
      }
    }

    // 2.9 四柱回填提示
    if (person.reverseSource) {
      const rev = person.reverseSource;
      const revHint = document.createElement('div');
      revHint.className = 'workspace-ui-field-hint';
      const repClock =
        person.birthHour && person.birthMinute
          ? `${person.birthHour.padStart(2, '0')}:${person.birthMinute.padStart(2, '0')}`
          : '代表时刻';
      revHint.textContent = `已选日期（四柱输入）：${rev.pillars.year} ${rev.pillars.month} ${rev.pillars.day} ${rev.pillars.hour}；候选区间 ${rev.intervalStart} 至 ${rev.intervalEnd}（起点含、终点不含）。采用区间起点 ${repClock}（北京时间）。`;
      body.appendChild(revHint);
    }

    // 2.10 保存到命例档案复选框
    if (showSaveToCaseOption) {
      const saveRow = document.createElement('div');
      saveRow.className = 'workspace-ui-form-row';
      const saveLabel = document.createElement('label');
      saveLabel.className = 'workspace-ui-checkbox';
      saveLabel.htmlFor = `${role}-save-case-checkbox`;
      const saveCheckbox = document.createElement('input');
      saveCheckbox.id = `${role}-save-case-checkbox`;
      saveCheckbox.type = 'checkbox';
      saveCheckbox.checked = saveToCase;
      saveCheckbox.addEventListener('change', () => {
        saveToCase = saveCheckbox.checked;
        notifyChange();
      });
      const saveSpan = document.createElement('span');
      saveSpan.textContent = '排盘时同步保存到命例档案';
      saveLabel.append(saveCheckbox, saveSpan);
      saveRow.appendChild(saveLabel);
      body.appendChild(saveRow);
    }

    section.appendChild(body);

    if (options.footerHint) {
      const footerHintEl = document.createElement('div');
      footerHintEl.className = 'workspace-ui-form-case-hint';
      footerHintEl.textContent = options.footerHint;
      section.appendChild(footerHintEl);
    }
  }

  render();

  return {
    element: section,
    getPerson: () => ({ ...person }),
    setPerson: (next) => {
      person = createDefaultPersonalCase({
        ...person,
        ...next,
        ...(forcePrecise ? { useTrueSolarTime: true } : {}),
      });
      inputMode = person.reverseSource
        ? 'pillars'
        : person.calendar === 'lunar'
          ? 'lunar'
          : 'solar';
      render();
    },
    getInputMode: () => inputMode,
    setInputMode: (mode) => {
      inputMode = mode;
      render();
    },
    shouldSaveToCase: () => saveToCase,
    validate: () =>
      validatePersonalCase(person, {
        label: role === 'partner' ? '命主二' : '命主一',
        forcePreciseBirthPlace: forcePrecise,
        allowUnknownTime,
        inputMode,
      }),
    saveToCasesStore: () => {
      const saved = upsertPersonalCase(person, person.isTemporary ? undefined : person.id);
      person = { ...saved };
      return saved;
    },
    destroy: () => {
      ownedModal?.destroy();
      section.remove();
    },
  };
}

export interface PersonFormWorkspaceOptions {
  mode?: 'single' | 'compatibility';
  method?: Method | string;
  initialSelf?: Partial<PersonalCase>;
  initialPartner?: Partial<PersonalCase>;
  defaultSaveToCase?: boolean;
  onRequestCasePicker?: (
    role: PersonRole,
    applyCase: (selected: PersonalCase, isTemporary: boolean) => void,
  ) => void;
  onOpenTimeReverse?: (person: PersonalCase, role: PersonRole) => void;
  onOpenRangeScan?: (person: PersonalCase, role: PersonRole) => void;
  onChange?: (state: { self: PersonalCase; partner?: PersonalCase }) => void;
}

export interface PersonFormWorkspaceController {
  element: HTMLDivElement;
  selfCard: PersonFormCardController;
  partnerCard: PersonFormCardController | null;
  getState: () => { self: PersonalCase; partner?: PersonalCase };
  validate: () => ValidationResult;
  persistIfRequested: () => { self: PersonalCase; partner?: PersonalCase };
  destroy: () => void;
}

const FORCE_PRECISE_METHODS = new Set<string>([
  'astrolabe',
  'astrolabe-range',
  'astrolabe-synastry',
  'qizheng',
  'qizheng-range',
]);

const ALLOW_UNKNOWN_TIME_METHODS = new Set<string>([
  'bazi',
  'bazi-synastry',
  'ziwei',
  'ziwei-synastry',
  'bazi-ziwei',
  'minglu',
  'chinese-name',
  'chinese-naming',
]);

/**
 * 创建支持单人模式与双人合盘模式（`命主一` + `命主二`）的完整 V1 生辰输入工作区。
 */
export function createPersonFormWorkspace(
  options: PersonFormWorkspaceOptions = {},
): PersonFormWorkspaceController {
  const isCompatibility =
    options.mode === 'compatibility' ||
    options.method === 'bazi-synastry' ||
    options.method === 'ziwei-synastry' ||
    options.method === 'astrolabe-synastry';
  const method = options.method ?? 'bazi';
  const forcePrecise = FORCE_PRECISE_METHODS.has(method);
  const allowUnknownTime = ALLOW_UNKNOWN_TIME_METHODS.has(method);
  const allowRangeScan = !isCompatibility && (method === 'astrolabe' || method === 'qizheng');

  const sharedPlaceModal = createBirthPlaceModal();
  const layout = document.createElement('div');
  layout.className = `workspace-ui-form-layout person-form-workspace${
    isCompatibility ? ' is-two-column is-compatibility' : ''
  }`;

  let activeMobileRole: PersonRole = 'self';
  let selfTabBtn: HTMLButtonElement | null = null;
  let partnerTabBtn: HTMLButtonElement | null = null;

  if (isCompatibility) {
    const mobileSwitcher = document.createElement('div');
    mobileSwitcher.className = 'compatibility-mobile-switcher';
    mobileSwitcher.setAttribute('role', 'tablist');
    mobileSwitcher.setAttribute('aria-label', '合盘人员资料切换');

    selfTabBtn = document.createElement('button');
    selfTabBtn.type = 'button';
    selfTabBtn.className = 'compatibility-mobile-switcher-btn is-active';
    selfTabBtn.setAttribute('role', 'tab');
    selfTabBtn.setAttribute('aria-selected', 'true');
    selfTabBtn.textContent = '命主一';

    partnerTabBtn = document.createElement('button');
    partnerTabBtn.type = 'button';
    partnerTabBtn.className = 'compatibility-mobile-switcher-btn';
    partnerTabBtn.setAttribute('role', 'tab');
    partnerTabBtn.setAttribute('aria-selected', 'false');
    partnerTabBtn.textContent = '命主二';

    selfTabBtn.addEventListener('click', () => {
      activeMobileRole = 'self';
      syncMobileCompatibilityCards();
    });
    partnerTabBtn.addEventListener('click', () => {
      activeMobileRole = 'partner';
      syncMobileCompatibilityCards();
    });

    mobileSwitcher.append(selfTabBtn, partnerTabBtn);
    layout.appendChild(mobileSwitcher);
  }

  const selfCard = createPersonFormCard({
    role: 'self',
    sectionTitle: isCompatibility ? '命主一' : '出生资料',
    initialCase: options.initialSelf,
    forcePreciseBirthPlace: forcePrecise,
    allowUnknownTime,
    showCasePickerButton: true,
    showSaveToCaseOption: true,
    defaultSaveToCase: options.defaultSaveToCase ?? true,
    birthPlaceModal: sharedPlaceModal,
    onRequestCasePicker: options.onRequestCasePicker,
    onOpenTimeReverse: options.onOpenTimeReverse,
    ...(allowRangeScan && options.onOpenRangeScan ? { onOpenRangeScan: options.onOpenRangeScan } : {}),
    onChange: () => {
      options.onChange?.({
        self: selfCard.getPerson(),
        ...(partnerCard ? { partner: partnerCard.getPerson() } : {}),
      });
    },
  });

  layout.appendChild(selfCard.element);

  let partnerCard: PersonFormCardController | null = null;
  if (isCompatibility) {
    partnerCard = createPersonFormCard({
      role: 'partner',
      sectionTitle: '命主二',
      initialCase:
        options.initialPartner ??
        createDefaultPersonalCase({
          id: 'temporary_partner',
          name: '',
          gender: 'female',
          year: '1992',
          month: '6',
          day: '15',
          timeIndex: 6,
          isTemporary: true,
        }),
      forcePreciseBirthPlace: forcePrecise,
      allowUnknownTime,
      showCasePickerButton: true,
      showSaveToCaseOption: true,
      defaultSaveToCase: options.defaultSaveToCase ?? false,
      birthPlaceModal: sharedPlaceModal,
      onRequestCasePicker: options.onRequestCasePicker,
      onOpenTimeReverse: options.onOpenTimeReverse,
      onChange: () => {
        options.onChange?.({
          self: selfCard.getPerson(),
          ...(partnerCard ? { partner: partnerCard.getPerson() } : {}),
        });
      },
    });
    layout.appendChild(partnerCard.element);
  }

  function syncMobileCompatibilityCards(): void {
    if (!isCompatibility || !partnerCard) return;
    const isSelf = activeMobileRole === 'self';
    selfTabBtn?.classList.toggle('is-active', isSelf);
    partnerTabBtn?.classList.toggle('is-active', !isSelf);
    selfTabBtn?.setAttribute('aria-selected', String(isSelf));
    partnerTabBtn?.setAttribute('aria-selected', String(!isSelf));
    selfCard.element.classList.toggle('is-mobile-hidden-card', !isSelf);
    partnerCard.element.classList.toggle('is-mobile-hidden-card', isSelf);
  }

  syncMobileCompatibilityCards();

  return {
    element: layout,
    selfCard,
    partnerCard,
    getState: () => ({
      self: selfCard.getPerson(),
      ...(partnerCard ? { partner: partnerCard.getPerson() } : {}),
    }),
    validate: () => {
      const selfValidation = selfCard.validate();
      if (!selfValidation.ok) {
        if (isCompatibility && activeMobileRole !== 'self') {
          activeMobileRole = 'self';
          syncMobileCompatibilityCards();
        }
        return selfValidation;
      }
      if (partnerCard) {
        const partnerValidation = partnerCard.validate();
        if (!partnerValidation.ok && activeMobileRole !== 'partner') {
          activeMobileRole = 'partner';
          syncMobileCompatibilityCards();
        }
        return partnerValidation;
      }
      return { ok: true };
    },
    persistIfRequested: () => {
      const self = selfCard.shouldSaveToCase()
        ? selfCard.saveToCasesStore()
        : selfCard.getPerson();
      let partner: PersonalCase | undefined;
      if (partnerCard) {
        partner = partnerCard.shouldSaveToCase()
          ? partnerCard.saveToCasesStore()
          : partnerCard.getPerson();
        upsertCompatibilityRecord(self, partner, { method: String(method) });
      }
      return { self, ...(partner ? { partner } : {}) };
    },
    destroy: () => {
      sharedPlaceModal.destroy();
      selfCard.destroy();
      partnerCard?.destroy();
      layout.remove();
    },
  };
}

export { toV2BirthPayload };
