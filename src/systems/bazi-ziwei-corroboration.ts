/**
 * @file 八字与紫微斗数跨体系合参互证条件
 * @传统依据 《滴天髓》《紫微斗数全书》《星平会海》：
 * 1. 羊刃与擎羊、陀罗、火星、铃星等煞曜同参（刚烈权柄与制约条件）；
 * 2. 天乙贵人与左辅、右弼、天魁、天钺吉曜同参（外力提携与顺遂条件）。
 */

import { buildPatternRelations } from './bazi/pattern-relations';
import type { BaziPillar } from './bazi/pillars';
import type { buildDayMasterStrength } from './bazi/strength';
import type { UsefulGodResult } from './bazi/useful-god';
import { analyzeZiweiPatternRelations, type ZiweiPattern, type ZiweiPatternPalace } from './ziwei-patterns';

export type CorroborationConditionStatus = '满足' | '不满足' | '资料不足';

export interface CorroborationCondition {
  /** 条件稳定键，便于下游按条件过滤或追踪。 */
  key: string;
  status: CorroborationConditionStatus;
  detail: string;
}

export type BaziPillarKey = 'year' | 'month' | 'day' | 'hour';

export interface BaziBranchEvidence {
  rule: '羊刃' | '天乙贵人';
  pillar: BaziPillarKey;
  pillarName: string;
  branch: string;
}

export interface ZiweiStarEvidence {
  name: string;
  palaceIndex: number;
  palaceName: string;
  palaceRole: '命宫' | '身宫' | '关键宫';
  kind: string;
  scope?: string;
  state: {
    brightness?: string;
    birthMutagen?: string;
    horoscopeMutagen?: string;
    activeScopeMutagen?: string;
  };
}

export interface ShaYaoCorroborationResult {
  hasBaziYangRen: boolean;
  baziDayMasterStrength: string;
  ziweiShaStars: string[];
  baziYangRenPositions: BaziBranchEvidence[];
  ziweiShaEvidence: ZiweiStarEvidence[];
  effectConditions: CorroborationCondition[];
  isHarmonized: boolean;
  judgment: string;
  ziweiCheckStatus: 'checked' | 'origin-missing';
}

export interface GuiRenCorroborationResult {
  hasBaziTianYi: boolean;
  ziweiGuiStars: string[];
  baziTianYiPositions: BaziBranchEvidence[];
  ziweiGuiEvidence: ZiweiStarEvidence[];
  effectConditions: CorroborationCondition[];
  isDoubleBlessed: boolean;
  judgment: string;
  ziweiCheckStatus: 'checked' | 'origin-missing';
}

export interface CrossSystemSignalPair {
  topic: string;
  baziSignal: string;
  ziweiSignal: string;
  condition: string;
}

export interface CrossSystemBalanceResult {
  dataStatus: '双盘格局资料完整' | '部分格局资料缺项';
  resonances: CrossSystemSignalPair[];
  tensions: CrossSystemSignalPair[];
}

export interface BaziZiweiCorroborationResult {
  shaYao: ShaYaoCorroborationResult;
  guiRen: GuiRenCorroborationResult;
  crossSystemBalance: CrossSystemBalanceResult;
  corroborationPoints: string[];
  summary: string;
}

export interface BaziCorroborationInput {
  pillars: Record<BaziPillarKey, { zhi: string } & Partial<BaziPillar>>;
  shensha?: {
    entries?: ReadonlyArray<{ name: string; position: BaziPillarKey; branch?: string }>;
  } | null;
  strength?: ({
    status?: string;
  } & Partial<ReturnType<typeof buildDayMasterStrength>>) | null;
  patternOverview?: { pattern: string; source: string } | null;
  ordinaryPattern?: { candidate: string } | null;
  usefulGod?: UsefulGodResult | null;
  isThreePillars?: boolean;
}

export interface ZiweiCorroborationStar {
  name: string;
  type: string;
  scope?: string;
  brightness?: string;
  mutagen?: string;
}

export interface ZiweiCorroborationPalace {
  index: number;
  name: string;
  earthlyBranch?: string;
  isBodyPalace: boolean;
  majorStars: readonly ZiweiCorroborationStar[];
  minorStars: readonly ZiweiCorroborationStar[];
  adjectiveStars: readonly ZiweiCorroborationStar[];
}

export interface ZiweiCorroborationScopeLayer {
  index: number;
  name: string;
  mutagenPlacements?: readonly {
    mutagen: string;
    star: string;
    targetIndex: number;
    natalPalace?: string;
  }[];
}

export interface ZiweiCorroborationInput {
  natal?: {
    palaces?: readonly ZiweiCorroborationPalace[];
    patterns?: readonly ZiweiPattern[];
  } | null;
  reference?: {
    localDateTime: string;
    layers?: Partial<Record<'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly' | 'age', ZiweiCorroborationScopeLayer>>;
  } | null;
}

const PILLAR_NAMES: Record<BaziPillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const PILLAR_ORDER: readonly BaziPillarKey[] = ['year', 'month', 'day', 'hour'];

const STANDARD_PALACE_NAMES = new Set([
  '命',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '交友',
  '官禄',
  '田宅',
  '福德',
  '父母',
]);

