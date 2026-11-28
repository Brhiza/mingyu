import { residential } from '../../../systems/residential';
import {
  bazhaiPalaces,
  bazhaiStarGuidance,
  birthYearCandidates,
  compareMingHouse,
  mingGuaForYear,
  starPalaceRelations,
  trigramProfiles,
} from '../../../systems/bazhai/foundation';
import {
  measureSitDirection,
  mountainAt,
  mountainTrigram,
  mountains,
} from '../../../systems/compass';
import { getYearSixtyCycle } from '../../../systems/ganzhi-foundation';
import { monthFlyingStar, yearFlyingStar } from '../../../systems/xuankong/flow';
import {
  FLOOR_MARKER_META,
  PLAN_DIRECTION_OPTIONS,
  getSimpleDirectionLabel,
  type FloorMarkerKind,
  type FloorPlanMarker,
  type HouseProfile,
  type ResidentMember,
} from './fengshui-store';

export const LUOSHU_GRID_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;

export const LUOSHU_DIR_BY_EARTH: Record<number, string> = {
  4: '东南',
  9: '南',
  2: '西南',
  3: '东',
  5: '中',
  7: '西',
  8: '东北',
  1: '北',
  6: '西北',
};

export const TRIGRAM_BY_EARTH: Record<number, string> = {
  4: '巽',
  9: '离',
  2: '坤',
  3: '震',
  5: '中',
  7: '兑',
  8: '艮',
  1: '坎',
  6: '乾',
};

export const TRIGRAM_SYMBOLS: Record<string, string> = {
  乾: '☰',
  兑: '☱',
  离: '☲',
  震: '☳',
  巽: '☴',
  坎: '☵',
  艮: '☶',
  坤: '☷',
  中: '☯',
};

const DIR_TO_EARTH: Record<string, number> = {
  东南: 4,
  南: 9,
  西南: 2,
  东: 3,
  中: 5,
  西: 7,
  东北: 8,
  北: 1,
  西北: 6,
};

const BAZHAI_LUCKY_SET = new Set(['生气', '延年', '天医', '伏位']);

const ZHENG_LING_TABLE: Record<number, { zheng: string; ling: string; zhao: string }> = {
  1: { zheng: '坎（正北）', ling: '离（正南）', zhao: '坤（西南）' },
  2: { zheng: '坤（西南）', ling: '艮（东北）', zhao: '巽（东南）' },
  3: { zheng: '震（正东）', ling: '兑（正西）', zhao: '乾（西北）' },
  4: { zheng: '巽（东南）', ling: '乾（西北）', zhao: '震（正东）' },
  5: { zheng: '坤艮（前艮后坤）', ling: '坤艮互参', zhao: '坎离互参' },
  6: { zheng: '乾（西北）', ling: '巽（东南）', zhao: '兑（正西）' },
  7: { zheng: '兑（正西）', ling: '震（正东）', zhao: '离（正南）' },
  8: { zheng: '艮（东北）', ling: '坤（西南）', zhao: '坎（正北）' },
  9: { zheng: '离（正南）', ling: '坎（正北）', zhao: '艮（东北）' },
};

const DOUBLE_STAR_META: Record<string, { label: string; kind: 'good' | 'bad'; remedy?: string }> = {
  '14': { label: '一四同宫（文昌科名）', kind: 'good' },
  '41': { label: '四一同宫（文昌显达）', kind: 'good' },
  '16': { label: '一六共宗（水天官贵）', kind: 'good' },
  '61': { label: '六一官星（文武皆利）', kind: 'good' },
  '68': { label: '六八同宫（武科富贵）', kind: 'good' },
  '86': { label: '八六同宫（地产功名）', kind: 'good' },
  '89': { label: '八九相生（婚喜庆典）', kind: 'good' },
  '98': { label: '九八辅弼（添丁进财）', kind: 'good' },
  '23': { label: '二三斗牛煞（口舌争执）', kind: 'bad', remedy: '宜暖光/红色点缀泄木生土' },
  '32': { label: '三二斗牛煞（是非兴讼）', kind: 'bad', remedy: '宜暖光/红色点缀泄木生土' },
  '25': { label: '二五交加（病符重煞）', kind: 'bad', remedy: '宜铜铃/金属/白色静置泄土，忌红黄火土与动土' },
  '52': { label: '五二交加（灾病损耗）', kind: 'bad', remedy: '宜铜铃/金属/白色静置泄土，忌红黄火土与动土' },
  '37': { label: '三七穿途（劫盗争端）', kind: 'bad', remedy: '宜静水/黑蓝色水气泄金生木' },
  '73': { label: '七三穿途（口舌官非）', kind: 'bad', remedy: '宜静水/黑蓝色水气泄金生木' },
  '67': { label: '六七交剑煞（金刃争斗）', kind: 'bad', remedy: '宜静水/黑蓝色水气泄金' },
  '76': { label: '七六交剑煞（竞争伤损）', kind: 'bad', remedy: '宜静水/黑蓝色水气泄金' },
  '79': { label: '七九穿途（回禄火患）', kind: 'bad', remedy: '宜陶瓷/米黄色土气泄火生金' },
  '97': { label: '九七合辙（祝融火煞）', kind: 'bad', remedy: '宜陶瓷/米黄色土气泄火生金' },
  '59': { label: '五九相聚（火生五黄毒煞）', kind: 'bad', remedy: '严忌红火动土，宜金属器物静泄土气' },
  '95': { label: '九五相聚（廉贞烈火顽疾）', kind: 'bad', remedy: '严忌红火动土，宜金属器物静泄土气' },
};

export const NINE_STAR_SHORT: Record<number, string> = {
  1: '一白贪狼',
  2: '二黑巨门',
  3: '三碧禄存',
  4: '四绿文曲',
  5: '五黄廉贞',
  6: '六白武曲',
  7: '七赤破军',
  8: '八白左辅',
  9: '九紫右弼',
};

export interface PalaceViewModel {
  earth: number;
  palaceName: string;
  direction: string;
  trigramSymbol: string;
  familyRole: string;
  bodyParts: string;
  bazhai?: {
    mingLabel: string;
    mingLuck: '吉' | '凶';
    houseLabel: string;
    houseLuck: '吉' | '凶';
    starName: string;
    starElement: string;
    palaceElement: string;
    relation: string;
    rank: string;
    domain: string;
    layoutAdvice: string;
  };
  xuankong?: {
    periodStar: number;
    mountainStar: number;
    waterStar: number;
    mountainTimeliness: string;
    waterTimeliness: string;
    yearStar?: number;
    monthStar?: number;
    dayStar?: number;
    hourStar?: number;
    doubleStarNote?: string;
    doubleStarKind?: 'good' | 'bad';
    hasFiveSha: boolean;
    hasTwoSha: boolean;
    remedies: string[];
  };
  statusTone: 'good' | 'warn' | 'neutral';
  roomSuitability: string;
}

