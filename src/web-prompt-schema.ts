import { getPromptCatalog } from './catalog';
import type { Method } from './schema';

type Field = { type?: string; description?: string; properties?: Record<string, Field>; enum?: unknown[]; optionLabels?: Record<string, string> };
type Catalog = { topicIds?: string[]; subtopics?: Record<string, { id: string; label: string }[]> };
const topicLabels: Record<string, string> = {
  general: '通用', relationship: '感情', career: '事业', wealth: '财运',
  health: '身心', family: '家庭', academic: '学业', timing: '时机',
};
export const schoolOptionLabels: Record<string, string> = {
  ziping: '子平派（重月令格局与扶抑）',
  mangpai: '盲派（重宾主做功，断事干脆）',
  xinpai: '新派（重紧贴作用、空亡与百神）',
  tiaohou: '调候派（重《穷通宝鉴》寒暖燥湿）',
  geju: '古法格局派（重《子平真诠》顺逆成败）',
  sanhe: '三合派（重三方四正与星曜庙旺）',
  feixing: '飞星派（重宫干四化飞星轨迹）',
  sihua: '钦天四化（重来因宫与生年四化）',
  zhongzhou: '中州派（重借星、夹宫与双星组合）',
  modern: '现代心理占星（重元素分布与心理议题）',
  traditional: '传统古典占星（重昼夜盘与尊贵互溶）',
  hellenistic: '希腊古典（重昼夜阵营与福点定位）',
  timing: '推运时机（重流运快照与窗口节点）',
  rws: '韦特体系（重图像象征与牌位）',
  yuansu: '四元素法（重火土风水能量分布）',
  narrative: '叙事串联（重牌序起承转合）',
  marseille: '马赛传统（重数序阶梯与几何位置）',
  shunshu: '顺数三宫传（重起因→过程→结果）',
  gongjue: '宫诀体用（重时宫歌诀与体用生克）',
  daoliu: '道家小六壬（重五行生克与时柱引动）',
  zhuke: '主客定算（重主客算与大将参将）',
  gongwei: '宫位神将（重太乙落宫与八门神将）',
  jisuan: '积算十六神（重积数推步与反证核验）',
  siwei: '四位生克（重人元贵神将神地分）',
  fayong: '发用神煞（重用爻立极与旬空）',
  wudong: '五动三动（重四位动象发端）',
  combination: '双牌组合（重邻牌叠加词典）',
  eventline: '事件线叙事（重因果推进落点）',
  significator: '指示牌定位（重人物牌落宫距离）',
  yunqi: '岁运太过不及（重岁干大运与胜复）',
  sitian: '司天在泉（重上下半年气候主调）',
  kezhu: '主客加临（重六步主客气生克）',
  xiejibianfang: '《协纪辨方书》（重正统建除黄黑道）',
  tongshu: '民间通书（兼顾民俗忌神避让）',
  guolao: '《果老星宗》（重神煞与恩难仇用）',
  qintang: '《琴堂指要》（重命度宿度浅深）',
  bazhaimingjing: '《八宅明镜》（重人宅东四西四相配）',
  yangzhaisanyao: '《阳宅三要》（重门主灶三要生克）',
  shenshi: '沈氏玄空（重山向挨星格局）',
  wuchang: '无常派玄空（重下卦替卦与城门诀）',
  hecan: '八宅玄空合参（重人宅与宅运叠合取舍）',
  yuanhui: '元会运世（重宏观周期与会运卦统辖）',
  guaqi: '值年卦气（重当年值年卦与六爻气运）',
  keti: '课体格局（重九宗门课体与传统定式）',
  bifafu: '《毕法赋》（重干支克应与经典赋文比照）',
  leishen: '类神聚焦（重所问事项类神乘将与落宫）',
  tiyong: '体用生克（重主互变体用旺衰与生克）',
  xiangshu: '卦象物象（重八卦类象与外应推演）',
  yaoci: '动爻辞参断（重《周易》本变卦辞与动爻辞）',
  huozhulin: '《火珠林》（重纳甲六亲与传统占断体系）',
  bushizhengzong: '《卜筮正宗》（重用神旺衰与黄金策脉络）',
  zengshanbuyi: '《增删卜易》（重月日动变实占与进退神）',
};

// Presentation only: the calculation and API continue to use the original schema and IDs.
export function promptFormSchema(method: Method, raw: unknown, value: Record<string, unknown>): unknown {
  const schema = raw as Field;
  const catalog = getPromptCatalog([method])[method] as Catalog | undefined;
  if (!schema?.properties) return raw;
  const properties = { ...schema.properties };
  if (properties.topicId && catalog?.topicIds) {
    const choices = catalog.topicIds;
    const selected = typeof value.topicId === 'string' ? value.topicId : undefined;
    const invalid = selected !== undefined && !choices.includes(selected);
    properties.topicId = { ...properties.topicId, enum: invalid ? [...choices, selected] : choices,
      optionLabels: { ...topicLabels, ...(invalid ? { [selected]: `不支持的主题：${selected}` } : {}) } };
  }
  if (properties.subtopicId && catalog?.subtopics) {
    const topic = typeof value.topicId === 'string' ? value.topicId : 'general';
    const choices = catalog.subtopics[topic] ?? [];
    const selected = typeof value.subtopicId === 'string' ? value.subtopicId : undefined;
    const invalid = selected !== undefined && !choices.some((item) => item.id === selected);
    properties.subtopicId = { ...properties.subtopicId,
      enum: [...choices.map((item) => item.id), ...(invalid ? [selected] : [])],
      optionLabels: { ...Object.fromEntries(choices.map((item) => [item.id, item.label])), ...(invalid ? { [selected]: `不属于当前主题：${selected}` } : {}) },
      description: choices.length ? properties.subtopicId.description : '当前主题没有可选子主题；请先选择其他主题，或移除此项。',
    };
  }
  for (const key of ['schools', 'baziSchools', 'ziweiSchools'] as const) {
    if (properties[key]) {
      properties[key] = {
        ...properties[key],
        optionLabels: { ...(properties[key].optionLabels ?? {}), ...schoolOptionLabels },
      };
    }
  }
  return { ...schema, properties };
}
