// 时局计算及证据由 V2 维护；格局和天文证据仍使用旧模块。
import type { QimenData, QimenJiuGongGe, QimenScope } from './types';
import { getClassicPatterns, type ClassicPattern, type PatternContext } from './classic-patterns';
import type { QimenMethod, QimenCenterPalace, QimenFeipanMode } from './layout';
import { getQimenJuShu, type QimenJuMethod, type QimenJuShuResult } from './jushu';
import { getDivinationTime, getSolarTermName, getVoidBranches } from '../calendar';
import { getMonthQimenJuShu, getYearQimenJuShu } from './year-month';
import { arrangeJiuGongGe, checkSpecialHourConditions, getDunJiaStem, getZhiFuZhiShiByGanZhi, resolveZhiShiLandingPalace } from './layout';
import { getQimenPatternTags, buildPatternDetails, buildPalaceInsights } from './patterns';
import { getStemRelations } from './stem-relations';
import { buildDirectionAdvice } from './directions';
import { estimateYingQi } from './ying-qi';
import { buildSeasonality } from './seasonality';
import { detectQimenPatternCombos } from './pattern-combos';
import { analyzeQimenEvidence } from './evidence';
import { branchPalaces as diPanPalaces, stemTombs as STEM_TOMB_MAP, hasTianPanStar, hasTianPanStem } from './palace';

function getPalaceName(jiuGongGe: QimenJiuGongGe[], palace: number): string {
  return jiuGongGe.find((item) => item.gong === palace)?.name || `${palace}宫`;
}

/**
 * 根据地支解析所属宫位
 *
 * @param branch     地支（如"子""午"）
 * @param jiuGongGe  九宫格数据
 * @returns 宫位对象（含地支、宫号、宫名），找不到时返回 null
 */
function resolveQimenBranchPalace(
  branch: string,
  jiuGongGe: QimenJiuGongGe[],
): { branch: string; palace: number; name: string } | null {
  const palace = diPanPalaces[branch];
  if (!palace) return null;
  return { branch, palace, name: getPalaceName(jiuGongGe, palace) };
}

/**
 * 获取驿马地支
 *
 * 《烟波钓叟歌》：「天马方为动应之神，驿马冲则事速」
 * 寅午戌马在申，申子辰马在寅，
 * 巳酉丑马在亥，亥卯未马在巳。
 *
 * @param sourceBranch 时支
 * @returns 驿马地支，无匹配时返回空字符串
 */
function getHorseBranch(sourceBranch: string): string {
  if (['申', '子', '辰'].includes(sourceBranch)) return '寅';
  if (['寅', '午', '戌'].includes(sourceBranch)) return '申';
  if (['亥', '卯', '未'].includes(sourceBranch)) return '巳';
  if (['巳', '酉', '丑'].includes(sourceBranch)) return '亥';
  return '';
}

function isHorseActivated(
  horsePalace: number | undefined,
  keyPalaces: Array<number | undefined>,
): boolean {
  return horsePalace !== undefined && keyPalaces.some((palace) => palace === horsePalace);
}

function assertQimenScope(scope: QimenScope): void {
  if (!['hour', 'day', 'month', 'year'].includes(scope)) {
    throw new Error(`未知的奇门排盘级别: ${String(scope)}`);
  }
}

/**
 * 将 ClassicPattern（classic-patterns 模块原始输出）映射为 QimenData 兼容的格式
 *
 * classic-patterns 使用 tone/palace 字段，
 * 而 QimenData.classicPatterns 使用 type/palaces 字段。
 *
 * @param patterns 原始 ClassicPattern 列表
 * @returns 映射后的 QimenData.classicPatterns 列表
 */
function mapClassicPatterns(
  patterns: ClassicPattern[],
): Exclude<QimenData['classicPatterns'], undefined> {
  // 检测器本身按传统格局类别依次输出；不再用任意分值重排“影响强度”。
  return patterns.map((p) => ({
    name: p.name,
    type: p.tone,
    summary: p.summary,
    palaces: p.palace ? [p.palace] : [],
  }));
}

// 主入口函数

