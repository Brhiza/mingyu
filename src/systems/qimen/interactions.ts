type Pillars = { year: string; month: string; day: string; hour: string };
type Interaction = { type: '六合' | '三合' | '半合' | '六冲' | '相刑' | '相害' | '天干五合' | '天干相冲'; pillars: string[]; values: string[]; description: string };
const labels: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
const pairMap = (pairs: string[]) => Object.fromEntries(pairs.flatMap(([a, b]) => [[a, b], [b, a]]));
const combine = pairMap(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']);
const clash = pairMap(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']);
const harm = pairMap(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']);
const stemCombine = pairMap(['甲己', '乙庚', '丙辛', '丁壬', '戊癸']);
const stemClash = pairMap(['甲庚', '乙辛', '丙壬', '丁癸']);
const stemElements: Record<string, string> = { 甲: '土', 己: '土', 乙: '金', 庚: '金', 丙: '水', 辛: '水', 丁: '木', 壬: '木', 戊: '火', 癸: '火' };
const groups: Record<string, string[]> = { 水局: ['申', '子', '辰'], 木局: ['亥', '卯', '未'], 火局: ['寅', '午', '戌'], 金局: ['巳', '酉', '丑'] };

function punishment(a: string, b: string) {
  if ('子卯'.includes(a) && '子卯'.includes(b) && a !== b) return '无礼之刑';
  if ('寅巳申'.includes(a) && '寅巳申'.includes(b) && a !== b) return '无恩之刑';
  if ('丑戌未'.includes(a) && '丑戌未'.includes(b) && a !== b) return '恃势之刑';
  if ('辰午酉亥'.includes(a) && a === b) return '自刑';
  return '';
}

export function analyzeGanzhiInteractions(ganzhi: Pillars): Interaction[] {
  const pillars = Object.entries(ganzhi).filter(([, value]) => value && value.length >= 2).map(([key, value]) => ({ key, gan: value[0], zhi: value[1] }));
  const result: Interaction[] = [];
  for (let i = 0; i < pillars.length; i++) for (let j = i + 1; j < pillars.length; j++) {
    const a = pillars[i], b = pillars[j], subject = `${labels[a.key]}${a.zhi}与${labels[b.key]}${b.zhi}`;
    const add = (type: Interaction['type'], values: string[], description: string) => result.push({ type, pillars: [a.key, b.key], values, description });
    if (combine[a.zhi] === b.zhi) add('六合', [a.zhi, b.zhi], `${subject}六合，主和合顺利。`);
    if (clash[a.zhi] === b.zhi) add('六冲', [a.zhi, b.zhi], `${subject}六冲，主冲突变动。`);
    if (harm[a.zhi] === b.zhi) add('相害', [a.zhi, b.zhi], `${subject}相害，主暗伤不利。`);
    const xing = punishment(a.zhi, b.zhi);
    if (xing) add('相刑', [a.zhi, b.zhi], `${subject}${xing}，主是非官非。`);
    if (stemCombine[a.gan] === b.gan) add('天干五合', [a.gan, b.gan], `${labels[a.key]}${a.gan}与${labels[b.key]}${b.gan}天干五合（化${stemElements[a.gan]}），主合作契机。`);
    if (stemClash[a.gan] === b.gan) add('天干相冲', [a.gan, b.gan], `${labels[a.key]}${a.gan}与${labels[b.key]}${b.gan}天干相冲，主对立矛盾。`);
  }
  const branchValues = pillars.map((pillar) => pillar.zhi);
  const pillarByBranch = Object.fromEntries(pillars.map((pillar) => [pillar.zhi, pillar.key]));
  const complete = Object.entries(groups).map(([group, members]) => ({ group, members: members.filter((branch) => branchValues.includes(branch)) })).filter((item) => item.members.length === 3);
  const used = new Set(complete.flatMap((item) => item.members));
  const half = Object.entries(groups).map(([group, members]) => ({ group, members: members.filter((branch) => branchValues.includes(branch) && !used.has(branch)) })).filter((item) => item.members.length === 2);
  for (const item of complete) result.push({ type: '三合', pillars: item.members.map((branch) => pillarByBranch[branch]).filter(Boolean), values: item.members, description: `${item.members.join('、')}合${item.group}，主气运凝聚。` });
  for (const item of half) result.push({ type: '半合', pillars: item.members.map((branch) => pillarByBranch[branch]).filter(Boolean), values: item.members, description: `${item.members.join('、')}半合${item.group}，合而不全，有合作之意但力未足。` });
  return result;
}
