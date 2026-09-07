/**
 * @file index.ts
 * Classical metaphysics dictionaries and rules export barrel.
 */

export * from './types';
export * from './qimen-patterns';
export * from './bazi-qiongtong';
export * from './bazi-ditiansui';
export * from './bazi-ziping';
export * from './liuyao-rules';
export * from './meihua-rules';
export * from './zhouyi';
export * from './xiaoliuren-classics';
export * from './jinkoujue-rules';
export * from './liuren-rules';
export * from './ziwei-classics';
export * from './fengshui-classics';
export * from './taiyi-classics';
export * from './huangji-classics';
export * from './qizheng-classics';
export * from './wuyun-liuqi-classics';
export * from './almanac-classics';

import {
  QIMEN_STEM_PATTERNS,
  getQimenDeityClassic as queryQimenDeityClassic,
  getQimenDoorClassic as queryQimenDoorClassic,
  getQimenStarClassic as queryQimenStarClassic,
  getQimenYanboClassic as queryQimenYanboClassic,
  getAllQimenYanboClassics as queryAllQimenYanboClassics,
} from './qimen-patterns';
import { getBaziQiongtongAdvice as queryBaziQiongtongAdvice } from './bazi-qiongtong';
import { getBaziDitiansuiAdvice as queryBaziDitiansuiAdvice } from './bazi-ditiansui';
import { getBaziZipingPatternAdvice as queryBaziZipingPatternAdvice } from './bazi-ziping';
import {
  LIUYAO_MOVEMENT_RULES,
  getLiuyaoChishiClassic as queryLiuyaoChishiClassic,
} from './liuyao-rules';
import {
  MEIHUA_RELATION_JUDGEMENTS,
  getMeihuaTrigramClassic as queryMeihuaTrigramClassic,
} from './meihua-rules';
import { ZHOUYI_HEXAGRAMS_TEXT } from './zhouyi';
import { getXiaoliurenClassic as queryXiaoliurenClassic } from './xiaoliuren-classics';
import { getJinkoujueMovementClassic as queryJinkoujueMovementClassic } from './jinkoujue-rules';
import {
  getLiurenTransmissionClassic as queryLiurenTransmissionClassic,
  getLiurenLessonPatternClassic as queryLiurenLessonPatternClassic,
  getLiurenGeneralClassic as queryLiurenGeneralClassic,
  getLiurenBifaClassic as queryLiurenBifaClassic,
  getAllLiurenBifaClassics as queryAllLiurenBifaClassics,
} from './liuren-rules';
import {
  getZiweiStarClassic as queryZiweiStarClassic,
  getZiweiFuClassic as queryZiweiFuClassic,
  getAllZiweiFuClassics as queryAllZiweiFuClassics,
} from './ziwei-classics';
import {
  getBazhaiStarClassic as queryBazhaiStarClassic,
  getXuankongStarClassic as queryXuankongStarClassic,
} from './fengshui-classics';
import { getTaiyiGeneralClassic as queryTaiyiGeneralClassic } from './taiyi-classics';
import { getHuangjiCycleClassic as queryHuangjiCycleClassic } from './huangji-classics';
import { getQizhengStarClassic as queryQizhengStarClassic } from './qizheng-classics';
import { getWuyunLiuqiClassic as queryWuyunLiuqiClassic } from './wuyun-liuqi-classics';
import { getAlmanacOfficerClassic as queryAlmanacOfficerClassic } from './almanac-classics';
import type {
  AlmanacOfficerClassic,
  BaziDitiansuiEntry,
  BaziQiongtongEntry,
  BaziZipingPatternEntry,
  BazhaiStarClassic,
  HuangjiCycleClassic,
  JinkoujueMovementClassic,
  LiurenGeneralClassic,
  LiurenLessonPatternClassic,
  LiurenTransmissionClassic,
  LiuyaoChishiClassic,
  LiuyaoMovementRule,
  MeihuaBodyUseJudgement,
  MeihuaTrigramClassic,
  QimenDeityClassic,
  QimenDoorClassic,
  QimenStarClassic,
  QimenStemPattern,
  QizhengStarClassic,
  TaiyiGeneralClassic,
  XiaoliurenPalaceClassic,
  XuankongStarClassic,
  WuyunLiuqiClassic,
  ZhouyiHexagramText,
  ZiweiFuClassic,
  ZiweiStarClassic,
} from './types';

/**
 * 查询奇门遁甲天盘干 + 地盘干 十干克应格局
 */
export function getQimenStemPattern(
  heavenStem: string,
  earthStem: string,
): QimenStemPattern | undefined {
  return QIMEN_STEM_PATTERNS[`${heavenStem}+${earthStem}`];
}

/**
 * 查询奇门遁甲九星释义
 */
export function getQimenStarClassic(star: string): QimenStarClassic | undefined {
  return queryQimenStarClassic(star);
}

/**
 * 查询奇门遁甲八门释义
 */
export function getQimenDoorClassic(door: string): QimenDoorClassic | undefined {
  return queryQimenDoorClassic(door);
}

/**
 * 查询奇门遁甲八神释义
 */
export function getQimenDeityClassic(deity: string): QimenDeityClassic | undefined {
  return queryQimenDeityClassic(deity);
}

/**
 * 查询奇门遁甲烟波钓叟歌精义
 */
export function getQimenYanboClassic(keyword: string) {
  return queryQimenYanboClassic(keyword);
}

