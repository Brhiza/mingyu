/**
 * @file 五运六气脏腑病机偏胜与岁运平气判定算法
 * @传统依据 《素问·至真要大论》《素问·五常政大论》：司天在泉所胜病机、五脏气机受制与平气之岁判定。
 */
import type { AnnualConformities, AnnualMovement, LiuqiProfile, WuyunElement } from './index';
import { assertValidGanZhi } from '../ganzhi/validation';
import { isKe } from '../wuxing';

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

/** 司天所胜之病机（《素问·至真要大论》） */
const SITIAN_PATHOLOGY: Record<string, { zangfu: string; pathology: string; guideline: string }> = {
  厥阴风木: {
    zangfu: '肝胆偏亢，脾胃受克',
    pathology: '风气淫胜，多见眩晕头痛、脾虚飧泄、关节拘急',
    guideline: '辛凉以散，酸苦以安，佐以甘缓',
  },
  少阴君火: {
    zangfu: '心神亢燥，肺金受制',
    pathology: '热气淫胜，多见心烦失眠、咳喘干渴、胸膈燥热',
    guideline: '咸寒降火，苦甘敛阴，清透心肺',
  },
  太阴湿土: {
    zangfu: '脾湿过盛，肾水受抑',
    pathology: '湿气淫胜，多见身重浮肿、腹满纳呆、二便不利',
    guideline: '苦燥利湿，淡渗分消，佐以健脾',
  },
  少阳相火: {
    zangfu: '三焦心包火炽，气分燥烈',
    pathology: '火热内燔，多见口苦耳鸣、头痛目赤、烦渴暴注',
    guideline: '咸辛以折，清降实火，生津调和',
  },
  阳明燥金: {
    zangfu: '肺燥气滞，肝木受刑',
    pathology: '燥气偏盛，多见干咳无痰、咽喉干痛、胁肋掣痛',
    guideline: '苦温以润，甘辛以和，滋阴润燥',
  },
  太阳寒水: {
    zangfu: '肾寒偏甚，心火受抑',
    pathology: '寒水淫胜，多见畏寒肢厥、心胸痹痛、腰膝冷痛',
    guideline: '甘热以温，苦辛以燥，温补命门',
  },
};

/**
 * 依据中运与司天推算脏腑病机偏胜与岁运平气定性
 */
export function evaluateWuyunLiuqiPathomechanism(params: {
  annualMovement: AnnualMovement;
  sitian: LiuqiProfile;
  yearGanZhi: string;
  annualConformities: AnnualConformities;
}): WuyunLiuqiPathomechanismResult {
  const { annualMovement, sitian, yearGanZhi, annualConformities } = params;
  assertValidGanZhi(yearGanZhi);
  if (annualMovement.stem !== yearGanZhi[0]) throw new Error('岁运年干与年干支不一致。');

  // 《古今医统大全》卷五论纪运：年层条件与交气日时、气候应期分别核对。
  const pingQiConditions: string[] = [];
  if (annualMovement.strength === '太过' && isKe(sitian.element, annualMovement.element)) {
    pingQiConditions.push(`${sitian.name}司天制约${annualMovement.element}运太过`);
  }
  if (annualMovement.strength === '不及') {
    if (annualConformities.suihui) pingQiConditions.push('岁运不及而逢岁会');
    if (annualConformities.tongSuihui) pingQiConditions.push('岁运不及而逢同岁会');
    if (yearGanZhi === '辛亥') pingQiConditions.push('辛水运不及，亥水同气相佐');
    if (yearGanZhi === '癸巳') pingQiConditions.push('癸火运不及，巳火同气相佐');
  }
  const names = MOVEMENT_REGIMES[annualMovement.element];
  const movementRegime = `${names[annualMovement.strength === '太过' ? 0 : 1]}之纪`;
  const pingQiType = pingQiConditions.length ? '具平气条件' : '平气待定';
  const pingQiBasis = `${yearGanZhi}${annualMovement.element}运${annualMovement.strength}，属${movementRegime}；${pingQiConditions.length ? pingQiConditions.join('；') : '年层资料尚未列出平气条件'}。平气成立时称${names[2]}之纪，仍须结合交气日时干德符及气候应期核定。`;

  // 2. 司天病机推导
  const pathology = SITIAN_PATHOLOGY[sitian.name] ?? {
    zangfu: '五脏各司其位',
    pathology: '运气平稳，随四时而化',
    guideline: '调和中气，顺应时令',
  };

  const summary = `平气条件：${pingQiBasis}`;

  return {
    isPingQi: null,
    pingQiType,
    pingQiConditions,
    movementRegime,
    pingQiBasis,
    affectedZangFu: pathology.zangfu,
    climaticPathology: pathology.pathology,
    treatmentGuideline: pathology.guideline,
    summary,
  };
}
