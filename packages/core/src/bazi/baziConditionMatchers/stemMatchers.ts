import type { Matcher } from './types';

const TOU_GAN_REGEX = /([甲乙丙丁戊己庚辛壬癸])[金木水火土]?透干/;
const FA_YONG_REGEX = /([甲乙丙丁戊己庚辛壬癸])[金木水火土]?发用/;
const TIAN_GAN_DUO_REGEX = /天干三([甲乙丙丁戊己庚辛壬癸])/;
const WU_HE_REGEX = /([甲乙丙丁戊己庚辛壬癸])([甲乙丙丁戊己庚辛壬癸])同透/;
const NO_ZHENG_HE_REGEX = /无([甲乙丙丁戊己庚辛壬癸])([甲乙丙丁戊己庚辛壬癸])争合/;
const NO_TOU_GAN_REGEX = /不见天干([甲乙丙丁戊己庚辛壬癸])/;

export const touGanMatcher: Matcher = ({ condition, allStems }) => {
  const match = condition.match(TOU_GAN_REGEX);
  if (!match) return null;
  return allStems.includes(match[1]);
};

export const faYongMatcher: Matcher = ({ condition, allStems }) => {
  const match = condition.match(FA_YONG_REGEX);
  if (!match) return null;
  return allStems.includes(match[1]);
};

export const tianGanDuoMatcher: Matcher = ({ condition, allStems }) => {
  const match = condition.match(TIAN_GAN_DUO_REGEX);
  if (!match) return null;
  const target = match[1];
  const count = allStems.filter((s) => s === target).length;
  return count >= 3;
};

export const wuHeMatcher: Matcher = ({ condition, allStems, dayStem, pillars }) => {
  const match = condition.match(WU_HE_REGEX);
  if (!match) return null;
  const stemA = match[1];
  const stemB = match[2];
  if (!allStems.includes(stemA) || !allStems.includes(stemB)) return false;
  // 古典化气格须由日干参与五合，且合神紧贴于月干或时干；年时隔位或日主未参与不能作真化
  if (dayStem) {
    if (dayStem !== stemA && dayStem !== stemB) return false;
    const partner = dayStem === stemA ? stemB : stemA;
    const isAdjacent = pillars?.month?.gan === partner || pillars?.hour?.gan === partner;
    if (!isAdjacent) return false;
  }
  return true;
};

export const noTouGanMatcher: Matcher = ({ condition, allStems }) => {
  const match = condition.match(NO_TOU_GAN_REGEX);
  if (!match) return null;
  return !allStems.includes(match[1]);
};

export const noZhengHeMatcher: Matcher = ({ condition, allStems }) => {
  const match = condition.match(NO_ZHENG_HE_REGEX);
  if (!match) return null;
  const count1 = allStems.filter((s) => s === match[1]).length;
  const count2 = allStems.filter((s) => s === match[2]).length;
  return !(count1 >= 2 || count2 >= 2);
};
