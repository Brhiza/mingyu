import type { BaziPillar, PillarName } from './pillars';
import { collectTraditionalRoots } from './strength';

type Pillars = Record<PillarName, BaziPillar>;
type Endpoint = { position: PillarName; stem: string; tenGod: string; rooted: boolean; actionable: boolean; monthControlled: boolean; effective: boolean };
type Node = Pick<Endpoint, 'position' | 'stem' | 'tenGod'>;
type Pair = { source: Node; target: Node; via?: Node };
type Status = '满足' | '不满足' | '资料不足';
type Path = { key: string; label: string; status: Status; reason: string; pairs: Pair[] };
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const seal = ['正印', '偏印'], wealth = ['正财', '偏财'], companion = ['比肩', '劫财'], output = ['食神', '伤官'], officer = ['正官', '七杀'];

/** 普通格局的已列制化路径；有向链必须由同一柱位的中间干承接。 */
export function buildPatternPaths(pillars: Pillars, pattern: string, source: string, visible: Endpoint[], harmonies: Array<{ participants: Array<{ position: PillarName }>; blocked: boolean }>) {
  if (source !== '普通月令取格候选') return [];
  const name = pattern.replace(/^杂气/, '').replace(/^偏官/, '七杀');
  const day = (): Endpoint => {
    const roots = collectTraditionalRoots(pillars, pillars.day.stemElement);
    const actionable = roots.some((root) => root.actionable && root.kind !== '弱藏');
    return { position: 'day', stem: pillars.day.gan, tenGod: '日主', rooted: roots.length > 0, actionable, monthControlled: false,
      effective: actionable && !harmonies.some((h) => h.blocked && h.participants.some((p) => p.position === 'day')) };
  };
  const hasVisible = (gods: string[]) => visible.some((item) => gods.includes(item.tenGod));
  const group = (gods: string[]) => {
    const items = [...visible.filter((item) => gods.includes(item.tenGod)), ...(gods.includes('日主') ? [day()] : [])];
    const exists = items.length > 0 || positions.some((position) => pillars[position].hiddenStems.some((item) => gods.includes(item.tenGod)));
    const rooted = items.filter((item) => item.actionable);
    const uncertain = items.some((item) => item.rooted && !item.actionable && item.monthControlled);
    return { items, exists, rooted, uncertain, failed: items.length > 0 && rooted.length === 0 && !uncertain, available: rooted.filter((item) => item.effective) };
  };
  const endpoint = ({ position, stem, tenGod }: Endpoint) => ({ position, stem, tenGod });
  const path = (key: string, label: string, from: string[], to: string[]): Path => {
    const a = group(from), b = group(to);
    const result = (status: Status, reason: string, pairs: Pair[] = []): Path => ({ key, label, status, reason, pairs });
    if (!a.exists || !b.exists) return result('不满足', `缺少${!a.exists ? '来源' : '作用对象'}`);
    if ((!a.items.length || !b.items.length) && !a.failed && !b.failed) return result('资料不足', '存在仅藏不透的作用端');
    if (!a.rooted.length || !b.rooted.length) return result(a.failed || b.failed ? '不满足' : '资料不足', '作用端缺少可用根气或受月令制约待核');
    if (!a.available.length || !b.available.length) return result('不满足', '作用端被合绊阻断');
    const pairs = a.available.flatMap((left) => b.available.filter((right) => Math.abs(positions.indexOf(left.position) - positions.indexOf(right.position)) === 1)
      .map((right) => ({ source: endpoint(left), target: endpoint(right) })));
    return pairs.length ? result('满足', '两端透干、有可用根气、紧贴且未被合绊阻断', pairs) : result('资料不足', '两端可用但未见紧贴柱位');
  };
  const chain = (key: string, label: string, first: Path, second: Path): Path => {
    const pairs = first.pairs.flatMap((a) => second.pairs.filter((b) => a.target.position === b.source.position && a.target.stem === b.source.stem)
      .map((b) => ({ source: a.source, via: a.target, target: b.target })));
    const status: Status = first.status === '不满足' || second.status === '不满足' ? '不满足'
      : first.status === '资料不足' || second.status === '资料不足' ? '资料不足' : pairs.length ? '满足' : '不满足';
    return { key, label, status, reason: `${first.label}：${first.status}；${second.label}：${second.status}${status === '不满足' && first.status === '满足' && second.status === '满足' ? '；两段未由同一柱位的中间干承接' : ''}`, pairs: status === '满足' ? pairs : [] };
  };
  if (name.includes('正官')) return [
    ...(hasVisible(['伤官']) ? [path('印制伤官', '印星制伤官护官', seal, ['伤官'])] : []),
    ...(hasVisible(['七杀']) ? [path('食神制七杀', '食神制七杀取清', ['食神'], ['七杀'])] : []),
  ];
  if (name.includes('正财') || name.includes('偏财')) {
    if (!hasVisible(companion)) return [];
    const a = path('比劫生食伤', '比劫泄秀生食伤', companion, output), b = path('食伤生财', '食伤泄比生财', output, [name.includes('偏财') ? '偏财' : '正财']);
    return [a, b, chain('比劫泄秀生财', '比劫→食伤→财', a, b), path('官杀护财', '官杀制比护财', officer, companion)];
  }
  if (name.includes('正印') || name.includes('偏印')) return hasVisible(wealth) ? [path('比劫护印', '比劫制财存印', companion, wealth)] : [];
  if (name.includes('食神')) return hasVisible(['偏印']) ? [path('财制偏印', '财星制枭护食', wealth, ['偏印'])] : [];
  if (name.includes('七杀')) {
    const a = path('七杀生印', '七杀生印', ['七杀'], seal), b = path('印生身', '印星生身', seal, ['日主']);
    return [path('食神制杀', '食神制七杀', ['食神'], ['七杀']), a, b, chain('印化杀', '七杀→印→身', a, b)];
  }
  if (name.includes('伤官')) return hasVisible(['正官']) ? [path('印配伤官', '印星配伤官制伤', seal, ['伤官'])] : [];
  if (['建禄', '月刃', '劫财', '比肩'].some((key) => name.includes(key))) return [
    path('官杀制比劫', '官杀制身', officer, ['日主']), path('食伤泄秀', '日主生食伤泄秀', ['日主'], output), path('财星承禄劫', '日主克财承载', ['日主'], wealth),
  ];
  return [];
}
