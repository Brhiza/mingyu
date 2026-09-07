/**
 * @file 方位 / 罗盘模块（地基层）
 * @description 八卦方位、二十四山、坐向→宅卦、八宅大游年（四吉四凶方）。
 * 供八宅风水、奇门方位应期、玄空等系统复用。设计为可继续拓展。
 */

import { NineStar, Zone } from 'tyme4ts';

/** 八卦（后天方位） */
export const BAGUA: string[] = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];

/** 八卦方位（后天八卦） */
export const BAGUA_DIRECTION: Record<string, string> = {
  坎: '北',
  艮: '东北',
  震: '东',
  巽: '东南',
  离: '南',
  坤: '西南',
  兑: '西',
  乾: '西北',
};

/** 八卦中心度数（罗盘，正北为 0°，顺时针） */
export const BAGUA_DEGREE: Record<string, number> = {
  坎: 0,
  艮: 45,
  震: 90,
  巽: 135,
  离: 180,
  坤: 225,
  兑: 270,
  乾: 315,
};

/** 二十四山（罗盘顺序，自正北子山起顺时针） */
export const TWENTY_FOUR_MOUNTAINS: string[] = [
  '子',
  '癸',
  '丑',
  '艮',
  '寅',
  '甲',
  '卯',
  '乙',
  '辰',
  '巽',
  '巳',
  '丙',
  '午',
  '丁',
  '未',
  '坤',
  '申',
  '庚',
  '酉',
  '辛',
  '戌',
  '乾',
  '亥',
  '壬',
];

export interface CompassMountainPosition {
  /** 归一化后的罗盘度数；360° 归入 0°。 */
  degree: number;
  mountain: string;
  index: number;
  centerDegree: number;
  startDegree: number;
  endDegree: number;
  isBoundary: boolean;
  boundaryMountains?: [string, string];
}

export interface SitFacingPosition {
  facing: CompassMountainPosition;
  sit: CompassMountainPosition;
  label: string;
}

export interface CompassDirectionCalculationStep {
  key: string;
  stage: '度数归一化' | '向山映射' | '坐山换算' | '八卦归属';
  status: '已核验' | '已映射' | '已换算';
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '罗盘计算步骤只证明输入度数如何按正北0度顺时针、每山15度的口径映射为向山、坐山和八卦；不得把步骤完整度解释为风水吉凶、现实结果或测量精度保证';
}

export interface CompassDirectionFact {
  key: string;
  type: '向山' | '坐山' | '分界状态' | '八卦归属';
  status: '已确定' | '位于分界线';
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '罗盘事实只记录当前度数在二十四山和后天八卦表中的映射；分界线、磁偏角、测量误差与实际建筑朝向仍需由上层测量流程处理';
}

export interface CompassDirectionLimitationFact {
  key: string;
  type: '基准方向边界' | '分界线边界' | '解释范围边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '罗盘限制事实用于约束度数换算的基准、分界与解释范围，不得被反向当作宅运、吉凶、事件概率或唯一风水结论的证据';
}

export interface CompassDirectionSummaryFact {
  key: 'foundation:direction:evidence-summary';
  status: '映射稳定' | '向山位于分界线' | '坐向均位于分界线';
  factKeys: string[];
  calculationStepCount: number;
  directionFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '罗盘证据汇总只统计向山、坐山、八卦和分界状态的覆盖，不表示已完成磁偏角修正、现场复测、宅卦稳定性或风水吉凶判断';
}

export interface CompassDirectionAnalysis {
  key: string;
  status: '已换算' | '存在分界线';
  inputDegree: number;
  normalizedDegree: number;
  facing: CompassMountainPosition;
  sit: CompassMountainPosition;
  facingBagua: string;
  sitBagua: string;
  label: string;
  calculationSteps: CompassDirectionCalculationStep[];
  calculationChain: string[];
  directionFacts: CompassDirectionFact[];
  summaryFact: CompassDirectionSummaryFact;
  limitations: string[];
  limitationFacts: CompassDirectionLimitationFact[];
  source: string;
  promptText: string;
}

const COMPASS_STEP_LIMITATION =
  '罗盘计算步骤只证明输入度数如何按正北0度顺时针、每山15度的口径映射为向山、坐山和八卦；不得把步骤完整度解释为风水吉凶、现实结果或测量精度保证' as const;
