/**
 * @file 奇门已校勘组合规则识别
 * @description 只识别已有固定文献条件可闭合的奇门组合规则。
 *
 * 这里只输出结构化计算结果，不生成应用层报告、评分报告或具体场景话术。
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import { branchElements, doorElements, isControlling, isGenerating } from './_constants';
import { getTianPanStems } from './palace-utils';

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

type StemPressureRule = {
  stemElement: string;
  palaceElement: string;
  palaces: number[];
  issue: string;
};

const stemPressureRules: Record<string, StemPressureRule> = {
  甲: { stemElement: '木', palaceElement: '金', palaces: [6, 7], issue: '木被金克' },
  乙: { stemElement: '木', palaceElement: '金', palaces: [6, 7], issue: '木被金克' },
  丙: { stemElement: '火', palaceElement: '水', palaces: [1], issue: '火被水克' },
  丁: { stemElement: '火', palaceElement: '水', palaces: [1], issue: '火被水克' },
  戊: { stemElement: '土', palaceElement: '木', palaces: [3, 4], issue: '土被木克' },
  己: { stemElement: '土', palaceElement: '木', palaces: [3, 4], issue: '土被木克' },
  庚: { stemElement: '金', palaceElement: '火', palaces: [9], issue: '金被火克' },
  辛: { stemElement: '金', palaceElement: '火', palaces: [9], issue: '金被火克' },
  壬: { stemElement: '水', palaceElement: '土', palaces: [2, 8], issue: '水被土克' },
  癸: { stemElement: '水', palaceElement: '土', palaces: [2, 8], issue: '水被土克' },
};

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

function pushStemPressureCombo(ctx: PatternComboContext, out: QimenPatternCombo[]): void {
  const entries = ctx.jiuGongGe
    .flatMap((palace) =>
      getTianPanStems(palace).map((stem) => {
        const rule = stemPressureRules[stem];
        if (!rule || !rule.palaces.includes(palace.gong)) return undefined;

        return {
          gong: palace.gong,
          text: `${palace.name}天盘${stem}属${rule.stemElement}临${rule.palaceElement}宫，${rule.issue}`,
        };
      }),
    )
    .filter((entry): entry is { gong: number; text: string } => Boolean(entry));

  if (!entries.length) return;

  out.push({
    key: `combo:stemPressure:${entries.map((entry) => entry.gong).join(':')}`,
    name: '十干迫制',
    tone: 'mixed',
    summary: `奇仪临受克之宫：${entries
      .map((entry) => entry.text)
      .join(
        '；',
      )}。依《奇门遁甲统宗》卷十二“甲乙金宫、丙丁坎内、戊己惧杜伤、庚辛离上、壬癸生死方”的固定表；只作奇仪落宫受克的结构事实，不自动延伸年命、疾病或通用吉凶。`,
    palace: entries.length === 1 ? entries[0].gong : undefined,
    sources: ['《奇门遁甲统宗》卷十二十干迫制固定表', ...entries.map((entry) => entry.text)],
  });
}

export function detectQimenPatternCombos(ctx: PatternComboContext): QimenPatternCombo[] {
  const out: QimenPatternCombo[] = [];
  pushDoorSeasonQiCombo(ctx, out);
  pushStemPressureCombo(ctx, out);

  const seen = new Set<string>();
  return out.filter((combo) => {
    if (seen.has(combo.key)) return false;
    seen.add(combo.key);
    return true;
  });
}
