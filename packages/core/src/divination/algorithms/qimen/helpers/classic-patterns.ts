/**
 * @file 奇门遁甲经典格局识别
 * @description 实现九大遁格、三奇格局、三诈五假、值符值使关系、相佐、守户、玉女守门、门迫、击刑、入墓、
 * 天地盘干关系等经典格局的完整检测。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「天遁地遁与人遁，龙遁虎遁与风遁，云遁鬼遁与神遁，九遁合参最上乘」
 *   - 《遁甲演义》：「三奇得使最为良，玉女守门喜非常」
 *   - 《奇门遁甲秘籍大全》：「符使同宫事必成，门迫宫兮事难行」
 *   - 《烟波钓叟歌》：「十干入墓主事迟，击刑之处防官非」
 *
 * 本模块集中输出会进入主排盘的经典格局。单一干干加临格局
 * （青龙返首、飞鸟跌穴、青龙逃走、白虎猖狂等）由
 * stem-pair-patterns.ts 维护表义，此处只接入有固定名称的格局。
 */

import type { QimenJiuGongGe } from '../../../../types/divination';
import {
  stemElements,
  doorElements,
  auspiciousDoors,
  sanQiStems,
  STEM_TOMB_MAP,
  isGenerating,
  isControlling,
} from './_constants';
import { isKe } from '../../_shared';
import { getNamedStemPairPattern } from './stem-pair-patterns';
import { getDunJiaStem } from './palace-utils';

// ============================================================================
// 类型定义
// ============================================================================

/** 经典格局 */
export interface ClassicPattern {
  /** 内部稳定标识 */
  key: string;
  /** 格局名称（用于显示） */
  name: string;
  /** 吉/凶/中 */
  tone: 'good' | 'bad' | 'neutral';
  /** 评分增减（吉为正，凶为负，绝对值越大影响越强） */
  score: number;
  /** 简要说明 */
  summary: string;
  /** 现代解读 */
  modern: string;
  /** 格局应验表现 */
  manifestation?: string;
  /** 涉及的宫位 */
  palace?: number;
  /** 涉及的天干/星/门/神（用于解释） */
  tokens?: string[];
}

/** 天地盘干关系 */
export interface StemRelation {
  /** 天盘干 */
  heaven: string;
  /** 地盘干 */
  earth: string;
  /** 宫位 */
  palace: number;
  /** 关系类型 */
  type:
    | '克上'
    | '克下'
    | '相佐'
    | '比和'
    | '生上'
    | '生下'
    | '奇仪相合'
    | '命名格局'
    | '入墓'
    | '击刑'
    | '空亡';
  /** 现代说明 */
  note: string;
}

// ============================================================================
// 常量表
// ============================================================================

/** 三奇 */
const sanQi = sanQiStems;

const getStemTombBranch = (stem: string): string | undefined => STEM_TOMB_MAP[stem]?.branch;
const getStemTombPalace = (stem: string): number | undefined => STEM_TOMB_MAP[stem]?.palace;

/**
 * 三奇入墓专用墓宫。
 *
 * 《奇门遁甲统宗》：「三奇入墓者，乙未到坤，丙奇到乾，丁奇到艮」
 * 《遁甲演义》：「更兼六乙来临二，月奇临六亦同论」
 *
 * 这里处理经典「三奇入墓」格局，不替代时干、日干等通用天干入墓表。
 */
const sanQiRuMuTombMap: Record<string, { branch: string; palace: number }> = {
  乙: { branch: '未', palace: 2 },
  丙: { branch: '戌', palace: 6 },
  丁: { branch: '丑', palace: 8 },
};

const sanQiRuMuConfig: Record<
  string,
  {
    key: string;
    name: string;
    score: number;
    result: string;
    modern: string;
    manifestation: string;
  }
> = {
  乙: {
    key: 'yiRuMu',
    name: '日奇入墓',
    score: -4,
    result: '主协商不力',
    modern: '柔和的事今天发挥不出来，遇到顺势就走，别强求。',
    manifestation: '协商和文书发挥不出来、柔和方式效果弱',
  },
  丙: {
    key: 'bingRuMu',
    name: '月奇入墓',
    score: -5,
    result: '主展示不显',
    modern: '今天对外推广、表达类的事难显效，先做内部准备。',
    manifestation: '展示和表达类事难显效、对内准备更好',
  },
  丁: {
    key: 'dingRuMu',
    name: '星奇入墓',
    score: -4,
    result: '主智不展',
    modern: '今天精细工作和暗中协调发挥不出来，劲使在能落地的事上。',
    manifestation: '精细工作发挥不出来、暗中协调效果弱',
  },
};

const sanQiShouZhiConfig: Record<
  string,
  {
    key: string;
    name: string;
    gongs: number[];
    score: number;
    reason: string;
    result: string;
    modern: string;
    manifestation: string;
  }
> = {
  乙: {
    key: 'yiShouZhi',
    name: '日奇受制',
    gongs: [6, 7],
    score: -4,
    reason: '木入金乡',
    result: '主协商文书受制',
    modern: '今天柔性沟通、文书推进容易被规则或强势对象压住，先避开硬碰硬。',
    manifestation: '协商受压、文书被卡、柔性办法难展开',
  },
  丙: {
    key: 'bingShouZhi',
    name: '月奇受制',
    gongs: [1],
    score: -5,
    reason: '火入水乡',
    result: '主展示表达受制',
    modern: '今天公开表达、曝光和推进容易被冷处理或阻断，先收束火力。',
    manifestation: '展示受阻、表达被冷处理、推进遇阻',
  },
  丁: {
    key: 'dingShouZhi',
    name: '星奇受制',
    gongs: [1],
    score: -4,
    reason: '火入水乡',
    result: '主暗助文书受制',
    modern: '今天精细沟通、内部协调和暗线帮助容易发挥不出来，适合先保存证据。',
    manifestation: '内部协调受阻、细节难发挥、暗助不显',
  },
};

const sanQiDeShiConfig: Record<
  string,
  {
    key: string;
    name: string;
    earthStems: string[];
    xunShouText: string;
    modern: string;
    manifestation: string;
  }
> = {
  乙: {
    key: 'riQiDeShi',
    name: '日奇得使',
    earthStems: ['己', '辛'],
    xunShouText: '甲戌/甲午',
    modern: '协商、文书、柔性沟通的事特别顺，关键人物愿意配合；乙奇得使可大胆推进需要共识的事。',
    manifestation: '协商成功、文书签成、对方配合度高',
  },
  丙: {
    key: 'yueQiDeShi',
    name: '月奇得使',
    earthStems: ['戊', '庚'],
    xunShouText: '甲子/甲申',
    modern: '展示、表达、对外发声有特别效果，能被关键的人看到；月奇得使可以放心做需要曝光的事。',
    manifestation: '展示获好评、表达被听见、关键曝光',
  },
  丁: {
    key: 'xingQiDeShi',
    name: '星奇得使',
    earthStems: ['壬', '癸'],
    xunShouText: '甲辰/甲寅',
    modern: '精细工作、暗中协调、内部沟通效果特别好；星奇得使适合做需要精修和幕后推动的事。',
    manifestation: '内部协调顺利、精修见效、暗助到位',
  },
};

const sanQiYouLiuYiConfig: Record<
  string,
  Record<
    string,
    {
      xunShou: string;
      targetStem: string;
      targetXunShou: string;
    }
  >
> = {
  乙: {
    己: { xunShou: '甲戌', targetStem: '辛', targetXunShou: '甲午' },
    辛: { xunShou: '甲午', targetStem: '己', targetXunShou: '甲戌' },
  },
  丙: {
    戊: { xunShou: '甲子', targetStem: '庚', targetXunShou: '甲申' },
    庚: { xunShou: '甲申', targetStem: '戊', targetXunShou: '甲子' },
  },
  丁: {
    壬: { xunShou: '甲辰', targetStem: '癸', targetXunShou: '甲寅' },
    癸: { xunShou: '甲寅', targetStem: '壬', targetXunShou: '甲辰' },
  },
};

const sanZhaGodConfig: Record<
  string,
  {
    key: string;
    name: string;
    score: number;
    summary: string;
    modern: string;
    manifestation: string;
  }
> = {
  太阴: {
    key: 'zhenZha',
    name: '真诈',
    score: 7,
    summary: '三奇、吉门、太阴同宫，乃真诈之格，主隐蔽得助、柔性成事。',
    modern: '适合用低调、柔和、私下沟通的方式推进，越是不张扬越容易成。',
    manifestation: '私下沟通顺利、暗中有人配合、柔性推进见效',
  },
  九地: {
    key: 'zhongZha',
    name: '重诈',
    score: 7,
    summary: '三奇、吉门、九地同宫，乃重诈之格，主伏藏蓄势、稳中取利。',
    modern: '适合先藏住底牌、稳扎稳打地争取资源，不宜急着公开摊牌。',
    manifestation: '资源暗中积累、稳步取利、伏藏后发',
  },
  六合: {
    key: 'xiuZha',
    name: '休诈',
    score: 7,
    summary: '三奇、吉门、六合同宫，乃休诈之格，主和合调停、协作成事。',
    modern: '适合谈合作、做协调、修复关系，借助中间人或团队配合更顺。',
    manifestation: '合作达成、关系缓和、调停有效',
  },
};

const wuJiaControlStems = ['丁', '己', '癸'];
const wuJiaThingStems = ['乙', '丁', '己'];

/**
 * 干击刑：六仪遁干落入特定自刑/相刑宫位为击刑
 * 《烟波钓叟歌》：「击刑之处防官非」
 * 戊在震3（子刑卯），己在坤2（戌刑未），
 * 庚在艮8（申刑寅），辛在离9（午自刑），
 * 壬在巽4（辰自刑），癸在巽4（巳自刑）
 */
