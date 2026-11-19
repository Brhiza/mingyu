import type { QimenData, QimenJiuGongGe } from '../types';
import { getDunJiaStem } from '../layout';
import { branchPalaces, hasTianPanStar } from '../palace';

export const lifetimeTopics = ['career', 'wealth', 'marriage', 'health', 'academic', 'relocation', 'family', 'children', 'partnership'] as const;
export type LifetimeTopic = typeof lifetimeTopics[number];
export interface PersonalMarker {
  markerType: 'yearStem' | 'yearBranch' | 'dayStem' | 'hourStem' | 'zhiFuStar' | 'zhiShiDoor' | 'companionStem';
  value: string;
  palace: number;
  palaceName: string;
  layer: 'tianPan' | 'diPan' | 'renPan' | 'baseGong';
  traditionalSignificance: string;
}
export interface TopicCandidate {
  topic: LifetimeTopic;
  topicName: string;
  primaryPalaces: number[];
  secondaryPalaces: number[];
  basis: string;
  patternSummary: string[];
  alternatives?: Array<{ rule: 'male' | 'female'; primaryPalaces: number[]; secondaryPalaces: number[] }>;
}

/** 从本命时局读取实际落宫；六甲按本旬遁干查找，天禽随宫干也参与匹配。 */
export function extractPersonalMarkers(chart: QimenData): PersonalMarker[] {
  const markers: PersonalMarker[] = [];
  const descriptions = {
    year: ['表外在社会名位、长辈福荫、名声根基与时代大势', '表先天祖业沉淀、内在家族根基与深层心理安全感'],
    day: ['求测者本人显性行藏、心智精力与中年主要作为', '本人内心隐秘居所、精神寄托与底层支撑'],
    hour: ['晚景运势、具体事业产出、下属晚辈及事态最终归宿', '晚运蓄势储备与底层执行承载'],
  } as const;
  const labels = { year: '年', day: '日', hour: '时' } as const;
  const addStem = (pillar: 'year' | 'day' | 'hour') => {
    const ganzhi = chart.ganzhi[pillar], stem = ganzhi[0];
    const lookup = stem === '甲' ? getDunJiaStem(ganzhi) : stem;
    const value = stem === '甲' ? `甲(遁${lookup})` : stem;
    const display = stem === '甲' ? `甲木遁${lookup}` : stem;
    for (const palace of chart.jiuGongGe) for (const layer of ['tianPan', 'diPan'] as const) {
      const match = layer === 'tianPan' ? palace.tianPan.stem === lookup || palace.tianPan.companionStem === lookup : palace.diPan.stem === lookup;
      if (match) markers.push({ markerType: `${pillar}Stem`, value, palace: palace.gong, palaceName: palace.name, layer,
        traditionalSignificance: `${labels[pillar]}干${layer === 'tianPan' ? '天' : '地'}盘落宫（${display}）：${descriptions[pillar][layer === 'tianPan' ? 0 : 1]}` });
    }
  };
  addStem('year');
  const branch = chart.ganzhi.year[1], branchPalace = branchPalaces[branch];
  if (branchPalace) {
    const name = chart.jiuGongGe.find((p) => p.gong === branchPalace)?.name ?? `${branchPalace}宫`;
    markers.push({ markerType: 'yearBranch', value: branch, palace: branchPalace, palaceName: name, layer: 'baseGong', traditionalSignificance: `年支本宫（${branch}在${name}）：身体元气与先天命基之寄托本原` });
  }
  addStem('day'); addStem('hour');
  const star = chart.jiuGongGe.find((p) => hasTianPanStar(p, chart.zhiFu));
  if (star) markers.push({ markerType: 'zhiFuStar', value: chart.zhiFu, palace: star.gong, palaceName: star.name, layer: 'tianPan', traditionalSignificance: `值符星落宫（${chart.zhiFu}）：一身大纲领，时代机遇与贵人庇佑之枢纽` });
  const door = chart.jiuGongGe.find((p) => p.renPan.door === chart.zhiShi);
  if (door) markers.push({ markerType: 'zhiShiDoor', value: chart.zhiShi, palace: door.gong, palaceName: door.name, layer: 'renPan', traditionalSignificance: `值使门落宫（${chart.zhiShi}）：人事具体权柄、行动落地与办事主宰` });
  const companion = chart.jiuGongGe.find((p) => p.tianPan.companionStem);
  if (companion?.tianPan.companionStem) markers.push({ markerType: 'companionStem', value: companion.tianPan.companionStem, palace: companion.gong, palaceName: companion.name, layer: 'tianPan', traditionalSignificance: `天禽寄宫携干（${companion.tianPan.companionStem}）：中五厚土兼化之隐性能量` });
  return markers;
}

const stemElements: Record<string, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const elements = ['木', '火', '土', '金', '水'];
type Relative = '父母' | '子息' | '兄弟' | '官鬼' | '妻财';
function sixRelative(subject: string, target: string): Relative {
  const a = elements.indexOf(stemElements[subject] ?? '土'), b = elements.indexOf(stemElements[target] ?? '土');
  return (['兄弟', '子息', '妻财', '官鬼', '父母'] as const)[(b - a + 5) % 5];
}
function palaceSummary(palace: QimenJiuGongGe, chart: QimenData) {
  const facts: string[] = [];
  if (palace.renPan.door) facts.push(`人盘${palace.renPan.door}`);
  if (palace.shenPan.god) facts.push(`神盘${palace.shenPan.god}`);
  if (palace.tianPan.star) facts.push(`天盘${palace.tianPan.star}`);
  facts.push(`干组合: ${palace.tianPan.stem}+${palace.diPan.stem}`);
  if (chart.voidPalaces?.some((item) => item.palace === palace.gong)) facts.push('临旬空');
  if (chart.horseStar?.palace === palace.gong) facts.push('临驿马');
  for (const pattern of chart.classicPatterns ?? []) if (pattern.palaces.includes(palace.gong)) facts.push(`格局:${pattern.name}(${pattern.type === 'good' ? '吉' : pattern.type === 'bad' ? '凶' : '平'})`);
  return facts;
}

