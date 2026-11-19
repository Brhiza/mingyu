import { EARTHLY_BRANCHES } from '../calendar';

interface TimingConditions {
  isYangDun: boolean;
  zhiFuLandingPalace: number;
  zhiShiLandingPalace: number;
  isFuyin: boolean;
  isFanyin: boolean;
  hasHorse: boolean;
  hasVoid: boolean;
  classicPatterns: unknown[];
  voidBranches: string[];
}
const yangInner = new Set([1, 8, 3, 4]);
const distance = (palace: number, isYangDun: boolean) => palace === 5 ? '中宫' : (yangInner.has(palace) === isYangDun ? '内宫' : '外宫');

/** 未按具体事项选用神时，仅以值符宫作通用应期参考。 */
export function estimateYingQi(options: TimingConditions) {
  const { isYangDun, zhiFuLandingPalace: fu, zhiShiLandingPalace: shi, isFuyin, isFanyin, hasHorse, hasVoid } = options;
  if ([fu, shi].some((palace) => !Number.isInteger(palace) || palace < 1 || palace > 9)) throw new Error('奇门应期宫位必须是 1-9 的整数。');
  const base = distance(fu, isYangDun), shiDistance = distance(shi, isYangDun), dun = isYangDun ? '阳遁' : '阴遁';
  let fast = base === '内宫' ? 1 : 0, slow = base === '外宫' ? 1 : 0;
  const sources = [base === '中宫' ? `值符通用参考落${fu}宫（中宫），盘内远近取象居中`
    : `值符通用参考落${fu}宫（${dun}${base}${base === '内宫' ? '速' : '迟'}应取象），盘内远近取象偏${base === '内宫' ? '近' : '远'}`];
  if (shiDistance === '内宫') { fast++; sources.push(`值使落${shi}宫（${dun}内宫），应期略快`); }
  if (shiDistance === '外宫') { slow++; sources.push(`值使落${shi}宫（${dun}外宫），应期略迟`); }
  if (isFuyin) { slow += 2; sources.push('伏吟局，事势迟滞，需等待重复推动或外部条件改变'); }
  if (isFanyin) { fast++; sources.push('反吟局，事势反复，应期虽快但不稳定，需防变数'); }
  if (hasHorse) { fast++; sources.push('驿马发动，出现行动、迁移、消息流转时更容易触发进展'); }
  if (hasVoid) {
    slow += 2;
    sources.push('空亡入局，需填实或冲实之月日方应，应期偏迟');
    if (options.voidBranches.length) {
      const voidDesc = options.voidBranches.map((branch) => {
        const index = EARTHLY_BRANCHES.indexOf(branch);
        return index < 0 ? branch : `${branch}（逢${EARTHLY_BRANCHES[(index + 6) % 12]}冲实）`;
      }).join('、');
      sources.push(`空亡在${voidDesc}，待填实/冲实之月日应`);
    }
  }
  if (options.classicPatterns.length) sources.push('未选定事项用神，经典格局保留为全盘资料，不进入值符通用参考的应期节奏');
  const rhythm: '快' | '中' | '慢' = slow >= fast + 2 ? '慢' : fast >= slow + 2 ? '快' : '中';
  const matched = sources.filter((source) => /逢|填实|冲实|行动|迁移|消息流转|条件具备|处理阻滞/.test(source));
  const triggerConditions = matched.length ? matched : ['结合问题期限，观察值符通用参考宫所代表的人事是否出现可核验的实际进展'];
  const limitations = ['快、中、慢只表示盘内相对节奏，不对应固定日数、月数或公历日期', '空亡、马星等只给候选触发条件，必须结合问题期限和现实事件核验', '未按具体问题选定用神时，本结果只能作为值符落宫的通用参考'];
  const parts = [`盘内应期节奏为${rhythm}，不机械换算固定天数。`];
  if (hasHorse) parts.push('马星冲动，应期较快，宜主动把握时机。');
  if (hasVoid) parts.push('空亡填实/冲实后方应，需耐心等待相应月日。');
  if (isFuyin) parts.push('伏吟局主迟滞，需反复推动或等待外因触发。');
  if (isFanyin) parts.push('反吟局主反复，虽快但易生变数，多做预案。');
  if (base === '内宫' && !hasVoid && !isFuyin) parts.push('值符通用参考落内宫，盘内节奏偏近。');
  if (base === '外宫' && !hasHorse && !isFanyin) parts.push('值符通用参考落外宫，盘内节奏偏远。');
  return { rhythm, sources, triggerConditions, limitations, description: parts.join('') };
}
