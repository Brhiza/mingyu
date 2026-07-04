import { BASIC_MAPPINGS, SEASON_STATUS } from './baziDefinitions';
import { WUXING, type Wuxing } from './baziTypes';
import type { MonthQiElementItem, MonthQiProfile } from '../types/analysis';

const STATUS_SCORE: Record<string, number> = {
  旺: 4,
  相: 2,
  休: 0,
  囚: -2,
  死: -4,
};

const STATUS_WEIGHT: Record<string, number> = {
  旺: 40,
  相: 26,
  休: 16,
  囚: 10,
  死: 8,
};

function getStemWuxing(stem: string | undefined): Wuxing | undefined {
  if (!stem) return undefined;
  const index = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem as never);
  return index >= 0 ? (BASIC_MAPPINGS.STEM_WUXING[index] as Wuxing) : undefined;
}

function getBranchWuxing(branch: string): Wuxing | undefined {
  const index = BASIC_MAPPINGS.EARTHLY_BRANCHES.indexOf(branch as never);
  return index >= 0 ? (BASIC_MAPPINGS.BRANCH_WUXING[index] as Wuxing) : undefined;
}

function getMonthLeadingElement(monthBranch: string): Wuxing | undefined {
  const season = SEASON_STATUS[monthBranch];
  const wangElement = Object.entries(season ?? {}).find(([, status]) => status === '旺')?.[0];
  return (wangElement as Wuxing | undefined) ?? getBranchWuxing(monthBranch);
}

function formatSignedScore(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

export function analyzeMonthQiProfile(
  monthBranch: string,
  commanderStem?: string,
): MonthQiProfile {
  const season = SEASON_STATUS[monthBranch] ?? {};
  const commanderWuxing = getStemWuxing(commanderStem);

  const rawItems = WUXING.map((element) => {
    const seasonStatus = season[element] ?? '平';
    const commanderBonus = commanderWuxing === element ? 1.5 : 0;
    const score = Number(((STATUS_SCORE[seasonStatus] ?? 0) + commanderBonus).toFixed(1));
    const weight = (STATUS_WEIGHT[seasonStatus] ?? 12) + (commanderBonus > 0 ? 12 : 0);
    const count = (season[element] ? 1 : 0) + (commanderBonus > 0 ? 1 : 0);

    return {
      element,
      seasonStatus,
      score,
      weight,
      count,
    };
  });

  const totalWeight = rawItems.reduce((sum, item) => sum + item.weight, 0) || 1;
  const items: MonthQiElementItem[] = rawItems.map((item) => {
    const percent = Number(((item.weight / totalWeight) * 100).toFixed(1));
    const commanderText =
      commanderWuxing === item.element && commanderStem ? `，${commanderStem}司令加权` : '';

    return {
      element: item.element,
      seasonStatus: item.seasonStatus,
      score: item.score,
      percent,
      count: item.count,
      summary: `${item.element}于${monthBranch}月${item.seasonStatus}，分数${formatSignedScore(
        item.score,
      )}，气数约${percent}%${commanderText}`,
    };
  });

  const leadingElements = [
    ...new Set(
      [getMonthLeadingElement(monthBranch), commanderWuxing].filter(
        (element): element is Wuxing => Boolean(element),
      ),
    ),
  ];

  return {
    commanderStem: commanderStem || '',
    leadingElements,
    items,
    summary: [
      `${monthBranch}月令以${leadingElements.join('、') || '未知'}为主`,
      commanderStem && commanderWuxing ? `${commanderStem}${commanderWuxing}司令` : '',
    ]
      .filter(Boolean)
      .join('，'),
  };
}
