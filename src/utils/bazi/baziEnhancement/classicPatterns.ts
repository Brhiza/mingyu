/**
 * 格局体系扩充：经典格局库与识别函数。
 */

import type { BaziChartResult } from '../baziTypes';
import { checkCondition } from '../baziConditionMatchers';

interface ClassicPattern {
  id: string;
  name: string;
  description: string;
  conditions: {
    dayStems?: string[];
    monthBranch?: string[];
    otherConditions?: string[];
    exactMonthBranchMap?: Record<string, string>;
    excludePatterns?: string[];
  };
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  level: '极品' | '上等' | '中等';
}

const CLASSIC_PATTERNS: ClassicPattern[] = [
  {
    id: 'lu-ren-yang',
    name: '阳刃格',
    description:
      '甲羊刃在卯，丙戊羊刃在午，庚羊刃在酉，壬羊刃在子。阴干不论阳刃。羊刃帮身有力，但需官杀制伏方为贵。',
    conditions: {
      dayStems: ['甲', '丙', '戊', '庚', '壬'],
      monthBranch: ['卯', '午', '酉', '子'],
      exactMonthBranchMap: { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' },
      otherConditions: ['羊刃透出', '羊刃当令'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['官', '杀'],
    unfavorableWuxing: ['刃', '比'],
    level: '上等',
  },
  {
    id: 'lu-ren-lu',
    name: '建禄格',
    description: '日干与月支同气，如甲木生寅月。建禄自旺，不祖则兄，主辛苦创业。',
    conditions: {
      dayStems: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      monthBranch: ['寅', '卯', '巳', '午', '申', '酉', '亥', '子'],
      exactMonthBranchMap: {
        甲: '寅',
        乙: '卯',
        丙: '巳',
        丁: '午',
        戊: '巳',
        己: '午',
        庚: '申',
        辛: '酉',
        壬: '亥',
        癸: '子',
      },
      otherConditions: ['日干与月支同气', '月令司权'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['财', '官', '食'],
    unfavorableWuxing: ['印', '比'],
    level: '中等',
  },

  {
    id: 'jin-shen',
    name: '金神格',
    description:
      '甲己日生乙丑、己巳、癸酉三时。金神入格，性情刚烈，多主武贵。忌火乡运行，喜水木运。',
    conditions: {
      dayStems: ['甲', '己'],
      otherConditions: ['时柱为乙丑', '时柱为己巳', '时柱为癸酉'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['火'],
    level: '上等',
  },

  {
    id: 'jing-lan-cha',
    name: '井栏叉格',
    description:
      '庚申、庚子、庚辰三柱重逢，天干三庚、地支申子辰三合水局。忌丙丁火破局，喜水木清华。主清贵富足。',
    conditions: {
      dayStems: ['庚'],
      otherConditions: ['天干三庚', '申子辰三合水局'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['火', '土'],
    level: '极品',
  },

  {
    id: 'gui-ding',
    name: '癸丁格',
    description: '癸日见丁巳时。癸水遇丁火财星坐巳，财官双美。忌亥冲巳破局，喜金水相辅。',
    conditions: {
      dayStems: ['癸'],
      otherConditions: ['时柱为丁巳'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['木', '土'],
    level: '上等',
  },

  {
    id: 'ren-qi-long',
    name: '壬骑龙背格',
    description: '壬辰日生，辰为水库，壬水得辰中癸水帮扶。多见辰字更贵，忌戌冲辰破局。主大富大贵。',
    conditions: {
      dayStems: ['壬'],
      otherConditions: ['日柱为壬辰'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['土', '戌'],
    level: '极品',
  },

  {
    id: 'liu-yin-chao-yang',
    name: '六阴朝阳格',
    description:
      '辛日见戊子时。六阴至子而朝阳，辛金得戊土生扶、子水润泽。忌午冲子破局，忌丙丁火出干混局。主清贵。',
    conditions: {
      dayStems: ['辛'],
      otherConditions: ['时柱为戊子'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '午'],
    level: '上等',
  },

  {
    id: 'ren-zhe-bian-de',
    name: '仁者变德格',
    description:
      '甲己日见亥月，亥为甲木长生、己土胞胎。甲己合而化德，仁而有守。忌刑冲破害，喜官印相生。',
    conditions: {
      dayStems: ['甲', '己'],
      monthBranch: ['亥'],
      otherConditions: ['亥中壬水发用', '亥水当令'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['金'],
    level: '上等',
  },

  {
    id: 'run-xia',
    name: '润下格',
    description: '壬癸日见亥子丑三会水局或申子辰三合水局，水势泛滥。忌土来制水，喜木泄水为用。',
    conditions: {
      dayStems: ['壬', '癸'],
      otherConditions: ['亥子丑三会水局', '三合水局', '水势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['土'],
    level: '极品',
  },

  {
    id: 'yan-shang',
    name: '炎上格',
    description: '丙丁日见巳午未三会火局。火势炎上，忌水来破局，喜木火相助。',
    conditions: {
      dayStems: ['丙', '丁'],
      otherConditions: ['巳午未三会火局', '火势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['水'],
    level: '极品',
  },

  {
    id: 'cong-ge',
    name: '从革格',
    description: '庚辛日见申酉戌三会金局。金气纯粹，忌火来克金，喜土金相助。',
    conditions: {
      dayStems: ['庚', '辛'],
      otherConditions: ['申酉戌三会金局', '金势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['土', '金'],
    unfavorableWuxing: ['火', '木'],
    level: '极品',
  },

  {
    id: 'qu-zhi',
    name: '曲直格',
    description: '甲乙日见寅卯辰三会木局。木性曲直，忌金来克木，喜水木相助。',
    conditions: {
      dayStems: ['甲', '乙'],
      otherConditions: ['寅卯辰三会木局', '木势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['金'],
    level: '极品',
  },

  {
    id: 'jia-se',
    name: '稼穑格',
    description: '戊己日见辰戌丑未全局。土性厚重，忌木来克土，喜火土相助。',
    conditions: {
      dayStems: ['戊', '己'],
      otherConditions: ['辰戌丑未全', '土势旺盛'],
      excludePatterns: ['从财格', '从杀格', '从儿格', '从势格'],
    },
    favorableWuxing: ['火', '土'],
    unfavorableWuxing: ['木', '水'],
    level: '极品',
  },

  {
    id: 'fei-tian-lu-ma',
    name: '飞天禄马格',
    description:
      '庚日子时或壬日子时。庚禄在申、壬禄在亥，借子位暗冲丙火官星、午火财星。忌丙丁巳午填实，喜金水助之。主大贵。',
    conditions: {
      dayStems: ['庚', '壬'],
      otherConditions: ['时柱为丙子', '时柱为庚子'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '土'],
    level: '极品',
  },

  {
    id: 'yi-ji-shu-gui',
    name: '乙己鼠贵格',
    description:
      '乙日或己日见丙子时。乙己阴柔，夜生得子时为贵。忌午冲子破局，忌丑合子散局。主名利双收。',
    conditions: {
      dayStems: ['乙', '己'],
      otherConditions: ['时柱为丙子'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['火', '午'],
    level: '上等',
  },

  {
    id: 'xing-chong-de-lu',
    name: '刑冲得禄格',
    description:
      '日干禄神逢刑冲而得用。如甲日见寅被申冲，反得申中庚金为官。刑冲得禄，因祸得福。忌禄神被合住失效。',
    conditions: {
      dayStems: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      otherConditions: ['禄神逢冲'],
    },
    favorableWuxing: ['官', '杀'],
    unfavorableWuxing: ['比', '劫'],
    level: '上等',
  },

  {
    id: 'dao-chong',
    name: '倒冲格',
    description:
      '丙日见午多或丁日见巳多，火势极旺，反冲子水为官。忌壬癸亥子填实，喜火旺助冲。主异路功名。',
    conditions: {
      dayStems: ['丙', '丁'],
      otherConditions: ['地支多午', '地支多巳'],
    },
    favorableWuxing: ['火', '木'],
    unfavorableWuxing: ['水'],
    level: '上等',
  },

  {
    id: 'jia-qiu',
    name: '夹丘格',
    description: '戊己日生辰戌时或丑未时，两库夹日。土得库藏，财富丰厚。忌木来克破，喜火生土。',
    conditions: {
      dayStems: ['戊', '己'],
      otherConditions: ['时支见辰', '时支见戌', '时支见丑', '时支见未'],
    },
    favorableWuxing: ['火', '土'],
    unfavorableWuxing: ['木'],
    level: '中等',
  },

  {
    id: 'hua-qi-tu',
    name: '甲己化土格',
    description:
      '甲己合化土，月令辰戌丑未土旺之地，天干甲己同透，无乙庚争合破局。化气纯粹则贵，喜火土生扶，忌木克土破化。',
    conditions: {
      dayStems: ['甲', '己'],
      monthBranch: ['辰', '戌', '丑', '未'],
      otherConditions: ['甲己同透', '无乙庚争合'],
    },
    favorableWuxing: ['火', '土'],
    unfavorableWuxing: ['木', '水'],
    level: '极品',
  },
  {
    id: 'hua-qi-jin',
    name: '乙庚化金格',
    description:
      '乙庚合化金，月令巳酉丑或申酉戌金旺之地，天干乙庚同透，无丙辛争合破局。化气纯粹则贵，喜土金生扶，忌火克金破化。',
    conditions: {
      dayStems: ['乙', '庚'],
      monthBranch: ['巳', '酉', '丑', '申', '戌'],
      otherConditions: ['乙庚同透', '无丙辛争合'],
    },
    favorableWuxing: ['土', '金'],
    unfavorableWuxing: ['火', '木'],
    level: '极品',
  },
  {
    id: 'hua-qi-shui',
    name: '丙辛化水格',
    description:
      '丙辛合化水，月令申子辰或亥子丑水旺之地，天干丙辛同透，无丁壬争合破局。化气纯粹则贵，喜金水生扶，忌土克水破化。',
    conditions: {
      dayStems: ['丙', '辛'],
      monthBranch: ['申', '子', '辰', '亥', '丑'],
      otherConditions: ['丙辛同透', '无丁壬争合'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['土', '火'],
    level: '极品',
  },
  {
    id: 'hua-qi-mu',
    name: '丁壬化木格',
    description:
      '丁壬合化木，月令亥卯未或寅卯辰木旺之地，天干丁壬同透，无戊癸争合破局。化气纯粹则贵，喜水木生扶，忌金克木破化。',
    conditions: {
      dayStems: ['丁', '壬'],
      monthBranch: ['亥', '卯', '未', '寅', '辰'],
      otherConditions: ['丁壬同透', '无戊癸争合'],
    },
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['金', '土'],
    level: '极品',
  },
  {
    id: 'hua-qi-huo',
    name: '戊癸化火格',
    description:
      '戊癸合化火，月令寅午戌或巳午未火旺之地，天干戊癸同透，无甲己争合破局。化气纯粹则贵，喜木火生扶，忌水克火破化。',
    conditions: {
      dayStems: ['戊', '癸'],
      monthBranch: ['寅', '午', '戌', '巳', '未'],
      otherConditions: ['戊癸同透', '无甲己争合'],
    },
    favorableWuxing: ['木', '火'],
    unfavorableWuxing: ['水', '金'],
    level: '极品',
  },
  {
    id: 'ri-gui',
    name: '日贵格',
    description:
      '丁酉日或癸巳日生，夜生更贵。丁酉日贵人在酉，癸巳日贵人在巳。主人聪慧温和，多得贵人相助。忌午冲子破。',
    conditions: {
      dayStems: ['丁', '癸'],
      otherConditions: ['日柱为丁酉', '日柱为癸巳'],
    },
    favorableWuxing: ['金', '水'],
    unfavorableWuxing: ['火', '午'],
    level: '上等',
  },
  {
    id: 'ri-de',
    name: '日德格',
    description:
      '甲寅、丙辰、戊辰、庚辰、壬戌五日生人。日德入命，主性格敦厚宽仁，多福多寿。忌刑冲破害，喜官印相生。',
    conditions: {
      dayStems: ['甲', '丙', '戊', '庚', '壬'],
      otherConditions: ['日柱为甲寅', '日柱为丙辰', '日柱为戊辰', '日柱为庚辰', '日柱为壬戌'],
    },
    favorableWuxing: ['印', '食'],
    unfavorableWuxing: ['伤', '杀'],
    level: '上等',
  },
  {
    id: 'fu-de',
    name: '福德格',
    description:
      '甲申、乙酉、丙子、丁亥、戊午、己巳、庚辰、辛卯、壬寅、癸丑十位日柱。福德入命，主一生福禄厚重。忌刑冲破害。',
    conditions: {
      dayStems: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      otherConditions: ['日柱为甲申', '日柱为乙酉', '日柱为丙子', '日柱为丁亥', '日柱为戊午', '日柱为己巳', '日柱为庚辰', '日柱为辛卯', '日柱为壬寅', '日柱为癸丑'],
    },
    favorableWuxing: ['财', '官'],
    unfavorableWuxing: ['刑', '冲'],
    level: '中等',
  },
  {
    id: 'zi-wu-shuang-bao',
    name: '子午双包格',
    description:
      '四柱中有两子、两午，或子午各二。子午为坎离水火，子午双包主阴阳调和、水火既济。忌丑未破局。主人聪明智慧。',
    conditions: {
      dayStems: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'],
      otherConditions: ['地支有两子', '地支有两午', '子午各二'],
    },
    favorableWuxing: ['水', '火'],
    unfavorableWuxing: ['土'],
    level: '上等',
  },
  {
    id: 'mu-yu',
    name: '沐浴格/败地逢生格',
    description:
      '日主坐沐浴（败）地，如甲子、乙巳、庚午、辛亥等。沐浴又名败地，但逢合则化凶为吉。主艺术才华。',
    conditions: {
      dayStems: ['甲', '乙', '庚', '辛'],
      otherConditions: ['日柱为甲子', '日柱为乙巳', '日柱为庚午', '日柱为辛亥'],
    },
    favorableWuxing: ['印', '官'],
    unfavorableWuxing: ['比', '劫'],
    level: '中等',
  },
];

export function identifyClassicPattern(
  dayStem: string,
  monthBranch: string,
  pillars: BaziChartResult['pillars'],
  hiddenStems: BaziChartResult['hiddenStems'],
  currentPattern?: string,
): ClassicPattern | null {
  for (const pattern of CLASSIC_PATTERNS) {
    if (pattern.conditions.dayStems && !pattern.conditions.dayStems.includes(dayStem)) {
      continue;
    }

    if (pattern.conditions.monthBranch && !pattern.conditions.monthBranch.includes(monthBranch)) {
      continue;
    }

    if (pattern.conditions.exactMonthBranchMap) {
      const requiredBranch = pattern.conditions.exactMonthBranchMap[dayStem];
      if (!requiredBranch || monthBranch !== requiredBranch) {
        continue;
      }
    }

    if (pattern.conditions.excludePatterns && currentPattern) {
      if (pattern.conditions.excludePatterns.includes(currentPattern)) {
        continue;
      }
    }

    if (pattern.conditions.otherConditions) {
      let conditionsMet = true;
      for (const condition of pattern.conditions.otherConditions) {
        if (!checkCondition(condition, dayStem, pillars, hiddenStems)) {
          conditionsMet = false;
          break;
        }
      }
      if (!conditionsMet) continue;
    }

    return pattern;
  }

  return null;
}