export interface ResidentAnalysis {
  member: ResidentMember;
  isPrimary: boolean;
  mingGua: string;
  mingGroup: '东四' | '西四';
  birthBoundaryStatus: string;
  candidateYears: number[];
  candidateGuas: string[];
  matchWithHouse: '同组' | '异组';
  luckyDirections: Array<{ direction: string; gua: string; label: string }>;
  unluckyDirections: Array<{ direction: string; gua: string; label: string }>;
  bestSleepDir: string;
  bestStudyDir: string;
  bestDoorDir: string;
  layeredAdvice: string;
}

export interface WorkbenchSnapshot {
  sitMountain: string;
  facingMountain: string;
  houseGua: string;
  houseGroup: '东四' | '西四';
  correctedDegree?: number;
  stabilityText: string;
  measurementWarnings: string[];
  yun: number;
  yuan: string;
  periodRange: string;
  effectiveMode: '下卦' | '替卦';
  formation: string;
  shanToMountain: boolean;
  xiangToFacing: boolean;
  zhengLing: { zheng: string; ling: string; zhao: string };
  castleGateSummary: string;
  combinations: ReadonlyArray<{ name: string; kind: string; note?: string }>;
  fallbackNotice: string | null;
  moveInCycleNotice: string | null;
  palaces: PalaceViewModel[];
  residentAnalyses: ResidentAnalysis[];
  agreements: Array<{ level: string; title: string; detail: string }>;
  advice: string[];
  residentialPayload: Record<string, unknown>;
  rawResidentialResult: ReturnType<typeof residential>;
}

export interface AnnualFengShuiSha {
  year: number;
  ganZhi: string;
  yearBranch: string;
  taiSui: { branch: string; direction: string; trigram: string; earth: number };
  suiPo: { branch: string; direction: string; trigram: string; earth: number };
  sanSha: { groupLabel: string; direction: string; mountains: string; earth: number };
  annualCenterStar: number;
  annualPlate: number[];
  annualPalaces: Array<{
    earth: number;
    direction: string;
    palaceName: string;
    star: number;
    starName: string;
    tag: string;
    tone: 'good' | 'warn' | 'neutral';
    avoidDigging: boolean;
  }>;
  monthlyPlates: Array<{
    month: number;
    monthBranch: string;
    centerStar: number;
    starName: string;
    plate: number[];
    fiveEarth: number;
    twoEarth: number;
    overlapAlerts: string[];
  }>;
}

export interface FloorMarkerDiagnosis {
  marker: FloorPlanMarker;
  kindLabel: string;
  direction: string;
  mountain: string;
  trigram: string;
  bearing: number | null;
  status: '宜' | '平' | '慎';
  summary: string;
}

function starTimeliness(star: number, yun: number): string {
  if (star === yun) return '旺';
  const next1 = (yun % 9) + 1;
  const next2 = ((yun + 1) % 9) + 1;
  const prev1 = ((yun - 2 + 9) % 9) + 1;
  if (star === next1 && star !== 5) return '生';
  if (star === next2 && star !== 5) return '进气';
  if (star === prev1 && star !== 5) return '退';
  if (star === 5) return '五黄煞';
  if (star === 2) return '二黑病';
  return '失令';
}

function isGoodStarTime(t: string): boolean {
  return t === '旺' || t === '生' || t === '进气';
}

function buildFlowInput(profile: HouseProfile) {
  if (profile.flowGranularity === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.flowDate);
    if (m) {
      const y = Math.min(2100, Math.max(1900, Number(m[1])));
      const mo = Math.min(12, Math.max(1, Number(m[2])));
      const d = Math.min(31, Math.max(1, Number(m[3])));
      return {
        kind: 'date' as const,
        year: y,
        month: mo,
        day: d,
        ...(profile.flowHour !== undefined ? { hour: profile.flowHour } : {}),
      };
    }
  }
  return {
    kind: 'year' as const,
    year: Math.min(2100, Math.max(1900, profile.flowYear)),
  };
}

function buildPersonInput(member: ResidentMember) {
  return {
    kind: 'birth' as const,
    year: Math.min(2100, Math.max(1900, member.birthYear)),
    gender: member.gender,
    ...(member.birthMonth && member.birthDay
      ? { month: member.birthMonth, day: member.birthDay }
      : {}),
  };
}

