/**
 * @file 住宅风水（八宅 + 玄空飞星 一站式）
 * @description 产品入口收敛为“住宅风水”；算法仍分层计算八宅与玄空，再合成统一结果与提示词。
 * @传统依据 八宅参照《八宅明镜》《阳宅十书》；玄空参照三元九运、下卦山向飞布等通行口径。
 * 不生成综合吉凶总分，不把两套体系互相改写。
 */

import {
  analyzeBaZhai,
  analyzeBaZhaiByDoorDegree,
  getBaZhaiSitFacingFromDoorDegree,
  type BaZhaiDoorDegreeInput,
  type BaZhaiInput,
  type BaZhaiResult,
} from '../ba_zhai';
import { generateXuanKong, type XuanKongInput, type XuanKongResult } from '../xuan_kong';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export interface ResidentialFengshuiInput {
  /** 建造年或起运年；排玄空宅运盘时必需 */
  year?: number;
  /** 出生公历年，用于八宅命卦 */
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  gender?: 'male' | 'female';
  mingGua?: string;
  sitMountain?: string;
  facingMountain?: string;
  facingDegree?: number;
  sitDegree?: number;
  /** 八宅门向测量：站在大门处面向屋内 */
  doorToInteriorDegree?: number;
  northReference?: 'unspecified' | 'magnetic' | 'true';
  magneticDeclinationDegrees?: number;
  measurementUncertaintyDegrees?: number;
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
    houseYear: number | null;
    orientationText: string;
    xuankongStatus: '已排盘' | '缺少山向' | '缺少建造年或起运年';
  };
  bazhai: BaZhaiResult | null;
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
  return Boolean(input.mingGua || (input.birthYear != null && input.gender));
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

function buildOrientationText(params: {
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  input: ResidentialFengshuiInput;
}) {
  if (params.xuankong) {
    return `坐${params.xuankong.sitMountain}向${params.xuankong.facingMountain}`;
  }
  const sit =
    params.input.sitMountain ||
    (params.bazhai as { directionMeasurement?: { sitMountain?: string } } | null)
      ?.directionMeasurement?.sitMountain;
  const facing =
    params.input.facingMountain ||
    (params.bazhai as { directionMeasurement?: { facingMountain?: string } } | null)
      ?.directionMeasurement?.facingMountain;
  if (sit && facing) return `坐${sit}向${facing}`;
  if (sit) return `坐${sit}`;
  if (params.input.doorToInteriorDegree != null) {
    return `门向度数 ${params.input.doorToInteriorDegree}°`;
  }
  if (params.input.facingDegree != null) return `朝向度数 ${params.input.facingDegree}°`;
  if (params.input.sitDegree != null) return `坐山度数 ${params.input.sitDegree}°`;
  return '未提供山向';
}

function buildBazhai(input: ResidentialFengshuiInput): BaZhaiResult | null {
  if (!hasPersonInput(input)) return null;

  const base: BaZhaiInput = {
    ...(input.birthYear != null ? { birthYear: input.birthYear } : {}),
    ...(input.birthMonth != null ? { birthMonth: input.birthMonth } : {}),
    ...(input.birthDay != null ? { birthDay: input.birthDay } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.mingGua ? { mingGua: input.mingGua } : {}),
  };

  if (input.doorToInteriorDegree != null) {
    const doorInput: BaZhaiDoorDegreeInput = {
      ...base,
      doorToInteriorDegree: input.doorToInteriorDegree,
      ...(input.northReference ? { northReference: input.northReference } : {}),
      ...(input.magneticDeclinationDegrees != null
        ? { magneticDeclinationDegrees: input.magneticDeclinationDegrees }
        : {}),
      ...(input.measurementUncertaintyDegrees != null
        ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
        : {}),
    };
    return analyzeBaZhaiByDoorDegree(doorInput);
  }

  const sitMountain =
    input.sitMountain ||
    (input.facingMountain ? undefined : (input as { sitMountain?: string }).sitMountain);

  // 若只给了朝向山名，则由玄空侧推坐山后，再回填八宅。
  if (sitMountain) {
    return analyzeBaZhai({ ...base, sitMountain });
  }

  // 无明确坐山时，仍可先算命卦盘。
  return analyzeBaZhai(base);
}

