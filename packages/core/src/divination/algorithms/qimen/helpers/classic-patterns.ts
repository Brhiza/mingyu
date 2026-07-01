/**
 * @file 奇门遁甲经典格局识别
 * @description 实现九大遁格、三奇格局、值符值使关系、玉女守门、门迫、击刑、入墓、
 * 天地盘干关系等经典格局的完整检测。
 *
 * 古籍依据：
 *   - 《烟波钓叟歌》：「天遁地遁与人遁，龙遁虎遁与风遁，云遁鬼遁与神遁，九遁合参最上乘」
 *   - 《遁甲演义》：「三奇得使最为良，玉女守门喜非常」
 *   - 《奇门遁甲秘籍大全》：「符使同宫事必成，门迫宫兮事难行」
 *   - 《烟波钓叟歌》：「十干入墓主事迟，击刑之处防官非」
 *
 * 本模块只处理需要多要素组合判定的复合格局。单一干干加临格局
 * （青龙返首、飞鸟跌穴、青龙逃走、白虎猖狂等九九八十一格）
 * 在 stem-pair-patterns.ts 中完整覆盖，此处不再重复。
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
  type: '克上' | '克下' | '相佐' | '比和' | '生上' | '生下' | '奇仪相合' | '入墓' | '击刑' | '空亡';
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
    // 《遁甲演义》：开门+乙奇+天盘丙 同宫，主上升机会与天助
    // 或 丙+开门+生门
    if (door === '开门' && heaven === '丙' && earth === '乙') {
      out.push({
        key: `pattern:tianDun:${gong}`,
        name: '天遁',
        tone: 'good',
        score: 9,
        summary: '开门、乙奇、天盘丙同宫，乃天遁之格，主上升机会与天助。',
        modern:
          '特别难得的机会窗口，主动出击都顺，关键沟通和签约都有利。但出手要果断，拖久了就凉了。',
        manifestation: '关键沟通顺利、签约成功、对方主动抛出好条件',
        palace: gong,
        tokens: ['开门', '乙', '丙'],
      });
    }

    // ── 地遁 ──
    // 《遁甲演义》：休门+丁奇+地盘乙 同宫，主稳健长远、地利相助
    // 或 乙+开门
    if (door === '休门' && heaven === '丁' && earth === '乙') {
      out.push({
        key: `pattern:diDun:${gong}`,
        name: '地遁',
        tone: 'good',
        score: 8,
        summary: '休门、丁奇、地盘乙同宫，乃地遁之格，主稳健长远、地利相助。',
        modern: '适合做需要稳扎稳打的事，比如基础准备、长期布局。',
        manifestation: '基础扎实、长期项目推进顺利',
        palace: gong,
        tokens: ['休门', '丁', '乙'],
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
    // 《奇门遁甲秘籍大全》：乙+杜门+九地 或 开门+丁奇+九地
    // 主暗中操作、私下成事
    if (
      (door === '杜门' && heaven === '乙' && god === '九地') ||
      (door === '开门' && heaven === '丁' && god === '九地')
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
 * 《奇门遁甲秘籍大全》：乙/丙/丁三奇各临值使门所在宫为"得使"。
 * 乙奇+值使门=日奇得使，丙奇+值使门=月奇得使，丁奇+值使门=星奇得使。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiShi - 值使门
 * @returns 检测到的三奇得使格局列表
 */
