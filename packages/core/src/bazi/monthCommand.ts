import { BASIC_MAPPINGS, SEASON_STATUS } from './baziDefinitions';
import { WUXING, type Wuxing } from './baziTypes';
import { assertEarthlyBranch, assertHeavenlyStem } from './baziUtils';
import type { MonthQiElementItem, MonthQiProfile } from '../types/analysis';

function getStemWuxing(stem: string): Wuxing {
  assertHeavenlyStem(stem, '司令天干');
  const index = BASIC_MAPPINGS.HEAVENLY_STEMS.indexOf(stem as never);
  const wuxing = BASIC_MAPPINGS.STEM_WUXING[index] as Wuxing | undefined;
  if (!wuxing) {
    throw new Error(`司令天干五行数据缺失：${stem}`);
  }
  return wuxing;
}

function getBranchWuxing(branch: string): Wuxing {
  assertEarthlyBranch(branch, '月支');
  const index = BASIC_MAPPINGS.EARTHLY_BRANCHES.indexOf(branch as never);
  const wuxing = BASIC_MAPPINGS.BRANCH_WUXING[index] as Wuxing | undefined;
  if (!wuxing) {
    throw new Error(`月支五行数据缺失：${branch}`);
  }
  return wuxing;
}

function getMonthLeadingElement(monthBranch: string): Wuxing {
  const season = SEASON_STATUS[monthBranch];
  const wangElement = Object.entries(season ?? {}).find(([, status]) => status === '旺')?.[0];
  return (wangElement as Wuxing | undefined) ?? getBranchWuxing(monthBranch);
}

export function analyzeMonthQiProfile(monthBranch: string, commanderStem?: string): MonthQiProfile {
  assertEarthlyBranch(monthBranch, '月支');
  if (commanderStem) {
    assertHeavenlyStem(commanderStem, '司令天干');
  }

  const season = SEASON_STATUS[monthBranch];
  if (!season) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}`);
  }

  const commanderWuxing = commanderStem ? getStemWuxing(commanderStem) : undefined;

  const items: MonthQiElementItem[] = WUXING.map((element) => {
    const seasonStatus = season[element] ?? '平';
    const commanderApplied = commanderWuxing === element;
    const commanderText = commanderApplied && commanderStem ? `；${commanderStem}司令` : '';

    return {
      element,
      seasonStatus,
      count: 1 + (commanderApplied ? 1 : 0),
      commanderApplied,
      ruleBasis: [
        `${monthBranch}月状态：${seasonStatus}`,
        ...(commanderApplied && commanderStem ? [`${commanderStem}司令五行：${element}`] : []),
      ],
      summary: `${element}于${monthBranch}月为${seasonStatus}${commanderText}；月令状态与司令分别登记，不换算百分比`,
    };
  });

  const leadingElements = [
    ...new Set(
      [getMonthLeadingElement(monthBranch), commanderWuxing].filter((element): element is Wuxing =>
        Boolean(element),
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
