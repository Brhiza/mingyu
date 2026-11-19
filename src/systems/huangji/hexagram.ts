import hexagramsData from '../huangji-hexagrams.json';
export type HexagramData = (typeof hexagramsData)[number];

const PURE_HEXAGRAM_NAMES: Record<string, string> = {
  乾: '乾为天',
  兑: '兑为泽',
  离: '离为火',
  震: '震为雷',
  巽: '巽为风',
  坎: '坎为水',
  艮: '艮为山',
  坤: '坤为地',
};

export const NEXT_AFTER_CARDINAL: Record<string, string> = {
  乾: '姤',
  坤: '复',
  离: '革',
  坎: '蒙',
};

export function getHexagramByShortName(shortName: string): HexagramData {
  const fullName = PURE_HEXAGRAM_NAMES[shortName];
  const found = hexagramsData.find((item) =>
    fullName ? item.name === fullName : item.name.endsWith(shortName),
  );
  if (!found) throw new Error(`缺少皇极经世卦象资料：${shortName}。`);
  return found;
}

export function getHexagramByBinary(binarySymbol: string): HexagramData {
  const found = hexagramsData.find((item) => item.binarySymbol === binarySymbol);
  if (!found) throw new Error(`缺少皇极经世卦画资料：${binarySymbol}。`);
  return found;
}

export function shortHexagramName(hexagram: HexagramData): string {
  const pure = Object.entries(PURE_HEXAGRAM_NAMES).find(([, name]) => name === hexagram.name);
  return pure?.[0] || hexagram.name.slice(2);
}

export function summarizeHexagram(hexagram: HexagramData) {
  return {
    id: hexagram.id,
    name: hexagram.name,
    shortName: shortHexagramName(hexagram),
    symbol: hexagram.symbol,
    upper: hexagram.upper,
    lower: hexagram.lower,
    judgment: hexagram.description,
  };
}

export function toBottomUpLines(binarySymbol: string): string[] {
  return [
    binarySymbol[3],
    binarySymbol[4],
    binarySymbol[5],
    binarySymbol[0],
    binarySymbol[1],
    binarySymbol[2],
  ];
}

export function fromBottomUpLines(lines: string[]): string {
  return `${lines.slice(3, 6).join('')}${lines.slice(0, 3).join('')}`;
}

