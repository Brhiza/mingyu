import { HEAVENLY_STEMS, getBranchIndex, isKe, isSheng } from '../ganzhi';
import type {
  JinkoujueFourPosition,
  JinkoujuePositionName,
  JinkoujueYinYang,
} from '../types/divination';

const CANONICAL_JINKOU_POSITION_ROLES: Record<JinkoujuePositionName, string> = {
  地分: '四象中的田宅、子孙、奴仆、鞍马与六畜位',
  将神: '四象中的己身、妻财、亲戚与内位',
  贵神: '四象中的主、臣、父与官禄位',
  人元: '四象中的客、天、君、祖与外位',
};

export const JINKOU_POSITION_ROLES: Record<JinkoujuePositionName, string> = {
  ...CANONICAL_JINKOU_POSITION_ROLES,
};

export function getJinkouPositionRole(name: JinkoujuePositionName): string {
  return CANONICAL_JINKOU_POSITION_ROLES[name];
}

const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);

export function getJinkoujueElementRelation(
  sourceElement: string,
  targetElement: string,
): '比和' | '生' | '被生' | '克' | '被克' {
  if (!VALID_WUXING.has(sourceElement) || !VALID_WUXING.has(targetElement)) {
    throw new Error(`金口诀四位五行无效：${sourceElement || '空'} -> ${targetElement || '空'}。`);
  }
  if (sourceElement === targetElement) return '比和';
  if (isSheng(sourceElement, targetElement)) return '生';
  if (isSheng(targetElement, sourceElement)) return '被生';
  if (isKe(sourceElement, targetElement)) return '克';
  return '被克';
}

const FORWARD_NOBLEMAN_BRANCHES = new Set(['亥', '子', '丑', '寅', '卯', '辰']);
const NOBLEMAN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '巳', night: '卯' },
  癸: { day: '巳', night: '卯' },
  辛: { day: '午', night: '寅' },
};
const GUI_SHEN_SEQUENCE = [
  '贵人',
  '螣蛇',
  '朱雀',
  '六合',
  '勾陈',
  '青龙',
  '天空',
  '白虎',
  '太常',
  '玄武',
  '太阴',
  '天后',
] as const;
type GuiShenName = (typeof GUI_SHEN_SEQUENCE)[number];
const GUI_SHEN_ATTRIBUTES: Record<
  GuiShenName,
  { stem: string; branch: string; element: string; yinYang: JinkoujueYinYang }
> = {
  贵人: { stem: '己', branch: '丑', element: '土', yinYang: '阴' },
  螣蛇: { stem: '丁', branch: '巳', element: '火', yinYang: '阴' },
  朱雀: { stem: '丙', branch: '午', element: '火', yinYang: '阳' },
  六合: { stem: '乙', branch: '卯', element: '木', yinYang: '阴' },
  勾陈: { stem: '戊', branch: '辰', element: '土', yinYang: '阳' },
  青龙: { stem: '甲', branch: '寅', element: '木', yinYang: '阳' },
  天空: { stem: '戊', branch: '戌', element: '土', yinYang: '阳' },
  白虎: { stem: '庚', branch: '申', element: '金', yinYang: '阳' },
  太常: { stem: '己', branch: '未', element: '土', yinYang: '阴' },
  玄武: { stem: '壬', branch: '子', element: '水', yinYang: '阳' },
  太阴: { stem: '辛', branch: '酉', element: '金', yinYang: '阴' },
  天后: { stem: '癸', branch: '亥', element: '水', yinYang: '阴' },
};

export function getJinkouNoblemanBranch(dayStem: string, dayNight: '昼占' | '夜占'): string {
  const pair = NOBLEMAN_BRANCH_BY_STEM[dayStem];
  if (!pair) throw new Error(`无法识别日干“${dayStem}”的金口诀贵人起例。`);
  return dayNight === '昼占' ? pair.day : pair.night;
}

export function getGuiShenOnDiFen(noblemanBranch: string, diFenBranch: string) {
  const noblemanIndex = getBranchIndex(noblemanBranch);
  const diFenIndex = getBranchIndex(diFenBranch);
  if (noblemanIndex < 0 || diFenIndex < 0) throw new Error('金口诀贵神起例参数包含无效地支。');
  const isForward = FORWARD_NOBLEMAN_BRANCHES.has(noblemanBranch);
  const step = isForward
    ? (diFenIndex - noblemanIndex + 12) % 12
    : (noblemanIndex - diFenIndex + 12) % 12;
  const god = GUI_SHEN_SEQUENCE[step];
  const attributes = god ? GUI_SHEN_ATTRIBUTES[god] : undefined;
  if (!god || !attributes) {
    throw new Error(`金口诀贵神“${god || '空'}”缺少本属数据。`);
  }
  return {
    god,
    direction: isForward ? ('顺布' as const) : ('逆布' as const),
    ...attributes,
  };
}

/** 五子元遁：甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途。 */
const WUZI_YUAN_STEM: Record<string, string> = {
  甲: '甲',
  己: '甲',
  乙: '丙',
  庚: '丙',
  丙: '戊',
  辛: '戊',
  丁: '庚',
  壬: '庚',
  戊: '壬',
  癸: '壬',
};

export function getYuanStemOnBranch(dayStem: string, branch: string): string {
  const startStem = WUZI_YUAN_STEM[dayStem];
  if (!startStem) {
    throw new Error(`无法识别日干 "${dayStem}" 的五子元遁起干。`);
  }
  const startStemIndex = HEAVENLY_STEMS.indexOf(startStem as (typeof HEAVENLY_STEMS)[number]);
  const branchIndex = getBranchIndex(branch);
  if (startStemIndex < 0 || branchIndex < 0) {
    throw new Error(`五子元遁计算失败：日干 ${dayStem}，地支 ${branch}`);
  }
  return HEAVENLY_STEMS[(startStemIndex + branchIndex) % HEAVENLY_STEMS.length];
}

export function formatJinkoujuePositionPromptText(
  position: Pick<
    JinkoujueFourPosition,
    | 'name'
    | 'branch'
    | 'stem'
    | 'god'
    | 'element'
    | 'elementBasis'
    | 'yinYang'
    | 'seasonState'
    | 'isVoid'
    | 'stemElement'
  >,
): string {
  return [
    `${position.name}${position.stem || ''}${position.branch}`,
    position.god ? `乘${position.god}` : '',
    `${position.yinYang}${position.element}（按${position.elementBasis}）`,
    position.stemElement && position.elementBasis !== '人元干'
      ? `遁干${position.stem}属${position.stemElement}`
      : '',
    `月令${position.seasonState}`,
    position.elementBasis === '人元干' ? '' : position.isVoid ? '旬空' : '不空',
  ]
    .filter(Boolean)
    .join('；');
}
