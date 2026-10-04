/**
 * @file 住宅风水（八宅 + 玄空飞星 一站式）
 * @description 产品入口收敛为“住宅风水”；算法仍分层计算八宅与玄空，再合成统一结果与提示词。
 * @传统依据 八宅参照《八宅明镜》《阳宅十书》；玄空参照三元九运、下卦山向飞布等通行口径。
 * 不生成综合吉凶总分，不把两套体系互相改写。
 */

import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  analyzeBaZhaiBySitDegree,
  type BaZhaiInput,
  type BaZhaiDoorDegreeResult,
  type BaZhaiResult,
} from '../ba_zhai';
import {
  generateXuanKong,
  resolveXuanKongOrientation,
  type XuanKongGuaType,
  type XuanKongInput,
  type XuanKongResult,
} from '../xuan_kong';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export interface ResidentialFengshuiInput {
  /** 建造年或起运年；排玄空宅运盘时必需 */
  year?: number;
  /** 出生公历年，用于八宅命卦 */
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  birthHour?: number;
  birthMinute?: number;
  birthSecond?: number;
  birthTimezone?: number;
  birthTimeZoneId?: string;
  gender?: 'male' | 'female';
  mingGua?: string;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  /** 默认下卦；仅在已核定兼向时显式传入替卦。 */
  guaType?: XuanKongGuaType;
  /** 八宅门向测量：站在大门处面向屋内 */
  doorToInteriorDegree?: number;
  northReference?: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
  flowYear?: number;
  flowMonth?: number;
  flowDay?: number;
}

export interface ResidentialFengshuiAgreement {
  level: '一致关注' | '可互补' | '资料不足' | '口径不同需分述';
  title: string;
  detail: string;
}

export interface ResidentialFengshuiResult {
  key: 'residential-fengshui';
  label: '住宅风水';
  inputSummary: {
    hasPerson: boolean;
    hasHouseOrientation: boolean;
    /** 度数读数未声明北向基准时，宅卦与宅运按原始读数暂列。 */
    northReferenceUnspecified?: boolean;
    houseYear: number | null;
    orientationText: string;
    xuankongStatus: '已排盘' | '缺少山向' | '缺少建造年或起运年';
  };
  bazhai: BaZhaiResult | BaZhaiDoorDegreeResult | null;
  xuankong: XuanKongResult | null;
  agreements: ResidentialFengshuiAgreement[];
  advice: string[];
  prompt: string;
  evidencePromptText: string;
}

function normalizeDegree(value: number) {
  return ((value % 360) + 360) % 360;
}

function resolveDoorNorth(input: ResidentialFengshuiInput): number {
  if (
    typeof input.doorToInteriorDegree !== 'number' ||
    !Number.isFinite(input.doorToInteriorDegree) ||
    input.doorToInteriorDegree < 0 ||
    input.doorToInteriorDegree > 360
  ) {
    throw new Error('大门朝向屋内的度数必须是 0-360 之间的有限数字。');
  }
  const reference = input.northReference ?? 'unspecified';
  if (!['unspecified', 'magnetic', 'true'].includes(reference)) {
    throw new Error('northReference 只能是 unspecified、magnetic 或 true。');
  }
  const declination = input.magneticDeclinationDegrees;
  if (
    declination !== undefined &&
    (!Number.isFinite(declination) || declination < -30 || declination > 30)
  ) {
    throw new Error('磁偏角必须是 -30 至 30 之间的有限数字，东偏为正、西偏为负。');
  }
  if (reference === 'magnetic' && declination === undefined) {
    throw new Error('读数采用磁北时必须提供当地磁偏角。');
  }
  if (reference !== 'magnetic' && declination !== undefined) {
    throw new Error('只有 northReference 为 magnetic 时才应提供磁偏角。');
  }
  return normalizeDegree(
    input.doorToInteriorDegree + (reference === 'magnetic' ? declination! : 0),
  );
}