export function computeWorkbenchSnapshot(profile: HouseProfile): WorkbenchSnapshot {
  const primaryResident =
    profile.residents.find((r) => r.id === profile.primaryResidentId) ??
    profile.residents[0] ?? {
      id: 'fallback',
      name: '宅主',
      birthYear: 1990,
      gender: 'male' as const,
    };

  const orientation =
    profile.orientationKind === 'mountain'
      ? { kind: 'mountain' as const, sitMountain: profile.sitMountain }
      : {
          kind: 'degree' as const,
          reading: profile.degreeReading,
          degree: profile.degree,
          northReference: profile.northReference,
          ...(profile.northReference === 'magnetic'
            ? { magneticDeclinationDegrees: profile.magneticDeclination }
            : {}),
          uncertaintyDegrees: profile.uncertaintyDegrees,
        };

  const construction = { year: Math.min(2100, Math.max(1900, profile.constructionYear)) };
  const flow = buildFlowInput(profile);
  const roomEntries = Object.entries(profile.roomPlacements ?? {})
    .filter(([, dir]) => Boolean(dir))
    .map(([k, dir]) => `${FLOOR_MARKER_META.find((m) => m.kind === k)?.label ?? k}在${dir === '中' ? '房子中心' : `${dir}方`}`);
  const contextBits = [
    `建于${construction.year}年`,
    profile.moveInYear ? `${profile.moveInYear}年入住/翻新` : '',
    roomEntries.length ? `已标房间位置：${roomEntries.join('、')}` : '',
  ].filter(Boolean);
  const baseQ = profile.notes.trim() || '这套住宅的坐向格局与居住人是否相合，布局上需要注意什么？';
  const question = contextBits.length ? `${baseQ}（补充：${contextBits.join('；')}）` : baseQ;

  let fallbackNotice: string | null = null;
  let effectiveMode: '下卦' | '替卦' = profile.xuankongMode;
  let residentialPayload: Record<string, unknown> = {
    question,
    person: buildPersonInput(primaryResident),
    orientation,
    construction,
    mode: profile.xuankongMode,
    ...(profile.xuankongMode === '替卦' ? { confirmJianXiang: true } : {}),
    flow,
  };

  let resResult: ReturnType<typeof residential>;
  try {
    resResult = residential(residentialPayload as Parameters<typeof residential>[0]);
  } catch (err) {
    if (profile.xuankongMode === '替卦') {
      effectiveMode = '下卦';
      fallbackNotice =
        err instanceof Error && err.message
          ? `未满足替卦条件（${err.message}），当前已暂按下卦显示预览。`
          : '当前度数或误差范围未满足兼向替卦条件，已暂按下卦显示预览。';
      residentialPayload = {
        question,
        person: buildPersonInput(primaryResident),
        orientation,
        construction,
        mode: '下卦',
        flow,
      };
      resResult = residential(residentialPayload as Parameters<typeof residential>[0]);
    } else {
      throw err;
    }
  }

  const resData = resResult.data;
  const xkChart = resData.xuankong?.charts[0];
  const primaryHouse = resData.houses[0] ?? {
    sitMountain: profile.sitMountain,
    facingMountain: mountains[(mountains.indexOf(profile.sitMountain) + 12) % 24]!,
    houseGua: mountainTrigram(profile.sitMountain),
  };

  const sitMountain = xkChart?.sitMountain ?? primaryHouse.sitMountain;
  const facingMountain = xkChart?.facingMountain ?? primaryHouse.facingMountain;
  const houseGua = primaryHouse.houseGua;
  const houseGroup = '坎离震巽'.includes(houseGua) ? ('东四' as const) : ('西四' as const);

  const measurementInfo =
    resData.measurement ??
    (profile.orientationKind === 'degree'
      ? measureSitDirection({
          degree:
            profile.degreeReading === 'facing' ? (profile.degree + 180) % 360 : profile.degree,
          northReference: profile.northReference,
          ...(profile.northReference === 'magnetic'
            ? { magneticDeclinationDegrees: profile.magneticDeclination }
            : {}),
          uncertaintyDegrees: profile.uncertaintyDegrees,
        })
      : null);

  const yun = xkChart?.period.yun ?? 9;
  const yuan = xkChart?.period.yuan ?? '下元';
  const periodRange = xkChart ? `${xkChart.period.startYear}–${xkChart.period.endYear}` : '';

  const primaryComp = resData.bazhai?.comparisons[0];
  const primaryMingPalace = resData.bazhai?.mingPalaces[0];
  const primaryHousePalace = resData.housePalaces[0];

  const dirCompMap = new Map((primaryComp?.directions ?? []).map((d) => [d.direction, d]));
  const starRelMap = new Map(
    (primaryMingPalace?.starPalaces ?? primaryHousePalace?.starPalaces ?? []).map((s) => [
      s.direction,
      s,
    ]),
  );
  const xkByEarth = new Map((xkChart?.palaces ?? []).map((p) => [p.earth, p]));

  const palaces: PalaceViewModel[] = LUOSHU_GRID_ORDER.map((earth) => {
    const direction = LUOSHU_DIR_BY_EARTH[earth]!;
    const trigram = TRIGRAM_BY_EARTH[earth]!;
    const profileMeta = trigram !== '中' ? trigramProfiles[trigram] : undefined;
    const compDir = dirCompMap.get(direction);
    const starRel = starRelMap.get(direction);
    const xp = xkByEarth.get(earth);

    const bazhaiInfo =
      earth !== 5 && compDir && starRel
        ? {
            mingLabel: compDir.ming,
            mingLuck: compDir.mingLuck,
            houseLabel: compDir.house,
            houseLuck: compDir.houseLuck,
            starName: starRel.star,
            starElement: starRel.starElement,
            palaceElement: starRel.palaceElement,
            relation: starRel.relation,
            rank: bazhaiStarGuidance[compDir.ming]?.rank ?? '',
            domain: bazhaiStarGuidance[compDir.ming]?.domain ?? '',
            layoutAdvice: bazhaiStarGuidance[compDir.ming]?.layoutAdvice ?? '',
          }
        : undefined;

    let xkInfo: PalaceViewModel['xuankong'];
    if (xp) {
      const mTime = starTimeliness(xp.mountain, yun);
      const wTime = starTimeliness(xp.water, yun);
      const pairKey = `${xp.mountain}${xp.water}`;
      const pairMeta = DOUBLE_STAR_META[pairKey];
      const hasFiveSha =
        (xp.mountain === 5 && yun !== 5) ||
        (xp.water === 5 && yun !== 5) ||
        xp.yearStar === 5 ||
        xp.monthStar === 5;
      const hasTwoSha =
        (xp.mountain === 2 && yun !== 2 && yun !== 9) ||
        (xp.water === 2 && yun !== 2 && yun !== 9) ||
        xp.yearStar === 2 ||
        xp.monthStar === 2;

      const remedies: string[] = [];
      if (hasFiveSha || hasTwoSha) {
        remedies.push('金属器物/铜铃/素白金气静泄土煞，忌红黄火土色与动土修造');
      }
      if (pairMeta?.remedy) {
        remedies.push(pairMeta.remedy);
      }

      xkInfo = {
        periodStar: xp.period,
        mountainStar: xp.mountain,
        waterStar: xp.water,
        mountainTimeliness: mTime,
        waterTimeliness: wTime,
        ...(xp.yearStar !== undefined ? { yearStar: xp.yearStar } : {}),
        ...(xp.monthStar !== undefined ? { monthStar: xp.monthStar } : {}),
        ...(xp.dayStar !== undefined ? { dayStar: xp.dayStar } : {}),
        ...(xp.hourStar !== undefined ? { hourStar: xp.hourStar } : {}),
        ...(pairMeta ? { doubleStarNote: pairMeta.label, doubleStarKind: pairMeta.kind } : {}),
        hasFiveSha,
        hasTwoSha,
        remedies,
      };
    }

    const mingGood = bazhaiInfo?.mingLuck === '吉';
    const xkGood = xkInfo
      ? isGoodStarTime(xkInfo.mountainTimeliness) || isGoodStarTime(xkInfo.waterTimeliness)
      : false;
    const hasHardSha = Boolean(
      xkInfo && (xkInfo.hasFiveSha || xkInfo.hasTwoSha || xkInfo.doubleStarKind === 'bad'),
    );

    let statusTone: 'good' | 'warn' | 'neutral' = 'neutral';
    if (earth !== 5) {
      if (hasHardSha || (!mingGood && bazhaiInfo?.houseLuck === '凶')) {
        statusTone = 'warn';
      } else if (mingGood && !hasHardSha && (xkGood || bazhaiInfo?.houseLuck === '吉')) {
        statusTone = 'good';
      }
    }

    let roomSuitability = '中宫太极枢纽，宜开阔通明、保持整洁，忌设卫生间或重物堆压。';
    if (earth !== 5 && bazhaiInfo) {
      if (hasHardSha) {
        roomSuitability = `本宫带${xkInfo?.hasFiveSha ? '五黄' : xkInfo?.hasTwoSha ? '二黑' : '凶星组合'}煞气，先以五行静化，宜作储物/走道/卫浴，慎作主卧与大动土。`;
      } else if (bazhaiInfo.mingLuck === '吉' && bazhaiInfo.houseLuck === '吉') {
        roomSuitability = `人宅同吉（${bazhaiInfo.mingLabel}/${bazhaiInfo.houseLabel}），${xkGood ? '且当令旺气加持，' : ''}优先作大门、主卧、客厅或书房核心区。`;
      } else if (bazhaiInfo.mingLuck === '吉' && bazhaiInfo.houseLuck === '凶') {
        roomSuitability = `人吉宅凶（命${bazhaiInfo.mingLabel}/宅${bazhaiInfo.houseLabel}），宜作个人床头、书桌朝向，不宜作全宅总门纳气。`;
      } else if (bazhaiInfo.mingLuck === '凶' && bazhaiInfo.houseLuck === '吉') {
        roomSuitability = `宅吉人凶（宅${bazhaiInfo.houseLabel}/命${bazhaiInfo.mingLabel}），宜作外局客厅、入户动线，避作本人长期卧室。`;
      } else {
        roomSuitability = `人宅均临凶星（${bazhaiInfo.mingLabel}/${bazhaiInfo.houseLabel}），宜作卫浴、杂物间或次要通道镇压静置。`;
      }
    }

    return {
      earth,
      palaceName: trigram === '中' ? '中宫' : `${trigram}宫`,
      direction,
      trigramSymbol: TRIGRAM_SYMBOLS[trigram] ?? '',
      familyRole: profileMeta?.familyRole ?? '太极中心',
      bodyParts: profileMeta?.bodyParts ?? '整体气脉枢纽',
      ...(bazhaiInfo ? { bazhai: bazhaiInfo } : {}),
      ...(xkInfo ? { xuankong: xkInfo } : {}),
      statusTone,
      roomSuitability,
    };
  });

  const residentAnalyses: ResidentAnalysis[] = profile.residents.map((member) => {
    const candidates = birthYearCandidates({
      year: member.birthYear,
      ...(member.birthMonth && member.birthDay
        ? { month: member.birthMonth, day: member.birthDay, timezone: 8 }
        : {}),
    });
    const guas = candidates.years.map((y) => mingGuaForYear(y, member.gender));
    const primaryGua = guas[guas.length - 1]!;
    const comp = compareMingHouse(primaryGua.gua, sitMountain);
    const palacesForMing = bazhaiPalaces(primaryGua.gua);
    const luckyDirections = palacesForMing
      .filter((p) => p.luck === '吉')
      .map((p) => ({ direction: p.direction, gua: p.gua, label: p.label }));
    const unluckyDirections = palacesForMing
      .filter((p) => p.luck === '凶')
      .map((p) => ({ direction: p.direction, gua: p.gua, label: p.label }));

    const findDir = (lbl: string) =>
      luckyDirections.find((d) => d.label === lbl)?.direction ?? luckyDirections[0]?.direction ?? '—';

    const bestDoorDir =
      comp.match === '同组'
        ? `${findDir('生气')} / ${findDir('延年')}`
        : `外局顺宅(${comp.directions.filter((d) => d.houseLuck === '吉').slice(0, 2).map((d) => d.direction).join('、')})`;
    const bestSleepDir = `${findDir('延年')} / ${findDir('天医')}`;
    const bestStudyDir = `${findDir('生气')} / ${findDir('伏位')}`;

    const layeredAdvice =
      comp.match === '同组'
        ? `与${houseGua}宅同属${primaryGua.group}，人宅相生相合；卧室床头宜朝${findDir('延年')}或${findDir('天医')}，书桌办公宜向${findDir('生气')}。`
        : `命卦(${primaryGua.group})与${houseGua}宅(${houseGroup})异组；按“外事从宅、内事从命”法，大门客厅顺宅吉方，个人卧室及床头/书桌优先取命卦${findDir('延年')}、${findDir('生气')}。`;

    return {
      member,
      isPrimary: member.id === primaryResident.id,
      mingGua: primaryGua.gua,
      mingGroup: primaryGua.group,
      birthBoundaryStatus: candidates.status,
      candidateYears: candidates.years,
      candidateGuas: [...new Set(guas.map((g) => g.gua))],
      matchWithHouse: comp.match,
      luckyDirections,
      unluckyDirections,
      bestSleepDir,
      bestStudyDir,
      bestDoorDir,
      layeredAdvice,
    };
  });

  const cgCandidates = xkChart?.castleGate.candidates ?? [];
  const castleGateSummary =
    cgCandidates.length > 0
      ? cgCandidates
          .map((c) => `${c.role}${c.mountain}（${c.gongName}宫·${c.status}）`)
          .join('；')
      : '暂无';

  return {
    sitMountain,
    facingMountain,
    houseGua,
    houseGroup,
    ...(measurementInfo ? { correctedDegree: measurementInfo.correctedDegree } : {}),
    stabilityText: measurementInfo?.stability ?? '坐山已定',
    measurementWarnings: measurementInfo?.warnings ?? [],
    yun,
    yuan,
    periodRange,
    effectiveMode,
    formation: xkChart?.formation ?? '—',
    shanToMountain: Boolean(xkChart?.arrival.shanToMountain),
    xiangToFacing: Boolean(xkChart?.arrival.xiangToFacing),
    zhengLing: ZHENG_LING_TABLE[yun] ?? ZHENG_LING_TABLE[9]!,
    castleGateSummary,
    combinations: xkChart?.combinations ?? [],
    fallbackNotice,
    moveInCycleNotice: (() => {
      if (!profile.moveInYear) return null;
      const buildYun = Math.floor((construction.year - 1864) / 20);
      const moveYun = Math.floor((profile.moveInYear - 1864) / 20);
      if (moveYun > buildYun) {
        return `该房建于 ${construction.year} 年、于 ${profile.moveInYear} 年入住或翻新（跨入新周期），整体主结构仍以建成年份为主，同时兼顾新周期运势变化。`;
      }
      return null;
    })(),
    palaces,
    residentAnalyses,
    agreements: resData.agreements,
    advice: resData.advice,
    residentialPayload,
    rawResidentialResult: resResult,
  };
}