function buildXuanKong(
  input: ResidentialFengshuiInput,
  bazhai: BaZhaiResult | null,
): XuanKongResult | null {
  if (!hasOrientationInput(input) || input.year == null) return null;

  const measurement = (
    bazhai as {
      directionMeasurement?: {
        sitMountain?: string;
        facingMountain?: string;
        sitDegree?: number;
        facingDegree?: number;
      };
    } | null
  )?.directionMeasurement;

  const xuanInput: XuanKongInput = {
    year: input.year,
    ...(input.measurementUncertaintyDegrees != null
      ? { measurementUncertaintyDegrees: input.measurementUncertaintyDegrees }
      : {}),
  };

  if (input.sitDegree != null || input.facingDegree != null) {
    if (input.sitDegree != null) xuanInput.sitDegree = input.sitDegree;
    if (input.facingDegree != null) xuanInput.facingDegree = input.facingDegree;
  } else if (input.doorToInteriorDegree != null && measurement) {
    // 八宅门向量测：measuredDegree 是入户方向；玄空优先用其换算出的坐向。
    if (measurement.sitMountain) xuanInput.sitMountain = measurement.sitMountain;
    if (measurement.facingMountain) xuanInput.facingMountain = measurement.facingMountain;
  } else if (input.doorToInteriorDegree != null) {
    // 无居住人时仍可用门向起玄空宅运盘。
    const trueNorthDegree = resolveDoorNorth(input);
    const position = getBaZhaiSitFacingFromDoorDegree(trueNorthDegree);
    xuanInput.sitDegree = position.sit.degree;
    xuanInput.facingDegree = position.facing.degree;
    xuanInput.measurementUncertaintyDegrees = input.measurementUncertaintyDegrees ?? 0;
  } else if (input.sitMountain || input.facingMountain) {
    if (input.sitMountain) xuanInput.sitMountain = input.sitMountain;
    if (input.facingMountain) xuanInput.facingMountain = input.facingMountain;
  } else if (measurement?.sitMountain) {
    xuanInput.sitMountain = measurement.sitMountain;
    if (measurement.facingMountain) xuanInput.facingMountain = measurement.facingMountain;
  } else {
    return null;
  }

  return generateXuanKong(xuanInput);
}

function buildAgreements(
  bazhai: BaZhaiResult | null,
  xuankong: XuanKongResult | null,
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'],
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
    items.push({
      level: '可互补',
      title: '宅运与人宅分层并观',
      detail: `玄空见${xuankong.period.label}、${xuankong.daoShanXiang.summary}；八宅命卦${bazhai.mingGua}、命宅关系${bazhai.match}。宅运结构与人宅适配分层并列。`,
    });

    if (bazhai.match === '相合') {
      items.push({
        level: '一致关注',
        title: '命宅相合可提高关注优先级',
        detail: '八宅显示命宅同组，与玄空中的山向、当运结构并列作为关注资料。',
      });
    } else if (bazhai.match === '相冲') {
      items.push({
        level: '口径不同需分述',
        title: '命宅不同组需分开说明',
        detail: '八宅显示命宅不同组，个人吉方与住宅山向结构分列。',
      });
    }

    if (xuankong.measurement?.stability === '山向边界敏感' || bazhai.match === '未知') {
      items.push({
        level: '资料不足',
        title: '山向或宅卦边界仍敏感',
        detail: '测量误差范围内的候选山向与宅卦一并列出。',
      });
    }
  }

  return items;
}

function buildAdvice(
  bazhai: BaZhaiResult | null,
  xuankong: XuanKongResult | null,
  agreements: ResidentialFengshuiAgreement[],
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'],
): string[] {
  const advice: string[] = [];
  if (xuankong) {
    advice.push(
      `先看宅运：${xuankong.period.label}，坐${xuankong.sitMountain}向${xuankong.facingMountain}，${xuankong.daoShanXiang.summary}。`,
    );
  }
  if (bazhai) {
    const lucky = bazhai.luckyDirections
      .slice(0, 4)
      .map((item) => `${item.direction}${item.label}`)
      .join('、');
    advice.push(
      `再看人宅：命卦${bazhai.mingGua}（${bazhai.mingGroup}），命宅关系${bazhai.match}${
        lucky ? `；命卦较利方位可参考 ${lucky}` : ''
      }。`,
    );
  }
  if (agreements.some((item) => item.level === '口径不同需分述')) {
    advice.push('两边有分歧时，分别保留宅运结构与个人方位依据，不硬统一成一个总分。');
  }
  if (agreements.some((item) => item.level === '资料不足')) {
    advice.push(
      xuankongStatus === '缺少建造年或起运年'
        ? '请先补充住宅建造年或起运年，再排玄空宅运盘并讨论具体布局。'
        : '资料不足处先补山向或居住人信息，再做更细的布局讨论。',
    );
  }
  if (!advice.length) {
    advice.push('请补充山向或居住人信息后重新排盘。');
  }
  return advice;
}