function hasPersonInput(input: ResidentialFengshuiInput) {
  return input.mingGua !== undefined || Boolean(input.birthYear != null && input.gender);
}

function hasOrientationInput(input: ResidentialFengshuiInput) {
  return (
    input.sitMountain != null ||
    input.facingMountain != null ||
    input.facingDegree != null ||
    input.sitDegree != null ||
    input.doorToInteriorDegree != null
  );
}

function hasDegreeMeasurement(input: ResidentialFengshuiInput) {
  return (
    input.doorToInteriorDegree !== undefined ||
    input.sitDegree !== undefined ||
    input.facingDegree !== undefined
  );
}

type ResidentialOrientation = ReturnType<typeof resolveXuanKongOrientation>;

function resolveResidentialOrientation(
  input: ResidentialFengshuiInput,
): ResidentialOrientation | undefined {
  if (!hasOrientationInput(input)) return undefined;
  const toTrueNorth = (degree: number) =>
    resolveDoorNorth({ ...input, doorToInteriorDegree: degree });
  let sitDegree = input.sitDegree === undefined ? undefined : toTrueNorth(input.sitDegree);
  const facingDegree =
    input.facingDegree === undefined ? undefined : toTrueNorth(input.facingDegree);
  if (input.doorToInteriorDegree !== undefined) {
    const doorSitDegree = resolveDoorNorth(input);
    if (
      sitDegree !== undefined &&
      Math.min(Math.abs(sitDegree - doorSitDegree), 360 - Math.abs(sitDegree - doorSitDegree)) >
        1e-10
    ) {
      throw new Error('门向换算的坐山度数与提供的坐山度数不一致。');
    }
    sitDegree = doorSitDegree;
  }
  return resolveXuanKongOrientation({
    sitDegree,
    facingDegree,
    sitMountain: input.sitMountain,
    facingMountain: input.facingMountain,
    measurementUncertaintyDegrees: input.measurementUncertaintyDegrees,
  });
}

function buildBazhai(
  input: ResidentialFengshuiInput,
  orientation?: ResidentialOrientation,
): BaZhaiResult | BaZhaiDoorDegreeResult | null {
  if (!hasPersonInput(input)) return null;
  const base: BaZhaiInput = {
    ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
    ...(input.birthMonth !== undefined ? { birthMonth: input.birthMonth } : {}),
    ...(input.birthDay !== undefined ? { birthDay: input.birthDay } : {}),
    ...(input.birthHour !== undefined ? { birthHour: input.birthHour } : {}),
    ...(input.birthMinute !== undefined ? { birthMinute: input.birthMinute } : {}),
    ...(input.birthSecond !== undefined ? { birthSecond: input.birthSecond } : {}),
    ...(input.birthTimezone !== undefined ? { birthTimezone: input.birthTimezone } : {}),
    ...(input.birthTimeZoneId !== undefined ? { birthTimeZoneId: input.birthTimeZoneId } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.mingGua !== undefined ? { mingGua: input.mingGua } : {}),
  };
  const measurement = {
    northReference: input.northReference,
    magneticDeclinationDegrees: input.magneticDeclinationDegrees,
    measurementUncertaintyDegrees: input.measurementUncertaintyDegrees,
  };
  if (input.doorToInteriorDegree !== undefined) {
    return analyzeBaZhaiByDoorDegree({
      ...base,
      ...measurement,
      doorToInteriorDegree: input.doorToInteriorDegree,
    });
  }
  if (input.sitDegree !== undefined || input.facingDegree !== undefined) {
    return analyzeBaZhaiBySitDegree({
      ...base,
      ...measurement,
      sitDegree: input.sitDegree ?? normalizeDegree(input.facingDegree! + 180),
    });
  }
  return analyzeBaZhai({
    ...base,
    ...(orientation ? { sitMountain: orientation.sitMountain } : {}),
  });
}