const COMPASS_FACT_LIMITATION =
  '罗盘事实只记录当前度数在二十四山和后天八卦表中的映射；分界线、磁偏角、测量误差与实际建筑朝向仍需由上层测量流程处理' as const;
const COMPASS_LIMITATION_FACT_LIMITATION =
  '罗盘限制事实用于约束度数换算的基准、分界与解释范围，不得被反向当作宅运、吉凶、事件概率或唯一风水结论的证据' as const;
const COMPASS_SUMMARY_LIMITATION =
  '罗盘证据汇总只统计向山、坐山、八卦和分界状态的覆盖，不表示已完成磁偏角修正、现场复测、宅卦稳定性或风水吉凶判断' as const;

function normalizeCompassDegree(degree: number): number {
  if (!Number.isFinite(degree) || degree < 0 || degree > 360) {
    throw new Error('罗盘度数需在 0 到 360 之间。');
  }
  return degree === 360 ? 0 : degree;
}

/**
 * 按每山 15°、子山中心 0° 的罗盘口径，把度数换算为二十四山。
 * 分界线仍返回相邻山位，但会以 isBoundary 标记，调用方不应静默采用。
 */
export function getMountainFromDegree(degree: number): CompassMountainPosition {
  const normalized = normalizeCompassDegree(degree);
  const index = Math.floor(((normalized + 7.5) % 360) / 15);
  const mountain = TWENTY_FOUR_MOUNTAINS[index];
  const centerDegree = index * 15;
  const boundaryRemainder = (((normalized - 7.5) % 15) + 15) % 15;
  const isBoundary =
    boundaryRemainder < Number.EPSILON * 16 ||
    Math.abs(boundaryRemainder - 15) < Number.EPSILON * 16;
  const previousIndex = (index + TWENTY_FOUR_MOUNTAINS.length - 1) % TWENTY_FOUR_MOUNTAINS.length;

  return {
    degree: normalized,
    mountain,
    index,
    centerDegree,
    startDegree: (centerDegree - 7.5 + 360) % 360,
    endDegree: (centerDegree + 7.5) % 360,
    isBoundary,
    ...(isBoundary
      ? { boundaryMountains: [TWENTY_FOUR_MOUNTAINS[previousIndex], mountain] as [string, string] }
      : {}),
  };
}

/** 输入房屋朝向度数，自动换算相反方向的坐山。 */
export function getSitFacingFromFacingDegree(facingDegree: number): SitFacingPosition {
  const facing = getMountainFromDegree(facingDegree);
  const sit = getMountainFromDegree((facing.degree + 180) % 360);
  return {
    facing,
    sit,
    label: `${sit.mountain}山${facing.mountain}向`,
  };
}

/**
 * 公共罗盘证据入口：把朝向度数换算为向山、坐山与所属八卦，并显式保留分界线和解释边界。
 */