const BRANCH_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const BRANCH_TO_PLACE: Record<string, { direction: string; trigram: string; earth: number }> = {
  子: { direction: '北', trigram: '坎', earth: 1 },
  丑: { direction: '东北', trigram: '艮', earth: 8 },
  寅: { direction: '东北', trigram: '艮', earth: 8 },
  卯: { direction: '东', trigram: '震', earth: 3 },
  辰: { direction: '东南', trigram: '巽', earth: 4 },
  巳: { direction: '东南', trigram: '巽', earth: 4 },
  午: { direction: '南', trigram: '离', earth: 9 },
  未: { direction: '西南', trigram: '坤', earth: 2 },
  申: { direction: '西南', trigram: '坤', earth: 2 },
  酉: { direction: '西', trigram: '兑', earth: 7 },
  戌: { direction: '西北', trigram: '乾', earth: 6 },
  亥: { direction: '西北', trigram: '乾', earth: 6 },
};

function resolveSanShaByBranch(branch: string) {
  if ('申子辰'.includes(branch)) {
    return { groupLabel: '申子辰年', direction: '南', mountains: '巳午未', earth: 9 };
  }
  if ('寅午戌'.includes(branch)) {
    return { groupLabel: '寅午戌年', direction: '北', mountains: '亥子丑', earth: 1 };
  }
  if ('巳酉丑'.includes(branch)) {
    return { groupLabel: '巳酉丑年', direction: '东', mountains: '寅卯辰', earth: 3 };
  }
  return { groupLabel: '亥卯未年', direction: '西', mountains: '申酉戌', earth: 7 };
}