const SHA_KEY_PALACES = new Set(['命宫', '身宫', '官禄', '迁移']);
const GUI_KEY_PALACES = new Set(['命宫', '身宫', '官禄', '财帛', '迁移']);
const SHA_STAR_SET = new Set(['擎羊', '陀罗', '火星', '铃星']);
const GUI_STAR_SET = new Set(['左辅', '右弼', '天魁', '天钺']);
const AUXILIARY_STARS_WITHOUT_DEFAULT_BRIGHTNESS = new Set(['左辅', '右弼', '天魁', '天钺']);

const SCOPE_LABELS: Record<'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly' | 'age', string> = {
  decadal: '大限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
  age: '小限',
};

export function isStrongDayMasterStatus(status: string): boolean {
  return status === '极强' || status === '身强' || status === '偏强';
}

function stripPalaceSuffix(name: string): string {
  return name.length > 2 && name.endsWith('宫') ? name.slice(0, -1) : name;
}

function matchesKeyPalace(name: string, keys: Set<string>): boolean {
  return keys.has(name) || keys.has(stripPalaceSuffix(name));
}

function normalizeOriginPalaceName(name: string): string {
  const bareName = name.endsWith('宫') ? name.slice(0, -1) : name;
  return bareName === '仆役' ? '交友' : bareName;
}

/** 宫位身份、身宫定位和星曜列表完整，才可把未列星曜解释为未命中。 */
export function hasCompleteZiweiOrigin(ziwei: ZiweiCorroborationInput): boolean {
  const palaces = ziwei.natal?.palaces;
  if (!palaces || palaces.length !== 12) return false;
  const names = palaces.map((palace) => normalizeOriginPalaceName(palace.name));
  const bodyPalaceCount = palaces.filter((palace) => palace.isBodyPalace).length;
  return (
    new Set(palaces.map((palace) => palace.index)).size === 12 &&
    bodyPalaceCount === 1 &&
    palaces.every(
      (palace) =>
        Number.isInteger(palace.index) &&
        palace.index >= 0 &&
        palace.index < 12 &&
        typeof palace.isBodyPalace === 'boolean' &&
        Array.isArray(palace.majorStars) &&
        Array.isArray(palace.minorStars) &&
        Array.isArray(palace.adjectiveStars),
    ) &&
    new Set(names).size === 12 &&
    names.every((name) => STANDARD_PALACE_NAMES.has(name))
  );
}

function findBaziShenShaEvidence(
  bazi: BaziCorroborationInput,
  rule: BaziBranchEvidence['rule'],
): BaziBranchEvidence[] | undefined {
  const entries = bazi.shensha?.entries;
  if (bazi.isThreePillars || !Array.isArray(entries)) return undefined;
  const hitPillars = new Set(
    entries.filter((entry) => entry.name === rule).map((entry) => entry.position),
  );
  return PILLAR_ORDER.filter((pillar) => hitPillars.has(pillar)).map((pillar) => ({
    rule,
    pillar,
    pillarName: PILLAR_NAMES[pillar],
    branch: bazi.pillars[pillar].zhi,
  }));
}

function palaceRole(palace: ZiweiCorroborationPalace): ZiweiStarEvidence['palaceRole'] {
  if (palace.isBodyPalace) return '身宫';
  if (palace.name === '命宫' || stripPalaceSuffix(palace.name) === '命') return '命宫';
  return '关键宫';
}

