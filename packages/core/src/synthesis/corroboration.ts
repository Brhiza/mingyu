/**
 * @file 八字与紫微斗数跨体系合参互证算法
 * @传统依据 《滴天髓》《紫微斗数全书》《星平会海》：
 * 1. 羊刃与擎羊火星等煞曜同参（刚烈权柄与刑伤防范）；
 * 2. 天乙贵人与左辅右弼、天魁天钺吉曜同参（外力提携与顺遂福力）；
 * 3. 财官印绶与三方四正化禄化权同参（事业成就与资源承载）。
 */
import { isStrongDayMasterStatus, type BaziChartResult } from '../bazi/baziTypes';
import type { PalaceFact } from '../types/analysis';
import type { ZiweiRuntime } from '../ziwei/runtime';

export type CorroborationConditionStatus = '满足' | '不满足' | '资料不足';

export interface CorroborationCondition {
  /** 条件稳定键，便于下游按条件过滤或追踪。 */
  key: string;
  status: CorroborationConditionStatus;
  detail: string;
}

export interface BaziBranchEvidence {
  rule: '羊刃' | '天乙贵人';
  pillar: 'year' | 'month' | 'day' | 'hour';
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
  /** 八字羊刃命中的具体柱位。 */
  baziYangRenPositions: BaziBranchEvidence[];
  /** 紫微关键宫或身宫命中的煞曜及其可用状态。 */
  ziweiShaEvidence: ZiweiStarEvidence[];
  /** 当前结构线索所需条件；满足不等于现实事件或制化完成。 */
  effectConditions: CorroborationCondition[];
  isHarmonized: boolean; // 是否具备权柄相济的结构线索，不等于制化已经完成
  judgment: string;
  /** 紫微原盘核验状态：checked=已按关键宫核验；origin-missing=原盘缺失未核验 */
  ziweiCheckStatus: 'checked' | 'origin-missing';
}

export interface GuiRenCorroborationResult {
  hasBaziTianYi: boolean;
  ziweiGuiStars: string[];
  /** 八字天乙贵人命中的具体柱位。 */
  baziTianYiPositions: BaziBranchEvidence[];
  /** 紫微关键宫或身宫命中的贵人星及其可用状态。 */
  ziweiGuiEvidence: ZiweiStarEvidence[];
  /** 当前结构线索所需条件；缺少岁限时不能外推终身或固定应期。 */
  effectConditions: CorroborationCondition[];
  /** 双盘资料同时出现的结构线索，不表示终身福力或现实结果。 */
  isDoubleBlessed: boolean;
  judgment: string;
  /** 紫微原盘核验状态：checked=已按关键宫核验；origin-missing=原盘缺失未核验 */
  ziweiCheckStatus: 'checked' | 'origin-missing';
}

export interface BaziZiweiCorroborationResult {
  shaYao: ShaYaoCorroborationResult;
  guiRen: GuiRenCorroborationResult;
  corroborationPoints: string[];
  summary: string;
}

/** 归一化宫位名称：兼容“官禄宫/官禄”两种资料形态（“命宫”本身即两字全名） */
function stripPalaceSuffix(name: string): string {
  return name.length > 2 && name.endsWith('宫') ? name.slice(0, -1) : name;
}

function matchesKeyPalace(name: string, keys: Set<string>): boolean {
  return keys.has(name) || keys.has(stripPalaceSuffix(name));
}

const PILLAR_NAMES = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
} as const;

/**
 * 直接复用排盘时选定的公共神煞结果。
 *
 * 羊刃和天乙贵人都存在流派参数；合参层不能重新按另一张固定表推导，
 * 否则同一份八字在盘面与合参摘要中会出现不同口径。
 */