export function getAllQimenYanboClassics() {
  return queryAllQimenYanboClassics();
}

/**
 * 查询八字《穷通宝鉴》日主生于月令调候断语
 */
export function getBaziQiongtongAdvice(
  dayMaster: string,
  monthBranch: string,
): BaziQiongtongEntry | undefined {
  return queryBaziQiongtongAdvice(dayMaster, monthBranch);
}

/**
 * 查询八字《滴天髓》日主十干体象与性情
 */
export function getBaziDitiansuiAdvice(dayMaster: string): BaziDitiansuiEntry | undefined {
  return queryBaziDitiansuiAdvice(dayMaster);
}

/**
 * 查询八字《子平真诠》八格取用与纯杂判定
 */
export function getBaziZipingPatternAdvice(pattern: string): BaziZipingPatternEntry | undefined {
  return queryBaziZipingPatternAdvice(pattern);
}

/**
 * 查询六爻动变规则与《黄金策》《增删卜易》断语
 */
export function getLiuyaoMovementRule(key: string): LiuyaoMovementRule | undefined {
  return LIUYAO_MOVEMENT_RULES[key];
}

/**
 * 查询六爻六亲持世歌诀
 */
export function getLiuyaoChishiClassic(sixRelation: string): LiuyaoChishiClassic | undefined {
  return queryLiuyaoChishiClassic(sixRelation);
}

/**
 * 查询梅花易数体用生克决断
 */
export function getMeihuaBodyUseJudgement(
  relationType: string,
): MeihuaBodyUseJudgement | undefined {
  return MEIHUA_RELATION_JUDGEMENTS[relationType];
}

/**
 * 查询梅花易数八卦万物类象
 */
export function getMeihuaTrigramClassic(trigram: string): MeihuaTrigramClassic | undefined {
  return queryMeihuaTrigramClassic(trigram);
}

/**
 * 查询周易卦爻辞全本经文
 */
export function getZhouyiHexagramClassic(hexagramId: number): ZhouyiHexagramText | undefined {
  return ZHOUYI_HEXAGRAMS_TEXT[hexagramId];
}

/**
 * 查询小六壬六宫歌诀及主题解释。
 */
export function getXiaoliurenClassic(palaceName: string): XiaoliurenPalaceClassic | undefined {
  return queryXiaoliurenClassic(palaceName);
}

/**
 * 查询金口诀五动三动与《金口诀大全》断语
 */
export function getJinkoujueMovementClassic(key: string): JinkoujueMovementClassic | undefined {
  return queryJinkoujueMovementClassic(key);
}

/**
 * 查询大六壬九宗门取传与《大六壬大全》法则
 */
export function getLiurenTransmissionClassic(rule: string): LiurenTransmissionClassic | undefined {
  return queryLiurenTransmissionClassic(rule);
}

/**
 * 查询大六壬经典课体与《六壬指南》释义
 */
export function getLiurenLessonPatternClassic(
  pattern: string,
): LiurenLessonPatternClassic | undefined {
  return queryLiurenLessonPatternClassic(pattern);
}

/**
 * 查询大六壬十二天将精解
 */
export function getLiurenGeneralClassic(general: string): LiurenGeneralClassic | undefined {
  return queryLiurenGeneralClassic(general);
}

/**
 * 查询大六壬毕法赋
 */
export function getLiurenBifaClassic(keyword: string) {
  return queryLiurenBifaClassic(keyword);
}

export function getAllLiurenBifaClassics() {
  return queryAllLiurenBifaClassics();
}

/**
 * 查询紫微斗数十四正曜诸星问答论
 */
export function getZiweiStarClassic(star: string): ZiweiStarClassic | undefined {
  return queryZiweiStarClassic(star);
}

/**
 * 查询紫微斗数太微赋/骨髓赋名句
 */
export function getZiweiFuClassic(key: string): ZiweiFuClassic | undefined {
  return queryZiweiFuClassic(key);
}

export function getAllZiweiFuClassics(): ZiweiFuClassic[] {
  return queryAllZiweiFuClassics();
}

/**
 * 查询八宅明镜四吉四凶星释义
 */
export function getBazhaiStarClassic(star: string): BazhaiStarClassic | undefined {
  return queryBazhaiStarClassic(star);
}

/**
 * 查询玄空飞星九星释义
 */
export function getXuankongStarClassic(
  starNumber: number | string,
): XuankongStarClassic | undefined {
  return queryXuankongStarClassic(starNumber);
}

/**
 * 查询太乙神数八将与主客算释义
 */
export function getTaiyiGeneralClassic(general: string): TaiyiGeneralClassic | undefined {
  return queryTaiyiGeneralClassic(general);
}

/**
 * 查询《皇极经世索隐》的元会运世年周期资料
 */
export function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined {
  return queryHuangjiCycleClassic(cycle);
}

/**
 * 查询七政四余十一曜释义
 */
export function getQizhengStarClassic(star: string): QizhengStarClassic | undefined {
  return queryQizhengStarClassic(star);
}

/**
 * 查询五运六气大运司在经文
 */
export function getWuyunLiuqiClassic(factor: string): WuyunLiuqiClassic | undefined {
  return queryWuyunLiuqiClassic(factor);
}

/**
 * 查询协纪辨方书建除十二神歌诀
 */
export function getAlmanacOfficerClassic(officer: string): AlmanacOfficerClassic | undefined {
  return queryAlmanacOfficerClassic(officer);
}