function getSanQiDeShiPatterns(jiuGongGe: QimenJiuGongGe[], zhiShi: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiShi) return out;

  const zhiShiPal = findDoorPalace(jiuGongGe, zhiShi);
  if (!zhiShiPal) return out;

  const heavenStem = zhiShiPal.tianPan.stem;

  if (heavenStem === '乙') {
    out.push({
      key: `pattern:riQiDeShi:${zhiShiPal.gong}`,
      name: '日奇得使',
      tone: 'good',
      score: 8,
      summary: `乙奇临值使${zhiShi}所在${zhiShiPal.name}，乃日奇得使之格，主文书协商大利。`,
      modern: '协商、文书、柔性沟通的事特别顺，关键人物愿意配合；乙奇得使可大胆推进需要共识的事。',
      manifestation: '协商成功、文书签成、对方配合度高',
      palace: zhiShiPal.gong,
      tokens: ['乙', zhiShi],
    });
  }
  if (heavenStem === '丙') {
    out.push({
      key: `pattern:yueQiDeShi:${zhiShiPal.gong}`,
      name: '月奇得使',
      tone: 'good',
      score: 8,
      summary: `丙奇临值使${zhiShi}所在${zhiShiPal.name}，乃月奇得使之格，主展示显达大利。`,
      modern: '展示、表达、对外发声有特别效果，能被关键的人看到；月奇得使可以放心做需要曝光的事。',
      manifestation: '展示获好评、表达被听见、关键曝光',
      palace: zhiShiPal.gong,
      tokens: ['丙', zhiShi],
    });
  }
  if (heavenStem === '丁') {
    out.push({
      key: `pattern:xingQiDeShi:${zhiShiPal.gong}`,
      name: '星奇得使',
      tone: 'good',
      score: 8,
      summary: `丁奇临值使${zhiShi}所在${zhiShiPal.name}，乃星奇得使之格，主精细暗助大利。`,
      modern: '精细工作、暗中协调、内部沟通效果特别好；星奇得使适合做需要精修和幕后推动的事。',
      manifestation: '内部协调顺利、精修见效、暗助到位',
      palace: zhiShiPal.gong,
      tokens: ['丁', zhiShi],
    });
  }

  // 三奇得使 + 值使为三吉门 → 三奇得地（更强吉格）
  if (auspiciousDoors.includes(zhiShi) && ['乙', '丙', '丁'].includes(heavenStem)) {
    const qiNameMap: Record<string, string> = { 乙: '日奇', 丙: '月奇', 丁: '星奇' };
    out.push({
      key: `pattern:deShiPlusGoodDoor:${zhiShiPal.gong}`,
      name: `${qiNameMap[heavenStem]}得地`,
      tone: 'good',
      score: 11,
      summary: `${qiNameMap[heavenStem]}临吉门${zhiShi}（值使），得地得使，双重吉利。`,
      modern: '今天关键事有特别好的入口，资源、信息、关键人同时到位，别错过机会窗口。',
      manifestation: '机会窗口打开、资源到位、关键人配合',
      palace: zhiShiPal.gong,
      tokens: [heavenStem, zhiShi],
    });
  }

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
 * 《烟波钓叟歌》：「十干入墓主事迟」
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
    const tombPalace = getStemTombPalace(heaven);
    const tombBranch = getStemTombBranch(heaven);

    if (!config || tombPalace !== gong || !tombBranch) return;

    out.push({
      key: `pattern:${config.key}:${gong}`,
      name: config.name,
      tone: 'bad',
      score: config.score,
      summary: `${heaven}奇入${palace.name}（${heaven}墓在${tombBranch}），${config.name}，${config.result}。`,
      modern: config.modern,
      manifestation: config.manifestation,
      palace: gong,
      tokens: [heaven, palace.name],
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
 * 识别天乙飞干格与天乙伏干格
 *
 * 《奇门遁甲元灵经》：
 *   天乙飞干格——值符天干天盘+地盘庚（值符主动出击，但力有不逮）
 *   天乙伏干格——天盘庚+地盘值符天干（庚克制值符，贵人受压）
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiFu - 值符星
 * @returns 检测到的天乙飞干格/伏干格列表
 */
function getTianYiGanGePatterns(jiuGongGe: QimenJiuGongGe[], zhiFu: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiFu) return out;

  // 九星对应的天干（值符星的天干属性）
  const starToStem: Record<string, string> = {
    天蓬: '壬',
    天芮: '己',
    天冲: '甲',
    天辅: '乙',
    天禽: '戊',
    天心: '辛',
    天柱: '庚',
    天任: '丙',
    天英: '丁',
  };

  const tianYiStem = starToStem[zhiFu];

  if (!tianYiStem || tianYiStem === '庚') return out;

  // 天乙飞干格：值符天干（天盘）+ 地盘庚
  const tianYiPal = findStemPalace(jiuGongGe, tianYiStem, 'tianPan');
  if (tianYiPal && tianYiPal.diPan.stem === '庚') {
    out.push({
      key: `pattern:tianYiFeiGanGe:${tianYiPal.gong}`,
      name: '天乙飞干格',
      tone: 'bad',
      score: -6,
      summary: `值符${tianYiStem}加地盘庚于${tianYiPal.name}，名天乙飞干格，主值符力量被冲。`,
      modern: '今天贵人运受阻，想帮你的人也不好出手，关键事先靠自己。',
      manifestation: '贵人使不上力、求援被拒',
      palace: tianYiPal.gong,
      tokens: [tianYiStem, '庚'],
    });
  }

  // 天乙伏干格：天盘庚 + 地盘值符天干
  const gengPal = findStemPalace(jiuGongGe, '庚', 'tianPan');
  if (gengPal && gengPal.diPan.stem === tianYiStem) {
    out.push({
      key: `pattern:tianYiFuGanGe:${gengPal.gong}`,
      name: '天乙伏干格',
      tone: 'bad',
      score: -7,
      summary: `天盘庚加地盘值符${tianYiStem}于${gengPal.name}，名天乙伏干格，主贵人受困。`,
      modern: '今天想帮你的人自己也有事缠身，重大支持的渠道先确认再依赖。',
      manifestation: '贵人自顾不暇、支持渠道不畅',
      palace: gengPal.gong,
      tokens: ['庚', tianYiStem],
    });
  }

  return out;
}

/**
 * 识别天辅时格局
 *
 * 《奇门遁甲元灵经》：甲日/己日天辅星为值符为"天辅时"，百事皆宜。
 *
 * @param dayStem - 日干
 * @param zhiFu - 值符星
 * @returns 检测到的天辅时格局列表
 */
function getTianFuShiPattern(dayStem: string, zhiFu: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if ((dayStem === '甲' || dayStem === '己') && zhiFu === '天辅') {
    out.push({
      key: 'pattern:tianFuShi',
      name: '天辅时',
      tone: 'good',
      score: 6,
      summary: '甲（己）日天辅星为值符，名天辅时，主百事皆宜。',
      modern: '今天适合推进各类事务，时机恰到好处，可以放心行动。',
      manifestation: '诸事顺利、百无禁忌',
      tokens: ['天辅'],
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
 * 《烟波钓叟歌》：「更有三奇游六仪，号为玉女守门扉」
 * 玉女守门：丁奇临值使三吉门（开门/休门/生门）所在宫，
 * 主婚姻文书、柔顺得机。
 *
 * @param jiuGongGe - 九宫格数据
 * @param zhiShi - 值使门
 * @returns 检测到的玉女守门格局列表
 */
function getYuNvShouMenPattern(jiuGongGe: QimenJiuGongGe[], zhiShi: string): ClassicPattern[] {
  const out: ClassicPattern[] = [];

  if (!zhiShi || !auspiciousDoors.includes(zhiShi)) return out;

  const zhiShiPal = findDoorPalace(jiuGongGe, zhiShi);
  if (zhiShiPal && zhiShiPal.tianPan.stem === '丁') {
    out.push({
      key: `pattern:yunvShoumen:${zhiShiPal.gong}`,
      name: '玉女守门',
      tone: 'good',
      score: 8,
      summary: `丁奇临值使${zhiShi}所在${zhiShiPal.name}，乃玉女守门之格，主婚姻文书、柔顺得机。`,
      modern: '今天谈感情、签文书、谈合作都特别顺，对方愿意配合，柔性方式最有效。',
      manifestation: '关系缓和、对方愿意配合、沟通变顺',
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
// 8. 天地盘干关系
// ============================================================================

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
  /** 日干 */
  dayStem?: string;
}

/**
 * 识别所有经典奇门格局
 *
 * 涵盖：
 *   九大遁格（天遁、地遁、人遁、神遁、鬼遁、龙遁、虎遁、风遁、云遁）
 *   三奇格局（得使、升殿、入墓、会甲）
 *   值符值使关系（符使同宫、天乙飞干格、天乙伏干格、天辅时）
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
  const { jiuGongGe, zhiFu, zhiShi, dayStem } = ctx;

  const patterns: ClassicPattern[] = [
    // 1. 九大遁格
    ...getDunPatterns(jiuGongGe),
    // 2. 三奇格局
    ...getSanQiDeShiPatterns(jiuGongGe, zhiShi),
    ...getSanQiShengDianPatterns(jiuGongGe),
    ...getSanQiRuMuPatterns(jiuGongGe),
    ...(dayStem ? getSanQiHuiJiaPattern(jiuGongGe, dayStem) : []),
    // 3. 值符值使关系
    ...getZhiFuZhiShiPatterns(jiuGongGe, zhiFu, zhiShi),
    ...getTianYiGanGePatterns(jiuGongGe, zhiFu),
    ...(dayStem ? getTianFuShiPattern(dayStem, zhiFu) : []),
    // 4. 玉女守门
    ...getYuNvShouMenPattern(jiuGongGe, zhiShi),
    // 5. 八门格局
    ...getMenPoPatterns(jiuGongGe),
    ...getMenGongXiangShengPatterns(jiuGongGe),
    // 6. 击刑（天盘干）
    ...getJiXingPatterns(jiuGongGe),
    // 7. 入墓（天盘干）
    ...getRuMuPatterns(jiuGongGe, 'tianPan'),
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