export function analyzeCompassDirection(facingDegree: number): CompassDirectionAnalysis {
  const position = getSitFacingFromFacingDegree(facingDegree);
  const facingBagua = getHouseTrigram(position.facing.mountain);
  const sitBagua = getHouseTrigram(position.sit.mountain);
  const normalizeStepKey = 'foundation:direction:calculation:normalize';
  const facingStepKey = 'foundation:direction:calculation:facing';
  const sitStepKey = 'foundation:direction:calculation:sit';
  const baguaStepKey = 'foundation:direction:calculation:bagua';
  const calculationSteps: CompassDirectionCalculationStep[] = [
    {
      key: normalizeStepKey,
      stage: '度数归一化',
      status: '已核验',
      dependsOnStepKeys: [],
      promptText: `核验输入朝向${facingDegree}°，归一化为${position.facing.degree}°；正北为0°并按顺时针增加`,
      sources: ['公共罗盘度数范围与360°归零规则'],
      limitation: COMPASS_STEP_LIMITATION,
    },
    {
      key: facingStepKey,
      stage: '向山映射',
      status: '已映射',
      dependsOnStepKeys: [normalizeStepKey],
      promptText: `${position.facing.degree}°按每山15°映射为${position.facing.mountain}向，中心${position.facing.centerDegree}°，范围${position.facing.startDegree}°至${position.facing.endDegree}°${position.facing.isBoundary ? `，位于${position.facing.boundaryMountains?.join('、')}分界线` : ''}`,
      sources: ['子山中心0°、二十四山顺时针每山15°公共表'],
      limitation: COMPASS_STEP_LIMITATION,
    },
    {
      key: sitStepKey,
      stage: '坐山换算',
      status: '已换算',
      dependsOnStepKeys: [facingStepKey],
      promptText: `朝向加180°得到坐山度数${position.sit.degree}°，映射为${position.sit.mountain}山${position.sit.isBoundary ? `，位于${position.sit.boundaryMountains?.join('、')}分界线` : ''}`,
      sources: ['坐山与朝向相差180°的罗盘口径'],
      limitation: COMPASS_STEP_LIMITATION,
    },
    {
      key: baguaStepKey,
      stage: '八卦归属',
      status: '已映射',
      dependsOnStepKeys: [facingStepKey, sitStepKey],
      promptText: `${position.facing.mountain}向属${facingBagua}卦，${position.sit.mountain}山属${sitBagua}卦，形成${position.label}`,
      sources: ['公共二十四山所属后天八卦表'],
      limitation: COMPASS_STEP_LIMITATION,
    },
  ];
  const directionFacts: CompassDirectionFact[] = [
    {
      key: 'foundation:direction:fact:facing',
      type: '向山',
      status: position.facing.isBoundary ? '位于分界线' : '已确定',
      ownerStepKeys: [facingStepKey],
      promptText: `${position.facing.degree}°对应${position.facing.mountain}向${position.facing.isBoundary ? `，相邻山位为${position.facing.boundaryMountains?.join('、')}` : ''}`,
      sources: ['二十四山向山映射结果'],
      limitation: COMPASS_FACT_LIMITATION,
    },
    {
      key: 'foundation:direction:fact:sit',
      type: '坐山',
      status: position.sit.isBoundary ? '位于分界线' : '已确定',
      ownerStepKeys: [sitStepKey],
      promptText: `${position.sit.degree}°对应${position.sit.mountain}山${position.sit.isBoundary ? `，相邻山位为${position.sit.boundaryMountains?.join('、')}` : ''}`,
      sources: ['朝向反向180°后的坐山映射结果'],
      limitation: COMPASS_FACT_LIMITATION,
    },
    {
      key: 'foundation:direction:fact:boundary',
      type: '分界状态',
      status: position.facing.isBoundary || position.sit.isBoundary ? '位于分界线' : '已确定',
      ownerStepKeys: [facingStepKey, sitStepKey],
      promptText:
        position.facing.isBoundary || position.sit.isBoundary
          ? '当前坐向命中二十四山分界线，不应静默采用单一山位'
          : '当前坐向未命中二十四山精确分界线',
      sources: ['每山起止边界与当前归一化度数比较'],
      limitation: COMPASS_FACT_LIMITATION,
    },
    {
      key: 'foundation:direction:fact:bagua',
      type: '八卦归属',
      status: '已确定',
      ownerStepKeys: [baguaStepKey],
      promptText: `${position.facing.mountain}向属${facingBagua}卦，${position.sit.mountain}山属${sitBagua}卦`,
      sources: ['二十四山所属后天八卦表'],
      limitation: COMPASS_FACT_LIMITATION,
    },
  ];
  const limitations = [
    '输入度数必须先明确以真北还是磁北为基准；本入口不自动推断或补造磁偏角。',
    '精确落在7.5°加15°整数倍的度数属于相邻二十四山分界线，应结合仪器误差和现场复测，不应静默采用单一山位。',
    '本结果只完成罗盘度数、坐向和八卦归属换算，不单独证明宅卦稳定、风水吉凶、健康、财富或事件结果。',
  ];
  const limitationFacts: CompassDirectionLimitationFact[] = [
    {
      key: 'foundation:direction:limitation:north-reference',
      type: '基准方向边界',
      status: '适用',
      ownerFactKeys: directionFacts.map((item) => item.key),
      ownerStepKeys: [normalizeStepKey],
      promptText: limitations[0],
      sources: ['真北、磁北与磁偏角的测量口径'],
      limitation: COMPASS_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:direction:limitation:boundary',
      type: '分界线边界',
      status: '适用',
      ownerFactKeys: [
        'foundation:direction:fact:facing',
        'foundation:direction:fact:sit',
        'foundation:direction:fact:boundary',
      ],
      ownerStepKeys: [facingStepKey, sitStepKey],
      promptText: limitations[1],
      sources: ['二十四山每山15°与分界线规则'],
      limitation: COMPASS_LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'foundation:direction:limitation:interpretation',
      type: '解释范围边界',
      status: '适用',
      ownerFactKeys: directionFacts.map((item) => item.key),
      ownerStepKeys: calculationSteps.map((item) => item.key),
      promptText: limitations[2],
      sources: ['罗盘换算与上层八宅、玄空等判断的职责边界'],
      limitation: COMPASS_LIMITATION_FACT_LIMITATION,
    },
  ];
  const boundaryCount = Number(position.facing.isBoundary) + Number(position.sit.isBoundary);
  const summaryStatus: CompassDirectionSummaryFact['status'] =
    boundaryCount >= 2 ? '坐向均位于分界线' : boundaryCount === 1 ? '向山位于分界线' : '映射稳定';
  const summaryFact: CompassDirectionSummaryFact = {
    key: 'foundation:direction:evidence-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...directionFacts.map((item) => item.key),
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    directionFactCount: directionFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `罗盘换算状态为${summaryStatus}；计算步骤${calculationSteps.length}项、方位事实${directionFacts.length}项、限制${limitationFacts.length}项`,
    sources: ['度数归一化、二十四山、相反坐山、后天八卦与分界状态汇总'],
    limitation: COMPASS_SUMMARY_LIMITATION,
  };
  const source =
    '采用正北0°顺时针、子山中心0°、二十四山每山15°、坐向相差180°及公共二十四山所属后天八卦表';

  return {
    key: `foundation:direction:${position.facing.degree}`,
    status: boundaryCount > 0 ? '存在分界线' : '已换算',
    inputDegree: facingDegree,
    normalizedDegree: position.facing.degree,
    facing: position.facing,
    sit: position.sit,
    facingBagua,
    sitBagua,
    label: position.label,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    directionFacts,
    summaryFact,
    limitations,
    limitationFacts,
    source,
    promptText: `罗盘换算：${calculationSteps.map((item) => item.promptText).join(' → ')}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.map((item) => item.replace(/[。；]+$/, '')).join('；')}。`,
  };
}

