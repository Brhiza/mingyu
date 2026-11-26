import type { BaziPillar, PillarName } from './pillars';
import { calculateBaziShensha, type BaziShenshaOptions } from './shensha';

type Pillars = Record<PillarName, BaziPillar>;
type Layer = { id: 'dayun' | 'year' | 'month' | 'day' | 'hour'; pillar: BaziPillar };
const included = ['天乙贵人', '天官贵人', '太极贵人', '文昌贵人', '福星贵人', '国印贵人', '金舆', '天厨贵人', '禄神', '暗禄', '羊刃', '飞刃', '流霞',
  '驿马', '桃花', '将星', '华盖', '亡神', '劫煞', '灾煞', '岁煞', '六厄', '红鸾', '天喜', '孤辰', '寡宿',
  '丧门', '官符', '岁破', '龙德', '紫微', '白虎', '福德', '吊客', '病符', '披麻',
  '天德贵人', '天德合', '月德贵人', '月德合', '天医', '血刃', '空亡', '学堂', '词馆', '德秀贵人', '红艳煞', '勾绞煞', '天罗地网', '元辰'] as const;
const supported = new Set<string>(included);

/**
 * 这些查法的起例仅使用本命年、月、日柱及性别。逐一将岁运柱作为目标复用同一规则，
 * 只取列明的逐柱命中，丢弃本命时柱专用与整局规则；输出只列实际岁运层级。
 */
export function calculateFortuneShensha(pillars: Pillars, active: Layer[], gender: 'male' | 'female', options?: BaziShenshaOptions) {
  const layers = active.map(({ id, pillar }) => {
    const checked = calculateBaziShensha(pillars, gender, pillar, options);
    const entries = checked.entries.filter((entry) => entry.position === 'hour' && supported.has(entry.name)).map(({ position: _position, ...entry }) => entry);
    return { id, ganZhi: pillar.ganZhi, entries };
  });
  return { included: [...included], layers,
    rule: '将各岁运干支作为查找目标；起例仍使用实际本命年、月、日柱及性别，不替换本命年柱。',
    limitation: '仅核对所列可按固定本命起例的神煞；不将日柱专属、时柱专属或整局规则套作岁运神煞，未命中也不代表吉凶。不同流派的岁运查法尚未核验。' };
}

const layerLabels: Record<Layer['id'], string> = { dayun: '大运', year: '流年', month: '流月', day: '流日', hour: '流时' };
const pillarLabels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
export function formatFortuneShensha(value: ReturnType<typeof calculateFortuneShensha>, layers: readonly Layer['id'][], includeBasis = false) {
  const selected = value.layers.filter((layer) => layers.includes(layer.id));
  if (!selected.length) return '';
  const text = selected.map((layer) => `${layerLabels[layer.id]}${layer.ganZhi}：${layer.entries.map((item) => `${item.target}${item.name}${includeBasis ? `（${item.basis.map((basis) => `${pillarLabels[basis.pillar]}${basis.kind}${basis.value}查${basis.target}`).join('、')}）` : ''}`).join('；') || '所列规则未命中'}`).join('\n');
  return `${text}\n${value.rule}\n${value.limitation}`;
}