function buildXuanKong(
  input: ResidentialFengshuiInput,
  orientation?: ResidentialOrientation,
): XuanKongResult | null {
  if (!orientation || input.year == null) return null;
  const xuanInput: XuanKongInput = {
    year: input.year,
    sitMountain: orientation.sitMountain,
    facingMountain: orientation.facingMountain,
    guaType: input.guaType,
    measurementUncertaintyDegrees: input.measurementUncertaintyDegrees,
    flowYear: input.flowYear,
    flowMonth: input.flowMonth,
    flowDay: input.flowDay,
    ...(orientation.measurement
      ? {
          sitDegree: orientation.measurement.sitDegree,
          facingDegree: orientation.measurement.facingDegree,
        }
      : {}),
  };
  return generateXuanKong(xuanInput);
}

function buildAgreements(
  bazhai: BaZhaiResult | BaZhaiDoorDegreeResult | null,
  xuankong: XuanKongResult | null,
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'],
  northReferenceUnspecified: boolean,
): ResidentialFengshuiAgreement[] {
  const items: ResidentialFengshuiAgreement[] = [];

  if (!bazhai && !xuankong) {
    return [
      {
        level: '资料不足',
        title: '缺少可用资料',
        detail: '至少提供山向或居住人出生信息之一，才能形成住宅风水结果。',
      },
    ];
  }

  if (bazhai && !xuankong) {
    items.push({
      level: '资料不足',
      title: '仅完成八宅人宅层',
      detail:
        xuankongStatus === '缺少建造年或起运年'
          ? '已有命卦与山向资料，但缺少住宅建造年或起运年，暂不排玄空宅运盘。'
          : '已有命卦方位，但缺少明确山向，暂不能排玄空宅运盘。',
    });
  }

  if (!bazhai && xuankong) {
    items.push({
      level: '资料不足',
      title: '仅完成玄空宅运层',
      detail: '已有山向与运盘，但未提供居住人出生年性别或命卦，暂不做八宅人宅适配。',
    });
  }

  if (bazhai && xuankong) {
    const xuankongBoundarySensitive = xuankong.measurement?.stability === '山向边界敏感';
    const mountainBoundarySensitive =
      xuankong.measurement?.boundaryReasons?.includes('二十四山分界') ?? false;
    const centralNineBoundarySensitive =
      xuankong.measurement?.boundaryReasons?.includes('中央九度分界') ?? false;
    const houseBoundarySensitive =
      'directionMeasurement' in bazhai && bazhai.directionMeasurement.stability === '宅卦不稳定';
    const periodLabel = `${xuankong.period.boundaryStatus ? '暂按' : ''}${xuankong.period.label}`;
    const candidateDirections =
      'directionMeasurement' in bazhai ? bazhai.directionMeasurement.candidateDirections : [];
    const candidateMatches = new Set(candidateDirections.map((item) => item.match));
    const matchChangesWithOrientation = candidateMatches.size > 1;
    items.push({
      level: '可互补',
      title: '宅运与人宅分层并观',
      detail: `玄空见${periodLabel}、${northReferenceUnspecified ? '按原始读数暂列的' : ''}${xuankong.daoShanXiang.summary}${xuankongBoundarySensitive ? '（中心读数盘，待复测核定）' : ''}；八宅${bazhai.birthYearBoundaryStatus === '待复核' ? '暂按' : ''}命卦${bazhai.mingGua}、${bazhai.birthYearBoundaryStatus === '待复核' || northReferenceUnspecified ? '暂按' : ''}${matchChangesWithOrientation ? `候选命宅关系${[...candidateMatches].join('或')}` : `命宅关系${bazhai.match}`}。宅运结构与人宅适配分层并列。`,
    });

    if (matchChangesWithOrientation) {
      items.push({
        level: '资料不足',
        title: '命宅关系随候选坐向变化',
        detail: `${northReferenceUnspecified ? '按原始读数暂列：' : ''}测量误差范围内，${candidateDirections.map((item) => `${item.label}命宅${item.match}`).join('、')}；需${northReferenceUnspecified ? '核定北向基准并' : ''}复测坐向后确定命宅关系。`,
      });
    } else if (
      bazhai.match === '相合' &&
      !xuankongBoundarySensitive &&
      !northReferenceUnspecified &&
      bazhai.birthYearBoundaryStatus !== '待复核'
    ) {
      items.push({
        level: '一致关注',
        title: '命宅相合可提高关注优先级',
        detail: '八宅显示命宅同组，与玄空中的山向、当运结构并列作为关注资料。',
      });
    } else if (
      bazhai.match === '相冲' &&
      !xuankongBoundarySensitive &&
      !northReferenceUnspecified &&
      bazhai.birthYearBoundaryStatus !== '待复核'
    ) {
      items.push({
        level: '口径不同需分述',
        title: '命宅不同组需分开说明',
        detail: '八宅显示命宅不同组，个人吉方与住宅山向结构分列。',
      });
    }

    if (xuankongBoundarySensitive || bazhai.match === '未知') {
      items.push({
        level: '资料不足',
        title:
          mountainBoundarySensitive && centralNineBoundarySensitive
            ? `候选山向${houseBoundarySensitive ? '、宅卦' : ''}与下卦替卦起法待核定`
            : mountainBoundarySensitive
              ? houseBoundarySensitive
                ? '山向与宅卦边界仍敏感'
                : '山向边界仍敏感'
              : '下卦与替卦起法待核定',
        detail:
          mountainBoundarySensitive && centralNineBoundarySensitive
            ? `测量误差范围内的候选山向${houseBoundarySensitive ? '与宅卦一并' : '已'}列出；同时触及中央九度分界，需复测后核定下卦或替卦起法。`
            : mountainBoundarySensitive
              ? houseBoundarySensitive
                ? '测量误差范围内的候选山向与宅卦一并列出。'
                : '测量误差范围内的候选山向已列出，宅卦仍属同一卦。'
              : '坐向触及中央九度分界，需复测后核定下卦或替卦起法。',
      });
    }
  }

  return items;
}