const stemJiXingPalace: Record<string, number[]> = {
  甲: [3],
  戊: [3],
  己: [2],
  庚: [8],
  辛: [9],
  壬: [4],
  癸: [4],
};

/**
 * 三奇升殿宫位
 * 《烟波钓叟歌》：「三奇得地升殿吉，各归本气最为良」
 * 乙（木）临震3巽4（木地），丙（火）临离9（火地），
 * 丁（火）临兑7（火克金得制为升殿）
 */
const sanQiShengDian: Record<string, number[]> = {
  乙: [3, 4],
  丙: [9],
  丁: [7],
};

/**
 * 九遁组合定义
 * 《遁甲演义》定九遁：
 *   天遁：丙+开门+生门 或 开门+乙+天盘丙
 *   地遁：休门+乙 或 休门+丁+地盘乙
 *   人遁：丁+休门+太阴
 *   神遁：丙+生门+九天
 *   鬼遁：乙+杜门+九地 或 开门+丁奇+九地
 *   龙遁：乙+癸+休门/开门 或 休门+乙+坎一
 *   虎遁：辛+生门/休门+艮 或 生门+乙+艮八
 *   风遁：乙+杜门+巽 或 开门+乙+巽四
 *   云遁：乙+辛+开门 或 开门+乙+坎一
 */

// ============================================================================
// 工具函数
// ============================================================================

/** 在九宫格中查找包含指定天干的宫位（天盘或地盘） */
function findStemPalace(
  jiuGongGe: QimenJiuGongGe[],
  stem: string,
  position: 'tianPan' | 'diPan' = 'tianPan',
): QimenJiuGongGe | undefined {
  return jiuGongGe.find((p) =>
    position === 'tianPan' ? p.tianPan.stem === stem : p.diPan.stem === stem,
  );
}

/** 在九宫格中查找包含指定门的宫位 */
function findDoorPalace(jiuGongGe: QimenJiuGongGe[], door: string): QimenJiuGongGe | undefined {
  return jiuGongGe.find((p) => p.renPan.door === door);
}

// ============================================================================
// 1. 九大遁格识别
// ============================================================================

/**
 * 识别九遁格局（天遁、地遁、人遁、神遁、鬼遁、龙遁、虎遁、风遁、云遁）
 * 《遁甲演义》：「九遁为奇门第一等吉格，各有所主，合参用之。」
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 检测到的遁格列表
 */
function getDunPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const door = palace.renPan.door;
    const heaven = palace.tianPan.stem;
    const earth = palace.diPan.stem;
    const god = palace.shenPan.god;
    const gong = palace.gong;
    const name = palace.name;

    // ── 天遁 ──
    // 《遁甲演义》：「上盘六丙，中盘生门，下盘六丁」
    // 《奇门遁甲统宗》另有「生丙临戊」口径，故兼收地盘丁/戊。
    if (door === '生门' && heaven === '丙' && (earth === '丁' || earth === '戊')) {
      out.push({
        key: `pattern:tianDun:${gong}`,
        name: '天遁',
        tone: 'good',
        score: 9,
        summary: `生门、丙奇、地盘${earth}同宫，乃天遁之格，主上升机会与天助。`,
        modern:
          '特别难得的机会窗口，主动出击都顺，关键沟通和签约都有利。但出手要果断，拖久了就凉了。',
        manifestation: '关键沟通顺利、签约成功、对方主动抛出好条件',
        palace: gong,
        tokens: ['生门', '丙', earth],
      });
    }

    // ── 地遁 ──
    // 《遁甲演义》：「上盘六乙，中盘开门，下盘六己」
    if (door === '开门' && heaven === '乙' && earth === '己') {
      out.push({
        key: `pattern:diDun:${gong}`,
        name: '地遁',
        tone: 'good',
        score: 8,
        summary: '开门、乙奇、地盘己同宫，乃地遁之格，主稳健长远、地利相助。',
        modern: '适合做需要稳扎稳打的事，比如基础准备、长期布局。',
        manifestation: '基础扎实、长期项目推进顺利',
        palace: gong,
        tokens: ['开门', '乙', '己'],
      });
    }

    // ── 人遁 ──
    // 《遁甲演义》：休门+太阴+丁奇 同宫，主低调得人和、暗中得助
    if (door === '休门' && god === '太阴' && heaven === '丁') {
      out.push({
        key: `pattern:renDun:${gong}`,
        name: '人遁',
        tone: 'good',
        score: 8,
        summary: '休门、太阴、丁奇同宫，乃人遁之格，主低调得人和、暗中得助。',
        modern: '今天靠人脉、私下沟通会比公开推进更有效，关键人物愿意帮你。',
        manifestation: '关键人主动伸手、私下消息利好',
        palace: gong,
        tokens: ['休门', '太阴', '丁'],
      });
    }

    // ── 神遁 ──
    // 《奇门遁甲秘籍大全》：生门+丙奇+九天 同宫，主神助、机缘自显
    if (door === '生门' && heaven === '丙' && god === '九天') {
      out.push({
        key: `pattern:shenDun:${gong}`,
        name: '神遁',
        tone: 'good',
        score: 9,
        summary: '生门、丙奇、九天同宫，乃神遁之格，主神助、机缘自显、谋为成功。',
        modern: '今天关键事会有意外的助力出现，对外推进比预期顺，可以大胆推进重要的事。',
        manifestation: '关键事情顺利、助力出现、好消息传来',
        palace: gong,
        tokens: ['生门', '丙', '九天'],
      });
    }

    // ── 鬼遁 ──
    // 《遁甲演义》：乙奇合九地临杜门；丁奇与休门相合下临九地；
    // 又曰乙奇与开门相合下临九地。
    // 主暗中操作、私下成事
    if (
      (door === '杜门' && heaven === '乙' && god === '九地') ||
      (door === '休门' && heaven === '丁' && god === '九地') ||
      (door === '开门' && heaven === '乙' && god === '九地')
    ) {
      out.push({
        key: `pattern:guiDun:${gong}`,
        name: '鬼遁',
        tone: 'good',
        score: 8,
        summary: '乙/丁、九地与杜门/开门同宫，乃鬼遁之格，主暗中操作、私下成事。',
        modern: '今天用私下沟通、内部协调的方式更容易成事，别公开摊牌。',
        manifestation: '暗中成事、私下沟通有效',
        palace: gong,
        tokens: [heaven, god, door],
      });
    }

    // ── 龙遁 ──
    // 《烟波钓叟歌》：乙+癸+休门/开门 或 休门+乙+坎一宫
    // 主深藏蓄势、暗助得力
    if (
      ((heaven === '乙' && earth === '癸') || (heaven === '癸' && earth === '乙')) &&
      (door === '休门' || door === '开门')
    ) {
      // 乙癸同宫 + 休门/开门
      out.push({
        key: `pattern:longDun:${gong}`,
        name: '龙遁',
        tone: 'good',
        score: 9,
        summary: `乙癸同宫见${door}于${name}，乃龙遁之格，主深藏蓄势、暗助得力。`,
        modern: '今天适合做需要隐忍、需要靠潜在资源的事，明面慢但底牌强。',
        manifestation: '深层资源被调动、暗中有人帮忙',
        palace: gong,
        tokens: ['乙', '癸', door],
      });
    } else if (door === '休门' && heaven === '乙' && gong === 1) {
      // 休门+乙+坎一宫（水宫为龙）
      out.push({
        key: `pattern:longDun:${gong}`,
        name: '龙遁',
        tone: 'good',
        score: 9,
        summary: '休门、乙奇落坎一宫，乃龙遁之格，主深藏蓄势、暗助得力。',
        modern: '今天适合做需要隐忍、需要靠潜在资源的事，明面慢但底牌强。',
        manifestation: '深层资源被调动、暗中有人帮忙',
        palace: gong,
        tokens: ['休门', '乙', '坎一'],
      });
    }

    // ── 虎遁 ──
    // 《烟波钓叟歌》：辛+生门/休门+艮宫 或 生门+乙+艮八宫
    // 主威严稳固、资源回归
    if ((heaven === '辛' || earth === '辛') && (door === '生门' || door === '休门') && gong === 8) {
      out.push({
        key: `pattern:huDun:${gong}`,
        name: '虎遁',
        tone: 'good',
        score: 8,
        summary: `辛见${door}落艮八宫，乃虎遁之格，主威严稳固、资源回归。`,
        modern: '今天适合做需要稳扎稳打、积累资源的事，越是低调越能成。',
        manifestation: '积累见成效、资源稳步回归',
        palace: gong,
        tokens: ['辛', door, '艮八'],
      });
    } else if (door === '生门' && heaven === '乙' && gong === 8) {
      out.push({
        key: `pattern:huDun:${gong}`,
        name: '虎遁',
        tone: 'good',
        score: 8,
        summary: '生门、乙奇落艮八宫，乃虎遁之格，主威严稳固、资源回归。',
        modern: '今天适合做需要稳扎稳打、积累资源的事，越是低调越能成。',
        manifestation: '积累见成效、资源稳步回归',
        palace: gong,
        tokens: ['生门', '乙', '艮八'],
      });
    }

    // ── 风遁 ──
    // 《烟波钓叟歌》：乙+杜门+巽宫 或 开门+乙+巽四宫
    // 主消息流通、文书传递
    if (heaven === '乙' && door === '杜门' && gong === 4) {
      out.push({
        key: `pattern:fengDun:${gong}`,
        name: '风遁',
        tone: 'good',
        score: 8,
        summary: '乙奇、杜门落巽四宫，乃风遁之格，主消息流通、文书传递。',
        modern: '今天适合发文、传话、撮合，沟通的事会比平时顺很多。',
        manifestation: '消息传得快、文书和沟通特别顺',
        palace: gong,
        tokens: ['乙', '杜门', '巽四'],
      });
    } else if (door === '开门' && heaven === '乙' && gong === 4) {
      out.push({
        key: `pattern:fengDun:${gong}`,
        name: '风遁',
        tone: 'good',
        score: 8,
        summary: '开门、乙奇落巽四宫，乃风遁之格，主消息流通、文书传递。',
        modern: '今天适合发文、传话、撮合，沟通的事会比平时顺很多。',
        manifestation: '消息传得快、文书和沟通特别顺',
        palace: gong,
        tokens: ['开门', '乙', '巽四'],
      });
    }

    // ── 云遁 ──
    // 《烟波钓叟歌》：乙+辛+开门 或 开门+乙+坎一宫
    // 主升迁、求职、上行通达
    if (door === '开门' && heaven === '乙' && earth === '辛') {
      out.push({
        key: `pattern:yunDun:${gong}`,
        name: '云遁',
        tone: 'good',
        score: 7,
        summary: '开门、乙奇加天盘辛，乃云遁之格，主升迁、求职、上行通达。',
        modern: '今天适合求贵人、跑升职、谈进阶，向上的事会有回应。',
        manifestation: '机会向上升、贵人从远方来',
        palace: gong,
        tokens: ['开门', '乙', '辛'],
      });
    } else if (door === '开门' && heaven === '乙' && gong === 1) {
      out.push({
        key: `pattern:yunDun:${gong}`,
        name: '云遁',
        tone: 'good',
        score: 7,
        summary: '开门、乙奇落坎一宫，乃云遁之格，主升迁、求职、上行通达。',
        modern: '今天适合求贵人、跑升职、谈进阶，向上的事会有回应。',
        manifestation: '机会向上升、贵人从远方来',
        palace: gong,
        tokens: ['开门', '乙', '坎一'],
      });
    }
  });

  return out;
}

