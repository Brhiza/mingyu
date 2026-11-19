import { trigrams } from '../compass';

const palaceTable: Record<string, string[]> = {
  乾: ['六煞', '天医', '五鬼', '祸害', '绝命', '延年', '生气', '伏位'], 坎: ['伏位', '五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
  艮: ['五鬼', '伏位', '六煞', '绝命', '祸害', '生气', '延年', '天医'], 震: ['天医', '六煞', '伏位', '延年', '生气', '祸害', '绝命', '五鬼'],
  巽: ['生气', '绝命', '延年', '伏位', '天医', '五鬼', '六煞', '祸害'], 离: ['延年', '祸害', '生气', '天医', '伏位', '六煞', '五鬼', '绝命'],
  坤: ['绝命', '生气', '祸害', '五鬼', '六煞', '伏位', '天医', '延年'], 兑: ['祸害', '延年', '绝命', '六煞', '五鬼', '天医', '伏位', '生气'],
};
const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const luck = ['伏位', '生气', '延年', '天医'];

export function bazhaiPalaces(gua: string) {
  if (!Object.hasOwn(palaceTable, gua)) throw new Error('基准卦须为八卦之一。');
  const row = palaceTable[gua];
  return trigrams.map((directionGua, index) => ({ gua: directionGua, direction: directions[index], degree: index * 45, label: row[index], luck: luck.includes(row[index]) ? '吉' as const : '凶' as const }));
}