/** 按北京时间生成时、日、月、年四种奇门时局。 */
export function generateQimen(
  customDate: Date,
  method: QimenMethod = 'zhuanpan',
  scope: QimenScope = 'hour',
  juMethod: QimenJuMethod = 'chaibu',
  referenceDate?: Date,
  timezoneOffsetMinutes = 480,
  timeZoneId?: string,
  options?: { evidence?: boolean; seasonality?: boolean; centerPalace?: QimenCenterPalace; feipanMode?: QimenFeipanMode },
): QimenData {
  if (options?.seasonality === false && options.evidence !== false) throw new Error('跳过节令背景时不能生成完整证据。');
  assertQimenScope(scope);
  const centerPalace: QimenCenterPalace = options?.centerPalace ?? 'kun2';
  const feipanMode: QimenFeipanMode = options?.feipanMode ?? 'star-only';
  const corrected = getDivinationTime(customDate, timezoneOffsetMinutes);
  const reference = getDivinationTime(referenceDate ?? customDate);
  const timestamp = corrected.timestamp;
  const ganzhi = { ...corrected.ganzhi, year: reference.ganzhi.year, month: reference.ganzhi.month };
  const local = new Date(timestamp + timezoneOffsetMinutes * 60_000);
  const solar = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(), hour: local.getUTCHours(), minute: local.getUTCMinutes(), second: local.getUTCSeconds() };
  const termLocal = new Date(reference.timestamp + 8 * 3_600_000);
  const referenceSolar = { year: termLocal.getUTCFullYear(), month: termLocal.getUTCMonth() + 1, day: termLocal.getUTCDate(), hour: termLocal.getUTCHours(), minute: termLocal.getUTCMinutes(), second: termLocal.getUTCSeconds() };
  const jieQi = getSolarTermName(reference.timestamp);
  const timeInfo = { solar, jieQi };
  const actualOffsetMinutes = timezoneOffsetMinutes;
  const solarSecond = solar.second;

  // 根据 scope 确定"主动干支"（用于定局、寻符使、空亡、驿马）
  const activeGanZhi = getActiveGanZhi(ganzhi, scope);

  // 步骤 2：定局数
  const jushuResult = getJushuForScope(
    scope,
    ganzhi,
    {
      ...timeInfo,
      solar: { ...timeInfo.solar, second: solarSecond },
    },
    juMethod,
    referenceSolar,
    timezoneOffsetMinutes,
    timeZoneId,
  );
  const { isYangDun, juShu, yuan } = jushuResult;

  // 步骤 3：寻值符与值使（旬首法）
  const zhiFuShiResult = getZhiFuShiForScope(scope, activeGanZhi, ganzhi, jushuResult, centerPalace);
  const { zhiFu, zhiShi, zhiFuPalace, specialConditions } = zhiFuShiResult;

  // ── 后续步骤 4-12 与 scope 无关，共用同一套排盘逻辑 ──

  // 步骤 4：按所选转盘法或飞盘法排九宫格
  const jiuGongGe = arrangeJiuGongGe(
    isYangDun,
    juShu,
    zhiFu,
    zhiShi,
    { hour: activeGanZhi },
    method,
    centerPalace,
    feipanMode,
  );
  if (scope === 'day') checkDayRuMu(ganzhi.day, jiuGongGe, specialConditions);
  enrichLiuGuiTianWang(specialConditions, jiuGongGe);

  // 步骤 5：辅助数据（空亡、驿马）
  const activeZhi = activeGanZhi.charAt(1);
  const activeGanForFind = getDunJiaStem(activeGanZhi);

  const voidBranches = getVoidBranches(activeGanZhi) || [];
  const voidPalaces = voidBranches
    .map((branch: string) => resolveQimenBranchPalace(branch, jiuGongGe))
    .filter((item): item is { branch: string; palace: number; name: string } => Boolean(item));

  const horseBranch = getHorseBranch(activeZhi);
  const horsePalace = horseBranch ? resolveQimenBranchPalace(horseBranch, jiuGongGe) : null;

  const zhiFuLandingPalace = jiuGongGe.find((gong) => hasTianPanStar(gong, zhiFu))?.gong;
  if (zhiFuLandingPalace === undefined) {
    throw new Error(`找不到值符星 "${zhiFu}" 落宫。`);
  }
  const zhiShiLandingPalace = resolveZhiShiLandingPalace(
    isYangDun,
    zhiShi,
    activeGanZhi,
    zhiFuPalace,
    method,
    centerPalace,
  );

  // 步骤 6：基础格局标签
  const patternTags = getQimenPatternTags({
    zhiFu,
    zhiShi,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    jiuGongGe,
    activeGanForFind,
    activeGanLabel: getActiveGanLabel(scope),
    horsePalace: horsePalace?.palace,
    horsePalaceName: horsePalace?.name,
  });

  // 步骤 7：标签详情
  const patternDetails = buildPatternDetails(patternTags);

  // 步骤 8：经典格局
  const dayStem = ganzhi.day.charAt(0);
  const yearBranch = ganzhi.year.charAt(1);
  const dayBranch = ganzhi.day.charAt(1);
  const monthBranch = ganzhi.month.charAt(1);
  const hourStem = ganzhi.hour.charAt(0);
  const hourBranch = ganzhi.hour.charAt(1);
  const classicPatternContext: PatternContext = {
    jiuGongGe,
    zhiFu,
    zhiShi,
    yearGanZhi: ganzhi.year,
    ...(scope !== 'year' ? { monthGanZhi: ganzhi.month } : {}),
    ...(scope === 'day' || scope === 'hour' ? { dayStem, dayGanZhi: ganzhi.day } : {}),
    ...(scope === 'hour' ? { hourGanZhi: ganzhi.hour } : {}),
  };
  const classicPatternsRaw = getClassicPatterns(classicPatternContext);
  const classicPatterns = mapClassicPatterns(classicPatternsRaw);

  // 步骤 9：天地盘干关系
  const stemRelations = getStemRelations(jiuGongGe);

  // 步骤 10：节令背景
  const seasonality = options?.seasonality === false ? undefined : buildSeasonality(ganzhi, new Date(timestamp), referenceDate, timezoneOffsetMinutes);

  // 步骤 11：宫位洞察
  const palaceInsights = buildPalaceInsights({
    jiuGongGe,
    zhiFu,
    zhiShi,
    patternTags,
  });

  // 步骤 12：方位建议
  const directions = buildDirectionAdvice(
    jiuGongGe,
    voidBranches,
    classicPatternsRaw,
    specialConditions,
  );

  // 步骤 13：应期估算
  const isFuyin = patternTags.some((t) => t.includes('伏吟'));
  const isFanyin = patternTags.some((t) => t.includes('反吟'));
  const yingQiVoidBranches = voidPalaces
    .filter((item) => item.palace === zhiFuLandingPalace)
    .map((item) => item.branch);
  const hasVoid = yingQiVoidBranches.length > 0;
  const hasHorse = isHorseActivated(horsePalace?.palace, [zhiFuLandingPalace, zhiShiLandingPalace]);
  // 未按具体事项选定用神时，第二参数保持省略，让应期结果明确标为值符通用参考，
  // 同时避免把值符宫作为“用神”再重复计入一次。
  const yingQi = estimateYingQi({
    isFuyin,
    isFanyin,
    hasHorse,
    hasVoid,
    isYangDun,
    zhiFuLandingPalace,
    zhiShiLandingPalace,
    classicPatterns: classicPatternsRaw,
    voidBranches: yingQiVoidBranches,
  });

  // 步骤 14：复合格局
  const patternCombos = detectQimenPatternCombos({
    classicPatterns: classicPatternsRaw,
    patternTags,
    voidPalaces,
    horseStar: hasHorse ? horsePalace || undefined : undefined,
    activeGanZhi,
    zhiFu,
    zhiShi,
    yearBranch,
    ...(scope === 'day' || scope === 'hour' ? { dayGanZhi: ganzhi.day, dayStem, dayBranch } : {}),
    ...(scope !== 'year' ? { monthBranch } : {}),
    solarTerm: jushuResult.jieQi || jieQi,
    actualSolarTerm: jushuResult.actualJieQi || jieQi,
    epoch: yuan,
    ...(scope === 'hour' ? { hourGanZhi: ganzhi.hour, hourStem, hourBranch } : {}),
    jiuGongGe,
  });

  // 步骤 15：返回完整 QimenData
  const isYearOrMonthScope = scope === 'year' || scope === 'month';
  const result: QimenData = {
    timezoneOffsetMinutes: actualOffsetMinutes,
    ...(referenceDate ? { termReferenceTimestamp: reference.timestamp } : {}),
    method,
    ...(method === 'feipan' && feipanMode === 'all-fly' ? { feipanMode } : {}),
    scope,
    ...(!isYearOrMonthScope ? { juMethod: jushuResult.juMethod } : {}),
    ...(centerPalace === 'yang-gen8-yin-kun2' ? { centerPalace } : {}),
    timeInfo: {
      solarTerm: jushuResult.actualJieQi || jieQi,
      epoch: jushuResult.yuan,
      ...(!isYearOrMonthScope
        ? {
            juTerm: jushuResult.jieQi || jieQi,
            juMethod: jushuResult.juMethod,
            ...(jushuResult.fuTou ? { fuTou: jushuResult.fuTou } : {}),
            ...(jushuResult.fuTouDate ? { fuTouDate: jushuResult.fuTouDate } : {}),
            ...(jushuResult.chaoShenOrJieQi
              ? { chaoShenOrJieQi: jushuResult.chaoShenOrJieQi }
              : {}),
            ...(jushuResult.isZhiRun !== undefined
              ? { isZhiRun: String(jushuResult.isZhiRun) }
              : {}),
          }
        : {}),
      ...(jushuResult.juMethodNote ? { juMethodNote: jushuResult.juMethodNote } : {}),
    },
    ganzhi,
    isYangDun: jushuResult.isYangDun,
    juShu: jushuResult.juShu,
    zhiFu,
    zhiShi,
    patternTags,
    patternDetails,
    palaceInsights,
    voidBranches,
    voidPalaces,
    horseStar: horsePalace ? { ...horsePalace, sourceBranch: activeZhi } : undefined,
    specialConditions,
    seasonality,
    jiuGongGe,
    classicPatterns,
    stemRelations,
    patternCombos,
    directions,
    yingQi,
    timestamp,
  };
  if (options?.evidence !== false) result.evidenceAnalysis = analyzeQimenEvidence(result);
  return result;
}

