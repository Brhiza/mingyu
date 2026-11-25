import { getTenStar } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';
import type { buildPatternPaths } from './pattern-paths';
import { collectTraditionalRoots } from './strength';

type Pillars = Record<PillarName, BaziPillar>;
type Stem = { position: PillarName; stem: string; tenGod: string; rooted: boolean; actionable: boolean; effective: boolean };
type Condition = '满足' | '不满足' | '资料不足';
type Decision = '成格' | '破格' | '破而复成' | '平常' | '未判定';
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const lu: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const blade: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };

/** 已列普通格局条件的有限模型；不推断未列的流派规则或最终用神。 */
export function decideOrdinaryPattern(pillars: Pillars, pattern: string, source: string, commander: string, visible: Stem[], paths: ReturnType<typeof buildPatternPaths>, strength?: string) {
  if (source !== '普通月令取格候选') return null;
  const name = pattern.replace(/^杂气/, '').replace(/^偏官/, '七杀');
  const target = ['正官', '七杀', '正财', '偏财', '正印', '偏印', '食神', '伤官', '比肩', '劫财'].find((god) => name.includes(god));
  const isLu = name.includes('建禄'), isBlade = name.includes('月刃');
  if (!target && !isLu && !isBlade) return null;
  const commanderGod = getTenStar(pillars.day.gan, commander);
  const monthGate = isLu ? pillars.month.zhi === lu[pillars.day.gan] : isBlade ? pillars.month.zhi === blade[pillars.day.gan]
    : pillars.month.hiddenStems.some((item) => item.tenGod === target) || commanderGod === target;
  const itemsFor = (gods: string[]) => visible.filter((item) => gods.includes(item.tenGod));
  const usable = (gods: string[]) => {
    const items = itemsFor(gods), effective = items.filter((item) => item.effective);
    const uncertain = items.some((item) => !item.actionable);
    const status: Condition = !items.length ? '不满足' : effective.length ? uncertain ? '资料不足' : '满足' : uncertain ? '资料不足' : '不满足';
    return { status, effective: effective.length > 0, uncertain, stems: effective.map(({ position, stem, tenGod }) => ({ position, stem, tenGod })) };
  };
  const exists = (god: string) => itemsFor([god]).length > 0 || positions.some((position) => pillars[position].hiddenStems.some((item) => item.tenGod === god));
  const targetItems = target ? itemsFor([target]) : [];
  let targetCondition: Condition = isLu || isBlade ? monthGate ? '满足' : '不满足'
    : !target || !exists(target) ? '不满足' : !targetItems.length ? '资料不足'
      : !targetItems.some((item) => item.rooted) ? '不满足'
        : targetItems.some((item) => item.effective) ? '满足' : usable([target]).status;
  if (target === '比肩' || target === '劫财') {
    const roots = collectTraditionalRoots(pillars, pillars.day.stemElement);
    const active = roots.filter((root) => root.actionable && root.kind !== '弱藏');
    const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const hidden = positions.flatMap((position) => pillars[position].hiddenStems.filter((item) => item.tenGod === target).map((item) => ({ position, stem: item.stem })));
    const hiddenActionable = hidden.some((item) => active.length > 0 && (item.position !== 'month' || item.stem === pillars.month.hiddenStems[0].stem || controls[pillars.month.branchElement] !== pillars.day.stemElement || active.some((root) => root.kind === '本气')));
    targetCondition = !exists(target) || !roots.length ? '不满足' : (targetItems.length ? targetItems.some((item) => item.actionable) : hiddenActionable) ? '满足' : '资料不足';
  }
  const byKey = (key: string) => paths.find((path) => path.key === key);
  const specs: Array<{ label: string; gods: string[]; repairs: string[] }> = name.includes('正官') ? [
    { label: '伤官见官', gods: ['伤官'], repairs: ['印制伤官'] }, { label: '官杀混杂', gods: ['七杀'], repairs: ['食神制七杀'] },
  ] : name.includes('正财') || name.includes('偏财') ? [{ label: '比劫夺财', gods: ['比肩', '劫财'], repairs: ['比劫泄秀生财', '官杀护财'] }]
    : name.includes('正印') || name.includes('偏印') ? [{ label: '财星破印', gods: ['正财', '偏财'], repairs: ['比劫护印'] }]
      : name.includes('食神') ? [{ label: '枭神夺食', gods: ['偏印'], repairs: ['财制偏印'] }]
        : name.includes('伤官') ? [{ label: '伤官见官', gods: ['正官'], repairs: ['印配伤官'] }] : [];
  const breakers = specs.map(({ label, gods, repairs }) => {
    const state = usable(gods), repairPaths = repairs.map(byKey).filter((p) => p !== undefined);
    const repairStatus: Condition = repairPaths.some((p) => p.status === '满足') ? '满足'
      : repairPaths.some((p) => p.status === '资料不足') ? '资料不足' : '不满足';
    return { label, ...state, repairStatus, repairPaths: repairPaths.map((p) => p.key) };
  });
  let status: Decision, reason: string;
  if (!monthGate) { status = '平常'; reason = '月令及司权未满足当前格局条件'; }
  else if (isLu || isBlade || target === '比肩' || target === '劫财') {
    const candidates = (isBlade ? ['官杀制比劫'] : ['官杀制比劫', '食伤泄秀', '财星承禄劫']).map(byKey).filter((p) => p !== undefined);
    status = candidates.some((p) => p.status === '满足') ? '成格' : candidates.some((p) => p.status === '资料不足') ? '未判定' : '破格';
    reason = isBlade ? '按官杀驾刃路径核对' : '按官杀制身、食伤泄秀或财星承载路径核对';
  } else if (targetCondition !== '满足') {
    status = targetCondition === '资料不足' ? '未判定' : '破格'; reason = `格神条件${targetCondition}`;
  } else if (target === '七杀') {
    const candidates = ['食神制杀', '印化杀'].map(byKey).filter((p) => p !== undefined);
    status = candidates.some((p) => p.status === '满足') ? '成格' : candidates.some((p) => p.status === '资料不足') ? '未判定' : '破格';
    reason = '按食神制杀或七杀生印、印星生身的连续路径核对';
  } else {
    const active = breakers.filter((item) => item.effective);
    if (active.some((item) => item.repairStatus === '不满足')) { status = '破格'; reason = '存在有效破格项且未见有效救应'; }
    else if (breakers.some((item) => item.uncertain)) { status = '未判定'; reason = '破格项透出但根气受冲或受月令克制减力，按轻度破格偏破论（岁运扶助易转实破）'; }
    else if (!active.length) { status = '成格'; reason = '格神可用且未见有效明透破格项'; }
    else if (active.some((item) => item.repairStatus === '资料不足')) { status = '未判定'; reason = '有效破格项存在潜在救应但仅藏不透或隔位未紧贴，按破格有救意（岁运引出救应可复成）论'; }
    else { status = '破而复成'; reason = '各有效破格项均有列出的有效救应路径'; }
  }
  const wealthBearing: Condition | null = target === '正财' || target === '偏财'
    ? ['极强', '身强', '偏强', '中和'].includes(strength ?? '') ? '满足' : ['极弱', '身弱', '偏弱'].includes(strength ?? '') ? '不满足' : '资料不足' : null;
  if (wealthBearing && wealthBearing !== '满足' && (status === '成格' || status === '破而复成')) {
    reason = `有限格神结构为${status}，但身承财条件${wealthBearing}；${reason}`; status = '未判定';
  }
  return { status, reason, monthGate: monthGate ? '满足' as const : '不满足' as const, target: target ?? (isLu ? '建禄' : '月刃'), targetCondition, breakers, wealthBearing,
    limitation: '仅为当前列出条件下的普通格局模型，不代表其他流派或最终用神；旧规则对照不等于独立文献核验。' };
}
