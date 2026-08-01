/**
 * @file 奇门已校勘组合规则识别
 * @description 只识别已有固定文献条件可闭合的奇门组合规则。
 *
 * 这里只输出结构化计算结果，不生成应用层报告、评分报告或具体场景话术。
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import { branchElements, doorElements, isControlling, isGenerating } from './_constants';

export interface QimenPatternCombo {
  key: string;
  name: string;
  tone: 'super-good' | 'super-bad' | 'mixed';
  summary: string;
  palace?: number;
  sources: string[];
}

export interface PatternComboContext {
  monthBranch?: string;
  jiuGongGe: QimenJiuGongGe[];
}

type DoorSeasonQiState = '旺' | '相' | '休' | '囚' | '废';

function getDoorSeasonQiState(
  doorElement: string,
  monthElement: string,
): DoorSeasonQiState | undefined {
  if (!doorElement || !monthElement) return undefined;
  if (doorElement === monthElement) return '旺';
  if (isGenerating(doorElement, monthElement)) return '相';
  if (isControlling(doorElement, monthElement)) return '休';
  if (isControlling(monthElement, doorElement)) return '囚';
  if (isGenerating(monthElement, doorElement)) return '废';
  return undefined;
}

function pushDoorSeasonQiCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const monthElement = ctx.monthBranch ? branchElements[ctx.monthBranch] : undefined;
  if (!ctx.monthBranch || !monthElement) return;

  const entries = ctx.jiuGongGe
    .map((palace) => {
      const door = palace.renPan.door;
      const doorElement = doorElements[door];
      const state = doorElement ? getDoorSeasonQiState(doorElement, monthElement) : undefined;
      if (!door || !doorElement || !state) return undefined;
      return {
        gong: palace.gong,
        text: `${palace.name}${door}属${doorElement}为${state}`,
      };
    })
    .filter((entry): entry is { gong: number; text: string } => Boolean(entry));

  if (!entries.length) return;

  out.push({
    key: `combo:doorSeasonQi:${ctx.monthBranch}:${entries.map((entry) => entry.gong).join(':')}`,
    name: '八门余气',
    tone: 'mixed',
    summary: `${ctx.monthBranch}月属${monthElement}，八门余气为：${entries
      .map((entry) => entry.text)
      .join(
        '；',
      )}。固定采用《奇门遁甲统宗》卷十二“当时者为旺，我生者为相，我克者为休，克我者为囚，生我者为废”五态月令版，不混用《奇门宝鉴御定》逐节旺、绝、胎、没、死、囚、休、废八态版；只作八门月令状态事实，不自动推出兵事进退或通用吉凶。`,
    sources: [
      '《奇门遁甲统宗》卷十二八门余气五态月令版',
      `${ctx.monthBranch}月属${monthElement}`,
      ...entries.map((entry) => entry.text),
    ],
  });
}

export function detectQimenPatternCombos(ctx: PatternComboContext): QimenPatternCombo[] {
  const out: QimenPatternCombo[] = [];
  pushDoorSeasonQiCombo(ctx, out);

  const seen = new Set<string>();
  return out.filter((combo) => {
    if (seen.has(combo.key)) return false;
    seen.add(combo.key);
    return true;
  });
}
