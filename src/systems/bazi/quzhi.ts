import type { BaziPillar, PillarName } from './pillars';
import { branchesClash } from './natal-facts';

type Pillars = Record<PillarName, BaziPillar>;
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

/** 曲直按两种明确路线核对，支中金及局外直接六冲分别保留。 */
export function buildQuzhi(pillars: Pillars) {
  if (!['甲', '乙'].includes(pillars.day.gan)) return null;
  const allBranches = positions.map((position) => pillars[position].zhi);
  const complete = (members: string) => [...members].every((branch) => allBranches.includes(branch));
  const route = complete('亥卯未') ? '亥卯未木局' : complete('寅卯辰') && '寅卯辰'.includes(pillars.month.zhi) ? '寅卯辰东方' : null;
  if (!route) return null;
  const members = route === '亥卯未木局' ? '亥卯未' : '寅卯辰';
  const method = route === '亥卯未木局' ? '《三命通会》卷六亥卯未曲直法' : '《渊海子平·神趣八法·类象》春生寅卯辰法';
  const memberFacts = [...members].map((branch) => ({ branch, positions: positions.filter((position) => pillars[position].zhi === branch), hiddenStems: pillars[positions.find((position) => pillars[position].zhi === branch)!].hiddenStems.map((item) => item.stem) }));
  const visibleMetal = positions.flatMap((position) => ['庚', '辛'].includes(pillars[position].gan) ? [{ position, stem: pillars[position].gan }] : []);
  const hiddenMetal = positions.flatMap((position) => pillars[position].hiddenStems.flatMap(({ stem }) => ['庚', '辛'].includes(stem) ? [{ position, branch: pillars[position].zhi, stem }] : []));
  const externalClashes = positions.flatMap((position) => {
    const branch = pillars[position].zhi;
    if (members.includes(branch)) return [];
    const targets = [...members].filter((member) => branchesClash(branch, member));
    return targets.length ? [{ position, branch, targets }] : [];
  });
  const visibleOutput = positions.flatMap((position) => position !== 'day' && ['丙', '丁'].includes(pillars[position].gan) ? [{ position, stem: pillars[position].gan }] : []);
  const visibleWealth = positions.flatMap((position) => position !== 'day' && ['戊', '己'].includes(pillars[position].gan) ? [{ position, stem: pillars[position].gan }] : []);
  const blockers = [
    ...(visibleMetal.length ? ['庚辛透干'] : []), ...(hiddenMetal.length ? ['庚辛藏支'] : []), ...(externalClashes.length ? ['局外支直接冲局'] : []),
  ];
  return { pattern: '曲直格', route, method, status: blockers.length ? '存在反证' : '条件成立', dayStem: pillars.day.gan, monthBranch: pillars.month.zhi, members: memberFacts,
    visibleMetal, hiddenMetal, externalClashes, visibleOutput, visibleWealth, blockers,
    limitation: '按所列传统路线和严格金制口径判断；火土透出仅记为泄秀和财星事实，未判断作用成败。不同流派口径可能不同，用神及其他特殊格仍须另核。' };
}

type Quzhi = NonNullable<ReturnType<typeof buildQuzhi>>;
export function formatQuzhi(value: Quzhi | null) {
  if (!value) return '未命中两条曲直结构路线。';
  return `${value.pattern}（${value.route}）：${value.status}；${value.method}。成员：${value.members.map((item) => `${item.branch}在${item.positions.map((p) => labels[p]).join('、')}，藏${item.hiddenStems.join('、')}`).join('；')}。\n庚辛透干：${value.visibleMetal.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '未见'}；庚辛藏支：${value.hiddenMetal.map((item) => `${labels[item.position]}${item.branch}藏${item.stem}`).join('、') || '未见'}；局外冲：${value.externalClashes.map((item) => `${labels[item.position]}${item.branch}冲${item.targets.join('、')}`).join('、') || '未见'}。\n食伤明透：${value.visibleOutput.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '未见'}；财星明透：${value.visibleWealth.map((item) => `${labels[item.position]}${item.stem}`).join('、') || '未见'}。${value.limitation}`;
}