const ANNUAL_STAR_EFFECT: Record<number, { tag: string; tone: 'good' | 'warn' | 'neutral'; avoidDigging: boolean }> = {
  1: { tag: '桃花人缘·远行', tone: 'good', avoidDigging: false },
  2: { tag: '二黑病符·宜静', tone: 'warn', avoidDigging: true },
  3: { tag: '三碧是非·防争', tone: 'warn', avoidDigging: false },
  4: { tag: '四绿文昌·学业', tone: 'good', avoidDigging: false },
  5: { tag: '五黄大煞·忌动土', tone: 'warn', avoidDigging: true },
  6: { tag: '六白武曲·贵人', tone: 'good', avoidDigging: false },
  7: { tag: '七赤破军·防破耗', tone: 'neutral', avoidDigging: false },
  8: { tag: '八白正财·置业', tone: 'good', avoidDigging: false },
  9: { tag: '九紫当运·喜庆旺财', tone: 'good', avoidDigging: false },
};

export function computeAnnualFengShuiSha(year: number): AnnualFengShuiSha {
  const safeYear = Math.min(2100, Math.max(1900, Math.round(year)));
  const ganZhi = getYearSixtyCycle(safeYear);
  const yearBranch = ganZhi[1]!;
  const branchIdx = BRANCH_LIST.indexOf(yearBranch as (typeof BRANCH_LIST)[number]);
  const oppBranch = BRANCH_LIST[(branchIdx + 6) % 12]!;

  const taiSuiPlace = BRANCH_TO_PLACE[yearBranch]!;
  const suiPoPlace = BRANCH_TO_PLACE[oppBranch]!;
  const sanSha = resolveSanShaByBranch(yearBranch);
  const yearStarRes = yearFlyingStar(safeYear);

  const annualPalaces = LUOSHU_GRID_ORDER.map((earth) => {
    const star = yearStarRes.plate[earth - 1]!;
    const meta = ANNUAL_STAR_EFFECT[star]!;
    const trigram = TRIGRAM_BY_EARTH[earth]!;
    return {
      earth,
      direction: LUOSHU_DIR_BY_EARTH[earth]!,
      palaceName: trigram === '中' ? '中宫' : `${trigram}宫`,
      star,
      starName: NINE_STAR_SHORT[star] ?? `${star}`,
      tag: meta.tag,
      tone: meta.tone,
      avoidDigging:
        meta.avoidDigging ||
        earth === taiSuiPlace.earth ||
        earth === suiPoPlace.earth ||
        earth === sanSha.earth,
    };
  });

  const monthlyPlates = Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    const mStar = monthFlyingStar(safeYear, month, 15);
    const fiveEarth = mStar.plate.indexOf(5) + 1;
    const twoEarth = mStar.plate.indexOf(2) + 1;
    const overlapAlerts: string[] = [];
    for (const earth of LUOSHU_GRID_ORDER) {
      const yStar = yearStarRes.plate[earth - 1]!;
      const moStar = mStar.plate[earth - 1]!;
      const dir = LUOSHU_DIR_BY_EARTH[earth]!;
      if (yStar === 5 && moStar === 5) overlapAlerts.push(`${dir}双五黄叠煞`);
      else if ((yStar === 5 && moStar === 2) || (yStar === 2 && moStar === 5)) {
        overlapAlerts.push(`${dir}五黄二黑叠临`);
      } else if (yStar === 2 && moStar === 2) {
        overlapAlerts.push(`${dir}双二黑病符`);
      }
    }
    return {
      month,
      monthBranch: mStar.monthBranch,
      centerStar: mStar.centerStar,
      starName: mStar.starName ?? `${mStar.centerStar}`,
      plate: mStar.plate,
      fiveEarth,
      twoEarth,
      overlapAlerts,
    };
  });

  return {
    year: safeYear,
    ganZhi,
    yearBranch,
    taiSui: { branch: yearBranch, ...taiSuiPlace },
    suiPo: { branch: oppBranch, ...suiPoPlace },
    sanSha,
    annualCenterStar: yearStarRes.centerStar,
    annualPlate: yearStarRes.plate,
    annualPalaces,
    monthlyPlates,
  };
}

function bearingToEightDirection(bearing: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] as const;
  const idx = Math.floor(((((bearing + 22.5) % 360) + 360) % 360) / 45);
  return dirs[idx]!;
}

