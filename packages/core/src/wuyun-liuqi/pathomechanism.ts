/**
 * @file 五运六气脏腑病机偏胜与岁运平气判定算法
 * @传统依据 《素问·至真要大论》《素问·五常政大论》：司天在泉所胜病机、五脏气机受制与平气之岁判定。
 */
import type { AnnualMovement, LiuqiProfile } from './index';

export interface WuyunLiuqiPathomechanismResult {
  isPingQi: boolean;
  pingQiType: '平气之岁' | '太过偏亢' | '不及偏虚';
  pingQiBasis: string;
  affectedZangFu: string;
  climaticPathology: string;
  treatmentGuideline: string;
  summary: string;
}

/** 传统平气干支组合（运太过逢年支制抑，或不及逢年支资助） */
const PING_QI_YEARS: Record<string, string> = {
  戊辰: '火运太过，逢辰土泄火抑亢，化为赫曦之平气',
  戊戌: '火运太过，逢戌土泄火抑亢，化为平气',
  庚子: '金运太过，逢子水泄金之烈，化为审平之平气',
  辛亥: '水运不及，逢亥水本宫扶助，化为涸流得平',
  辛卯: '水运不及，得卯木生发疏调，化为平气',
  丁亥: '木运不及，得亥水生木资养，化为委和之平气',
  癸巳: '火运不及，逢巳火临官资助，化为伏明得平',
  乙酉: '金运不及，逢酉金得令扶助，化为审平得平',
  己丑: '土运不及，逢丑土同气相助，化为卑监得平',
  己未: '土运不及，逢未土同气相助，化为卑监得平',
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
}): WuyunLiuqiPathomechanismResult {
  const { annualMovement, sitian, yearGanZhi } = params;

  // 1. 检查平气
  const pingQiRule = PING_QI_YEARS[yearGanZhi];
  const isPingQi = Boolean(pingQiRule);
  const pingQiType: WuyunLiuqiPathomechanismResult['pingQiType'] = isPingQi
    ? '平气之岁'
    : annualMovement.strength === '太过'
      ? '太过偏亢'
      : '不及偏虚';
  const pingQiBasis = pingQiRule ?? `${yearGanZhi}岁运呈${annualMovement.strength}，未入平气格`;

  // 2. 司天病机推导
  const pathology = SITIAN_PATHOLOGY[sitian.name] ?? {
    zangfu: '五脏各司其位',
    pathology: '运气平稳，随四时而化',
    guideline: '调和中气，顺应时令',
  };

  const summary = `病机偏胜与平气：${yearGanZhi}年为${pingQiType}（${pingQiBasis}）；${sitian.name}司天，五脏受候${pathology.zangfu}，气化所胜${pathology.pathology}`;

  return {
    isPingQi,
    pingQiType,
    pingQiBasis,
    affectedZangFu: pathology.zangfu,
    climaticPathology: pathology.pathology,
    treatmentGuideline: pathology.guideline,
    summary,
  };
}
