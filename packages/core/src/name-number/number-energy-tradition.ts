import { getBaZhaiPalace, type BaZhaiLabel } from '../direction';
import { trigramsByIndex } from '../divination/hexagram-data';

const NUMBER_TRIGRAM_NAMES: Readonly<Record<number, string>> = {
  1: '坎',
  2: '坤',
  3: '震',
  4: '巽',
  6: '乾',
  7: '兑',
  8: '艮',
  9: '离',
};

const STAR_NAMES: Readonly<Record<BaZhaiLabel, string>> = {
  生气: '贪狼',
  天医: '巨门',
  延年: '武曲',
  伏位: '辅弼',
  绝命: '破军',
  五鬼: '廉贞',
  六煞: '文曲',
  祸害: '禄存',
};

export const NUMBER_ENERGY_TRADITION = {
  title: '《钦定协纪辨方书》卷二·大游年变卦',
  sourceUrl: 'https://www.shidianguji.com/book/SK1619/chapter/1l9llp3fvijvs',
  passage:
    '大游年以卦爻变化定八星：上一爻变为生气、贪狼，下二爻变为天医、巨门，三爻俱变为延年、武曲，三爻俱不变为伏位、辅弼；八宫初世为祸害，四世为五鬼，游魂为六煞，归魂为绝命。',
  scope: '大游年原为宅卦相配之法；号码解读借用其卦变关系作民俗取象。',
  numberMapping: '后天卦数：1坎、2坤、3震、4巽、6乾、7兑、8艮、9离。',
  conversion:
    '字母按 A=1 至 Z=26 展开，夹在两端有效卦数之间的 0 取隐藏、5 取增强，是号码解读采用的转换约定。头尾的 0、5 及仅含 0、5 的序列单独记录位置，卦变取两端有效卦数。',
} as const;

function numberTrigram(digit: number) {
  const name = NUMBER_TRIGRAM_NAMES[digit];
  if (!Number.isInteger(digit) || !name) {
    throw new Error('八星卦数需为1、2、3、4、6、7、8、9');
  }
  const trigram = Object.values(trigramsByIndex).find((item) => item.name === name)!;
  return {
    digit,
    name,
    symbol: trigram.symbol,
    element: trigram.element,
    lines: [...trigram.lines],
  };
}

export function analyzeNumberEnergyPair(left: number, right: number) {
  const from = numberTrigram(left);
  const to = numberTrigram(right);
  const name = getBaZhaiPalace(from.name).find((item) => item.gua === to.name)!.label;
  const changedLines = from.lines.flatMap((line, index) =>
    line === to.lines[index] ? [] : [index + 1],
  );
  const changedLineText = changedLines.length
    ? `${changedLines.map((line) => ['下爻', '中爻', '上爻'][line - 1]).join('、')}变化`
    : '三爻相同';
  return {
    from,
    to,
    name,
    starName: STAR_NAMES[name],
    changedLines,
    changedLineText,
    explanation: `${left}为${from.name}${from.symbol}，${right}为${to.name}${to.symbol}；${changedLineText}，大游年对应${name}、${STAR_NAMES[name]}。`,
  };
}