function diagnoseMarkerInPalace(
  kind: FloorMarkerKind,
  palace: PalaceViewModel,
  isCenter: boolean,
): { status: '宜' | '平' | '慎'; summary: string } {
  if (isCenter) {
    if (kind === 'bath' || kind === 'kitchen') {
      return { status: '慎', summary: '落在太极中宫，厨卫压中易浊气心腹，建议移位或加强排风整洁。' };
    }
    if (kind === 'living') {
      return { status: '宜', summary: '客厅中堂居中聚气，宜保持开阔明亮、动线顺畅。' };
    }
    return { status: '平', summary: '位于中宫核心，宜保持通透整洁，忌重物遮挡。' };
  }

  const bz = palace.bazhai;
  const xk = palace.xuankong;
  const mingGood = bz ? BAZHAI_LUCKY_SET.has(bz.mingLabel) : false;
  const houseGood = bz ? BAZHAI_LUCKY_SET.has(bz.houseLabel) : false;
  const hasSha = Boolean(xk && (xk.hasFiveSha || xk.hasTwoSha || xk.doubleStarKind === 'bad'));
  const hasGoodStar = Boolean(
    xk && (isGoodStarTime(xk.mountainTimeliness) || isGoodStarTime(xk.waterTimeliness)),
  );

  switch (kind) {
    case 'door':
      if (hasSha) {
        return {
          status: '慎',
          summary: `大门纳气落${palace.direction}（${bz?.houseLabel ?? ''}），逢玄空${xk?.hasFiveSha ? '五黄' : xk?.hasTwoSha ? '二黑' : '凶星'}，门垫宜用白/灰色或置金属铜器化泄。`,
        };
      }
      if (houseGood || hasGoodStar) {
        return {
          status: '宜',
          summary: `大门落${palace.direction}${palace.palaceName}，${houseGood ? `宅卦${bz?.houseLabel}吉方` : ''}${hasGoodStar ? '当令旺气纳气' : ''}，宜保持玄关明亮通风。`,
        };
      }
      return { status: '平', summary: `大门落${palace.direction}（宅${bz?.houseLabel ?? '—'}），宜设玄关屏风缓冲直冲。` };

    case 'masterBed':
      if (hasSha) {
        return {
          status: '慎',
          summary: `主卧落${palace.direction}逢五黄/二黑或凶星组合，若难以换房，宜少用红黄色饰品并加金属元素静泄。`,
        };
      }
      if (mingGood) {
        return {
          status: '宜',
          summary: `落宅主命卦${bz?.mingLabel}吉方，利安神休养与人际感情，床头靠实墙更佳。`,
        };
      }
      return {
        status: '慎',
        summary: `落命卦${bz?.mingLabel ?? '—'}凶方，建议调整床头朝向宅主延年/天医吉方，或改作客卧/储物。`,
      };

    case 'kitchen':
      if (houseGood && mingGood) {
        return {
          status: '平',
          summary: `灶位在${palace.direction}吉方，传统八宅讲究“坐凶向吉”，可让灶台操作面朝向生气或天医方。`,
        };
      }
      if (xk?.doubleStarKind === 'bad' && (xk.mountainStar === 7 || xk.waterStar === 7 || xk.mountainStar === 9 || xk.waterStar === 9)) {
        return {
          status: '慎',
          summary: `灶位逢火金煞气宫位，注意厨房油烟散热与电器用火安全。`,
        };
      }
      return {
        status: '宜',
        summary: `灶位在${palace.direction}（${bz?.houseLabel ?? ''}），符合压凶借火之势，灶口朝吉方更稳妥。`,
      };

    case 'study':
      if (xk?.doubleStarNote?.includes('文昌') || mingGood || hasGoodStar) {
        return {
          status: '宜',
          summary: `落${palace.direction}${xk?.doubleStarNote?.includes('文昌') ? '文昌位' : bz?.mingLabel ?? ''}，适合伏案办公与学业专注。`,
        };
      }
      return {
        status: hasSha ? '慎' : '平',
        summary: hasSha
          ? `受流转煞气干扰，建议书桌避开正冲并保持桌面整洁。`
          : `常规可用，可将座椅调整至背靠实墙、面向命卦吉方。`,
      };

    case 'bath':
      if (!mingGood || !houseGood) {
        return {
          status: '宜',
          summary: `卫生间落${palace.direction}（${bz?.mingLabel ?? ''}/${bz?.houseLabel ?? ''}），合“凶方宜压”原则，重在干燥除味。`,
        };
      }
      return {
        status: '慎',
        summary: `卫生间压在${palace.direction}吉位，务必做好干湿分离、常开排风并随手关门。`,
      };

    case 'living':
      if (hasSha) {
        return {
          status: '慎',
          summary: `客厅落${palace.direction}逢煞星叠临，宜减少强声光电刺激与大修动，多用素雅金属配饰。`,
        };
      }
      return {
        status: houseGood || hasGoodStar ? '宜' : '平',
        summary: `客厅在${palace.direction}${palace.palaceName}，${houseGood ? `顺宅${bz?.houseLabel}` : '宜维持动线流畅与采光'}。`,
      };
  }
}

export function evaluateFloorPlanMarkers(
  profile: HouseProfile,
  snapshot: WorkbenchSnapshot,
): FloorMarkerDiagnosis[] {
  const fp = profile.floorPlan;
  if (fp.topDirection === 'unknown') {
    return fp.markers.map((marker) => ({
      marker,
      kindLabel: FLOOR_MARKER_META.find((k) => k.kind === marker.kind)?.label ?? marker.label,
      direction: '待定',
      mountain: '—',
      trigram: '—',
      bearing: null,
      status: '平',
      summary: '请先在右侧选择「图纸上方朝向」以精确识别落宫方位。',
    }));
  }

  const dirOpt = PLAN_DIRECTION_OPTIONS.find((d) => d.value === fp.topDirection);
  const compassRotation = (dirOpt?.rotation ?? 0) + fp.fineAngle;
  const imgW = fp.imageWidth > 0 ? fp.imageWidth : 1000;
  const imgH = fp.imageHeight > 0 ? fp.imageHeight : 1000;
  const compassRadiusPx = (Math.min(imgW, imgH) * fp.compassSize) / 200;

  return fp.markers.map((marker) => {
    const kindLabel = FLOOR_MARKER_META.find((k) => k.kind === marker.kind)?.label ?? marker.label;
    const dxPx = ((marker.x - fp.compassCenterX) / 100) * imgW;
    const dyPx = ((marker.y - fp.compassCenterY) / 100) * imgH;
    const distPx = Math.hypot(dxPx, dyPx);

    const isCenter = distPx <= Math.max(12, compassRadiusPx * 0.16);
    if (isCenter) {
      const centerPalace = snapshot.palaces.find((p) => p.earth === 5)!;
      const diag = diagnoseMarkerInPalace(marker.kind, centerPalace, true);
      return {
        marker,
        kindLabel,
        direction: '中宫',
        mountain: '中',
        trigram: '中',
        bearing: null,
        ...diag,
      };
    }

    const screenAngleFromUp = (Math.atan2(dxPx, -dyPx) * 180) / Math.PI;
    const bearing = (((screenAngleFromUp - compassRotation) % 360) + 360) % 360;
    const mountainInfo = mountainAt(bearing);
    const mountain = mountainInfo.mountain!;
    const trigram = mountainTrigram(mountain)!;
    const direction = bearingToEightDirection(bearing);
    const earth = DIR_TO_EARTH[direction] ?? 5;
    const palace = snapshot.palaces.find((p) => p.earth === earth) ?? snapshot.palaces[4]!;
    const diag = diagnoseMarkerInPalace(marker.kind, palace, false);

    return {
      marker,
      kindLabel,
      direction,
      mountain,
      trigram,
      bearing: Math.round(bearing * 10) / 10,
      ...diag,
    };
  });
}