// ============================================================================
// 2. 三奇格局
// ============================================================================

/**
 * 识别三奇得使格局
 *
 * 《烟波钓叟歌》：「三奇得使最为良」
 * 《遁甲演义》：「甲戌甲午乙为使，甲子甲申丙为使，甲辰甲寅丁为使。」
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 检测到的三奇得使格局列表
 */
function getSanQiDeShiPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heavenStem = palace.tianPan.stem;
    const earthStem = palace.diPan.stem;
    const config = sanQiDeShiConfig[heavenStem];
    if (!config || !config.earthStems.includes(earthStem)) return;

    out.push({
      key: `pattern:${config.key}:${palace.gong}`,
      name: config.name,
      tone: 'good',
      score: 8,
      summary: `${heavenStem}奇加地盘${earthStem}（${config.xunShouText}所遁）于${palace.name}，乃${config.name}之格。`,
      modern: config.modern,
      manifestation: config.manifestation,
      palace: palace.gong,
      tokens: [heavenStem, earthStem],
    });

    if (auspiciousDoors.includes(palace.renPan.door)) {
      const qiNameMap: Record<string, string> = { 乙: '日奇', 丙: '月奇', 丁: '星奇' };
      out.push({
        key: `pattern:deShiPlusGoodDoor:${palace.gong}`,
        name: `${qiNameMap[heavenStem]}得地`,
        tone: 'good',
        score: 11,
        summary: `${qiNameMap[heavenStem]}得使又临吉门${palace.renPan.door}，得门得使，双重吉利。`,
        modern: '今天关键事有特别好的入口，资源、信息、关键人同时到位，别错过机会窗口。',
        manifestation: '机会窗口打开、资源到位、关键人配合',
        palace: palace.gong,
        tokens: [heavenStem, earthStem, palace.renPan.door],
      });
    }
  });

  return out;
}

/**
 * 识别《奇门宝鉴御定》口径的三奇得使。
 *
 * 《奇门宝鉴御定》：「三奇得使者，谓得三吉门、直使加奇也。凡开、休、生加乙、丙、丁
 * 为吉门合三奇，利为百事。更得吉门作直使为得使，谋为尤利。」
 */
function getBaoJianSanQiDeShiPatterns(
  jiuGongGe: QimenJiuGongGe[],
  zhiShi: string,
): ClassicPattern[] {
  if (!zhiShi || !auspiciousDoors.includes(zhiShi)) return [];

  const palace = findDoorPalace(jiuGongGe, zhiShi);
  if (!palace || !sanQi.includes(palace.tianPan.stem)) return [];

  const qiNameMap: Record<string, string> = { 乙: '日奇', 丙: '月奇', 丁: '星奇' };
  const qiName = qiNameMap[palace.tianPan.stem] || `${palace.tianPan.stem}奇`;

  return [
    {
      key: `pattern:baoJianSanQiDeShi:${palace.gong}`,
      name: '宝鉴三奇得使',
      tone: 'good',
      score: 9,
      summary: `值使${zhiShi}为三吉门，直使加天盘${palace.tianPan.stem}奇于${palace.name}，合《奇门宝鉴御定》“得三吉门、直使加奇”为三奇得使，谋为尤利。`,
      modern: `值使门本身带${qiName}，关键入口和关键资源重合，适合推进重要谋划。`,
      manifestation: '关键入口得奇、谋事尤利、资源与行动窗口重合',
      palace: palace.gong,
      tokens: [zhiShi, palace.tianPan.stem],
    },
  ];
}

/**
 * 识别三奇游六仪格局。
 *
 * 《奇门宝鉴御定》：「三奇游六仪者，谓奇间于仪中，仪加奇、而奇复游其仪也。
 * 左仪加奇，则奇游于右仪。右仪加奇，则奇游于左仪。乙游己辛，丙游戊庚，
 * 丁游壬癸，必为当旬直符来加方是。」
 *
 * 与“三奇得使”相反，本格看当前值符所带六仪加到地盘三奇，且必须是当旬值符来加。
 */
function getSanQiYouLiuYiPatterns(jiuGongGe: QimenJiuGongGe[], zhiFu: string): ClassicPattern[] {
  if (!zhiFu) return [];

  const zhiFuPalace = jiuGongGe.find((palace) => palace.tianPan.star === zhiFu);
  if (!zhiFuPalace) return [];

  const qi = zhiFuPalace.diPan.stem;
  const zhiFuStem = zhiFuPalace.tianPan.stem;
  const config = sanQiYouLiuYiConfig[qi]?.[zhiFuStem];
  if (!config) return [];

  const qiNameMap: Record<string, string> = { 乙: '日奇', 丙: '月奇', 丁: '星奇' };
  const goodDoorText = auspiciousDoors.includes(zhiFuPalace.renPan.door)
    ? `同宫又得${zhiFuPalace.renPan.door}，更利。`
    : '';

  return [
    {
      key: `pattern:sanQiYouLiuYi:${qi}:${zhiFuPalace.gong}`,
      name: '三奇游六仪',
      tone: 'good',
      score: 8,
      summary: `${config.xunShou}${zhiFuStem}值符加地盘${qi}奇于${zhiFuPalace.name}，${qiNameMap[qi] || qi}游于${config.targetXunShou}${config.targetStem}，合“三奇游六仪”之格；古法主百事可为。${goodDoorText}`,
      modern: '今天关键资源能借势转换，适合请托、宴会、协商和争取机会；若同宫得吉门，推进更顺。',
      manifestation: '关键资源转换成助力、请托协商顺利、人情往来得便',
      palace: zhiFuPalace.gong,
      tokens: [qi, `${config.xunShou}${zhiFuStem}`, `${config.targetXunShou}${config.targetStem}`, zhiFu],
    },
  ];
}

/**
 * 识别三诈格局。
 *
 * 《遁甲演义》：「若三门合三奇，下临太阴宫，名曰真诈；
 * 若三门合三奇，下临九地宫，名曰重诈；
 * 若三门合三奇，下临六合宫，名曰休诈。」
 *
 * 这里的“三门”取开、休、生三吉门；“三奇”取乙、丙、丁。
 */
function getSanZhaPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const door = palace.renPan.door;
    const god = palace.shenPan.god;

    if (!sanQi.includes(heaven) || !auspiciousDoors.includes(door)) return;

    const config = sanZhaGodConfig[god];
    if (!config) return;

    out.push({
      key: `pattern:${config.key}:${palace.gong}`,
      name: config.name,
      tone: 'good',
      score: config.score,
      summary: `${heaven}奇、${door}、${god}同宫于${palace.name}，${config.summary}`,
      modern: config.modern,
      manifestation: config.manifestation,
      palace: palace.gong,
      tokens: [heaven, door, god],
    });
  });

  return out;
}

/**
 * 识别假格。
 *
 * 《奇门遁甲元灵经》：「凡作事，九遁为上吉，诈假为次吉。
 * 三诈五假各宜其用，随事而取之吉。」
 *
 * 假格诸说在传本中存在差异，本函数只接入当前九宫字段可稳定表达的
 * 天假、地假、人假、物假、鬼假、神假口径；需要朱雀或跨宫下临关系的别说暂不强行判定。
 */
function getJiaPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  const pushPattern = (
    palace: QimenJiuGongGe,
    key: string,
    name: string,
    summary: string,
    modern: string,
    manifestation: string,
    tokens: string[],
  ) => {
    out.push({
      key: `pattern:${key}:${palace.gong}`,
      name,
      tone: 'good',
      score: 6,
      summary,
      modern,
      manifestation,
      palace: palace.gong,
      tokens,
    });
  };

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const earth = palace.diPan.stem;
    const door = palace.renPan.door;
    const god = palace.shenPan.god;
    const gong = palace.gong;

    if (!heaven || !door || !god) return;

    if (door === '景门' && sanQi.includes(heaven) && (god === '九天' || god === '九地')) {
      pushPattern(
        palace,
        'tianJia',
        '天假',
        `景门、${heaven}奇、${god}同宫于${palace.name}，合天假（一作天诈）之格，主进谒干贵、消息通达。`,
        '适合拜访关键人物、递交诉求、公开表达，外部回应会比平时顺。',
        '贵人接洽顺利、消息有回应、求见更容易',
        [door, heaven, god],
      );
    }

    const isWuJiaThingByDu = door === '杜门' && heaven === '丁' && earth === '己' && god === '太阴';
    if (
      door === '杜门' &&
      wuJiaControlStems.includes(heaven) &&
      ['九地', '太阴', '六合'].includes(god) &&
      !isWuJiaThingByDu
    ) {
      pushPattern(
        palace,
        'diJia',
        '地假',
        `杜门、${heaven}、${god}同宫于${palace.name}，合地假之格，主伏藏逃避、潜伏蓄势。`,
        '适合低调处理、保存实力、避开正面冲突，先藏住再行动更稳。',
        '潜伏避险、暗中准备、失物寻人有线索',
        [door, heaven, god],
      );
    }

    if (door === '惊门' && heaven === '壬' && (gong === 2 || god === '九天')) {
      pushPattern(
        palace,
        'renJia',
        '人假',
        `壬、惊门${gong === 2 ? '临坤二宫' : `合${god}`}于${palace.name}，合人假之格，主掩捕追寻。`,
        '适合处理追踪、调查、找人找物这类事，但仍要避开强冲硬碰。',
        '追寻有路、掩捕得机、调查推进',
        [heaven, door, gong === 2 ? '坤二' : god],
      );
    }

    if (isWuJiaThingByDu || (door === '伤门' && god === '六合' && wuJiaThingStems.includes(heaven))) {
      const source = isWuJiaThingByDu ? `丁奇、太阴、杜门下临地盘己于${palace.name}` : `${heaven}、伤门、六合同宫于${palace.name}`;
      pushPattern(
        palace,
        'wuJia',
        '物假',
        `${source}，合物假之格，主阴私谋密、暗中筹划。`,
        '适合处理私下协商、保密筹划和不宜公开的安排。',
        '私下谋划有进展、隐秘事务可推进',
        isWuJiaThingByDu ? ['丁', '太阴', '杜门', '己'] : [heaven, door, god],
      );
    }

    if (door === '死门' && wuJiaControlStems.includes(heaven) && god === '九地') {
      pushPattern(
        palace,
        'guiJia',
        '鬼假',
        `死门、${heaven}、九地同宫于${palace.name}，合鬼假之格，主安葬荐度、处理沉滞旧事。`,
        '适合收尾、整理旧账、处理长期搁置或需要安顿的事情，不宜当作开创新局的信号。',
        '旧事收束、沉滞事务可安顿',
        [door, heaven, god],
      );
    }

    if (door === '伤门' && heaven === '庚' && gong === 4) {
      pushPattern(
        palace,
        'shenJia',
        '神假',
        `六庚、伤门到巽四宫于${palace.name}，合神假之格，主私行得便、间谋可用。`,
        '适合低调行动、暗线推进和需要避开正面冲突的安排，不适合作公开强攻。',
        '私行得便、暗线推进、谋事有隙',
        ['庚', door, '巽四'],
      );
    }
  });

  return out;
}

/**
 * 识别三奇升殿格局
 *
 * 《烟波钓叟歌》：「三奇得地升殿吉」
 * 三奇各临本气得地之宫为升殿：
 *   乙奇（木）临震三宫/巽四宫（木地）为升殿
 *   丙奇（火）临离九宫（火地）为升殿
 *   丁奇（火）临兑七宫（火克金得制）为升殿
 *
 * @param jiuGongGe - 九宫格数据（检查地盘三奇位置）
 * @returns 检测到的三奇升殿格局列表
 */
function getSanQiShengDianPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  sanQi.forEach((qi) => {
    const allowedGongs = sanQiShengDian[qi];
    if (!allowedGongs) return;

    // 天盘或地盘落升殿宫都算升殿（以天盘为准，地盘为辅）
    const palace = jiuGongGe.find((p) => p.tianPan.stem === qi && allowedGongs.includes(p.gong));
    if (!palace) return;

    const qiNameMap: Record<string, string> = {
      乙: '日奇·柔顺协商',
      丙: '月奇·光明显达',
      丁: '星奇·精细暗助',
    };
    const qiDisplay = qiNameMap[qi] || qi;
    const shengDianName: Record<string, string> = {
      乙: '乙奇升殿',
      丙: '丙奇升殿',
      丁: '丁奇升殿',
    };

    out.push({
      key: `pattern:${qi}ShengDian:${palace.gong}`,
      name: shengDianName[qi],
      tone: 'good',
      score: 5,
      summary: `${qiDisplay}入${palace.name}，得本气之地，升殿得位。`,
      modern:
        qi === '乙'
          ? '今天柔性的、协商的、文书的事更容易出效果。'
          : qi === '丙'
            ? '今天展示、表达、公开发声的事会更有力，能被该看到的人看到。'
            : '今天精细活、暗中协调、内部沟通会更顺。',
      manifestation:
        qi === '乙'
          ? '协商顺利、文书好写、柔性方式有效'
          : qi === '丙'
            ? '作品被认可、表达被听见、展示获好评'
            : '内部协调顺利、暗中帮忙',
      palace: palace.gong,
      tokens: [qi],
    });
  });

  return out;
}

/**
 * 识别三奇入墓格局
 *
 * 《奇门遁甲统宗》：「三奇入墓者，乙未到坤，丙奇到乾，丁奇到艮」
 * 乙入坤2（未墓），丙入乾6（戌墓），丁入艮8（丑墓）
 *
 * @param jiuGongGe - 九宫格数据（检查天盘三奇落入墓宫）
 * @returns 检测到的三奇入墓格局列表
 */
function getSanQiRuMuPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const gong = palace.gong;
    const config = sanQiRuMuConfig[heaven];
    const tomb = sanQiRuMuTombMap[heaven];

    if (!config || !tomb || tomb.palace !== gong) return;

    out.push({
      key: `pattern:${config.key}:${gong}`,
      name: config.name,
      tone: 'bad',
      score: config.score,
      summary: `${heaven}奇入${palace.name}（三奇墓在${tomb.branch}），${config.name}，${config.result}。`,
      modern: config.modern,
      manifestation: config.manifestation,
      palace: gong,
      tokens: [heaven, palace.name],
    });
  });

  return out;
}

/**
 * 识别三奇受制格局
 *
 * 《奇门宝鉴御定》：「奇制者；乙奇临六、七宫，木制于金。
 * 丙丁奇临一宫，火制于水也。三奇受制，占与墓同。」
 *
 * @param jiuGongGe - 九宫格数据（检查天盘三奇落入受制宫）
 * @returns 检测到的三奇受制格局列表
 */
function getSanQiShouZhiPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const config = sanQiShouZhiConfig[heaven];

    if (!config || !config.gongs.includes(palace.gong)) return;

    out.push({
      key: `pattern:${config.key}:${palace.gong}`,
      name: config.name,
      tone: 'bad',
      score: config.score,
      summary: `${heaven}奇临${palace.name}，${config.reason}，为三奇受制，${config.result}。`,
      modern: config.modern,
      manifestation: config.manifestation,
      palace: palace.gong,
      tokens: [heaven, palace.name, config.reason],
    });
  });

  return out;
}

/**
 * 识别三奇会甲格局
 *
 * 《奇门遁甲秘籍大全》：甲日或己日盘中同时出现乙丙丁三奇，主贵人助力汇聚。
 *
 * @param jiuGongGe - 九宫格数据
 * @param dayStem - 日干
 * @returns 检测到的三奇会甲格局列表
 */
function getSanQiHuiJiaPattern(jiuGongGe: QimenJiuGongGe[], dayStem: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (dayStem !== '甲' && dayStem !== '己') return out;

  const allQiPresent = sanQi.every((qi) => !!findStemPalace(jiuGongGe, qi, 'tianPan'));
  if (allQiPresent) {
    out.push({
      key: 'pattern:sanQiHuiJia',
      name: '三奇会甲',
      tone: 'good',
      score: 7,
      summary: '甲（己）日三奇乙丙丁齐显，主贵人助力、机会汇聚。',
      modern: '今天三奇都在盘上，主线很容易找到帮忙的人和机会，重要的事可以出手。',
      manifestation: '贵人助力汇聚、主线方向有人支持',
      tokens: ['甲', '乙', '丙', '丁'],
    });
  }

  return out;
}

// ============================================================================
// 3. 值符值使关系
// ============================================================================

/**
 * 识别符使同宫格局
 *
 * 《烟波钓叟歌》：「符使同宫事必成」
 * 值符星与值使门落在同一宫，代表神与门合一，事情有极强的集中力量。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiFu - 值符星
 * @param zhiShi - 值使门
 * @returns 检测到的符使同宫格局列表
 */
