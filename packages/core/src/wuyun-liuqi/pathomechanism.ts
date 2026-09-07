/**
 * @file 五运六气平气条件与司天淫胜资料
 * @传统依据 《素问·至真要大论》司天所胜段与《古今医统大全》论纪运。
 */
import type { AnnualConformities, AnnualMovement, LiuqiProfile, WuyunElement } from './index';
import { assertValidGanZhi } from '../ganzhi/validation';
import { isKe, isSheng } from '../wuxing';
import {
  STEM_MOVEMENT,
  QI_PROFILES,
  BRANCH_SITIAN_ZAIQUAN,
  SUIHUI_BRANCH_ELEMENT,
} from './annual-data';

export interface WuyunLiuqiPathomechanismResult {
  /** 年度资料不足以确认实际气候是否为平气。 */
  isPingQi: null;
  pingQiType: '具平气条件' | '平气待定';
  pingQiConditions: string[];
  movementRegime: string;
  pingQiBasis: string;
  affectedZangFu: string;
  climaticPathology: string;
  treatmentGuideline: string;
  classicalReference: {
    source: string;
    url: string;
    condition: string;
    conditionEstablished: null;
  };
  summary: string;
}

/** 《运气要诀》五运平气太过不及歌，依次为太过、不及、平气之纪。 */
const MOVEMENT_REGIMES: Record<WuyunElement, readonly [string, string, string]> = {
  木: ['发生', '委和', '敷和'],
  火: ['赫曦', '伏明', '升明'],
  土: ['敦阜', '卑监', '备化'],
  金: ['坚成', '从革', '审平'],
  水: ['流衍', '涸流', '静顺'],
};

/** 《素问·至真要大论》司天所胜段摘录；所胜条件须另据气候与病候核定。 */
const SITIAN_PATHOLOGY: Record<
  string,
  { condition: string; zangfu: string; pathology: string; guideline: string }
> = {
  厥阴风木: {
    condition: '厥阴司天，风淫所胜',
    zangfu: '病本于脾',
    pathology: '胃脘当心而痛，上支两胁；饮食不下；食则呕，冷泄腹胀',
    guideline: '平以辛凉，佐以苦甘，以甘缓之，以酸写之',
  },
  少阴君火: {
    condition: '少阴司天，热淫所胜',
    zangfu: '病本于肺',
    pathology: '胸中烦热，嗌乾，右胠满，皮肤痛，寒热欬喘',
    guideline: '平以咸寒，佐以苦甘，以酸收之',
  },
  太阴湿土: {
    condition: '太阴司天，湿淫所胜',
    zangfu: '病本于肾',
    pathology: '胕肿，骨痛，阴痹；腰脊头项痛；饥不欲食',
    guideline: '平以苦热，佐以酸辛，以苦燥之，以淡泄之',
  },
  少阳相火: {
    condition: '少阳司天，火淫所胜',
    zangfu: '病本于肺',
    pathology: '头痛发热，恶寒而疟；腹满仰息；烦心，胸中热',
    guideline: '平以酸冷，佐以苦甘，以酸收之，以苦发之，以酸复之',
  },
  阳明燥金: {
    condition: '阳明司天，燥淫所胜',
    zangfu: '病本于肝',
    pathology: '左胠胁痛，寒清于中；欬腹中鸣；腰痛',
    guideline: '平以苦湿，佐以酸辛，以苦下之',
  },
  太阳寒水: {
    condition: '太阳司天，寒淫所胜',
    zangfu: '病本于心',
    pathology: '胸腹满，手热，肘挛；胸胁胃脘不安；面赤目黄',
    guideline: '平以辛热，佐以甘苦，以咸写之',
  },
};

/**
 * 根据一致的年层资料整理平气条件与具名古籍摘录。
 */