export function buildComprehensiveFengShuiPrompt(
  profile: HouseProfile,
  snapshot: WorkbenchSnapshot,
  annualSha: AnnualFengShuiSha,
  markerReports: FloorMarkerDiagnosis[],
): string {
  const fp = profile.floorPlan;
  const topDirLabel =
    PLAN_DIRECTION_OPTIONS.find((d) => d.value === fp.topDirection)?.label ?? '未定';

  const residentLines = snapshot.residentAnalyses.map(
    (r) =>
      `- ${r.member.name}（${r.member.birthYear}年${r.member.gender === 'female' ? '女' : '男'}${r.isPrimary ? '·主宅主' : ''}）：命卦 ${r.mingGua}（${r.mingGroup}），与本宅${r.matchWithHouse}；四吉方 ${r.luckyDirections.map((d) => `${d.direction}${d.label}`).join('、')}；${r.layeredAdvice}`,
  );

  const markerLines = markerReports.map(
    (m) =>
      `- ${m.kindLabel}${m.marker.label !== m.kindLabel ? `（${m.marker.label}）` : ''}：落${m.direction}${m.mountain !== '中' ? `（${m.mountain}山·${m.trigram}宫·${m.bearing ?? 0}°）` : ''} → ［${m.status}］${m.summary}`,
  );

  const roomReports = evaluateRoomPlacements(profile.roomPlacements, snapshot);
  const roomLines = roomReports.map(
    (r) => `- ${r.kindLabel}（${r.direction}）：［${r.status}］${r.summary}`,
  );

  const basePrompt = snapshot.rawResidentialResult.prompt?.text ?? '';

  return [
    '你是一名严谨务实的住宅空间与传统阳宅风水顾问。请结合以下多维盘面资料（及可能附带的带标注户型图），给出清晰可执行的家居诊断与调整建议。',
    '',
    '【房源概况与坐向校准】',
    `- 住宅方案：${profile.name}${profile.location ? ` · ${profile.location}` : ''}${profile.floor ? ` · ${profile.floor}` : ''}（建于 ${profile.constructionYear} 年${profile.moveInYear ? `，${profile.moveInYear} 年入住/翻新` : ''}）`,
    `- 坐向盘局：坐${snapshot.sitMountain}向${snapshot.facingMountain}（${snapshot.houseGua}宅·${snapshot.houseGroup}），${snapshot.yuan}${snapshot.yun}运（${snapshot.periodRange}），${snapshot.effectiveMode}，格局「${snapshot.formation}」`,
    `- 城门与水神：正神${snapshot.zhengLing.zheng}｜零神${snapshot.zhengLing.ling}｜城门 ${snapshot.castleGateSummary}`,
    ...(fp.imageWidth > 0
      ? [
          `- 户型图罗盘校准：上方朝向「${topDirLabel}」，微调 ${fp.fineAngle}°，太极点(${fp.compassCenterX.toFixed(1)}%, ${fp.compassCenterY.toFixed(1)}%)`,
        ]
      : []),
    '',
    '【全家居住人命宅对照】',
    ...residentLines,
    ...(roomLines.length > 0 ? ['', '【房间实际方位诊断】', ...roomLines] : []),
    '',
    `【${annualSha.year}（${annualSha.ganZhi}）年流年神煞】`,
    `- 太岁方：${annualSha.taiSui.direction}（${annualSha.taiSui.branch}）｜岁破方：${annualSha.suiPo.direction}（${annualSha.suiPo.branch}）｜三煞方：${annualSha.sanSha.direction}（${annualSha.sanSha.mountains}）`,
    `- 流年五黄：${annualSha.annualPalaces.find((p) => p.star === 5)?.direction ?? '—'}｜流年二黑：${annualSha.annualPalaces.find((p) => p.star === 2)?.direction ?? '—'}｜四绿文昌：${annualSha.annualPalaces.find((p) => p.star === 4)?.direction ?? '—'}｜九紫喜庆：${annualSha.annualPalaces.find((p) => p.star === 9)?.direction ?? '—'}`,
    ...(markerLines.length > 0 ? ['', '【户型图实景功能标点诊断】', ...markerLines] : []),
    '',
    '【底层合参计算明细】',
    basePrompt,
    '',
    '【回答要求】',
    '1. 用大白话先总结房子整体气场、人宅匹配与当前流年重点。',
    '2. 逐一核对大门、主卧、灶台、书房、卫生间的实际落位或家人分房建议。',
    '3. 按「立即优先调整 / 低成本微调 / 无需改动」给出具体行动方案。',
  ].join('\n');
}

export interface RoomPlacementDiagnosis {
  kind: FloorMarkerKind;
  kindLabel: string;
  direction: string;
  status: '宜' | '平' | '慎';
  summary: string;
}

export function evaluateRoomPlacements(
  roomPlacements: HouseProfile['roomPlacements'],
  snapshot: WorkbenchSnapshot,
): RoomPlacementDiagnosis[] {
  const results: RoomPlacementDiagnosis[] = [];
  for (const meta of FLOOR_MARKER_META) {
    const dir = roomPlacements?.[meta.kind];
    if (!dir) continue;
    const isCenter = dir === '中';
    const palace = isCenter
      ? snapshot.palaces.find((p) => p.earth === 5)!
      : snapshot.palaces.find((p) => p.direction === dir);
    if (!palace) continue;
    const diag = diagnoseMarkerInPalace(meta.kind, palace, isCenter);
    results.push({
      kind: meta.kind,
      kindLabel: meta.label,
      direction: isCenter ? '房子中心' : dir,
      ...diag,
    });
  }
  return results;
}

