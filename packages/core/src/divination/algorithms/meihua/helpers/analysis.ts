import { isKe, isSheng } from '../../../../ganzhi';
import { WUXING } from '../../../../wuxing';

export type MeihuaSeason = '春' | '夏' | '秋' | '冬';
export type MeihuaSeasonState = '旺' | '相' | '休' | '囚' | '死' | '未知';

const WUXING_ELEMENTS = new Set<string>(WUXING);

function assertWuxing(value: string, label: string): void {
  if (!WUXING_ELEMENTS.has(value)) {
    throw new Error(`${label}五行无效：${value}`);
  }
}

export function getMeihuaSeasonByJieQi(jieQi: string): MeihuaSeason {
  const seasonByJieQi: Record<string, MeihuaSeason> = {
    立春: '春',
    雨水: '春',
    惊蛰: '春',
    春分: '春',
    清明: '春',
    谷雨: '春',
    立夏: '夏',
    小满: '夏',
    芒种: '夏',
    夏至: '夏',
    小暑: '夏',
    大暑: '夏',
    立秋: '秋',
    处暑: '秋',
    白露: '秋',
    秋分: '秋',
    寒露: '秋',
    霜降: '秋',
    立冬: '冬',
    小雪: '冬',
    大雪: '冬',
    冬至: '冬',
    小寒: '冬',
    大寒: '冬',
  };

  const season = seasonByJieQi[jieQi];
  if (!season) {
    throw new Error(`无法识别梅花易数节气：${jieQi}`);
  }
  return season;
}

export function getMeihuaSeasonByMonth(monthNumber: number): MeihuaSeason {
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`月份必须是 1-12 之间的整数，当前为 ${monthNumber}。`);
  }
  if (monthNumber <= 3) return '春';
  if (monthNumber <= 6) return '夏';
  if (monthNumber <= 9) return '秋';
  return '冬';
}

export function getMeihuaElementSeasonState(
  element: string,
  season: MeihuaSeason,
): MeihuaSeasonState {
  assertWuxing(element, '目标');
  const seasonStates: Record<MeihuaSeason, Record<string, Exclude<MeihuaSeasonState, '未知'>>> = {
    春: { 木: '旺', 火: '相', 水: '休', 金: '囚', 土: '死' },
    夏: { 火: '旺', 土: '相', 木: '休', 水: '囚', 金: '死' },
    秋: { 金: '旺', 水: '相', 土: '休', 火: '囚', 木: '死' },
    冬: { 水: '旺', 木: '相', 金: '休', 土: '囚', 火: '死' },
  };

  const state = seasonStates[season]?.[element];
  if (!state) {
    throw new Error(`无法判断${season}季${element}的旺衰。`);
  }
  return state;
}

export function getMeihuaElementRelation(yong: string, ti: string): string {
  assertWuxing(yong, '用卦');
  assertWuxing(ti, '体卦');
  if (yong === ti) return '体用比和';
  if (isSheng(yong, ti)) return '用生体';
  if (isSheng(ti, yong)) return '体生用';
  if (isKe(yong, ti)) return '用克体';
  if (isKe(ti, yong)) return '体克用';
  throw new Error(`无法判断用卦${yong}与体卦${ti}的五行关系。`);
}