/**
 * tyme4ts 的 `Zone` 表示二十八宿四象（东、北、西、南），并不包含二十四山。
 * 这里公开权威名称供星宿/方位模块复用；二十四山仍保留罗盘专用表，避免错误替换。
 */
export const FOUR_ZONES: string[] = Zone.NAMES.map((name: string) => Zone.fromName(name).getName());

export interface NineStarProfile {
  number: string;
  color: string;
  element: string;
  dipper: string;
  direction: string;
  name: string;
}

/** 九星资料（委托 tyme4ts） */
export function getNineStarProfile(index: number): NineStarProfile {
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    throw new Error(`九星索引必须是 0-8 之间的整数：${String(index)}`);
  }
  const star = NineStar.fromIndex(index);
  return {
    number: star.getName(),
    color: star.getColor(),
    element: star.getElement().getName(),
    dipper: star.getDipper().getName(),
    direction: star.getDirection().getName(),
    name: star.toString(),
  };
}

export const NINE_STARS: NineStarProfile[] = Array.from({ length: 9 }, (_, index) =>
  getNineStarProfile(index),
);

/** 二十四山所属八卦 */
export const MOUNTAIN_TO_BAGUA: Record<string, string> = {
  子: '坎',
  癸: '坎',
  丑: '艮',
  艮: '艮',
  寅: '艮',
  甲: '震',
  卯: '震',
  乙: '震',
  辰: '巽',
  巽: '巽',
  巳: '巽',
  丙: '离',
  午: '离',
  丁: '离',
  未: '坤',
  坤: '坤',
  申: '坤',
  庚: '兑',
  酉: '兑',
  辛: '兑',
  戌: '乾',
  乾: '乾',
  亥: '乾',
  壬: '坎',
};

/** 由坐山（二十四山）取宅卦 */
export function getHouseTrigram(mountain: string): string {
  const gua = MOUNTAIN_TO_BAGUA[mountain];
  if (!gua) throw new Error(`坐山无效：${mountain}`);
  return gua;
}

