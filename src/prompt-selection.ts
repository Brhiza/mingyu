import catalog from './prompt-catalog.json';

type Method = 'tarot' | 'lenormand' | 'xiaoliuren' | 'liuyao' | 'liuren' | 'jinkoujue' | 'taiyi' | 'wuyun-liuqi' | 'huangji-jingshi' | 'ssgw' | 'zhuge' | 'meihua' | 'qimen';
type Options = { topicId?: string; subtopicId?: string; scope?: string };
const topics: Record<string, string> = { general: '通用', relationship: '感情', career: '事业', wealth: '财运', health: '身心', family: '家庭', academic: '学业', timing: '时机' };
const scopes: Record<string, string> = { event: '当前事项', hourly: '流时/时计', daily: '流日/日计', monthly: '流月/月计', yearly: '流年/年计', cycle: '周期', custom: '自定义范围' };
const methods: Record<Method, { label: string; facts: string }> = {
  tarot: { label: '塔罗', facts: '牌位、正逆位、牌序和元素关系' },
  lenormand: { label: '雷诺曼', facts: '牌位、相邻组合和实际布局' },
  xiaoliuren: { label: '小六壬', facts: '顺数过程、时宫和对应歌诀' },
  liuyao: { label: '六爻', facts: '世应、六亲、用神候选、月日旺衰与动变' },
  liuren: { label: '大六壬', facts: '天地盘、四课取传、三传、天将及类神位置' },
  jinkoujue: { label: '金口诀', facts: '地分、将神、贵神、人元、阴阳发用及五动三动' },
  taiyi: { label: '太乙神数', facts: '四计积数、局数、主客定算、门将和宫位神将' },
  'wuyun-liuqi': { label: '五运六气', facts: '年度岁运、五步主客运、司天在泉及六步主客气' },
  'huangji-jingshi': { label: '皇极经世', facts: '元会运世位置、周期进度与实际提供的值年卦资料' },
  ssgw: { label: '三山国王灵签', facts: '签诗原文、典故及所问事项相关的解签资料' },
  zhuge: { label: '诸葛神数', facts: '三字/数字取数或五枚铜钱卦象、签诗卦辞和辅助解说' },
  meihua: { label: '梅花易数', facts: '主互变卦、动爻、体用生克和月令旺衰' },
  qimen: { label: '奇门遁甲', facts: '主体与事项用神、九宫门星神、天地盘干及宫间关系' },
};

export type SchoolGuidanceEntry = string | { label: string; task: string; basis: string };

/** Format deduplicated school guidance lines with an optional multi-school synthesis note. */
export function formatSchoolGuidance<K extends string>(
  schoolIds: readonly K[] | undefined,
  schoolMap: Record<K, SchoolGuidanceEntry>,
  options?: {
    heading?: string;
    basisLabel?: string;
    multiNote?: string;
  },
): string {
  const entries = [...new Set(schoolIds ?? [])].map((id) => schoolMap[id]);
  if (!entries.length) return '';
  const heading = options?.heading ?? '解读口径';
  const basisLabel = options?.basisLabel ?? '传统依据';
  const multiNote = options?.multiNote ?? '多口径分别分析，再比较共同依据与分歧。';
  const lines = entries.map((entry) =>
    typeof entry === 'string' ? entry : `${entry.label}：${entry.task}\n${basisLabel}：${entry.basis}`,
  );
  if (entries.length > 1) lines.push(multiNote);
  return `【${heading}】\n${lines.join('\n')}`;
}

/** Resolve only actual choices; labels and task instructions come from one contract. */
export function resolvePromptSelection(method: Method, options?: Options) {
  if (!options || (options.topicId === undefined && options.subtopicId === undefined && options.scope === undefined)) return null;
  const capability = catalog[method];
  const topic = options.topicId ?? 'general';
  if (!capability.topicIds.includes(topic)) throw new Error(`${methods[method].label}不支持主题：${topic}`);
  const subtopics = capability.subtopics as Record<string, { id: string; label: string }[]>;
  const subtopic = options.subtopicId === undefined ? undefined : subtopics[topic]?.find((item) => item.id === options.subtopicId);
  if (options.subtopicId !== undefined && !subtopic) throw new Error('所选子主题不属于当前主题。');
  const scope = options.scope ?? capability.defaultScope;
  if (!capability.scopeIds.includes(scope)) throw new Error(`${methods[method].label}不支持范围：${scope}`);
  const topicLabel = topics[topic], scopeLabel = scopes[scope];
  const focus = topic === 'general'
    ? `先组织${methods[method].facts}，说明整体主线与相互制约。`
    : `围绕${topicLabel}${subtopic ? `（${subtopic.label}）` : ''}，结合${methods[method].facts}说明主题主线、成立条件和现实核验点。`;
  return {
    section: [`方法：${methods[method].label}`, `解读主题：${topicLabel}`, subtopic ? `主题细项：${subtopic.label}` : '', `分析范围：${scopeLabel}`].filter(Boolean).join('\n'),
    task: `${focus} 以${scopeLabel}为问题边界，区分盘面事实、传统取义和条件性判断；未提供对应时间资料时明确说明缺口。`,
  };
}
