import { branchPalaces } from './palace';
import type { QimenJiuGongGe } from './types';

type Pattern = { name: string; tone: 'good' | 'bad' | 'neutral'; palace?: number; palaces?: number[] };
type Advice = { gong: number; name: string; direction: string; use: string; reasons: string[] };
const goodDoors = ['开门', '休门', '生门'];
const badDoors = ['伤门', '死门', '惊门'];
const goodGods = ['值符', '太阴', '六合', '九天', '九地'];
const badGods = ['螣蛇', '白虎', '玄武'];
const useByDoor: Record<string, string> = { 开门: '求官/事业/求职', 生门: '求财/合作/投资', 休门: '休养/安宁/关系' };

/** 以吉门为主证；空亡、凶神、凶格和五不遇独立构成限制。 */
export function buildDirectionAdvice(palaces: QimenJiuGongGe[], voidBranches: string[] = [], patterns: Pattern[] = [], conditions?: { isWuBuYuShi?: boolean }) {
  const voidGongs = new Set(voidBranches.map((branch) => branchPalaces[branch]).filter(Boolean));
  const names = (gong: number, tone: Pattern['tone']) => patterns.filter((p) => p.tone === tone && (p.palaces ?? (p.palace ? [p.palace] : [])).includes(gong)).map((p) => p.name);
  const goodDirections: Advice[] = [], avoidDirections: Advice[] = [];
  for (const palace of palaces) {
    if (palace.gong === 5) continue;
    const { gong, name, direction, tianPan, renPan, shenPan } = palace;
    const goodPatterns = names(gong, 'good'), badPatterns = names(gong, 'bad');
    if (!conditions?.isWuBuYuShi && goodDoors.includes(renPan.door) && !voidGongs.has(gong) && !badGods.includes(shenPan.god) && !badPatterns.length) {
      const reasons = [renPan.door];
      if (goodGods.includes(shenPan.god)) reasons.push(`值${shenPan.god}`);
      const qi = [tianPan.stem, tianPan.companionStem].find((stem) => stem && '乙丙丁'.includes(stem));
      if (qi) reasons.push(`${qi}奇合${renPan.door}`);
      reasons.push(...goodPatterns.map((item) => `吉格:${item}`));
      const use = useByDoor[renPan.door] + (shenPan.god === '值符' ? '/急难见贵' : '');
      goodDirections.push({ gong, name, direction, use, reasons: [...new Set(reasons)] });
    }
    const reasons: string[] = [];
    if (badDoors.includes(renPan.door)) reasons.push(renPan.door);
    if (badGods.includes(shenPan.god)) reasons.push(shenPan.god);
    if (voidGongs.has(gong)) reasons.push('空亡');
    reasons.push(...badPatterns.map((item) => `凶格:${item}`));
    if (reasons.length) avoidDirections.push({ gong, name, direction, use: '宜避之方', reasons: [...new Set(reasons)] });
  }
  return { goodDirections, avoidDirections };
}