function buildEvidencePrompt(params: {
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  agreements: ResidentialFengshuiAgreement[];
  advice: string[];
}) {
  const items: PromptEvidenceItem[] = [];
  if (params.xuankong) {
    items.push({
      level: '主证',
      title: '玄空宅运层',
      detail: `${params.xuankong.period.label}；坐${params.xuankong.sitMountain}向${params.xuankong.facingMountain}；${params.xuankong.daoShanXiang.summary}`,
      source: '玄空飞星 v1',
    });
  }
  if (params.bazhai) {
    items.push({
      level: '主证',
      title: '八宅人宅层',
      detail: `命卦${params.bazhai.mingGua}，宅卦${params.bazhai.houseGua ?? '未定'}，命宅关系${params.bazhai.match}`,
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
  orientationText: string;
  houseYear: number | null;
  bazhai: BaZhaiResult | null;
  xuankong: XuanKongResult | null;
  xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'];
}) {
  const lines = [
    '【住宅风水排盘】',
    `山向：${result.orientationText}`,
    result.houseYear != null ? `宅运年份：${result.houseYear}` : '',
    result.xuankong
      ? `玄空：${result.xuankong.period.label}；坐${result.xuankong.sitMountain}向${result.xuankong.facingMountain}；${result.xuankong.daoShanXiang.summary}`
      : result.bazhai
        ? result.xuankongStatus === '缺少建造年或起运年'
          ? '玄空：未排盘（缺少建造年或起运年）'
          : '玄空：未排盘'
        : '',
    result.bazhai
      ? `八宅：命卦${result.bazhai.mingGua}（${result.bazhai.mingGroup}）${result.bazhai.houseGua ? `，宅卦${result.bazhai.houseGua}，命宅关系${result.bazhai.match}` : ''}`
      : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function generateResidentialFengshui(
  input: ResidentialFengshuiInput = {},
): ResidentialFengshuiResult {
  if (!hasPersonInput(input) && !hasOrientationInput(input)) {
    throw new Error('住宅风水至少需要提供山向，或居住人出生年与性别/命卦。');
  }
  if (hasOrientationInput(input) && input.year == null && !hasPersonInput(input)) {
    throw new Error('仅按山向排玄空宅运盘时，必须提供住宅建造年或起运年。');
  }

  // 先尽量用门向度数算出八宅坐向，再喂给玄空，保证两边山向一致。
  let bazhai = buildBazhai(input);
  const xuankong = buildXuanKong(input, bazhai);

  // 若八宅只有命卦、但玄空已推出坐山，则回填八宅宅卦。
  if (bazhai && !bazhai.houseGua && xuankong?.sitMountain && hasPersonInput(input)) {
    bazhai = analyzeBaZhai({
      ...(input.birthYear != null ? { birthYear: input.birthYear } : {}),
      ...(input.birthMonth != null ? { birthMonth: input.birthMonth } : {}),
      ...(input.birthDay != null ? { birthDay: input.birthDay } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.mingGua ? { mingGua: input.mingGua } : {}),
      sitMountain: xuankong.sitMountain,
    });
  }

  const xuankongStatus: ResidentialFengshuiResult['inputSummary']['xuankongStatus'] = xuankong
    ? '已排盘'
    : hasOrientationInput(input)
      ? '缺少建造年或起运年'
      : '缺少山向';
  const agreements = buildAgreements(bazhai, xuankong, xuankongStatus);
  const advice = buildAdvice(bazhai, xuankong, agreements, xuankongStatus);
  const houseYear = xuankong ? xuankong.period.year : (input.year ?? null);
  const orientationText = buildOrientationText({ bazhai, xuankong, input });
  const evidencePromptText = buildEvidencePrompt({ bazhai, xuankong, agreements, advice });
  const prompt = buildPrompt({
    orientationText,
    houseYear,
    bazhai,
    xuankong,
    xuankongStatus,
  });

  return {
    key: 'residential-fengshui',
    label: '住宅风水',
    inputSummary: {
      hasPerson: Boolean(bazhai),
      hasHouseOrientation: Boolean(xuankong || bazhai?.houseGua),
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