// 内部辅助函数（不同 scope 对应的定局/寻符使逻辑）

/** 根据 scope 获取主动干支 */
function getActiveGanZhi(
  ganzhi: { year: string; month: string; day: string; hour: string },
  scope: QimenScope,
): string {
  switch (scope) {
    case 'year':
      return ganzhi.year;
    case 'month':
      return ganzhi.month;
    case 'day':
      return ganzhi.day;
    default:
      return ganzhi.hour;
  }
}

function getActiveGanLabel(scope: QimenScope): string {
  switch (scope) {
    case 'year':
      return '年干';
    case 'month':
      return '月干';
    case 'day':
      return '日干';
    default:
      return '时干';
  }
}

/** 根据 scope 获取定局结果 */
function getJushuForScope(
  scope: QimenScope,
  ganzhi: { year: string; month: string; day: string; hour: string },
  timeInfo: {
    solar: {
      year: number;
      month: number;
      day: number;
      hour?: number;
      minute?: number;
      second?: number;
    };
    jieQi: string;
  },
  juMethod: QimenJuMethod = 'chaibu',
  referenceSolar?: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  offsetMinutes = 480,
  timeZoneId?: string,
): QimenJuShuResult {
  switch (scope) {
    case 'year': {
      const r = getYearQimenJuShu(ganzhi.year, timeInfo.solar.year);
      return {
        ...r,
        jieQi: timeInfo.jieQi,
        juMethod,
        isZhiRun: false,
        juMethodNote: '《奇门遁甲统宗》年家三元阴遁定局',
      };
    }
    case 'month': {
      const r = getMonthQimenJuShu(ganzhi.month, ganzhi.year);
      return {
        ...r,
        jieQi: timeInfo.jieQi,
        juMethod,
        isZhiRun: false,
        juMethodNote: '《奇门遁甲统宗》月家五年三元阴遁定局',
      };
    }
    case 'day':
    case 'hour':
    default: {
      return getQimenJuShu({ ...timeInfo.solar, hour: timeInfo.solar.hour ?? 12, minute: timeInfo.solar.minute ?? 0, second: timeInfo.solar.second ?? 0 }, juMethod, referenceSolar, offsetMinutes, timeZoneId);
    }
  }
}