export function evaluateWuyunLiuqiPathomechanism(params: {
  annualMovement: AnnualMovement;
  sitian: LiuqiProfile;
  yearGanZhi: string;
  annualConformities: AnnualConformities;
}): WuyunLiuqiPathomechanismResult {
  if (!params || typeof params !== 'object') throw new Error('五运六气资料不能为空。');
  const { annualMovement, sitian, yearGanZhi, annualConformities } = params;
  assertValidGanZhi(yearGanZhi);
  const movement = STEM_MOVEMENT[yearGanZhi[0]];
  if (
    !annualMovement ||
    annualMovement.stem !== yearGanZhi[0] ||
    annualMovement.element !== movement.element ||
    annualMovement.strength !== movement.strength ||
    annualMovement.yinYang !== movement.yinYang
  )
    throw new Error('岁运资料与年干支不一致。');
  const pair = BRANCH_SITIAN_ZAIQUAN[yearGanZhi[1]];
  const expectedSitian = QI_PROFILES[pair[0]];
  if (
    !sitian ||
    (['name', 'element', 'phase', 'qi'] as const).some((key) => sitian[key] !== expectedSitian[key])
  ) {
    throw new Error('司天资料与年干支不一致。');
  }
  if (
    !annualConformities ||
    annualConformities.suihui !== (SUIHUI_BRANCH_ELEMENT[yearGanZhi[1]] === movement.element) ||
    annualConformities.tongSuihui !==
      (movement.yinYang === '阴' && QI_PROFILES[pair[1]].element === movement.element)
  ) {
    throw new Error('平气所用符会资料与年干支不一致。');
  }

  // 《古今医统大全》卷五论纪运：年层条件与交气日时、气候应期分别核对。
  const pingQiConditions: string[] = [];
  if (annualMovement.strength === '太过' && isKe(sitian.element, annualMovement.element)) {
    pingQiConditions.push(`${sitian.name}司天制约${annualMovement.element}运太过`);
  }
  if (annualMovement.strength === '不及') {
    if (sitian.element === annualMovement.element) {
      pingQiConditions.push(`${sitian.name}司天与${annualMovement.element}运同气，资助岁运不及`);
    } else if (isSheng(sitian.element, annualMovement.element)) {
      pingQiConditions.push(`${sitian.name}司天生${annualMovement.element}运，资助岁运不及`);
    }
    if (annualConformities.suihui) pingQiConditions.push('岁运不及而逢岁会');
    if (annualConformities.tongSuihui) pingQiConditions.push('岁运不及而逢同岁会');
    if (yearGanZhi === '辛亥') pingQiConditions.push('辛水运不及，亥水同气相佐');
    if (yearGanZhi === '癸巳') pingQiConditions.push('癸火运不及，巳火同气相佐');
  }
  const names = MOVEMENT_REGIMES[annualMovement.element];
  const movementRegime = `${names[annualMovement.strength === '太过' ? 0 : 1]}之纪`;
  const pingQiType = pingQiConditions.length ? '具平气条件' : '平气待定';
  const pingQiBasis = `${yearGanZhi}${annualMovement.element}运${annualMovement.strength}，属${movementRegime}；${pingQiConditions.length ? pingQiConditions.join('；') : '年层资料尚未列出平气条件'}。平气成立时称${names[2]}之纪，仍须结合交气日时干德符及气候应期核定。`;

  const pathology = SITIAN_PATHOLOGY[sitian.name];

  const summary = `平气条件：${pingQiBasis}`;

  return {
    isPingQi: null,
    pingQiType,
    pingQiConditions,
    movementRegime,
    pingQiBasis,
    affectedZangFu: `${pathology.condition}时，原文称“${pathology.zangfu}”。`,
    climaticPathology: `${pathology.condition}的病候摘录：“${pathology.pathology}”。`,
    treatmentGuideline: `${pathology.condition}的传统治则摘录：“${pathology.guideline}”。`,
    classicalReference: {
      source: '《素问·至真要大论》司天所胜段',
      url: 'https://www.shidianguji.com/book/SBCK072/chapter/1j7xq448ka915_98',
      condition: pathology.condition,
      conditionEstablished: null,
    },
    summary,
  };
}