function buildAdvice(
  bazhai: BaZhaiResult | BaZhaiDoorDegreeResult | null,
  xuankong: XuanKongResult | null,
  agreements: ResidentialFengshuiAgreement[],
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'],
  northReferenceUnspecified: boolean,
): string[] {
  const advice: string[] = [];
  if (xuankong) {
    advice.push(
      `先看宅运：${xuankong.period.boundaryStatus ? '暂按' : ''}${xuankong.period.label}，坐${xuankong.sitMountain}向${xuankong.facingMountain}，${xuankong.guaType}，${xuankong.daoShanXiang.summary}${xuankong.measurement?.stability === '山向边界敏感' ? '（中心读数盘，待复测核定）' : ''}${northReferenceUnspecified ? '（坐向按原始读数暂列）' : ''}${xuankong.period.boundaryStatus ? '；需按建造或起运日期核定运期' : ''}。`,
    );
  }
  if (bazhai) {
    const candidateDirections =
      'directionMeasurement' in bazhai ? bazhai.directionMeasurement.candidateDirections : [];
    const candidateMatches = new Set(candidateDirections.map((item) => item.match));
    const matchText =
      candidateMatches.size > 1
        ? `候选坐向命宅关系${[...candidateMatches].join('或')}`
        : `命宅关系${bazhai.match}`;
    const lucky = bazhai.luckyDirections
      .slice(0, 4)
      .map((item) => `${item.direction}${item.label}`)
      .join('、');
    advice.push(
      `再看人宅：${bazhai.birthYearBoundaryStatus === '待复核' ? '暂按' : ''}命卦${bazhai.mingGua}（${bazhai.mingGroup}），${bazhai.birthYearBoundaryStatus === '待复核' || northReferenceUnspecified ? '暂按' : ''}${matchText}${
        lucky ? `；命卦较利方位可参考 ${lucky}` : ''
      }。`,
    );
    if (bazhai.birthYearBoundaryStatus === '待复核') {
      const birth = bazhai.calculationInput;
      advice.push(
        birth.birthMonth === undefined
          ? '补充出生月日后复核命卦与个人方位。'
          : birth.birthHour === undefined
            ? '补充出生时刻后复核命卦与个人方位。'
            : birth.birthMinute === undefined
              ? '补充出生分钟后复核命卦与个人方位。'
              : '补充出生秒数后复核命卦与个人方位。',
      );
    }
  }
  if (agreements.some((item) => item.level === '口径不同需分述')) {
    advice.push('两边有分歧时，分别保留宅运结构与个人方位依据，不硬统一成一个总分。');
  }
  if (northReferenceUnspecified) {
    advice.push(
      '请核定坐向读数的北向基准；若采用磁北，还需提供当地磁偏角，再复核宅卦、命宅关系与宅运盘。',
    );
  }
  if (agreements.some((item) => item.level === '资料不足')) {
    const mountainBoundarySensitive =
      xuankong?.measurement?.boundaryReasons?.includes('二十四山分界') ?? false;
    const centralNineBoundarySensitive =
      xuankong?.measurement?.boundaryReasons?.includes('中央九度分界') ?? false;
    const houseBoundarySensitive =
      bazhai &&
      'directionMeasurement' in bazhai &&
      bazhai.directionMeasurement.stability === '宅卦不稳定';
    advice.push(
      xuankongStatus === '缺少建造年或起运年'
        ? '请先补充住宅建造年或起运年，再排玄空宅运盘并讨论具体布局。'
        : bazhai && xuankong
          ? mountainBoundarySensitive && centralNineBoundarySensitive
            ? `请复测坐向，核定候选山向${houseBoundarySensitive ? '与宅卦' : ''}、下卦或替卦起法后再讨论具体布局。`
            : mountainBoundarySensitive
              ? houseBoundarySensitive
                ? '请复测坐向，核定候选山向与宅卦后再讨论具体布局。'
                : '请复测坐向，核定候选山向后再讨论具体布局。'
              : '请复测坐向，核定下卦或替卦起法后再讨论具体布局。'
          : '资料不足处先补山向或居住人信息，再做更细的布局讨论。',
    );
  }
  if (!advice.length) {
    advice.push('请补充山向或居住人信息后重新排盘。');
  }
  return advice;
}