/** 由坐向（如「子山午向」）取宅卦 */
export function getHouseTrigramFromSitFacing(sitMountain: string): string {
  return getHouseTrigram(sitMountain);
}

/** 八宅大游年吉凶标签 */
export type BaZhaiLabel = '伏位' | '生气' | '延年' | '天医' | '绝命' | '五鬼' | '六煞' | '祸害';

const LUCKY_LABELS: BaZhaiLabel[] = ['伏位', '生气', '延年', '天医'];

function isLucky(label: BaZhaiLabel): boolean {
  return LUCKY_LABELS.includes(label);
}

/** 八宅大游年表：基准卦 → 八宫（坎艮震巽离坤兑乾顺序）的吉凶标签 */
const BA_ZHAI_TABLE: Record<string, BaZhaiLabel[]> = {
  乾: ['六煞', '天医', '五鬼', '祸害', '绝命', '延年', '生气', '伏位'],
  坎: ['伏位', '五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
  艮: ['五鬼', '伏位', '六煞', '绝命', '祸害', '生气', '延年', '天医'],
  震: ['天医', '六煞', '伏位', '延年', '生气', '祸害', '绝命', '五鬼'],
  巽: ['生气', '绝命', '延年', '伏位', '天医', '五鬼', '六煞', '祸害'],
  离: ['延年', '祸害', '生气', '天医', '伏位', '六煞', '五鬼', '绝命'],
  坤: ['绝命', '生气', '祸害', '五鬼', '六煞', '伏位', '天医', '延年'],
  兑: ['祸害', '延年', '绝命', '六煞', '五鬼', '天医', '伏位', '生气'],
};

export interface BaZhaiPalace {
  gua: string;
  direction: string;
  degree: number;
  label: BaZhaiLabel;
  luck: '吉' | '凶';
}

/**
 * 八宅大游年盘
 * @param baseGua 基准卦（可为命卦或宅卦）
 * @returns 八个方位的吉凶
 */
export function getBaZhaiPalace(baseGua: string): BaZhaiPalace[] {
  const row = BA_ZHAI_TABLE[baseGua];
  if (!row) throw new Error(`基准卦无效（需为八卦之一）：${baseGua}`);
  return BAGUA.map((gua, i) => ({
    gua,
    direction: BAGUA_DIRECTION[gua],
    degree: BAGUA_DEGREE[gua],
    label: row[i],
    luck: isLucky(row[i]) ? '吉' : '凶',
  }));
}

/** 命卦所属东四/西四 */
export function getEastWestGroup(gua: string): '东四命' | '西四命' {
  if (!BAGUA.includes(gua)) {
    throw new Error(`八卦无效：${gua}`);
  }
  return ['坎', '离', '震', '巽'].includes(gua) ? '东四命' : '西四命';
}

export interface EightMansionResult {
  mingGua: string;
  group: '东四命' | '西四命';
  lucky: BaZhaiPalace[];
  unlucky: BaZhaiPalace[];
  summary: string;
}

/** 命卦 → 八宅四吉四凶方 */
export function getEightMansion(mingGua: string): EightMansionResult {
  const palace = getBaZhaiPalace(mingGua);
  const lucky = palace.filter((p) => p.luck === '吉');
  const unlucky = palace.filter((p) => p.luck === '凶');
  const group = getEastWestGroup(mingGua);
  return {
    mingGua,
    group,
    lucky,
    unlucky,
    summary: `命卦${mingGua}属${group}；四吉方：${lucky
      .map((p) => `${p.direction}(${p.label})`)
      .join('、')}；四凶方：${unlucky.map((p) => `${p.direction}(${p.label})`).join('、')}。`,
  };
}

export const direction = {
  BAGUA,
  BAGUA_DIRECTION,
  BAGUA_DEGREE,
  TWENTY_FOUR_MOUNTAINS,
  FOUR_ZONES,
  NINE_STARS,
  MOUNTAIN_TO_BAGUA,
  getNineStarProfile,
  getMountainFromDegree,
  getSitFacingFromFacingDegree,
  analyzeCompassDirection,
  getHouseTrigram,
  getHouseTrigramFromSitFacing,
  getBaZhaiPalace,
  getEastWestGroup,
  getEightMansion,
};