function getZhiFuZhiShiPatterns(
  jiuGongGe: QimenJiuGongGe[],
  zhiFu: string,
  zhiShi: string,
): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiFu || !zhiShi) return out;

  const fuPalace = jiuGongGe.find((p) => p.tianPan.star === zhiFu);
  const shiPalace = findDoorPalace(jiuGongGe, zhiShi);

  // 符使同宫
  if (fuPalace && shiPalace && fuPalace.gong === shiPalace.gong) {
    out.push({
      key: `pattern:fuShiTongGong:${fuPalace.gong}`,
      name: '符使同宫',
      tone: 'good',
      score: 6,
      summary: `值符${zhiFu}与值使${zhiShi}同落${fuPalace.name}，乃符使同宫之格，事情有极强的集中力量。`,
      modern: '今天想做一件具体的事，力量非常集中，容易出结果。但也要注意过于偏执。',
      manifestation: '专注的事情容易出成果',
      palace: fuPalace.gong,
      tokens: [zhiFu, zhiShi],
    });
  }

  return out;
}

/**
 * 识别相佐、守户格局
 *
 * 《遁甲演义》：「符加丙丁为相佐，使加六丁为守户。」
 * 相佐看值符星所在宫的地盘丙/丁；守户看值使门所在宫的地盘丁。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiFu - 值符星
 * @param zhiShi - 值使门
 * @returns 检测到的相佐、守户格局列表
 */
function getXiangZuoShouHuPatterns(
  jiuGongGe: QimenJiuGongGe[],
  zhiFu: string,
  zhiShi: string,
): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (zhiFu) {
    const fuPalace = jiuGongGe.find((p) => p.tianPan.star === zhiFu);
    if (fuPalace && (fuPalace.diPan.stem === '丙' || fuPalace.diPan.stem === '丁')) {
      out.push({
        key: `pattern:xiangZuo:${fuPalace.gong}`,
        name: '相佐',
        tone: 'good',
        score: 4,
        summary: `值符${zhiFu}加地盘${fuPalace.diPan.stem}于${fuPalace.name}，合“符加丙丁为相佐”，主助力相辅。`,
        modern: '今天关键人或关键资源有辅助作用，适合借力推进，但仍要结合门星吉凶判断力度。',
        manifestation: '贵人助力、关键资源配合、推进有人相帮',
        palace: fuPalace.gong,
        tokens: [zhiFu, fuPalace.diPan.stem],
      });
    }
  }

  if (zhiShi) {
    const shiPalace = findDoorPalace(jiuGongGe, zhiShi);
    if (shiPalace && shiPalace.diPan.stem === '丁') {
      out.push({
        key: `pattern:shouHu:${shiPalace.gong}`,
        name: '守户',
        tone: 'good',
        score: 4,
        summary: `值使${zhiShi}加地盘丁奇于${shiPalace.name}，合“使加六丁为守户”，主门户得护。`,
        modern: '今天行动入口、沟通窗口或办事通道有保护与缓冲，适合稳住关键环节后再推进。',
        manifestation: '入口得护、手续有缓冲、关键通道较稳',
        palace: shiPalace.gong,
        tokens: [zhiShi, '丁'],
      });
    }
  }

  return out;
}

/**
 * 识别天乙飞宫格与天乙伏宫格
 *
 * 《奇门遁甲统宗》：
 *   值符加庚为天乙飞宫，庚加地下值符宫为天乙伏宫。
 *   这里的值符干应取当前值符星实际携带的天盘干，不是九星固定本气。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiFu - 值符星
 * @returns 检测到的天乙飞宫格/伏宫格列表
 */
function getTianYiGongGePatterns(jiuGongGe: QimenJiuGongGe[], zhiFu: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiFu) return out;

  const tianYiPal = jiuGongGe.find((palace) => palace.tianPan.star === zhiFu);
  const tianYiStem = tianYiPal?.tianPan.stem;

  if (!tianYiStem || tianYiStem === '庚') return out;

  // 天乙飞宫格：值符天干（天盘）+ 地盘庚
  if (tianYiPal && tianYiPal.diPan.stem === '庚') {
    out.push({
      key: `pattern:tianYiFeiGongGe:${tianYiPal.gong}`,
      name: '天乙飞宫格',
      tone: 'bad',
      score: -6,
      summary: `值符${zhiFu}所携${tianYiStem}加地盘庚于${tianYiPal.name}，名天乙飞宫格，亦名天乙行符与太白格，主值符力量被冲。`,
      modern: '今天贵人运受阻，想帮你的人也不好出手，关键事先靠自己。',
      manifestation: '贵人使不上力、求援被拒',
      palace: tianYiPal.gong,
      tokens: [tianYiStem, '庚'],
    });
  }

  // 天乙伏宫格：天盘庚 + 地盘值符天干
  const gengPal = findStemPalace(jiuGongGe, '庚', 'tianPan');
  if (gengPal && gengPal.diPan.stem === tianYiStem) {
    out.push({
      key: `pattern:tianYiFuGongGe:${gengPal.gong}`,
      name: '天乙伏宫格',
      tone: 'bad',
      score: -7,
      summary: `天盘庚加地盘值符${zhiFu}所携${tianYiStem}于${gengPal.name}，名天乙伏宫格，亦名天乙留符格，主贵人受困。`,
      modern: '今天想帮你的人自己也有事缠身，重大支持的渠道先确认再依赖。',
      manifestation: '贵人自顾不暇、支持渠道不畅',
      palace: gengPal.gong,
      tokens: ['庚', tianYiStem],
    });
  }

  return out;
}

/**
 * 识别六庚值符勃格与格勃
 *
 * 《奇门宝鉴御定》：「丙加地盘直符之庚为勃格。天上直符之庚，
 * 加于地之六丙为飞勃，亦名符勃。」
 * 此处必须先满足“当前值符星携带天盘庚”，再分别识别丙加庚与庚加丙。
 * 不替代普通丙加庚的荧入太白、庚加丙的太白入荧天地盘干格局。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiFu - 值符星
 * @returns 检测到的勃格/格勃列表
 */
function getGengZhiFuBoGePatterns(jiuGongGe: QimenJiuGongGe[], zhiFu: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiFu) return out;

  const tianYiPal = jiuGongGe.find((palace) => palace.tianPan.star === zhiFu);
  if (!tianYiPal || tianYiPal.tianPan.stem !== '庚') {
    return out;
  }

  const boGePal = jiuGongGe.find(
    (palace) => palace.tianPan.stem === '丙' && palace.diPan.stem === '庚',
  );
  if (boGePal) {
    out.push({
      key: `pattern:gengZhiFuBoGe:${boGePal.gong}`,
      name: '勃格',
      tone: 'bad',
      score: -8,
      summary: `天盘丙加地盘直符庚于${boGePal.name}，值符${zhiFu}携六庚，名勃格，主纲纪紊乱、勃逆难成。`,
      modern: '今天关键推动力容易与规则压力正面相冲，贸然推进会把局面搅乱，先稳住秩序更合适。',
      manifestation: '纲纪紊乱、推进失序、事多反覆',
      palace: boGePal.gong,
      tokens: ['丙', '庚', zhiFu],
    });
  }

  if (tianYiPal.diPan.stem === '丙') {
    out.push({
      key: `pattern:gengZhiFuGeBo:${tianYiPal.gong}`,
      name: '格勃',
      tone: 'bad',
      score: -8,
      summary: `值符${zhiFu}携六庚加地盘丙于${tianYiPal.name}，名飞勃，亦为格勃；古法忌把六庚值符临丙误作吉格。`,
      modern: '今天关键主事力量被冲动和阻隔牵制，不宜硬推或主动开战，先守住局面再等转机。',
      manifestation: '主事受阻、强推易生冲突、原本可动之事转为宜守',
      palace: tianYiPal.gong,
      tokens: ['庚', '丙', zhiFu],
    });
  }

  return out;
}

function getDayStemForQimen(dayStem?: string, dayGanZhi?: string): string {
  if (dayGanZhi) return getDunJiaStem(dayGanZhi);
  if (dayStem && dayStem !== '甲') return dayStem;
  return '';
}

function getGanZhiStemForQimen(ganZhi?: string): string {
  if (!ganZhi) return '';
  return getDunJiaStem(ganZhi);
}

function formatQimenGanZhiStem(label: string, ganZhi: string, qimenStem: string): string {
  const displayStem = ganZhi.charAt(0);
  return ganZhi.startsWith('甲')
    ? `${label}${displayStem}（${ganZhi}遁${qimenStem}）`
    : `${label}${displayStem}`;
}

/**
 * 识别日干飞干格与伏干格。
 *
 * 《奇门宝鉴御定》：「六庚为太白，加于日干为伏干格……今日之干，加于六庚为飞干格。」
 * 此格依赖当前日干，不是固定天地盘干组合；甲日以日柱六甲所遁六仪代甲入盘。
 */