export const BAZHAI_PLAIN_LABEL: Record<string, string> = {
  生气: '大吉 · 旺财事业',
  延年: '上吉 · 感情和睦',
  天医: '次吉 · 健康贵人',
  伏位: '小吉 · 安稳静思',
  绝命: '大凶 · 宜作卫浴储物',
  五鬼: '次凶 · 忌卧室宜静置',
  六煞: '次凶 · 宜设卫浴排水',
  祸害: '小凶 · 宜作通道杂物',
};

const BAZHAI_SHORT_TAG: Record<string, string> = {
  生气: '大吉·旺财',
  延年: '上吉·和睦',
  天医: '次吉·康健',
  伏位: '小吉·安稳',
  绝命: '宜静·避卧',
  五鬼: '宜静·少动',
  六煞: '宜作卫浴',
  祸害: '宜作通道',
};

export interface PlainPalaceCard {
  earth: number;
  direction: string;
  shortTag: string;
  tone: 'good' | 'warn' | 'neutral';
  avoidDigging: boolean;
  plainTip: string;
}

export interface PlainLayoutSummary {
  directionLabel: string;
  isMatch: boolean;
  headline: string;
  bedroomDirs: string;
  bedroomTip: string;
  studyDirs: string;
  studyTip: string;
  doorDirs: string;
  doorTip: string;
  avoidDirs: string;
  avoidTip: string;
  palacePlainCards: PlainPalaceCard[];
}

export function buildPlainLayoutSummary(
  snapshot: WorkbenchSnapshot,
  annualSha: AnnualFengShuiSha,
): PlainLayoutSummary {
  const directionLabel = getSimpleDirectionLabel(snapshot.sitMountain);
  const primary = snapshot.residentAnalyses[0];
  const isMatch = primary ? primary.matchWithHouse === '同组' : true;

  const headline = primary
    ? isMatch
      ? `人宅合拍 · 这套${directionLabel}的房子很适合${primary.member.name}居住`
      : `人宅错位可调 · 大门客厅顺房子吉位，${primary.member.name}的卧室床头按个人吉位摆即可`
    : `${directionLabel}住宅方位分布已生成`;

  const avoidDigSet = new Set(
    annualSha.annualPalaces.filter((p) => p.avoidDigging).map((p) => p.earth),
  );

  const bedroomDirs = primary ? primary.bestSleepDir : '东南、正东';
  const studyDirs = primary ? primary.bestStudyDir : '正东、正北';
  const doorDirs = primary ? primary.bestDoorDir : '正南、正东';

  const houseBadDirs = snapshot.palaces
    .filter((p) => p.earth !== 5 && p.bazhai?.houseLuck === '凶')
    .slice(0, 3)
    .map((p) => p.direction);
  const annualFive = annualSha.annualPalaces.find((p) => p.star === 5)?.direction;
  const avoidDirs = houseBadDirs.length ? houseBadDirs.join('、') : '参考避坑方';

  const palacePlainCards: PlainPalaceCard[] = snapshot.palaces.map((p) => {
    const avoidDigging = avoidDigSet.has(p.earth);
    if (p.earth === 5) {
      return {
        earth: 5,
        direction: '房子中心',
        shortTag: '保持通透整洁',
        tone: 'neutral',
        avoidDigging,
        plainTip: '房子正中心宜留空亮堂，别堆杂物或设卫生间。',
      };
    }

    const mingLabel = p.bazhai?.mingLabel ?? '';
    const houseLabel = p.bazhai?.houseLabel ?? '';
    const mingGood = p.bazhai?.mingLuck === '吉';
    const houseGood = p.bazhai?.houseLuck === '吉';
    const hasFiveOrTwo = Boolean(p.xuankong?.hasFiveSha || p.xuankong?.hasTwoSha);

    let shortTag = BAZHAI_SHORT_TAG[mingLabel] ?? '平顺常规';
    let tone: 'good' | 'warn' | 'neutral' = mingGood ? 'good' : 'warn';
    if (hasFiveOrTwo && mingGood) {
      shortTag = '吉位·忌大动';
      tone = 'neutral';
    } else if (avoidDigging && !mingGood) {
      shortTag = `${annualSha.year}忌动土`;
      tone = 'warn';
    }

    let plainTip = '';
    if (mingGood && houseGood) {
      plainTip = `${p.direction}方人宅都旺（${BAZHAI_PLAIN_LABEL[mingLabel] ?? '吉利'}），优先做主卧、客厅、书房或入户区。`;
    } else if (mingGood && !houseGood) {
      plainTip = `${p.direction}方对宅主个人很有利，最适合放床头或书桌，不建议当全家人出入的主大门。`;
    } else if (!mingGood && houseGood) {
      plainTip = `${p.direction}方适合做入户门厅或公共客厅，但宅主本人尽量别把卧室选在这里。`;
    } else {
      plainTip = `${p.direction}方属于${BAZHAI_PLAIN_LABEL[mingLabel] ?? '次要方位'}，做卫生间、储物间或过道最合适。`;
    }

    if (hasFiveOrTwo || avoidDigging) {
      plainTip += ` ${annualSha.year}年此处不宜敲墙动土，保持整洁少大改动。`;
    }

    return {
      earth: p.earth,
      direction: p.direction,
      shortTag,
      tone,
      avoidDigging,
      plainTip,
    };
  });

  return {
    directionLabel,
    isMatch,
    headline,
    bedroomDirs,
    bedroomTip: `主卧尽量选在${bedroomDirs.split(' / ')[0]}方，睡床床头也朝这个方向更好。`,
    studyDirs,
    studyTip: `书桌、电脑桌或招财绿植优先放在${studyDirs.split(' / ')[0]}方。`,
    doorDirs,
    doorTip: isMatch
      ? `大门、阳台或客厅采光位落在${doorDirs.split(' / ')[0]}方最聚气。`
      : `入户大门、客厅按房子自身吉位（${doorDirs.replace('外局顺宅(', '').replace(')', '')}）纳气更稳。`,
    avoidDirs,
    avoidTip: `卫生间、储物间适合放在${avoidDirs}${annualFive ? `；${annualSha.year}年「${annualFive}」忌装修动土` : ''}。`,
    palacePlainCards,
  };
}