function buildEvidencePrompt(params: {
  bazhai: BaZhaiResult | BaZhaiDoorDegreeResult | null;
  xuankong: XuanKongResult | null;
  agreements: ResidentialFengshuiAgreement[];
  advice: string[];
  northReferenceUnspecified: boolean;
}) {
  const items: PromptEvidenceItem[] = [];
  if (params.xuankong) {
    items.push({
      level: '主证',
      title: '玄空宅运层',
      detail: `${params.xuankong.period.boundaryStatus ? '暂按' : ''}${params.xuankong.period.label}；${params.northReferenceUnspecified ? '按原始读数暂列' : ''}坐${params.xuankong.sitMountain}向${params.xuankong.facingMountain}；${params.xuankong.guaType}；${params.xuankong.daoShanXiang.summary}${params.xuankong.measurement?.stability === '山向边界敏感' ? '（中心读数盘，待复测核定）' : ''}${params.xuankong.period.boundaryNote ? `；${params.xuankong.period.boundaryNote}` : ''}`,
      source: '玄空飞星 v1',
    });
  }
  if (params.northReferenceUnspecified) {
    items.push({
      level: '反证',
      title: '坐向北向基准未声明',
      detail: '坐向角度按原始读数暂排，尚未确认磁北或真北；补充北向基准后再核定住宅方向盘。',
      source: '住宅风水输入未声明北向基准',
    });
  }
  if (params.bazhai) {
    const candidateDirections =
      'directionMeasurement' in params.bazhai
        ? params.bazhai.directionMeasurement.candidateDirections
        : [];
    const candidateMatches = new Set(candidateDirections.map((item) => item.match));
    const candidateHouseGuas = [...new Set(candidateDirections.map((item) => item.houseGua))];
    const houseUnstable = candidateHouseGuas.length > 1;
    items.push({
      level: '主证',
      title: '八宅人宅层',
      detail: `${params.bazhai.birthYearBoundaryStatus === '待复核' ? '暂按' : ''}命卦${params.bazhai.mingGua}，${params.northReferenceUnspecified ? '暂按原始读数列' : ''}宅卦${params.bazhai.houseGua ?? '未定'}${houseUnstable ? `（中心读数；候选${candidateHouseGuas.map((gua) => `${gua}宅`).join('、')}）` : ''}，${params.bazhai.birthYearBoundaryStatus === '待复核' || params.northReferenceUnspecified ? '暂按' : ''}${candidateMatches.size > 1 ? `候选命宅关系${[...candidateMatches].join('或')}` : `命宅关系${params.bazhai.match}`}`,
      source: '八宅大游年',
    });
  }
  for (const item of params.agreements) {
    items.push({
      level: item.level === '资料不足' ? '反证' : item.level === '口径不同需分述' ? '限制' : '辅证',
      title: item.title,
      detail: item.detail,
      source: '住宅风水合参',
    });
  }
  const bundle: PromptEvidenceBundle = { title: '住宅风水证据', items };
  return formatPromptEvidenceBundle(bundle).join('\n');
}