function getDayGanFeiFuPatterns(
  jiuGongGe: QimenJiuGongGe[],
  dayStem?: string,
  dayGanZhi?: string,
): ClassicPattern[] {
  const out: ClassicPattern[] = [];
  const qimenDayStem = getDayStemForQimen(dayStem, dayGanZhi);
  if (!qimenDayStem) return out;

  const fuGanPalace = jiuGongGe.find(
    (palace) => palace.tianPan.stem === '庚' && palace.diPan.stem === qimenDayStem,
  );
  if (fuGanPalace) {
    out.push({
      key: `pattern:dayFuGan:${fuGanPalace.gong}`,
      name: '伏干格',
      tone: 'bad',
      score: -6,
      summary: `天盘庚加日干${dayStem || qimenDayStem}${dayGanZhi?.startsWith('甲') ? `（${dayGanZhi}遁${qimenDayStem}）` : ''}于${fuGanPalace.name}，合“六庚加日干为伏干格”，主日事受太白阻隔。`,
      modern: '今天与自身、当日主事相关的事项容易被规则、冲突或外部阻力压住，不宜硬闯。',
      manifestation: '当日主事受阻、求见不顺、对抗压力增加',
      palace: fuGanPalace.gong,
      tokens: ['庚', qimenDayStem],
    });
  }

  const feiGanPalace = jiuGongGe.find(
    (palace) => palace.tianPan.stem === qimenDayStem && palace.diPan.stem === '庚',
  );
  if (feiGanPalace && feiGanPalace.gong !== fuGanPalace?.gong) {
    out.push({
      key: `pattern:dayFeiGan:${feiGanPalace.gong}`,
      name: '飞干格',
      tone: 'bad',
      score: -5,
      summary: `日干${dayStem || qimenDayStem}${dayGanZhi?.startsWith('甲') ? `（${dayGanZhi}遁${qimenDayStem}）` : ''}加地盘庚于${feiGanPalace.name}，合“日干加六庚为飞干格”，主日事反临太白，主客两伤。`,
      modern: '今天主动推进时容易撞上阻隔和争执，先确认规则边界与对方态度，再行动更稳。',
      manifestation: '主动推进受阻、主客两伤、争执反复',
      palace: feiGanPalace.gong,
      tokens: [qimenDayStem, '庚'],
    });
  }

  return out;
}

/**
 * 识别岁格、月格、时格。
 *
 * 《奇门遁甲统宗》：「岁格 庚临岁干；月格 庚临月干；时格 庚临时干三奇。」
 * 《奇门宝鉴御定》：「六庚加年干为岁格……六庚加月朔为月格……六庚加本用时干者，为时格。」
 *
 * 日干同义格局已由 getDayGanFeiFuPatterns 输出“伏干格”，此处不重复输出“日格”。
 */
function getGengTemporalGePatterns(
  jiuGongGe: QimenJiuGongGe[],
  params: { yearGanZhi?: string; monthGanZhi?: string; hourGanZhi?: string },
): ClassicPattern[] {
  const specs = [
    {
      keyPrefix: 'suiGe',
      name: '岁格',
      label: '岁干',
      ganZhi: params.yearGanZhi,
      score: -7,
      modern: '今天的大环境或上级规则容易形成阻隔，重大事项宜先确认外部限制。',
      manifestation: '年度背景受阻、上层规则牵制、长期事项难推',
    },
    {
      keyPrefix: 'yueGe',
      name: '月格',
      label: '月干',
      ganZhi: params.monthGanZhi,
      score: -6,
      modern: '今天阶段性计划、团队协作或月内安排容易卡住，适合先补流程和资源。',
      manifestation: '阶段计划受阻、协作卡顿、月内事项不顺',
    },
    {
      keyPrefix: 'shiGe',
      name: '时格',
      label: '时干',
      ganZhi: params.hourGanZhi,
      score: -6,
      modern: '当前时点阻力较重，临时行动不宜硬推，先守住局面再择机推进。',
      manifestation: '当下行动受阻、临时冲突增加、宜守不宜攻',
    },
  ];
  const out: ClassicPattern[] = [];

  for (const spec of specs) {
    if (!spec.ganZhi) continue;

    const qimenStem = getGanZhiStemForQimen(spec.ganZhi);
    if (!qimenStem) continue;

    const palace = jiuGongGe.find(
      (item) => item.tianPan.stem === '庚' && item.diPan.stem === qimenStem,
    );
    if (!palace) continue;

    const target = formatQimenGanZhiStem(spec.label, spec.ganZhi, qimenStem);
    out.push({
      key: `pattern:${spec.keyPrefix}:${palace.gong}`,
      name: spec.name,
      tone: 'bad',
      score: spec.score,
      summary: `天盘庚加${target}于${palace.name}，合“六庚加${spec.label}为${spec.name}”，主事有阻格。`,
      modern: spec.modern,
      manifestation: spec.manifestation,
      palace: palace.gong,
      tokens: ['庚', qimenStem, spec.ganZhi],
    });
  }

  return out;
}

/**
 * 识别丙奇加年月日时干的勃格。
 *
 * 《奇门遁甲统宗》：「丙奇临时干名勃格而祸起。」
 * 《遁甲演义》：「天上六丙加年月日时之干直符类同。凡举百事，主纲纪紊乱。」
 */
function getBingTemporalBoGePatterns(
  jiuGongGe: QimenJiuGongGe[],
  params: { yearGanZhi?: string; monthGanZhi?: string; dayGanZhi?: string; hourGanZhi?: string },
): ClassicPattern[] {
  const specs = [
    {
      keyPrefix: 'suiGanBoGe',
      name: '岁干勃格',
      label: '岁干',
      ganZhi: params.yearGanZhi,
      score: -6,
      modern: '今天的大环境容易出现临时扰动或规则反复，重大事项先稳住节奏。',
      manifestation: '年度背景扰动、上层规则反复、长期事项易乱',
    },
    {
      keyPrefix: 'yueGanBoGe',
      name: '月干勃格',
      label: '月干',
      ganZhi: params.monthGanZhi,
      score: -5,
      modern: '阶段性计划容易被突发沟通、文书或流程打乱，适合先理顺材料。',
      manifestation: '阶段计划扰动、文书流程反复、协作易乱',
    },
    {
      keyPrefix: 'riGanBoGe',
      name: '日干勃格',
      label: '日干',
      ganZhi: params.dayGanZhi,
      score: -6,
      modern: '当天主事容易被突发变动牵动，不宜靠临场冲劲硬推。',
      manifestation: '当日主事紊乱、临场变动增多、执行反复',
    },
    {
      keyPrefix: 'shiGanBoGe',
      name: '时干勃格',
      label: '时干',
      ganZhi: params.hourGanZhi,
      score: -6,
      modern: '当前时点容易出现节奏失控或临时反复，先控风险再行动。',
      manifestation: '当下行动紊乱、临时反复增加、宜先稳后动',
    },
  ];
  const out: ClassicPattern[] = [];

  for (const spec of specs) {
    if (!spec.ganZhi) continue;

    const qimenStem = getGanZhiStemForQimen(spec.ganZhi);
    if (!qimenStem) continue;

    const palace = jiuGongGe.find(
      (item) => item.tianPan.stem === '丙' && item.diPan.stem === qimenStem,
    );
    if (!palace) continue;

    const target = formatQimenGanZhiStem(spec.label, spec.ganZhi, qimenStem);
    out.push({
      key: `pattern:${spec.keyPrefix}:${palace.gong}`,
      name: spec.name,
      tone: 'bad',
      score: spec.score,
      summary: `天盘丙加${target}于${palace.name}，合“丙奇临${spec.label}名为勃格”，主纲纪紊乱、行动逆乱。`,
      modern: spec.modern,
      manifestation: spec.manifestation,
      palace: palace.gong,
      tokens: ['丙', qimenStem, spec.ganZhi],
    });
  }

  return out;
}

/**
 * 识别六壬临时干的地罗遮蔽。
 *
 * 《奇门遁甲统宗》：「地罗遮蔽 六壬临时干。」
 * 《遁甲演义》：「天网四张格地网即壬临时干不赘。」
 */
function getRenTemporalDiLuoPatterns(
  jiuGongGe: QimenJiuGongGe[],
  hourGanZhi?: string,
): ClassicPattern[] {
  if (!hourGanZhi) return [];

  const qimenStem = getGanZhiStemForQimen(hourGanZhi);
  if (!qimenStem) return [];

  const palace = jiuGongGe.find(
    (item) => item.tianPan.stem === '壬' && item.diPan.stem === qimenStem,
  );
  if (!palace) return [];

  const target = formatQimenGanZhiStem('时干', hourGanZhi, qimenStem);
  return [
    {
      key: `pattern:diLuoZheBi:${palace.gong}`,
      name: '地罗遮蔽',
      tone: 'bad',
      score: -5,
      summary: `天盘壬加${target}于${palace.name}，合“六壬临时干”为地罗遮蔽，亦称地网，主前路遮障、行动受困。`,
      modern: '当前时点容易被隐性阻碍、拖延或环境不明卡住，出行和推进先查清路线与条件。',
      manifestation: '前路遮障、信息不明、行动受困、推进迟滞',
      palace: palace.gong,
      tokens: ['壬', qimenStem, hourGanZhi],
    },
  ];
}

/**
 * 识别天辅时与五合时格局
 *
 * 《奇门宝鉴御定》：「天辅时者；甲子、甲戌、甲申、甲午、甲辰、甲寅时也。」
 * 《奇门宝鉴御定》：「五合时者，时与日之干相合也。」
 * 《遁甲演义》另有按日干组合取天辅时的别传口径，单独降级标注，避免漏判六甲时。
 *
 * @param dayStem - 日干
 * @param hourGanZhi - 时辰干支
 * @returns 检测到的天辅时、五合时格局列表
 */
