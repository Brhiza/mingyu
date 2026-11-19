import type { QimenJiuGongGe } from './types';
import { getNamedStemPairPattern } from './stem-pairs';
import { getTianPanStems, stemTombs } from './palace';

const punishments: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };

/** 每组天盘地盘干保留命名格局，入墓、击刑独立列出。 */
export function getStemRelations(palaces: QimenJiuGongGe[]) {
  const relations: Array<{ gong: number; heavenStem: string; earthStem: string; relation: '命名格局' | '入墓' | '击刑'; pattern: string }> = [];
  for (const palace of palaces) for (const heaven of getTianPanStems(palace)) {
    const earth = palace.diPan.stem;
    const named = getNamedStemPairPattern(heaven, earth);
    if (!named) throw new Error(`无法识别奇门天地盘干组合：${heaven}${earth}。`);
    const add = (relation: '命名格局' | '入墓' | '击刑', pattern: string) => relations.push({ gong: palace.gong, heavenStem: heaven, earthStem: earth, relation, pattern });
    add('命名格局', `${named.name}：${named.summary}`);
    const tomb = stemTombs[heaven];
    if (tomb?.palace === palace.gong) add('入墓', `${heaven}入${palace.name}墓库（墓在${tomb.branch}），能量收敛，事情容易停在原地`);
    if (punishments[heaven] === palace.gong) add('击刑', `${heaven}在${palace.name}击刑，规则、口舌、文书方面要小心`);
  }
  return relations;
}