function buildPrompt(result: {
  input: ResidentialFengshuiInput;
  orientationText: string;
  houseYear: number | null;
  bazhai: BaZhaiResult | BaZhaiDoorDegreeResult | null;
  xuankong: XuanKongResult | null;
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'];
  northReferenceUnspecified: boolean;
}) {
  const measurementInput = !result.bazhai && result.xuankong?.measurement ? result.input : null;
  const originalMeasurement = measurementInput
    ? [
        measurementInput.doorToInteriorDegree !== undefined
          ? `站在大门处面向屋内测量，读数${measurementInput.doorToInteriorDegree}°`
          : '',
        measurementInput.sitDegree !== undefined ? `坐山读数${measurementInput.sitDegree}°` : '',
        measurementInput.facingDegree !== undefined
          ? `朝向读数${measurementInput.facingDegree}°`
          : '',
      ]
        .filter(Boolean)
        .join('、')
    : '';
  const northBasis =
    measurementInput?.northReference === 'magnetic'
      ? `磁北，磁偏角${measurementInput.magneticDeclinationDegrees}°（东偏为正）；坐向角度已换算为真北`
      : measurementInput?.northReference === 'true'
        ? '真北'
        : '未声明，坐向按原始读数暂列，补充磁北或真北基准后复核';
  const readSection = (prompt: string, title: '盘面资料' | '传统依据') => {
    let section = '';
    return prompt
      .split('\n')
      .filter((line) => {
        const heading = line.trim().match(/^【(.+)】$/);
        if (heading) {
          section = heading[1];
          return false;
        }
        return section === title;
      })
      .join('\n')
      .trim();
  };
  const lines = [
    '【任务】',
    result.xuankong && result.bazhai
      ? '请依据以下玄空宅运盘与八宅人宅盘解读住宅方位，分别说明宅运结构与命宅配合，并结合实际山水和房屋布局核对。'
      : result.xuankong
        ? '请依据以下玄空宅运盘解读住宅方位，并结合实际山水和房屋布局核对。'
        : result.bazhai?.houseGua
          ? '请依据以下八宅命卦与宅卦资料解读居住人的方位适配及人宅配合。'
          : '请依据以下八宅命卦资料解读居住人的方位适配。',
    '【盘面资料】',
    originalMeasurement ? `原始测向：${originalMeasurement}，北向基准${northBasis}。` : '',
    result.northReferenceUnspecified && result.xuankong && !originalMeasurement
      ? '坐向北向基准未声明；玄空角度盘按原始读数暂排，补充磁北或真北基准后复核。'
      : '',
    result.xuankong ? '' : `山向：${result.orientationText}`,
    result.houseYear != null
      ? result.xuankong
        ? `宅运年份：${result.houseYear}`
        : `提供的住宅建造年或起运年：${result.houseYear}`
      : '',
    !result.xuankong && result.bazhai
      ? result.xuankongStatus === '缺少建造年或起运年'
        ? '玄空：未排盘（缺少建造年或起运年）'
        : '玄空：未排盘'
      : '',
    result.xuankong ? `玄空完整盘面：\n${readSection(result.xuankong.prompt, '盘面资料')}` : '',
    result.bazhai
      ? `八宅完整盘面：\n${readSection(result.bazhai.prompt, '盘面资料')
          .split('\n')
          .filter(
            (line) =>
              !result.northReferenceUnspecified ||
              !result.xuankong ||
              line !== '北向基准未声明；以下坐向按原始读数暂算，补充磁北或真北基准后复核。',
          )
          .join('\n')}`
      : '',
    '【传统依据】',
    result.xuankong ? readSection(result.xuankong.prompt, '传统依据') : '',
    result.bazhai ? readSection(result.bazhai.prompt, '传统依据') : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function generateResidentialFengshui(
  input: ResidentialFengshuiInput = {},
): ResidentialFengshuiResult {
  if (
    input.year !== undefined &&
    (!Number.isSafeInteger(input.year) || input.year < 1 || input.year > 9999)
  ) {
    throw new Error('住宅建造年或起运年需为 1-9999 之间的整数。');
  }
  const hasPersonFields = [
    input.birthYear,
    input.birthMonth,
    input.birthDay,
    input.birthHour,
    input.birthMinute,
    input.birthSecond,
    input.birthTimezone,
    input.birthTimeZoneId,
    input.gender,
    input.mingGua,
  ].some((value) => value !== undefined);
  if (hasPersonFields && !hasPersonInput(input)) {
    throw new Error('居住人资料需提供出生年与性别，或直接给定命卦。');
  }
  if (!hasPersonInput(input) && !hasOrientationInput(input)) {
    throw new Error('住宅风水至少需要提供山向，或居住人出生年与性别/命卦。');
  }
  if (hasOrientationInput(input) && input.year == null && !hasPersonInput(input)) {
    throw new Error('仅按山向排玄空宅运盘时，必须提供住宅建造年或起运年。');
  }

  const orientation = resolveResidentialOrientation(input);
  const bazhai = buildBazhai(input, orientation);
  const xuankong = buildXuanKong(input, orientation);
  const northReferenceUnspecified =
    hasDegreeMeasurement(input) && (input.northReference ?? 'unspecified') === 'unspecified';

  const xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'] = xuankong
    ? '已排盘'
    : hasOrientationInput(input)
      ? '缺少建造年或起运年'
      : '缺少山向';
  const agreements = buildAgreements(bazhai, xuankong, xuankongStatus, northReferenceUnspecified);
  const advice = buildAdvice(
    bazhai,
    xuankong,
    agreements,
    xuankongStatus,
    northReferenceUnspecified,
  );
  const houseYear = xuankong ? xuankong.period.year : (input.year ?? null);
  const orientationText = orientation
    ? `坐${orientation.sitMountain}向${orientation.facingMountain}`
    : '未提供山向';
  const evidencePromptText = buildEvidencePrompt({
    bazhai,
    xuankong,
    agreements,
    advice,
    northReferenceUnspecified,
  });
  const prompt = buildPrompt({
    input,
    orientationText,
    houseYear,
    bazhai,
    xuankong,
    xuankongStatus,
    northReferenceUnspecified,
  });

  return {
    key: 'residential-fengshui',
    label: '住宅风水',
    inputSummary: {
      hasPerson: Boolean(bazhai),
      hasHouseOrientation: Boolean(xuankong || bazhai?.houseGua),
      northReferenceUnspecified,
      houseYear,
      orientationText,
      xuankongStatus,
    },
    bazhai,
    xuankong,
    agreements,
    advice,
    prompt,
    evidencePromptText,
  };
}

export const residentialFengshui = {
  generateResidentialFengshui,
};