function getTianFuShiPattern(dayStem: string, hourGanZhi: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];
  const sixJiaHours = new Set(['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅']);
  const wuHeHourStemByDayStem: Record<string, string> = {
    甲: '己',
    己: '甲',
    乙: '庚',
    庚: '乙',
    丙: '辛',
    辛: '丙',
    丁: '壬',
    壬: '丁',
    戊: '癸',
    癸: '戊',
  };

  if (sixJiaHours.has(hourGanZhi)) {
    out.push({
      key: 'pattern:tianFuShi',
      name: '天辅时',
      tone: 'good',
      score: 6,
      summary: `${hourGanZhi}时，合《奇门宝鉴御定》六甲天辅时，主解厄助成、诸事可谋。`,
      modern: '今天有解围和推进的机会，适合处理解释、协调、申诉、化解类事务。',
      manifestation: '解厄助成、贵人护持',
      tokens: [hourGanZhi],
    });
  }

  const tianFuShiMap: Record<string, string> = {
    甲: '己巳',
    己: '己巳',
    乙: '甲申',
    庚: '甲申',
    丙: '甲午',
    辛: '甲午',
    丁: '甲辰',
    壬: '甲辰',
    戊: '甲寅',
    癸: '甲寅',
  };
  const matchedHour = tianFuShiMap[dayStem];

  if (matchedHour && hourGanZhi === matchedHour && !sixJiaHours.has(hourGanZhi)) {
    out.push({
      key: 'pattern:tianFuShiVariant',
      name: '天辅时（别传）',
      tone: 'good',
      score: 4,
      summary: `${dayStem}日${hourGanZhi}时，合《遁甲演义》别传天辅时，主解厄助成，但与《宝鉴》六甲天辅时分列。`,
      modern: '今天可借助协调和缓冲来推进事情，但仍要结合门星格局判断，不宜只凭此格定吉。',
      manifestation: '别传吉时、解厄助成',
      tokens: [dayStem, hourGanZhi],
    });
  }

  const hourStem = hourGanZhi.charAt(0);
  if (wuHeHourStemByDayStem[dayStem] === hourStem) {
    out.push({
      key: `pattern:wuHeShi:${dayStem}:${hourGanZhi}`,
      name: '五合时',
      tone: 'good',
      score: 5,
      summary: `${dayStem}日${hourGanZhi}时，日干与时干五合，合《奇门宝鉴御定》五合时；其吉与天辅时同，但宜谋和合、隐秘诸事，不宜专作雪冤解释。`,
      modern: '今天适合谈合作、修复关系、暗中协调和处理需要保密推进的事情，但不宜只凭此格处理申诉辩白类事务。',
      manifestation: '和合隐秘、吉神用事',
      tokens: [dayStem, hourGanZhi, hourStem],
    });
  }

  return out;
}

// ============================================================================
// 4. 玉女守门
// ============================================================================

/**
 * 识别玉女守门格局
 *
 * 《奇门宝鉴御定》：「玉女守门者，地盘六丁守直使之门也。」
 * 玉女守门以值使门加地盘丁奇为核心条件；若值使本身又为三吉门，则更利。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiShi - 值使门
 * @returns 检测到的玉女守门格局列表
 */
function getYuNvShouMenPattern(jiuGongGe: QimenJiuGongGe[], zhiShi: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiShi) return out;

  const zhiShiPal = findDoorPalace(jiuGongGe, zhiShi);
  if (zhiShiPal && zhiShiPal.diPan.stem === '丁') {
    const isGoodDoor = auspiciousDoors.includes(zhiShiPal.renPan.door);
    const doorText = isGoodDoor
      ? `又得${zhiShiPal.renPan.door}三吉门，谋秘密、阴私、宴会和合之事更利。`
      : `${zhiShiPal.renPan.door}非三吉门，偏利秘密、阴私、和合之事，仍需合看门星吉凶。`;

    out.push({
      key: `pattern:yunvShoumen:${zhiShiPal.gong}`,
      name: '玉女守门',
      tone: 'good',
      score: isGoodDoor ? 8 : 4,
      summary: `值使${zhiShi}加地盘丁奇于${zhiShiPal.name}，合《奇门宝鉴御定》“地盘六丁守直使之门”为玉女守门；${doorText}`,
      modern: isGoodDoor
        ? '今天适合柔性协商、和合关系、处理文书或需要保密推进的事。'
        : '今天可借柔性方式守住沟通入口，适合保密协调；大事仍要结合门星吉凶再定。',
      manifestation: isGoodDoor
        ? '关系缓和、文书顺利、和合保密得便'
        : '入口得护、暗中协调、守秘推进',
      palace: zhiShiPal.gong,
      tokens: ['丁', zhiShi],
    });
  }

  return out;
}

// ============================================================================
// 5. 八门格局（门迫、门宫相生）
// ============================================================================

/**
 * 识别门迫格局
 *
 * 《烟波钓叟歌》：「门迫宫兮事难行」
 * 门克宫为门迫。如惊门（金）落离九宫（火）或开门（金）落离九宫（火）等。
 * 门迫主该宫位的事情受阻、不易推进。
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 检测到的门迫格局列表
 */
function getMenPoPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const door = palace.renPan.door;
    if (!door) return;

    const doorEl = doorElements[door];
    const palaceEl = palace.element;

    if (doorEl && palaceEl && isKe(doorEl, palaceEl)) {
      out.push({
        key: `pattern:menPo:${palace.gong}`,
        name: '门迫',
        tone: 'bad',
        score: -4,
        summary: `${door}（${doorEl}）克${palace.name}（${palaceEl}），乃门迫之格，主此宫事务受阻。`,
        modern: `在${palace.name}方位的相关事情容易遇到阻力，做事要多做预案。`,
        manifestation: '行动受阻、推进困难',
        palace: palace.gong,
        tokens: [door, palace.name],
      });
    }
  });

  return out;
}

/**
 * 识别门宫相生格局
 *
 * 宫生门或门生宫均为吉，该宫位事情有助力。
 * 宫生门为主方支持事体，门生宫为事情有利于主方。
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 检测到的门宫相生格局列表
 */
function getMenGongXiangShengPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const door = palace.renPan.door;
    if (!door) return;

    const doorEl = doorElements[door];
    const palaceEl = palace.element;

    if (!doorEl || !palaceEl) return;

    // 宫生门（地利助事）
    if (isGenerating(palaceEl, doorEl)) {
      out.push({
        key: `pattern:gongShengMen:${palace.gong}`,
        name: '宫生门',
        tone: 'good',
        score: 3,
        summary: `${palace.name}（${palaceEl}）生${door}（${doorEl}），此地利助事之象。`,
        modern: `在${palace.name}方位的相关事情能得到环境支持，比较顺利。`,
        manifestation: '环境支持、阻力小',
        palace: palace.gong,
        tokens: [door, palace.name],
      });
    }

    // 门生宫（事利其地）
    if (isGenerating(doorEl, palaceEl)) {
      out.push({
        key: `pattern:menShengGong:${palace.gong}`,
        name: '门生宫',
        tone: 'good',
        score: 3,
        summary: `${door}（${doorEl}）生${palace.name}（${palaceEl}），此事有利该宫方位。`,
        modern: `在${palace.name}方位做与${door}相关的事，容易得到滋养和助力。`,
        manifestation: '做事顺畅、有助力',
        palace: palace.gong,
        tokens: [door, palace.name],
      });
    }
  });

  return out;
}

// ============================================================================
// 6. 击刑
// ============================================================================

/**
 * 识别击刑格局
 *
 * 《烟波钓叟歌》：「击刑之处防官非」
 * 时干或值符落在击刑位。击刑代表该干在本宫的地支相刑，
 * 主规则束缚、口舌是非、压力增大。
 *
 * 击刑宫位：
 *   戊在震3，己在坤2，庚在艮8，辛在离9，壬在巽4，癸在巽4
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 检测到的击刑格局列表
 */
function getJiXingPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const gong = palace.gong;

    if (!heaven) return;

    const xingGongs = stemJiXingPalace[heaven];
    if (xingGongs && xingGongs.includes(gong)) {
      // 特别标注甲遁戊（地盘甲震3宫击刑已在戊处理）
      out.push({
        key: `pattern:jiXing:${palace.gong}`,
        name: `${heaven}击刑`,
        tone: 'bad',
        score: -4,
        summary: `${heaven}在${palace.name}击刑（${heaven}在此宫落于相刑之位），主规则、口舌、文书方面要小心。`,
        modern: `天盘${heaven}落${palace.name}为击刑位，今天与${heaven}相关的事要注意规则风险和口舌是非。`,
        manifestation: '规则约束、口舌是非、压力增大',
        palace: gong,
        tokens: [heaven, palace.name],
      });
    }
  });

  return out;
}

// ============================================================================
// 7. 入墓（天干入墓宫）
// ============================================================================

/**
 * 识别天干入墓格局
 *
 * 《烟波钓叟歌》：「十干入墓主事迟」
 * 天干入墓宫，主能量收敛、事情停滞或难以施展。
 *
 * 墓宫以 _constants.STEM_TOMB_MAP 为唯一来源：
 *   乙入未（坤2），丙入戌（乾6），丁入丑（艮8），
 *   戊入戌（乾6），己入辰（巽4），庚入未（坤2），
 *   辛入丑（艮8），壬入辰（巽4），癸入辰（巽4）
 *
 * @param jiuGongGe - 九宫格数据
 * @param position - 检查天盘或地盘，默认为天盘
 * @returns 检测到的入墓格局列表
 */
function getRuMuPatterns(
  jiuGongGe: QimenJiuGongGe[],
  position: 'tianPan' | 'diPan' = 'tianPan',
): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const stem = position === 'tianPan' ? palace.tianPan.stem : palace.diPan.stem;
    if (!stem) return;

    const muGong = getStemTombPalace(stem);
    if (!muGong) return;

    if (muGong === palace.gong) {
      const tombBranch = getStemTombBranch(stem);
      out.push({
        key: `pattern:ruMu:${stem}:${palace.gong}:${position === 'diPan' ? 'di' : 'tian'}`,
        name: `${stem}入墓`,
        tone: 'bad',
        score: -3,
        summary: `${stem}在${palace.name}入墓${tombBranch ? `（墓在${tombBranch}）` : ''}，主能量收敛、事情停滞或难以施展。`,
        modern: `${stem}相关的方面今天劲使不出来，建议先做其他准备，等时机转好再推。`,
        manifestation: '能量收敛、进展缓慢',
        palace: palace.gong,
        tokens: [stem, palace.name],
      });
    }
  });

  return out;
}