/** 根据 scope 获取值符值使 */
function getZhiFuShiForScope(
  scope: QimenScope,
  activeGanZhi: string,
  ganzhi: { day: string },
  jushuResult: { isYangDun: boolean; juShu: number },
  centerPalace: QimenCenterPalace = 'kun2',
): {
  zhiFu: string;
  zhiShi: string;
  zhiFuPalace: number;
  specialConditions: NonNullable<QimenData['specialConditions']>;
} {
  const defaultSpecialConditions = {
    isLiuJiaHour: false,
    isLiuGuiHour: false,
    isShiGanRuMu: false,
    isWuBuYuShi: false,
    description: '',
  };

  switch (scope) {
    case 'hour': {
      // 时家奇门：支持特殊时辰检查
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi, jushuResult, centerPalace);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        zhiFuPalace: result.xunShouPalace,
        specialConditions: checkSpecialHourConditions(activeGanZhi, ganzhi.day),
      };
    }
    case 'day': {
      // 日家奇门：使用通用旬首法；日干入墓待布盘后按天盘落宫核对。
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi, jushuResult, centerPalace);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        zhiFuPalace: result.xunShouPalace,
        specialConditions: { ...defaultSpecialConditions },
      };
    }
    case 'month':
    case 'year':
    default: {
      // 月家/年家：使用通用旬首法（无特殊条件）
      const result = getZhiFuZhiShiByGanZhi(activeGanZhi, jushuResult, centerPalace);
      return {
        zhiFu: result.zhiFu,
        zhiShi: result.zhiShi,
        zhiFuPalace: result.xunShouPalace,
        specialConditions: defaultSpecialConditions,
      };
    }
  }
}