function buildZiweiStarEvidence(
  palaces: readonly ZiweiCorroborationPalace[] | undefined,
  keyPalaces: Set<string>,
  starNames: Set<string>,
): ZiweiStarEvidence[] {
  return (palaces ?? [])
    .filter((palace) => palace.isBodyPalace || matchesKeyPalace(palace.name, keyPalaces))
    .flatMap((palace) =>
      [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
        .filter((star) => starNames.has(star.name))
        .map((star) => ({
          name: star.name,
          palaceIndex: palace.index,
          palaceName: palace.name,
          palaceRole: palaceRole(palace),
          kind: star.type || '未记录',
          ...(star.scope ? { scope: star.scope } : {}),
          state: {
            ...(star.brightness ? { brightness: star.brightness } : {}),
            ...(star.mutagen ? { birthMutagen: star.mutagen } : {}),
          },
        })),
    );
}

function formatBaziEvidence(evidence: BaziBranchEvidence[]): string {
  return evidence.length
    ? evidence.map((item) => `${item.pillarName}${item.branch}`).join('、')
    : '未命中四柱地支';
}

function getStarMutagenLabels(star: ZiweiStarEvidence): string[] {
  return [
    star.state.birthMutagen ? `生年化${star.state.birthMutagen}` : '',
    star.state.horoscopeMutagen ? `流曜化${star.state.horoscopeMutagen}` : '',
    star.state.activeScopeMutagen ? `运限化${star.state.activeScopeMutagen}` : '',
  ].filter(Boolean);
}

function formatZiweiEvidence(evidence: ZiweiStarEvidence[]): string {
  return evidence.length
    ? evidence
        .map((star) => {
          const state = [star.state.brightness, ...getStarMutagenLabels(star)].filter(Boolean);
          return `${star.name}入${star.palaceName}${state.length ? `（${state.join('、')}）` : ''}`;
        })
        .join('、')
    : '关键宫未记录目标星曜';
}

function buildStarStateCondition(
  key: string,
  evidence: ZiweiStarEvidence[],
  label: string,
  hasOrigin: boolean,
): CorroborationCondition {
  if (!hasOrigin) {
    return {
      key,
      status: '资料不足',
      detail: `紫微本命十二宫资料缺失或不完整，无法核验${label}状态。`,
    };
  }
  if (!evidence.length) {
    return { key, status: '不满足', detail: `未在关键宫记录${label}。` };
  }
  const constrained = evidence.filter(
    (star) =>
      star.state.brightness === '陷' ||
      [star.state.birthMutagen, star.state.horoscopeMutagen, star.state.activeScopeMutagen].includes('忌'),
  );
  const stateful = evidence.filter(
    (star) => Boolean(star.state.brightness) || AUXILIARY_STARS_WITHOUT_DEFAULT_BRIGHTNESS.has(star.name),
  );
  return {
    key,
    status: constrained.length
      ? '不满足'
      : stateful.length === evidence.length
        ? '满足'
        : '资料不足',
    detail: constrained.length
      ? `${formatZiweiEvidence(constrained)}带有落陷或化忌条件，需分别核对制约；其他星曜保留各自状态。`
      : stateful.length === evidence.length
        ? `${formatZiweiEvidence(evidence)}；已核对所列亮度及其适用性，当前目标星未列落陷或化忌；辅弼魁钺按本次所列宫位、四化与同宫组合判断。`
        : `${label}已记录${evidence.length}项，其中${stateful.length}项列亮度；未列亮度的星曜按本次安星口径核对适用性，未带四化本身不表示缺失资料。`,
  };
}

function buildOriginCondition(complete: boolean, present: boolean): CorroborationCondition {
  return complete
    ? { key: 'ziwei.origin', status: '满足', detail: '紫微本命十二宫资料已提供。' }
    : {
        key: 'ziwei.origin',
        status: '资料不足',
        detail: `紫微本命十二宫资料${present ? '不完整' : '缺失'}，无法完成双盘核验。`,
      };
}

function buildTimingCondition(
  ziwei: ZiweiCorroborationInput,
  evidence: ZiweiStarEvidence[],
  hasOrigin: boolean,
): CorroborationCondition {
  if (!hasOrigin) {
    return {
      key: 'timing.period',
      status: '资料不足',
      detail: '紫微本命十二宫资料缺失或不完整，无法将运限与本命目标星曜核对。',
    };
  }
  const reference = ziwei.reference;
  const layerEntries = reference?.layers
    ? (Object.entries(reference.layers) as Array<[keyof typeof SCOPE_LABELS, ZiweiCorroborationScopeLayer | undefined]>)
        .filter((entry): entry is [keyof typeof SCOPE_LABELS, ZiweiCorroborationScopeLayer] => Boolean(entry[1]))
    : [];
  if (!reference || !layerEntries.length) {
    return {
      key: 'timing.period',
      status: '资料不足',
      detail: '本次资料未列可定位的紫微运限日期，结构线索不能外推终身结论或固定应期。',
    };
  }

  const originIndexes = new Set((ziwei.natal?.palaces ?? []).map((palace) => palace.index));
  const dateLabel = reference.localDateTime.slice(0, 10);
  const allPalacesLocated = layerEntries.every(
    ([, layer]) => typeof layer.index === 'number' && originIndexes.has(layer.index),
  );
  const hits = layerEntries.flatMap(([scopeKey, layer]) => {
    const scopeLabel = SCOPE_LABELS[scopeKey] ?? layer.name;
    const palaceStars = evidence.filter(
      (star) =>
        typeof layer.index === 'number' &&
        originIndexes.has(layer.index) &&
        star.palaceIndex === layer.index,
    );
    const mutagens = (layer.mutagenPlacements ?? []).filter(
      (item) =>
        Number.isInteger(item.targetIndex) &&
        evidence.some((star) => star.name === item.star && star.palaceIndex === item.targetIndex),
    );
    return [
      ...palaceStars.map(
        (star) => `${scopeLabel}（${dateLabel}）定位${star.palaceName}，本命${star.name}同宫`,
      ),
      ...mutagens.map(
        (item) =>
          `${scopeLabel}（${dateLabel}）${item.star}化${item.mutagen}入${item.natalPalace ?? `第${item.targetIndex + 1}宫`}`,
      ),
    ];
  });

  return {
    key: 'timing.period',
    status: hits.length ? '满足' : allPalacesLocated ? '不满足' : '资料不足',
    detail: hits.length
      ? `紫微运限定位：${hits.join('；')}。${allPalacesLocated ? '' : '部分运限落宫未在当前层级展开，已先就定位宫位与四化星曜落点裁定。'}这些是紫微单盘引动事实，双盘同一时间窗口并参八字岁运。`
      : allPalacesLocated
        ? `已核对${layerEntries.map(([scopeKey, layer]) => `${SCOPE_LABELS[scopeKey] ?? layer.name}（${dateLabel}）`).join('、')}，目标星未命中所列运限宫位或四化。`
        : '已列紫微运限日期，但部分落宫未定位，无法完整核对本命目标星曜的运限引动。',
  };
}

function collectSharedContext(
  bazi: BaziCorroborationInput,
  ziwei: ZiweiCorroborationInput,
  rule: BaziBranchEvidence['rule'],
  keyPalaces: Set<string>,
  starSet: Set<string>,
) {
  const baziEvidence = findBaziShenShaEvidence(bazi, rule);
  const baziShenShaAvailable = baziEvidence !== undefined;
  const baziShenShaIssue = bazi.isThreePillars
    ? '出生时辰待补，八字神煞尚未计算'
    : '八字神煞资料未提供';
  const baziPositions = baziEvidence ?? [];
  const palaces = ziwei.natal?.palaces;
  const completeOrigin = hasCompleteZiweiOrigin(ziwei);
  const originIssue = palaces ? '紫微原盘十二宫资料不完整' : '紫微原盘资料缺失';
  const ziweiEvidence = buildZiweiStarEvidence(palaces, keyPalaces, starSet);
  const ziweiStars = ziweiEvidence.map((star) => `${star.name}(${star.palaceName})`);
  return {
    baziShenShaAvailable,
    baziShenShaIssue,
    baziPositions,
    hasBaziHit: baziPositions.length > 0,
    hasOriginObject: Boolean(palaces),
    completeOrigin,
    originIssue,
    ziweiEvidence,
    ziweiStars,
  };
}

/** 评估羊刃与紫微煞曜同参。 */
export function evaluateShaYaoCorroboration(
  bazi: BaziCorroborationInput,
  ziwei: ZiweiCorroborationInput,
): ShaYaoCorroborationResult {
  const ctx = collectSharedContext(bazi, ziwei, '羊刃', SHA_KEY_PALACES, SHA_STAR_SET);
  const strengthStatus = bazi.strength?.status || '未知';
  const isWang = isStrongDayMasterStatus(strengthStatus);
  const isHarmonized =
    ctx.completeOrigin && ctx.hasBaziHit && isWang && ctx.ziweiEvidence.length > 0;

  const effectConditions: CorroborationCondition[] = [
    {
      key: 'bazi.yang-ren-position',
      status: !ctx.baziShenShaAvailable ? '资料不足' : ctx.hasBaziHit ? '满足' : '不满足',
      detail: !ctx.baziShenShaAvailable
        ? `${ctx.baziShenShaIssue}，无法按当前口径核验羊刃。`
        : ctx.hasBaziHit
          ? `按当前八字神煞口径，羊刃命中${formatBaziEvidence(ctx.baziPositions)}。`
          : '按当前八字神煞口径，四柱未记录羊刃。',
    },
    {
      key: 'bazi.day-master-strength',
      status: strengthStatus === '未知' ? '资料不足' : isWang ? '满足' : '不满足',
      detail: `八字日主强弱状态为${strengthStatus}；权柄相济线索需要可核验的身强状态。`,
    },
    buildOriginCondition(ctx.completeOrigin, ctx.hasOriginObject),
    {
      key: 'ziwei.sha-star-position',
      status: !ctx.completeOrigin ? '资料不足' : ctx.ziweiEvidence.length ? '满足' : '不满足',
      detail: !ctx.completeOrigin
        ? `${ctx.originIssue}，无法完整核验关键宫煞曜。`
        : ctx.ziweiEvidence.length
          ? `紫微关键宫记录${formatZiweiEvidence(ctx.ziweiEvidence)}。`
          : '紫微关键宫未记录擎羊、陀罗、火星或铃星。',
    },
    buildStarStateCondition('ziwei.sha-star-state', ctx.ziweiEvidence, '紫微煞曜', ctx.completeOrigin),
    buildTimingCondition(ziwei, ctx.ziweiEvidence, ctx.completeOrigin),
  ];

  let judgment: string;
  if (!ctx.baziShenShaAvailable) {
    judgment = !ctx.completeOrigin
      ? `${ctx.originIssue}，煞曜同参未核验；${ctx.baziShenShaIssue}，无法核验羊刃位置`
      : ctx.ziweiEvidence.length > 0
        ? `紫微${formatZiweiEvidence(ctx.ziweiEvidence)}；${ctx.baziShenShaIssue}，无法核验羊刃位置，仅保留紫微宫位与星曜线索`
        : `${ctx.baziShenShaIssue}，无法核验羊刃位置；紫微关键宫也未记录目标煞曜`;
  } else if (!ctx.completeOrigin) {
    judgment = ctx.hasBaziHit
      ? `${ctx.originIssue}，煞曜同参未核验；八字羊刃命中${formatBaziEvidence(ctx.baziPositions)}，仅保留单盘位置事实`
      : `${ctx.originIssue}，煞曜同参未核验；八字四柱也未命中羊刃位置`;
  } else if (ctx.hasBaziHit && ctx.ziweiEvidence.length > 0) {
    if (isHarmonized) {
      judgment = `八字羊刃见于${formatBaziEvidence(ctx.baziPositions)}且日主状态为${strengthStatus}；紫微${formatZiweiEvidence(ctx.ziweiEvidence)}，权柄相济作为待合参的结构主题。${effectConditions
        .slice(-2)
        .map((condition) => condition.detail)
        .join('；')}`;
    } else {
      judgment = `八字羊刃见于${formatBaziEvidence(ctx.baziPositions)}，紫微${formatZiweiEvidence(ctx.ziweiEvidence)}；两盘形成煞曜同参线索，但日主状态${strengthStatus}未满足身强条件，不能直接认定权柄相济`;
    }
  } else if (ctx.hasBaziHit) {
    judgment = `八字羊刃见于${formatBaziEvidence(ctx.baziPositions)}；紫微关键宫未记录目标煞曜，仅保留八字位置事实，不据此推定性情或吉凶`;
  } else if (ctx.ziweiEvidence.length > 0) {
    judgment = `紫微${formatZiweiEvidence(ctx.ziweiEvidence)}；八字四柱未命中羊刃，仅保留紫微宫位与星曜线索，不据此推定暗劲或事件`;
  } else {
    judgment =
      '本次资料未命中八字羊刃或紫微关键宫煞曜；未命中只表示当前资料没有该项线索，不用于推出性情或吉凶';
  }

  return {
    hasBaziYangRen: ctx.hasBaziHit,
    baziDayMasterStrength: strengthStatus,
    ziweiShaStars: ctx.ziweiStars,
    baziYangRenPositions: ctx.baziPositions,
    ziweiShaEvidence: ctx.ziweiEvidence,
    effectConditions,
    isHarmonized,
    judgment,
    ziweiCheckStatus: ctx.completeOrigin ? 'checked' : 'origin-missing',
  };
}

/** 评估天乙贵人与紫微辅弼魁钺同参。 */
export function evaluateGuiRenCorroboration(
  bazi: BaziCorroborationInput,
  ziwei: ZiweiCorroborationInput,
): GuiRenCorroborationResult {
  const ctx = collectSharedContext(bazi, ziwei, '天乙贵人', GUI_KEY_PALACES, GUI_STAR_SET);
  const isDoubleBlessed = ctx.completeOrigin && ctx.hasBaziHit && ctx.ziweiEvidence.length > 0;

  const effectConditions: CorroborationCondition[] = [
    {
      key: 'bazi.tianyi-position',
      status: !ctx.baziShenShaAvailable ? '资料不足' : ctx.hasBaziHit ? '满足' : '不满足',
      detail: !ctx.baziShenShaAvailable
        ? `${ctx.baziShenShaIssue}，无法按当前口径核验天乙贵人。`
        : ctx.hasBaziHit
          ? `按当前八字神煞口径，天乙贵人命中${formatBaziEvidence(ctx.baziPositions)}。`
          : '按当前八字神煞口径，四柱未记录天乙贵人。',
    },
    buildOriginCondition(ctx.completeOrigin, ctx.hasOriginObject),
    {
      key: 'ziwei.gui-star-position',
      status: !ctx.completeOrigin ? '资料不足' : ctx.ziweiEvidence.length ? '满足' : '不满足',
      detail: !ctx.completeOrigin
        ? `${ctx.originIssue}，无法完整核验关键宫贵人星。`
        : ctx.ziweiEvidence.length
          ? `紫微关键宫记录${formatZiweiEvidence(ctx.ziweiEvidence)}。`
          : '紫微关键宫未记录左辅、右弼、天魁或天钺。',
    },
    buildStarStateCondition('ziwei.gui-star-state', ctx.ziweiEvidence, '紫微贵人星', ctx.completeOrigin),
    buildTimingCondition(ziwei, ctx.ziweiEvidence, ctx.completeOrigin),
  ];

  let judgment: string;
  if (!ctx.baziShenShaAvailable) {
    judgment = !ctx.completeOrigin
      ? `${ctx.originIssue}，贵人吉曜同参未核验；${ctx.baziShenShaIssue}，无法核验天乙位置`
      : ctx.ziweiEvidence.length > 0
        ? `紫微${formatZiweiEvidence(ctx.ziweiEvidence)}；${ctx.baziShenShaIssue}，无法核验天乙位置，仅保留紫微宫位与星曜线索`
        : `${ctx.baziShenShaIssue}，无法核验天乙位置；紫微关键宫也未记录目标贵人星`;
  } else if (!ctx.completeOrigin) {
    judgment = ctx.hasBaziHit
      ? `${ctx.originIssue}，贵人吉曜同参未核验；八字天乙位于${formatBaziEvidence(ctx.baziPositions)}，仅保留单盘位置线索`
      : `${ctx.originIssue}，贵人吉曜同参未核验；八字四柱也未记录天乙位置`;
  } else if (isDoubleBlessed) {
    judgment = `八字天乙位于${formatBaziEvidence(ctx.baziPositions)}；紫微${formatZiweiEvidence(ctx.ziweiEvidence)}，形成双盘贵人结构线索。${effectConditions
      .slice(-2)
      .map((condition) => condition.detail)
      .join('；')}`;
  } else if (ctx.hasBaziHit) {
    judgment = `八字天乙位于${formatBaziEvidence(ctx.baziPositions)}；紫微关键宫未记录目标贵人星，仅保留八字单盘位置线索，作用范围与应期未定`;
  } else if (ctx.ziweiEvidence.length > 0) {
    judgment = `紫微${formatZiweiEvidence(ctx.ziweiEvidence)}；八字四柱未记录天乙，仅保留紫微宫位与星曜线索，作用范围与应期未定`;
  } else {
    judgment =
      '本次资料未命中八字天乙或紫微关键宫贵人星；未命中只表示当前资料没有该项线索，不用于推出自力或吉凶';
  }

  return {
    hasBaziTianYi: ctx.hasBaziHit,
    ziweiGuiStars: ctx.ziweiStars,
    baziTianYiPositions: ctx.baziPositions,
    ziweiGuiEvidence: ctx.ziweiEvidence,
    effectConditions,
    isDoubleBlessed,
    judgment,
    ziweiCheckStatus: ctx.completeOrigin ? 'checked' : 'origin-missing',
  };
}

const KEY_MUTAGEN_PALACES = new Set(['命', '夫妻', '财帛', '官禄', '福德']);

function hasFullBaziPatternData(bazi: BaziCorroborationInput): bazi is BaziCorroborationInput & {
  pillars: Record<BaziPillarKey, BaziPillar>;
  strength: ReturnType<typeof buildDayMasterStrength>;
  patternOverview: { pattern: string; source: string };
  ordinaryPattern: { candidate: string };
  usefulGod: UsefulGodResult;
} {
  return Boolean(
    bazi.patternOverview &&
      bazi.ordinaryPattern &&
      bazi.usefulGod &&
      bazi.strength?.status &&
      bazi.strength?.tendencies &&
      PILLAR_ORDER.every(
        (k) =>
          typeof bazi.pillars[k]?.gan === 'string' &&
          typeof bazi.pillars[k]?.tenGod === 'string' &&
          Array.isArray(bazi.pillars[k]?.hiddenStems),
      ),
  );
}

function hasFullZiweiPatternData(ziwei: ZiweiCorroborationInput): ziwei is ZiweiCorroborationInput & {
  natal: {
    palaces: readonly ZiweiPatternPalace[];
    patterns: readonly ZiweiPattern[];
  };
} {
  return Boolean(
    hasCompleteZiweiOrigin(ziwei) &&
      Array.isArray(ziwei.natal?.patterns) &&
      ziwei.natal?.palaces?.every((p) => typeof p.earthlyBranch === 'string' && p.earthlyBranch.length > 0),
  );
}

/** 评估八字与紫微双盘在格局、喜忌/四化与关键风险上的同向共振与分歧制衡。 */
export function evaluateCrossSystemBalance(
  bazi: BaziCorroborationInput,
  ziwei: ZiweiCorroborationInput,
  shaYao: ShaYaoCorroborationResult,
  guiRen: GuiRenCorroborationResult,
): CrossSystemBalanceResult {
  const resonances: CrossSystemSignalPair[] = [];
  const tensions: CrossSystemSignalPair[] = [];

  const baziReady = hasFullBaziPatternData(bazi);
  const ziweiReady = hasFullZiweiPatternData(ziwei);

  if (baziReady && ziweiReady) {
    const bzRel = buildPatternRelations({
      pillars: bazi.pillars,
      strength: bazi.strength,
      patternOverview: bazi.patternOverview,
      ordinaryPattern: bazi.ordinaryPattern,
      usefulGod: bazi.usefulGod,
    });
    const zwRel = analyzeZiweiPatternRelations(ziwei.natal.palaces, ziwei.natal.patterns);
    const zwAuspicious = ziwei.natal.patterns.filter((p) => p.kind === 'auspicious');
    const zwInauspicious = ziwei.natal.patterns.filter((p) => p.kind === 'inauspicious');

    const bzUnrescued = bzRel.conflictChains.filter((c) => c.rescueStatus !== '原局明透已救');
    const bzHasSynergy = bzRel.synergies.length > 0;
    const bzClean = bzUnrescued.length === 0;
    const zwHasSynergy = zwRel.synergies.length > 0 || (zwAuspicious.length > 0 && zwRel.damagedAuspicious.length === 0);
    const zwUnrescued = zwRel.inauspiciousRescues.filter((r) => r.status === '原局无明救');
    const zwHasDamage = zwRel.damagedAuspicious.length > 0 || zwUnrescued.length > 0;

    // 1. 格局增力与破损的同向共振 / 分歧张力
    if ((bzHasSynergy || bzClean) && zwHasSynergy && !zwHasDamage) {
      resonances.push({
        topic: '格局清纯与协同增力',
        baziSignal: bzHasSynergy
          ? `${bzRel.primaryPattern}兼见${bzRel.synergies.slice(0, 2).map((s) => s.name).join('、')}`
          : `${bzRel.primaryPattern}清纯无破格病灶`,
        ziweiSignal: zwRel.synergies.length
          ? zwRel.synergies[0]
          : `命中吉格${zwAuspicious.slice(0, 2).map((p) => p.name).join('、')}且未见煞忌破格`,
        condition: '双盘格局均具正向结构基础，行运/大限不犯忌神或煞忌冲破时易形成同向助力',
      });
    } else if (bzUnrescued.length > 0 && zwHasDamage) {
      resonances.push({
        topic: '破格风险与承压同向共振',
        baziSignal: bzUnrescued
          .slice(0, 2)
          .map((c) => `${c.conflict}（${c.rescueStatus}）`)
          .join('；'),
        ziweiSignal: [
          ...zwRel.damagedAuspicious.slice(0, 1).map((d) => `${d.patternName}成中有破（${d.breakers.slice(0, 2).join('、')}）`),
          ...zwUnrescued.slice(0, 1).map((r) => `${r.targetName}原局无明救`),
        ].join('；'),
        condition: `双盘均显原局结构阻力：八字须待岁运补「${bzUnrescued[0].remedyNeeded}」，紫微须待大限流年逢禄权科或辅弼救应`,
      });
    } else if ((bzHasSynergy || bzClean) && zwHasDamage) {
      tensions.push({
        topic: '格局成败张力（八字清纯 vs 紫微受破）',
        baziSignal: bzHasSynergy
          ? `${bzRel.primaryPattern}兼${bzRel.synergies[0].name}`
          : `${bzRel.primaryPattern}未见明显破格病灶`,
        ziweiSignal: [
          ...zwRel.damagedAuspicious.slice(0, 1).map((d) => `${d.patternName}受破（${d.breakers.slice(0, 2).join('、')}）`),
          ...zwUnrescued.slice(0, 1).map((r) => `${r.targetName}无明救`),
        ].join('；'),
        condition: '八字顺行喜用岁运时可发挥格局框架，但紫微受破宫位对应的领域须防煞忌叠冲引动波动',
      });
    } else if (bzUnrescued.length > 0 && zwHasSynergy && !zwHasDamage) {
      tensions.push({
        topic: '格局成败张力（八字带病 vs 紫微成格）',
        baziSignal: bzUnrescued
          .slice(0, 2)
          .map((c) => `${c.conflict}（${c.rescueStatus}）`)
          .join('；'),
        ziweiSignal: zwRel.synergies.length
          ? zwRel.synergies[0]
          : `吉格${zwAuspicious.slice(0, 2).map((p) => p.name).join('、')}未受破`,
        condition: `紫微星曜架构具备成格条件，但八字原局病灶须待行运见「${bzUnrescued[0].remedyNeeded}」方能与紫微吉格同频落地`,
      });
    }

    // 2. 生年四化落宫与八字喜忌/病药的交叉共振或张力
    const keyLu: string[] = [];
    const keyJi: string[] = [];
    for (const palace of ziwei.natal.palaces) {
      const norm = normalizeOriginPalaceName(palace.name);
      if (!KEY_MUTAGEN_PALACES.has(norm) && !palace.isBodyPalace) continue;
      for (const star of [...palace.majorStars, ...palace.minorStars]) {
        if (star.mutagen === '禄') keyLu.push(`${palace.name}${palace.isBodyPalace ? '(身)' : ''}${star.name}化禄`);
        if (star.mutagen === '忌') keyJi.push(`${palace.name}${palace.isBodyPalace ? '(身)' : ''}${star.name}化忌`);
      }
    }
    if (keyJi.length > 0 && bzUnrescued.length > 0 && !resonances.some((r) => r.topic === '破格风险与承压同向共振')) {
      resonances.push({
        topic: '关键宫位化忌与八字病灶同向提示',
        baziSignal: bzUnrescued.slice(0, 2).map((c) => `${c.conflict}（${c.rescueStatus}）`).join('；'),
        ziweiSignal: `关键宫生年化忌：${keyJi.join('、')}`,
        condition: '双盘均指向关键环节存在消耗或卡点，八字以制病补药为先，紫微以化忌宫位避忌守成为宜',
      });
    } else if (keyJi.length > 0 && bzClean && bazi.usefulGod.incrementStatus !== '部分判定') {
      tensions.push({
        topic: '八字喜用清纯与紫微关键宫化忌张力',
        baziSignal: `用神裁定主用${bazi.usefulGod.useful}（喜${bazi.usefulGod.favorableWuxing.join('、') || '中和'}），原局无未救破格`,
        ziweiSignal: `关键宫见生年化忌：${keyJi.join('、')}`,
        condition: '八字整体骨架平稳，但紫微生年化忌所落宫位仍为主观执念或局部损耗点，行运叠忌时触发',
      });
    } else if (keyLu.length > 0 && bzUnrescued.length > 0) {
      tensions.push({
        topic: '紫微关键宫化禄与八字病灶制衡',
        baziSignal: bzUnrescued.slice(0, 1).map((c) => `${c.conflict}（${c.rescueStatus}）`).join(''),
        ziweiSignal: `关键宫见生年化禄：${keyLu.join('、')}`,
        condition: '紫微化禄宫位提供资源/人缘缓冲，但放大成效仍以八字岁运解病补药为前提',
      });
    }

    // 3. 动静强弱张力（八字强弱 vs 紫微命宫空宫/落陷/杀破狼）
    const soulPalace = ziwei.natal.palaces.find((p) => normalizeOriginPalaceName(p.name) === '命');
    const soulEmpty = Boolean(soulPalace && soulPalace.majorStars.length === 0);
    const soulFallen = Boolean(soulPalace?.majorStars.some((s) => s.brightness === '陷'));
    const hasShaPoLang = zwRel.synergies.some((s) => s.includes('杀破狼')) || zwInauspicious.some((p) => p.name.includes('杀破狼'));
    const bzStrong = isStrongDayMasterStatus(bazi.strength.status);
    const bzWeak = bazi.strength.status === '身弱' || bazi.strength.status === '偏弱' || bazi.strength.status === '极弱';

    if (bzStrong && (soulEmpty || soulFallen)) {
      tensions.push({
        topic: '强弱动静张力（八字身强 vs 紫微命宫空/陷）',
        baziSignal: `日主${bazi.strength.status}，具备主动承压与向外发力条件`,
        ziweiSignal: soulEmpty ? '命宫无主星（须借对宫迁移主星发挥）' : '命宫主星见落陷',
        condition: '八字底气足而紫微命宫须借外势或大限扶助，宜借外部平台/迁移机遇落力',
      });
    } else if (bzWeak && hasShaPoLang) {
      tensions.push({
        topic: '强弱动静张力（八字身弱 vs 紫微杀破狼动局）',
        baziSignal: `日主${bazi.strength.status}，原局承压带宽有限`,
        ziweiSignal: '命宫三方成杀破狼变动架构',
        condition: '紫微变动冲劲强而八字喜印比生扶，推进变革须以八字印比岁运或稳健资源兜底为前提',
      });
    }
  }

  // 4. 纳入既有的煞曜与贵人双盘同参结果
  if (shaYao.isHarmonized) {
    resonances.push({
      topic: '煞曜权柄同向共振',
      baziSignal: `身强（${shaYao.baziDayMasterStrength}）兼羊刃（${formatBaziEvidence(shaYao.baziYangRenPositions)}）`,
      ziweiSignal: formatZiweiEvidence(shaYao.ziweiShaEvidence),
      condition: '须满足煞曜不落陷、不化忌且得运限引动，方作刚健决断之用',
    });
  } else if (shaYao.hasBaziYangRen && shaYao.ziweiShaEvidence.length > 0 && !shaYao.isHarmonized) {
    tensions.push({
      topic: '煞曜同见但承压条件不足',
      baziSignal: `羊刃（${formatBaziEvidence(shaYao.baziYangRenPositions)}）而日主状态为${shaYao.baziDayMasterStrength}`,
      ziweiSignal: formatZiweiEvidence(shaYao.ziweiShaEvidence),
      condition: '日主未达身强，双盘刚烈信号易转为内耗或冲动阻力，须见印比护身或吉化制煞',
    });
  }

  if (guiRen.isDoubleBlessed) {
    resonances.push({
      topic: '贵人助力同向共振',
      baziSignal: `天乙贵人（${formatBaziEvidence(guiRen.baziTianYiPositions)}）`,
      ziweiSignal: formatZiweiEvidence(guiRen.ziweiGuiEvidence),
      condition: '双盘贵人星均在位，遇运限宫位或四化引动时易显外部协作与助力',
    });
  }

  return {
    dataStatus: baziReady && ziweiReady ? '双盘格局资料完整' : '部分格局资料缺项',
    resonances,
    tensions,
  };
}

/** 跨体系合参综合互证。 */
export function evaluateBaziZiweiCorroboration(
  bazi: BaziCorroborationInput,
  ziwei: ZiweiCorroborationInput,
): BaziZiweiCorroborationResult {
  const shaYao = evaluateShaYaoCorroboration(bazi, ziwei);
  const guiRen = evaluateGuiRenCorroboration(bazi, ziwei);
  const crossSystemBalance = evaluateCrossSystemBalance(bazi, ziwei, shaYao, guiRen);
  return {
    shaYao,
    guiRen,
    crossSystemBalance,
    corroborationPoints: [shaYao.judgment, guiRen.judgment],
    summary: `八字紫微互证：${shaYao.judgment}；${guiRen.judgment}`,
  };
}

/** 格式化为精简的跨盘互证提示段落。 */
export function formatCorroborationSection(result: BaziZiweiCorroborationResult): string {
  return [
    `煞曜同参（羊刃/擎羊陀罗火铃）：${result.shaYao.judgment}`,
    `贵人同参（天乙贵人/辅弼魁钺）：${result.guiRen.judgment}`,
  ].join('\n');
}

/** 格式化为结构化的【跨体系同向共振与分歧制衡】段落。 */
export function formatCrossSystemBalanceSection(result: BaziZiweiCorroborationResult): string {
  const bal = result.crossSystemBalance;
  const resonanceLines = bal.resonances.length
    ? bal.resonances.map(
        (item) => `- ［同向共振·${item.topic}］八字：${item.baziSignal}｜紫微：${item.ziweiSignal}｜成立条件：${item.condition}。`,
      )
    : ['- ［同向共振］两盘未检出显著同向叠加信号，以各自单盘主线独立参看。'];
  const tensionLines = bal.tensions.length
    ? bal.tensions.map(
        (item) => `- ［分歧制衡·${item.topic}］八字：${item.baziSignal}｜紫微：${item.ziweiSignal}｜制衡条件：${item.condition}。`,
      )
    : ['- ［分歧制衡］两盘格局与强弱未检出显著结构张力。'];
  return [`资料状态：${bal.dataStatus}`, ...resonanceLines, ...tensionLines].join('\n');
}
