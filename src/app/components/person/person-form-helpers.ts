import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  SIXTY_CYCLE,
  type HeavenlyStem,
} from '../../../systems/ganzhi-foundation';
import type { PersonalCase } from '../../../v2-ui/cases-store';
import type { ValidationResult } from '../../../v2-ui/case-birth';

export type PersonRole = 'self' | 'partner';
export type PersonInputMode = 'solar' | 'lunar' | 'pillars';

export interface PersonFormCardHandle {
  getPerson: () => PersonalCase;
  setPerson: (next: Partial<PersonalCase>) => void;
  getInputMode: () => PersonInputMode;
  setInputMode: (mode: PersonInputMode) => void;
  shouldSaveToCase: () => boolean;
  validate: () => ValidationResult;
  saveToCasesStore: () => PersonalCase;
}

export interface PersonFormWorkspaceHandle {
  selfCard: PersonFormCardHandle | null;
  partnerCard: PersonFormCardHandle | null;
  getState: () => { self: PersonalCase; partner?: PersonalCase };
  validate: () => ValidationResult;
  persistIfRequested: () => { self: PersonalCase; partner?: PersonalCase };
}

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