/**
 * 检查日干入墓
 *
 * 按当前日干（甲日取六甲遁干）在天盘的实际落宫核对墓宫。
 */
function checkDayRuMu(
  dayGanZhi: string,
  jiuGongGe: QimenJiuGongGe[],
  conditions: Exclude<QimenData['specialConditions'], undefined>,
): void {
  const dayGan = dayGanZhi.charAt(0);
  const activeStem = getDunJiaStem(dayGanZhi);
  const ruMuInfo = STEM_TOMB_MAP[activeStem];
  if (!ruMuInfo) return;
  const palace = jiuGongGe.find(
    (item) => item.gong === ruMuInfo.palace && hasTianPanStem(item, activeStem),
  );
  if (!palace) return;
  conditions.isRiGanRuMu = true;
  const stemLabel =
    dayGan === activeStem ? `日干${dayGan}` : `日干${dayGan}（${dayGanZhi}遁${activeStem}）`;
  conditions.description += `${stemLabel}落${palace.name}入墓（墓支${ruMuInfo.branch}），大势迟滞，宜静不宜动；`;
}

/**
 * 六癸时补充天网高低与细分避忌。
 *
 * 《奇门遁甲统宗》：「天网者，六癸也。六癸时，不宜举动……临一二三四五宫低，可扬而出；
 * 临六七八九宫高过人，为四张无走路。」
 * 《奇门宝鉴御定》又细分四宫入墓、六宫触冠，故输出时单独提示，避免把入墓/触冠误作可出。
 */
function enrichLiuGuiTianWang(
  conditions: QimenData['specialConditions'],
  jiuGongGe: QimenJiuGongGe[],
): void {
  if (!conditions?.isLiuGuiHour) return;

  const guiPalace = jiuGongGe.find((palace) => hasTianPanStem(palace, '癸'));
  if (!guiPalace) return;

  switch (guiPalace.gong) {
    case 1:
    case 2:
    case 3:
      conditions.description += `天盘癸落${guiPalace.name}，天网临一至三宫为低，可取天上六癸方隐避，不宜主动举事；`;
      return;
    case 4:
      conditions.description += `天盘癸落${guiPalace.name}，天网临巽四宫为入墓，不宜出避，宜静守；`;
      return;
    case 5:
      conditions.description += `天盘癸落${guiPalace.name}，中五宫沿简分归低网，仍宜静守，不宜主动举事；`;
      return;
    case 6:
      conditions.description += `天盘癸落${guiPalace.name}，天网临乾六宫为触冠，不宜出避，主动举事多阻；`;
      return;
    default:
      conditions.description += `天盘癸落${guiPalace.name}，天网临七至九宫为高，古称天网四张，主动举事多阻；`;
  }
}


