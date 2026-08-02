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

function getMonthLeadingElement(monthBranch: string): Wuxing {
  const season = SEASON_STATUS[monthBranch];
  if (!season) {
    throw new Error(`月令旺衰数据缺失：${monthBranch}`);
  }
  const wangElements = Object.entries(season)
    .filter(([, status]) => status === '旺')
    .map(([element]) => element);
  if (wangElements.length !== 1 || !WUXING.includes(wangElements[0] as Wuxing)) {
    throw new Error(`${monthBranch}月令必须且只能有一个旺五行。`);
  }
  return wangElements[0] as Wuxing;
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
    const seasonStatus = season[element];
    if (!seasonStatus || !['旺', '相', '休', '囚', '死'].includes(seasonStatus)) {
      throw new Error(`月令旺衰数据缺失：${monthBranch}/${element}`);
    }
    const auditedSeasonStatus = seasonStatus as MonthQiElementItem['seasonStatus'];
    const commanderApplied = commanderWuxing === element;
    const commanderText = commanderApplied && commanderStem ? `；${commanderStem}司令` : '';

    return {
      element,
      seasonStatus: auditedSeasonStatus,
      count: 1 + (commanderApplied ? 1 : 0),
      commanderApplied,
      ruleBasis: [
        `${monthBranch}月状态：${auditedSeasonStatus}`,
        ...(commanderApplied && commanderStem ? [`${commanderStem}司令五行：${element}`] : []),
      ],
      summary: `${element}于${monthBranch}月为${auditedSeasonStatus}${commanderText}；月令状态与司令分别登记，不换算百分比`,
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