function findBaziShenShaEvidence(
  bazi: BaziChartResult,
  rule: BaziBranchEvidence['rule'],
): BaziBranchEvidence[] | undefined {
  const shensha = bazi.shensha;
  if (!shensha) return undefined;
  return (Object.keys(PILLAR_NAMES) as Array<keyof typeof PILLAR_NAMES>)
    .filter((pillar) => shensha[pillar]?.includes(rule))
    .map((pillar) => ({
      rule,
      pillar,
      pillarName: PILLAR_NAMES[pillar],
      branch: bazi.pillars[pillar].zhi,
    }));
}

function palaceRole(palace: PalaceFact): ZiweiStarEvidence['palaceRole'] {
  if (palace.is_body_palace) return '身宫';
  if (palace.name === '命宫' || stripPalaceSuffix(palace.name) === '命') return '命宫';
  return '关键宫';
}

function buildZiweiStarEvidence(
  palaces: PalaceFact[] | undefined,
  keyPalaces: Set<string>,
  starNames: Set<string>,
): ZiweiStarEvidence[] {
  return (palaces ?? [])
    .filter((palace) => palace.is_body_palace || matchesKeyPalace(palace.name, keyPalaces))
    .flatMap((palace) =>
      [...(palace.major_stars ?? []), ...(palace.minor_stars ?? []), ...(palace.other_stars ?? [])]
        .filter((star) => starNames.has(star.name))
        .map((star) => ({
          name: star.name,
          palaceIndex: palace.index,
          palaceName: palace.name,
          palaceRole: palaceRole(palace),
          kind: star.kind || '未记录',
          ...(star.scope ? { scope: star.scope } : {}),
          state: {
            ...(star.brightness ? { brightness: star.brightness } : {}),
            ...(star.birth_mutagen ? { birthMutagen: star.birth_mutagen } : {}),
            ...(star.horoscope_mutagen ? { horoscopeMutagen: star.horoscope_mutagen } : {}),
            ...(star.active_scope_mutagen ? { activeScopeMutagen: star.active_scope_mutagen } : {}),
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
    star.state.horoscopeMutagen ? `流耀化${star.state.horoscopeMutagen}` : '',
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

function formatLegacyZiweiStars(evidence: ZiweiStarEvidence[]): string[] {
  return evidence.map((star) => `${star.name}(${star.palaceName})`);
}

/** 当前安星口径中四辅曜没有默认庙旺表，缺少亮度不构成资料缺失。 */
const AUXILIARY_STARS_WITHOUT_DEFAULT_BRIGHTNESS = new Set(['左辅', '右弼', '天魁', '天钺']);

function buildStarStateCondition(
  key: string,
  evidence: ZiweiStarEvidence[],
  label: string,
): CorroborationCondition {
  if (!evidence.length) {
    return { key, status: '不满足', detail: `未在关键宫记录${label}。` };
  }
  const constrained = evidence.filter(
    (star) =>
      star.state.brightness === '陷' ||
      [
        star.state.birthMutagen,
        star.state.horoscopeMutagen,
        star.state.activeScopeMutagen,
      ].includes('忌'),
  );
  const stateful = evidence.filter(
    (star) =>
      Boolean(star.state.brightness) || AUXILIARY_STARS_WITHOUT_DEFAULT_BRIGHTNESS.has(star.name),
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

function buildOriginCondition(origin: boolean): CorroborationCondition {
  return origin
    ? { key: 'ziwei.origin', status: '满足', detail: '紫微本命十二宫资料已提供。' }
    : {
        key: 'ziwei.origin',
        status: '资料不足',
        detail: '紫微本命十二宫资料缺失，无法完成双盘核验。',
      };
}

function buildTimingCondition(
  ziwei: ZiweiRuntime,
  evidence: ZiweiStarEvidence[],
): CorroborationCondition {
  const scopes = Object.values(ziwei.payloadByScope).filter(
    (payload) =>
      payload?.active_scope?.scope !== 'origin' && Boolean(payload?.active_scope?.solar_date),
  );
  if (scopes.length) {
    const hits = scopes.flatMap((payload) => {
      const scope = payload.active_scope;
      const palaceStars = evidence.filter(
        (star) => Number.isInteger(scope.palace_index) && star.palaceIndex === scope.palace_index,
      );
      const mutagens = (scope.mutagen_map ?? []).filter(
        (item) =>
          Number.isInteger(item.palace_index) &&
          evidence.some(
            (star) => star.name === item.star && star.palaceIndex === item.palace_index,
          ),
      );
      return [
        ...palaceStars.map(
          (star) =>
            `${scope.label}（${scope.solar_date}）定位${star.palaceName}，本命${star.name}同宫`,
        ),
        ...mutagens.map(
          (item) =>
            `${scope.label}（${scope.solar_date}）${item.star}化${item.mutagen}入${item.palace_name ?? `第${item.palace_index! + 1}宫`}`,
        ),
      ];
    });
    return {
      key: 'timing.period',
      status: hits.length ? '满足' : '不满足',
      detail: hits.length
        ? `紫微运限定位：${hits.join('；')}。这些是紫微单盘引动事实，双盘同一时间窗口仍需核对八字岁运。`
        : `已核对${scopes.map((payload) => `${payload.active_scope.label}（${payload.active_scope.solar_date}）`).join('、')}，目标星未命中所列运限宫位或四化。`,
    };
  }
  return {
    key: 'timing.period',
    status: '资料不足',
    detail: '本次资料未列可定位的紫微运限日期，结构线索不能外推终身结论或固定应期。',
  };
}

const SHA_KEY_PALACES = new Set(['命宫', '身宫', '官禄', '迁移']);
const GUI_KEY_PALACES = new Set(['命宫', '身宫', '官禄', '财帛', '迁移']);

/**
 * 评估煞曜同参
 */
export function evaluateShaYaoCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): ShaYaoCorroborationResult {
  const baziYangRenEvidence = findBaziShenShaEvidence(bazi, '羊刃');
  const baziShenShaAvailable = baziYangRenEvidence !== undefined;
  const baziYangRenPositions = baziYangRenEvidence ?? [];
  const hasBaziYangRen = baziYangRenPositions.length > 0;

  const origin = ziwei.payloadByScope.origin;
  const SHA_STAR_SET = new Set(['擎羊', '陀罗', '火星', '铃星']);
  const ziweiShaEvidence = buildZiweiStarEvidence(origin?.palaces, SHA_KEY_PALACES, SHA_STAR_SET);
  const ziweiShaStars = formatLegacyZiweiStars(ziweiShaEvidence);

  const strengthStatus = bazi.analysis?.dayMasterStrength?.status || '未知';
  const isWang = isStrongDayMasterStatus(strengthStatus);
  const isHarmonized = hasBaziYangRen && isWang && ziweiShaEvidence.length > 0;
  const effectConditions: CorroborationCondition[] = [
    {
      key: 'bazi.yang-ren-position',
      status: !baziShenShaAvailable ? '资料不足' : hasBaziYangRen ? '满足' : '不满足',
      detail: !baziShenShaAvailable
        ? '八字神煞资料未提供，无法按当前口径核验羊刃。'
        : hasBaziYangRen
          ? `按当前八字神煞口径，羊刃命中${formatBaziEvidence(baziYangRenPositions)}。`
          : '按当前八字神煞口径，四柱未记录羊刃。',
    },
    {
      key: 'bazi.day-master-strength',
      status: strengthStatus === '未知' ? '资料不足' : isWang ? '满足' : '不满足',
      detail: `八字日主强弱状态为${strengthStatus}；权柄相济线索需要可核验的身强状态。`,
    },
    buildOriginCondition(Boolean(origin)),
    {
      key: 'ziwei.sha-star-position',
      status: ziweiShaEvidence.length ? '满足' : '不满足',
      detail: ziweiShaEvidence.length
        ? `紫微关键宫记录${formatZiweiEvidence(ziweiShaEvidence)}。`
        : '紫微关键宫未记录擎羊、陀罗、火星或铃星。',
    },
    buildStarStateCondition('ziwei.sha-star-state', ziweiShaEvidence, '紫微煞曜'),
    buildTimingCondition(ziwei, ziweiShaEvidence),
  ];

  let judgment: string;
  if (!baziShenShaAvailable) {
    judgment = !origin
      ? '紫微原盘资料缺失，煞曜同参未核验；八字神煞资料未提供，无法核验羊刃位置'
      : ziweiShaEvidence.length > 0
        ? `紫微${formatZiweiEvidence(ziweiShaEvidence)}；八字神煞资料未提供，无法核验羊刃位置，仅保留紫微宫位与星曜线索`
        : '八字神煞资料未提供，无法核验羊刃位置；紫微关键宫也未记录目标煞曜';
  } else if (!origin) {
    judgment = hasBaziYangRen
      ? `紫微原盘资料缺失，煞曜同参未核验；八字羊刃命中${formatBaziEvidence(baziYangRenPositions)}，仅保留单盘位置事实`
      : '紫微原盘资料缺失，煞曜同参未核验；八字四柱也未命中羊刃位置';
  } else if (hasBaziYangRen && ziweiShaEvidence.length > 0) {
    if (isHarmonized) {
      judgment = `八字羊刃见于${formatBaziEvidence(baziYangRenPositions)}且日主状态为${strengthStatus}；紫微${formatZiweiEvidence(ziweiShaEvidence)}，权柄相济作为待合参的结构主题。${effectConditions
        .slice(-2)
        .map((condition) => condition.detail)
        .join('；')}`;
    } else {
      judgment = `八字羊刃见于${formatBaziEvidence(baziYangRenPositions)}，紫微${formatZiweiEvidence(ziweiShaEvidence)}；两盘形成煞曜同参线索，但日主状态${strengthStatus}未满足身强条件，不能直接认定权柄相济`;
    }
  } else if (hasBaziYangRen) {
    judgment = `八字羊刃见于${formatBaziEvidence(baziYangRenPositions)}；紫微关键宫未记录目标煞曜，仅保留八字位置事实，不据此推定性情或吉凶`;
  } else if (ziweiShaEvidence.length > 0) {
    judgment = `紫微${formatZiweiEvidence(ziweiShaEvidence)}；八字四柱未命中羊刃，仅保留紫微宫位与星曜线索，不据此推定暗劲或事件`;
  } else {
    judgment =
      '本次资料未命中八字羊刃或紫微关键宫煞曜；未命中只表示当前资料没有该项线索，不用于推出性情或吉凶';
  }

  return {
    hasBaziYangRen,
    baziDayMasterStrength: strengthStatus,
    ziweiShaStars,
    baziYangRenPositions,
    ziweiShaEvidence,
    effectConditions,
    isHarmonized,
    judgment,
    ziweiCheckStatus: origin ? 'checked' : 'origin-missing',
  };
}

/**
 * 评估贵人吉曜同参
 */
export function evaluateGuiRenCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): GuiRenCorroborationResult {
  const baziTianYiEvidence = findBaziShenShaEvidence(bazi, '天乙贵人');
  const baziShenShaAvailable = baziTianYiEvidence !== undefined;
  const baziTianYiPositions = baziTianYiEvidence ?? [];
  const hasBaziTianYi = baziTianYiPositions.length > 0;

  const origin = ziwei.payloadByScope.origin;
  const GUI_STAR_SET = new Set(['左辅', '右弼', '天魁', '天钺']);
  const ziweiGuiEvidence = buildZiweiStarEvidence(origin?.palaces, GUI_KEY_PALACES, GUI_STAR_SET);
  const ziweiGuiStars = formatLegacyZiweiStars(ziweiGuiEvidence);

  const isDoubleBlessed = hasBaziTianYi && ziweiGuiEvidence.length > 0;
  const effectConditions: CorroborationCondition[] = [
    {
      key: 'bazi.tianyi-position',
      status: !baziShenShaAvailable ? '资料不足' : hasBaziTianYi ? '满足' : '不满足',
      detail: !baziShenShaAvailable
        ? '八字神煞资料未提供，无法按当前口径核验天乙贵人。'
        : hasBaziTianYi
          ? `按当前八字神煞口径，天乙贵人命中${formatBaziEvidence(baziTianYiPositions)}。`
          : '按当前八字神煞口径，四柱未记录天乙贵人。',
    },
    buildOriginCondition(Boolean(origin)),
    {
      key: 'ziwei.gui-star-position',
      status: ziweiGuiEvidence.length ? '满足' : '不满足',
      detail: ziweiGuiEvidence.length
        ? `紫微关键宫记录${formatZiweiEvidence(ziweiGuiEvidence)}。`
        : '紫微关键宫未记录左辅、右弼、天魁或天钺。',
    },
    buildStarStateCondition('ziwei.gui-star-state', ziweiGuiEvidence, '紫微贵人星'),
    buildTimingCondition(ziwei, ziweiGuiEvidence),
  ];
  let judgment: string;

  if (!baziShenShaAvailable) {
    judgment = !origin
      ? '紫微原盘资料缺失，贵人吉曜同参未核验；八字神煞资料未提供，无法核验天乙位置'
      : ziweiGuiEvidence.length > 0
        ? `紫微${formatZiweiEvidence(ziweiGuiEvidence)}；八字神煞资料未提供，无法核验天乙位置，仅保留紫微宫位与星曜线索`
        : '八字神煞资料未提供，无法核验天乙位置；紫微关键宫也未记录目标贵人星';
  } else if (!origin) {
    judgment = hasBaziTianYi
      ? `紫微原盘资料缺失，贵人吉曜同参未核验；八字天乙位于${formatBaziEvidence(baziTianYiPositions)}，仅保留单盘位置线索`
      : '紫微原盘资料缺失，贵人吉曜同参未核验；八字四柱也未记录天乙位置';
  } else if (isDoubleBlessed) {
    judgment = `八字天乙位于${formatBaziEvidence(baziTianYiPositions)}；紫微${formatZiweiEvidence(ziweiGuiEvidence)}，形成双盘贵人结构线索。${effectConditions
      .slice(-2)
      .map((condition) => condition.detail)
      .join('；')}`;
  } else if (hasBaziTianYi) {
    judgment = `八字天乙位于${formatBaziEvidence(baziTianYiPositions)}；紫微关键宫未记录目标贵人星，仅保留八字单盘位置线索，作用范围与应期未定`;
  } else if (ziweiGuiEvidence.length > 0) {
    judgment = `紫微${formatZiweiEvidence(ziweiGuiEvidence)}；八字四柱未记录天乙，仅保留紫微宫位与星曜线索，作用范围与应期未定`;
  } else {
    judgment =
      '本次资料未命中八字天乙或紫微关键宫贵人星；未命中只表示当前资料没有该项线索，不用于推出自力或吉凶';
  }

  return {
    hasBaziTianYi,
    ziweiGuiStars,
    baziTianYiPositions,
    ziweiGuiEvidence,
    effectConditions,
    isDoubleBlessed,
    judgment,
    ziweiCheckStatus: origin ? 'checked' : 'origin-missing',
  };
}

/**
 * 跨体系合参综合互证
 */
export function evaluateBaziZiweiCorroboration(
  bazi: BaziChartResult,
  ziwei: ZiweiRuntime,
): BaziZiweiCorroborationResult {
  const shaYao = evaluateShaYaoCorroboration(bazi, ziwei);
  const guiRen = evaluateGuiRenCorroboration(bazi, ziwei);

  const corroborationPoints: string[] = [shaYao.judgment, guiRen.judgment];
  const summary = `八字紫微互证：${shaYao.judgment}；${guiRen.judgment}`;

  return {
    shaYao,
    guiRen,
    corroborationPoints,
    summary,
  };
}