/** 九类人生主题候选只说明盘面取象，不代表事件结论。 */
export function buildTopicCandidates(chart: QimenData, gender?: 'male' | 'female', selected?: readonly LifetimeTopic[]): TopicCandidate[] {
  const door = (name: string) => chart.jiuGongGe.find((p) => p.renPan.door === name)?.gong;
  const god = (name: string) => chart.jiuGongGe.filter((p) => p.shenPan.god === name).map((p) => p.gong);
  const star = (name: string) => chart.jiuGongGe.find((p) => p.tianPan.star === name)?.gong;
  const stem = (name: string) => chart.jiuGongGe.filter((p) => p.tianPan.stem === name || p.tianPan.companionStem === name).map((p) => p.gong);
  const relatives: Record<Relative, number[]> = { 父母: [], 子息: [], 兄弟: [], 官鬼: [], 妻财: [] };
  const yearStem = chart.ganzhi.year[0];
  for (const p of chart.jiuGongGe) for (const value of [p.tianPan.stem, p.tianPan.companionStem]) if (value) {
    const list = relatives[sixRelative(yearStem, value)];
    if (!list.includes(p.gong)) list.push(p.gong);
  }
  const make = (topic: LifetimeTopic, topicName: string, primary: Array<number | undefined>, secondary: Array<number | undefined>, basis: string): TopicCandidate => {
    const main = [...new Set(primary.filter((p): p is number => p !== undefined))];
    const other = [...new Set(secondary.filter((p): p is number => p !== undefined && !main.includes(p)))];
    const patternSummary = main.flatMap((n) => { const p = chart.jiuGongGe.find((item) => item.gong === n); return p ? [`${p.name}: ${palaceSummary(p, chart).join('，')}`] : []; });
    return { topic, topicName, primaryPalaces: main, secondaryPalaces: other, basis, patternSummary };
  };
  const spouse = gender === 'male' ? [...relatives.妻财, ...stem('乙')] : gender === 'female' ? [...relatives.官鬼, ...stem('庚')] : [...relatives.妻财, ...relatives.官鬼, ...stem('乙'), ...stem('庚')];
  const marriageBasis = '《统宗》六合专司媒约婚姻，男取我克之妻财、女取克我之官鬼，乙庚为阴阳夫妇正配，休门司家庭' + (gender ? '' : '；未指定性别，保留两种取法供分别核验');
  const marriage = make('marriage', '婚恋配偶', [...god('六合'), ...spouse], [door('休门'), ...(gender === 'female' ? stem('乙') : gender === 'male' ? stem('庚') : [])], marriageBasis);
  if (!gender) {
    marriage.alternatives = (['male', 'female'] as const).map((rule) => {
      const variant = make('marriage', '婚恋配偶', [...god('六合'), ...(rule === 'male' ? relatives.妻财 : relatives.官鬼), ...stem(rule === 'male' ? '乙' : '庚')], [door('休门'), ...stem(rule === 'male' ? '庚' : '乙')], marriageBasis);
      return { rule, primaryPalaces: variant.primaryPalaces, secondaryPalaces: variant.secondaryPalaces };
    });
  }
  const candidates = [
    make('career', '事业官禄', [door('开门'), ...god('值符'), ...relatives.官鬼], [door('景门'), ...god('九天')], '《统宗》开门专司官爵仕途，值符为百官尊长，克我者官鬼司名权威柄，景门司文书名望'),
    make('wealth', '资产财帛', [door('生门'), ...stem('戊'), ...relatives.妻财], [...god('九地'), ...god('玄武')], '《统宗》生门专司财帛产业，甲子戊为青龙钱财资本，我克者妻财司日常资产，九地主储蓄'),
    marriage,
    make('health', '身体疾厄', [star('天芮'), door('死门'), ...relatives.官鬼], [door('伤门')], '《统宗》天芮星为疾病根源病灶，死门主气机滞塞，克我者官鬼疾厄司病患侵袭，伤门司外伤手术'),
    make('academic', '学业进修', [...relatives.父母, star('天辅'), door('景门'), ...stem('丁')], god('九天'), '《统宗》生我者父母司学业文凭庇荫，天辅为文曲导师，景门司试卷考选，丁奇为文书玉印'),
    make('relocation', '居所差旅', [chart.horseStar?.palace, ...god('九天'), door('开门')], [door('伤门'), door('杜门')], '《烟波钓叟歌》天马为动应之神，九天主升迁远行迁徙，开门司通达，伤门司车马动迁'),
    make('family', '原生家庭', [...relatives.父母, door('休门')], chart.jiuGongGe.filter((p) => p.tianPan.stem === yearStem).map((p) => p.gong), '《统宗》生我者为父母长辈，年干为宗族根基，休门为宅舍庇护之宫'),
    make('children', '晚辈后嗣', [...relatives.子息, ...chart.jiuGongGe.filter((p) => p.tianPan.stem === chart.ganzhi.hour[0]).map((p) => p.gong)], [door('生门')], '《统宗》我生者子息司晚辈团队，时干司晚运终局与具体事态产出'),
    make('partnership', '合伙合作', [...relatives.兄弟, ...god('六合')], [door('开门')], '《统宗》比肩者兄弟司同侪伙伴与合伙人，六合主契约协议合作共事'),
  ];
  return selected?.length ? candidates.filter((c) => selected.includes(c.topic)) : candidates;
}
