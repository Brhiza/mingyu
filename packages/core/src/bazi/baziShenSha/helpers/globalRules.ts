import type { BaziArray } from './types';

export function calculateGlobalShenSha(baziArray: BaziArray): string[] {
  const globalShenSha: string[] = [];
  const gans = baziArray.map(([gan]) => gan);
  const zhis = baziArray.map(([, zhi]) => zhi);
  const allCharacters = [...gans, ...zhis];
  const sequences: string[][] = [
    ['甲', '戊', '庚'],
    ['乙', '丙', '丁'],
  ];
  // 《五行精纪》《三命通会》均支持甲戊庚、乙丙丁两组；第三组在不同版本中
  // 分别作辛壬癸、壬癸辛，且《三命通会》明言称辛壬癸为人间三奇“其说无据”。
  // 默认口径不替争议版本选边，第三组失败关闭。
  const hasOrderedStems = (sequence: string[]) => {
    let index = 0;
    for (const gan of gans) {
      if (gan === sequence[index]) {
        index += 1;
      }
      if (index === sequence.length) {
        return true;
      }
    }
    return false;
  };
  for (const seq of sequences) {
    if (hasOrderedStems(seq)) {
      globalShenSha.push('三奇贵人');
      break;
    }
  }

  if (
    ['寅', '午', '戌'].every((zhi) => zhis.includes(zhi)) &&
    !gans.some((gan) => gan === '壬' || gan === '癸')
  ) {
    globalShenSha.push('天火煞');
  }

  // 《三命通会》并列两种挂剑煞结构：巳酉丑申四柱纯全，或巳酉丑三支齐全且其中一支重见。
  // 四柱中后一种等价于四支均属巳酉丑，并完整包含三支。
  const guaJianCoreBranches = ['巳', '酉', '丑'];
  if (
    ['巳', '酉', '丑', '申'].every((zhi) => zhis.includes(zhi)) ||
    (guaJianCoreBranches.every((zhi) => zhis.includes(zhi)) &&
      zhis.every((zhi) => guaJianCoreBranches.includes(zhi)))
  ) {
    globalShenSha.push('挂剑煞');
  }

  // 《五行精纪》只明确“四柱中乙己巳者名曲脚杀”。平头、悬针、破字、
  // 杖刑、阙字与聋哑字所列字符之外，还分别附有“犯多”、空亡、德合、
  // 五行有气等条件，原文没有给出可统一复算的“任意三字即命中”阈值。
  // 旧阈值失败关闭，避免把字表臆造成全局神煞规则。
  if (['乙', '己', '巳'].every((character) => allCharacters.includes(character))) {
    globalShenSha.push('曲脚杀');
  }

  return globalShenSha;
}