// ============================================================================
// 8. 天地盘干命名格局与关系
// ============================================================================

function getStemPairNamedPatterns(jiuGongGe: QimenJiuGongGe[]): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const earth = palace.diPan.stem;
    if (!heaven || !earth) return;

    const pattern = getNamedStemPairPattern(heaven, earth);
    if (!pattern) return;

    out.push({
      key: `pattern:stemPair:${heaven}_${earth}:${palace.gong}`,
      name: pattern.name,
      tone: pattern.type,
      score: pattern.score,
      summary: `天盘${heaven}加地盘${earth}于${palace.name}，${pattern.summary}`,
      modern: pattern.interpretation,
      manifestation: pattern.manifestation,
      palace: palace.gong,
      tokens: [heaven, earth],
    });
  });

  return out;
}

/**
 * 识别天地盘干关系
 *
 * 每个宫位最多输出一条主关系，并附加最多一条特殊（入墓/击刑/奇仪相合）。
 *
 * 入墓与击刑为独立判定，与五行关系可以共存不同宫位，但同宫内
 * 若已有入墓或击刑，则不再输出五行生克/奇仪相合（避免关系过多）。
 *
 * @param jiuGongGe - 九宫格数据
 * @returns 天地盘干关系列表
 */
export function getStemRelations(jiuGongGe: QimenJiuGongGe[]): StemRelation[] {
  const relations: StemRelation[] = [];

  jiuGongGe.forEach((palace) => {
    const heaven = palace.tianPan.stem;
    const earth = palace.diPan.stem;
    if (!heaven || !earth) return;

    const he = stemElements[heaven];
    const ee = stemElements[earth];

    const namedPattern = getNamedStemPairPattern(heaven, earth);
    if (namedPattern) {
      relations.push({
        heaven,
        earth,
        palace: palace.gong,
        type: '命名格局',
        note: `${namedPattern.name}：${namedPattern.summary}`,
      });
      return;
    }

    // 入墓判断：天盘干落入统一入墓表对应墓宫（入墓与击刑可同宫并存，均独立判定）
    const tombPalace = getStemTombPalace(heaven);
    const tombBranch = getStemTombBranch(heaven);
    let muHit = false;
    if (tombPalace === palace.gong) {
      muHit = true;
      relations.push({
        heaven,
        earth,
        palace: palace.gong,
        type: '入墓',
        note: `${heaven}入${palace.name}墓库${tombBranch ? `（墓在${tombBranch}）` : ''}，能量收敛，事情容易停在原地`,
      });
    }

    // 击刑：天盘干落入特定宫（独立判定，不被入墓抢先）
    let xingHit = false;
    if (stemJiXingPalace[heaven]?.includes(palace.gong)) {
      xingHit = true;
      relations.push({
        heaven,
        earth,
        palace: palace.gong,
        type: '击刑',
        note: `${heaven}在${palace.name}击刑，规则、口舌、文书方面要小心`,
      });
    }

    // 入墓或击刑命中后，不再输出五行生克/奇仪相合（避免同宫关系过多）
    if (muHit || xingHit) return;

    // 奇仪相合
    const heAndPairs: Array<[string, string, string]> = [
      ['乙', '己', '乙己合（日月相合，主合作得宜）'],
      ['丙', '辛', '丙辛合（威制之合，主达成共识）'],
      ['丁', '壬', '丁壬合（仁义之合，主关系巩固）'],
      ['戊', '癸', '戊癸合（无情之合，要看后续诚意）'],
      ['甲', '己', '甲己合（中正之合，主稳定推进）'],
    ];
    const hePair = heAndPairs.find(
      ([a, b]) => (heaven === a && earth === b) || (heaven === b && earth === a),
    );
    if (hePair) {
      relations.push({
        heaven,
        earth,
        palace: palace.gong,
        type: '奇仪相合',
        note: `${palace.name}见${hePair[2]}`,
      });
      return;
    }

    // 五行生克
    if (he && ee) {
      if (he === ee) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '比和',
          note: `${palace.name}天地干同气${heaven}，事情稳但不易变`,
        });
      } else if (isControlling(he, ee)) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '克下',
          note: `${heaven}克${earth}（${palace.name}天克地，主上压下，可主动出手，但要顾及承接）`,
        });
      } else if (isControlling(ee, he)) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '克上',
          note: `${earth}克${heaven}（${palace.name}地克天，主下顶上，外部环境压制，要先稳后动）`,
        });
      } else if (isGenerating(he, ee)) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '生下',
          note: `${heaven}生${earth}（${palace.name}天生地，主上助下，资源能落地）`,
        });
      } else if (isGenerating(ee, he)) {
        relations.push({
          heaven,
          earth,
          palace: palace.gong,
          type: '生上',
          note: `${earth}生${heaven}（${palace.name}地生天，主下托上，根基会给力）`,
        });
      }
    }
  });

  return relations;
}

// ============================================================================
// 入口函数：综合识别所有经典格局
// ============================================================================

/** 经典格局识别上下文 */
export interface PatternContext {
  /** 九宫格数据 */
  jiuGongGe: QimenJiuGongGe[];
  /** 值符星 */
  zhiFu: string;
  /** 值使门 */
  zhiShi: string;
  /** 年干支，用于岁格 */
  yearGanZhi?: string;
  /** 月干支，用于月格 */
  monthGanZhi?: string;
  /** 日干 */
  dayStem?: string;
  /** 日干支，用于甲日遁干与日干飞伏格 */
  dayGanZhi?: string;
  /** 时辰干支，用于时格、天辅时等按日时组合成立的格局 */
  hourGanZhi?: string;
}

/**
 * 识别所有经典奇门格局
 *
 * 涵盖：
 *   九大遁格（天遁、地遁、人遁、神遁、鬼遁、龙遁、虎遁、风遁、云遁）
 *   三奇格局（得使、升殿、入墓、会甲）与三诈五假
 *   值符值使关系（符使同宫、相佐、守户、天乙飞宫格、天乙伏宫格、天辅时）
 *   玉女守门
 *   门迫与门宫相生
 *   击刑
 *   入墓
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「天遁地遁与人遁，龙遁虎遁与风遁，云遁鬼遁与神遁」
 *   - 《奇门遁甲秘籍大全》：「三奇得使最为良，玉女守门喜非常」
 *   - 《烟波钓叟歌》：「十干入墓主事迟，击刑之处防官非」
 *   - 《五行大义》：「门迫则事阻，宫生则事成」
 *
 * @param ctx - 识别上下文
 * @returns 检测到的所有经典格局列表
 */
export function getClassicPatterns(ctx: PatternContext): ClassicPattern[] {
  const { jiuGongGe, zhiFu, zhiShi, yearGanZhi, monthGanZhi, dayStem, dayGanZhi, hourGanZhi } =
    ctx;

  const patterns: ClassicPattern[] = [
    // 1. 九大遁格
    ...getDunPatterns(jiuGongGe),
    // 2. 三奇格局
    ...getSanQiDeShiPatterns(jiuGongGe),
    ...getBaoJianSanQiDeShiPatterns(jiuGongGe, zhiShi),
    ...getSanQiYouLiuYiPatterns(jiuGongGe, zhiFu),
    ...getSanZhaPatterns(jiuGongGe),
    ...getJiaPatterns(jiuGongGe),
    ...getSanQiShengDianPatterns(jiuGongGe),
    ...getSanQiRuMuPatterns(jiuGongGe),
    ...getSanQiShouZhiPatterns(jiuGongGe),
    ...(dayStem ? getSanQiHuiJiaPattern(jiuGongGe, dayStem) : []),
    // 3. 值符值使关系
    ...getZhiFuZhiShiPatterns(jiuGongGe, zhiFu, zhiShi),
    ...getXiangZuoShouHuPatterns(jiuGongGe, zhiFu, zhiShi),
    ...getTianYiGongGePatterns(jiuGongGe, zhiFu),
    ...getGengZhiFuBoGePatterns(jiuGongGe, zhiFu),
    ...getDayGanFeiFuPatterns(jiuGongGe, dayStem, dayGanZhi),
    ...getGengTemporalGePatterns(jiuGongGe, { yearGanZhi, monthGanZhi, hourGanZhi }),
    ...getBingTemporalBoGePatterns(jiuGongGe, { yearGanZhi, monthGanZhi, dayGanZhi, hourGanZhi }),
    ...getRenTemporalDiLuoPatterns(jiuGongGe, hourGanZhi),
    ...(dayStem && hourGanZhi ? getTianFuShiPattern(dayStem, hourGanZhi) : []),
    // 4. 玉女守门
    ...getYuNvShouMenPattern(jiuGongGe, zhiShi),
    // 5. 八门格局
    ...getMenPoPatterns(jiuGongGe),
    ...getMenGongXiangShengPatterns(jiuGongGe),
    // 6. 击刑（天盘干）
    ...getJiXingPatterns(jiuGongGe),
    // 7. 入墓（天盘干）
    ...getRuMuPatterns(jiuGongGe, 'tianPan'),
    // 8. 天地盘干命名格局
    ...getStemPairNamedPatterns(jiuGongGe),
  ];

  // 给所有未手动设置manifest的格局自动补充manifest
  const defaultManifest = (tone: 'good' | 'bad' | 'neutral'): string => {
    if (tone === 'good') return '事情会比较顺利，能看到正向反馈';
    if (tone === 'bad') return '事情容易遇到阻碍，要注意防范';
    return '盘面偏中性，按实际情况判断';
  };

  patterns.forEach((p) => {
    if (!p.manifestation) {
      p.manifestation = defaultManifest(p.tone);
    }
  });

  return patterns;
}
