/**
 * 浏览器端 39 项术数推荐决策小模型 — V2 鲁棒特征提取与野生输入归一化模块
 * 纯 TypeScript、零 Node 专属依赖，训练脚本与浏览器推理共享同一套特征提取逻辑。
 *
 * V2 升级亮点：
 * 1. 繁简转换 + 术数错别字/同音别称 + 英文简称 + 当代网络黑话归一化；
 * 2. 非自然语言结构化野生输入自动识别（纯日期、双人日期、纯四柱干支、纯手机号/车牌、纯单字、纯报数）；
 * 3. 超短碎片句（2~5字）与长篇故事（150~300字尾句聚焦加权）双向兼容；
 * 4. 多意图/复合提问的次意图识别，确保 Top-3 同时照顾主意图与次意图。
 */

export const CANONICAL_METHODS = [
  'instant',
  'random-divination',
  'calendar',
  'zhouyi',
  'number-energy',
  'character-query',
  'chinese-name',
  'chinese-naming',
  'bazi-reverse',
  'tarot',
  'lenormand',
  'xiaoliuren',
  'ssgw',
  'zhuge',
  'wuyun-liuqi',
  'huangji-jingshi',
  'jinkoujue',
  'liuren',
  'meihua',
  'liuyao',
  'taiyi',
  'qimen',
  'qimen-lifetime',
  'bazi',
  'bazi-synastry',
  'bazhai',
  'xuankong',
  'residential',
  'almanac',
  'qizheng',
  'qizheng-range',
  'ziwei',
  'ziwei-synastry',
  'bazi-ziwei',
  'astrolabe',
  'astrolabe-synastry',
  'astrolabe-range',
  'minglu',
  'fortune',
] as const;

export type MethodId = (typeof CANONICAL_METHODS)[number];

export type BirthTimeStatus = 'exact' | 'range' | 'unknown' | 'not_provided';
export type TraditionPref = 'any' | 'eastern' | 'western_cards' | 'folk_signs';
export type DepthPref = 'quick' | 'standard' | 'deep';

export type WildInputKind =
  | 'pure_two_birthdates'
  | 'pure_birthdate'
  | 'pure_four_pillars'
  | 'pure_phone_or_plate'
  | 'pure_single_chars'
  | 'pure_numbers_2'
  | 'pure_numbers_3'
  | null;

export interface RouterInput {
  query: string;
  birthTimeStatus?: BirthTimeStatus;
  traditionPref?: TraditionPref;
  depthPref?: DepthPref;
  hasManualCast?: boolean;
  hasHouseFacing?: boolean;
}

export const METHOD_LABELS: Record<MethodId, string> = {
  instant: '即时起盘',
  'random-divination': '随机起卦',
  calendar: '历法与天文',
  zhouyi: '周易经文',
  'number-energy': '数字能量',
  'character-query': '汉字查询',
  'chinese-name': '姓名分析',
  'chinese-naming': '中文起名',
  'bazi-reverse': '四柱反推',
  tarot: '塔罗牌',
  lenormand: '雷诺曼',
  xiaoliuren: '小六壬',
  ssgw: '三山国王灵签',
  zhuge: '诸葛神数',
  'wuyun-liuqi': '五运六气',
  'huangji-jingshi': '皇极经世',
  jinkoujue: '金口诀',
  liuren: '大六壬',
  meihua: '梅花易数',
  liuyao: '六爻',
  taiyi: '太乙神数',
  qimen: '奇门遁甲',
  'qimen-lifetime': '奇门终身局',
  bazi: '八字排盘',
  'bazi-synastry': '八字合盘',
  bazhai: '八宅风水',
  xuankong: '玄空飞星',
  residential: '阳宅风水',
  almanac: '黄历择日',
  qizheng: '七政四余',
  'qizheng-range': '七政四余出生范围',
  ziwei: '紫微斗数',
  'ziwei-synastry': '紫微合盘',
  'bazi-ziwei': '八字紫微合参',
  astrolabe: '西洋星盘',
  'astrolabe-synastry': '西洋星盘合盘',
  'astrolabe-range': '西洋星盘出生范围',
  minglu: '个人命录',
  fortune: '流运运势',
};

export const DIVINATION_METHODS = new Set<MethodId>([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'jinkoujue',
  'xiaoliuren',
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'instant',
  'random-divination',
]);

export const CALIBRATION_NATAL_METHODS = new Set<MethodId>([
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'astrolabe-range',
  'qizheng-range',
  'bazi-synastry',
  'ziwei-synastry',
  'bazi-reverse',
  'qimen-lifetime',
]);

export const WESTERN_CARDS_METHODS = new Set<MethodId>([
  'tarot',
  'lenormand',
  'astrolabe',
  'astrolabe-synastry',
  'astrolabe-range',
]);

export const FOLK_SIGNS_METHODS = new Set<MethodId>(['ssgw', 'zhuge']);

export const QUICK_METHODS = new Set<MethodId>([
  'xiaoliuren',
  'meihua',
  'jinkoujue',
  'lenormand',
  'fortune',
  'ssgw',
  'random-divination',
  'character-query',
  'number-energy',
  'calendar',
]);

export const DEEP_METHODS = new Set<MethodId>([
  'bazi-ziwei',
  'minglu',
  'qimen',
  'liuren',
  'residential',
  'qimen-lifetime',
  'taiyi',
  'huangji-jingshi',
  'qizheng',
  'astrolabe',
]);

/**
 * 轻量高频港台繁体→简体单字映射（零外部依赖，O(L) 极速）
 */
const TRAD_PAIRS: readonly [string, string][] = [
  ['運', '运'], ['勢', '势'], ['測', '测'], ['盤', '盘'], ['簽', '签'], ['靈', '灵'],
  ['數', '数'], ['風', '风'], ['曆', '历'], ['黃', '黄'], ['擇', '择'], ['開', '开'],
  ['業', '业'], ['遷', '迁'], ['結', '结'], ['戀', '恋'], ['愛', '爱'], ['財', '财'],
  ['學', '学'], ['試', '试'], ['離', '离'], ['辭', '辞'], ['職', '职'], ['換', '换'],
  ['買', '买'], ['賣', '卖'], ['車', '车'], ['號', '号'], ['機', '机'], ['門', '门'],
  ['陽', '阳'], ['陰', '阴'], ['時', '时'], ['間', '间'], ['點', '点'], ['歲', '岁'],
  ['經', '经'], ['傳', '传'], ['醫', '医'], ['氣', '气'], ['聖', '圣'], ['諸', '诸'],
  ['羅', '罗'], ['衛', '卫'], ['鬥', '斗'], ['書', '书'], ['畫', '画'], ['筆', '笔'],
  ['義', '义'], ['釋', '释'], ['詢', '询'], ['對', '对'], ['雙', '双'], ['沖', '冲'],
  ['剋', '克'], ['問', '问'], ['題', '题'], ['幫', '帮'], ['準', '准'], ['確', '确'],
  ['這', '这'], ['個', '个'], ['麼', '么'], ['為', '为'], ['與', '与'], ['還', '还'],
  ['會', '会'], ['沒', '没'], ['過', '过'], ['來', '来'], ['說', '说'], ['話', '话'],
  ['長', '长'], ['遠', '远'], ['總', '总'], ['檔', '档'], ['錄', '录'], ['體', '体'],
  ['現', '现'], ['實', '实'], ['夢', '梦'], ['鬱', '郁'], ['煩', '烦'], ['憂', '忧'],
  ['慮', '虑'], ['壓', '压'], ['難', '难'], ['損', '损'], ['險', '险'], ['關', '关'],
  ['係', '系'], ['侶', '侣'], ['親', '亲'], ['婦', '妇'], ['兒', '儿'], ['孫', '孙'],
  ['鄰', '邻'], ['廣', '广'], ['東', '东'], ['華', '华'], ['國', '国'], ['際', '际'],
  ['區', '区'], ['邊', '边'], ['飛', '飞'], ['廳', '厅'], ['臥', '卧'], ['廚', '厨'],
  ['廁', '厕'], ['裝', '装'], ['購', '购'], ['貸', '贷'], ['債', '债'], ['錢', '钱'],
  ['賺', '赚'], ['虧', '亏'], ['賠', '赔'], ['獎', '奖'], ['調', '调'], ['崗', '岗'],
  ['約', '约'], ['談', '谈'], ['競', '竞'], ['標', '标'], ['敗', '败'], ['勝', '胜'],
  ['訟', '讼'], ['糾', '纠'], ['紛', '纷'], ['丟', '丢'], ['尋', '寻'], ['遺', '遗'],
  ['漢', '汉'], ['詞', '词'], ['語', '语'], ['讀', '读'], ['寫', '写'], ['選', '选'],
  ['擇', '择'], ['動', '动'], ['靜', '静'], ['變', '变'], ['化', '化'], ['極', '极'],
  ['宮', '宫'], ['祿', '禄'], ['權', '权'], ['科', '科'], ['忌', '忌'], ['曜', '曜'],
  ['宿', '宿'], ['餘', '余'], ['龜', '龟'], ['銅', '铜'], ['幣', '币'], ['搖', '摇'],
  ['擲', '掷'], ['隱', '隐'], ['瞞', '瞒'], ['騙', '骗'], ['錯', '错'], ['亂', '乱'],
  ['斷', '断'], ['決', '决'], ['終', '终'], ['順', '顺'], ['逆', '逆'], ['進', '进'],
  ['退', '退'], ['歸', '归'], ['發', '发'], ['達', '达'], ['興', '兴'], ['旺', '旺'],
  ['衰', '衰'], ['病', '病'], ['痛', '痛'], ['養', '养'], ['補', '补'], ['瀉', '泻'],
  ['陰', '阴'], ['曆', '历'], ['農', '农'], ['節', '节'], ['閏', '闰'], ['滿', '满'],
  ['虧', '亏'], ['廳', '厅'], ['樓', '楼'], ['層', '层'], ['戶', '户'], ['鋪', '铺'],
  ['廠', '厂'], ['辦', '办'], ['從', '从'], ['頭', '头'], ['剛', '刚'], ['裡', '里'],
  ['後', '后'], ['復', '复'], ['雜', '杂'], ['簡', '简'], ['單', '单'], ['細', '细'],
  ['膩', '腻'], ['詳', '详'], ['預', '预'], ['報', '报'], ['應', '应'], ['驗', '验'],
  ['證', '证'], ['據', '据'], ['圖', '图'], ['表', '表'], ['評', '评'], ['審', '审'],
  ['當', '当'], ['幹', '干'], ['廳', '厅'], ['請', '请'], ['謝', '谢'], ['願', '愿'],
  ['給', '给'], ['讓', '让'], ['聽', '听'], ['見', '见'], ['覺', '觉'], ['認', '认'],
  ['識', '识'], ['記', '记'], ['憶', '忆'], ['忘', '忘'], ['該', '该'], ['須', '须'],
  ['寶', '宝'], ['貝', '贝'], ['媽', '妈'], ['爺', '爷'], ['奶', '奶'], ['師', '师'],
  ['友', '友'], ['伴', '伴'], ['婚', '婚'], ['嫁', '嫁'], ['娶', '娶'], ['懷', '怀'],
  ['孕', '孕'], ['產', '产'], ['壽', '寿'], ['福', '福'], ['災', '灾'], ['禍', '祸'],
  ['殺', '杀'], ['破', '破'], ['狼', '狼'], ['廉', '廉'], ['貞', '贞'], ['貪', '贪'],
  ['陰', '阴'], ['陽', '阳'], ['梁', '梁'], ['機', '机'], ['巨', '巨'], ['門', '门'],
  ['點', '点'], ['鐘', '钟'], ['分', '分'], ['秒', '秒'], ['區', '区'], ['範', '范'],
  ['圍', '围'], ['較', '较'], ['疊', '叠'], ['跨', '跨'], ['線', '线'], ['網', '网'],
  ['電', '电'], ['腦', '脑'], ['郵', '邮'], ['遞', '递'], ['鐵', '铁'], ['飛', '飞'],
  ['駕', '驾'], ['駛', '驶'], ['遊', '游'], ['旅', '旅'], ['簽', '签'], ['證', '证'],
  ['廳', '厅'], ['嗎', '吗'], ['呢', '呢'], ['吧', '吧'], ['啊', '啊'], ['喔', '哦'],
];

const TRAD_MAP = new Map<string, string>(TRAD_PAIRS);

function toSimplifiedBasic(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += TRAD_MAP.get(ch) ?? ch;
  }
  return out;
}

/**
 * 错别字 / 同音别称 / 英文简称 / 当代网络黑话 归一化替换规则表
 */
const NORMALIZE_REPLACEMENTS: readonly [RegExp, string][] = [
  // 1. 术数专名错别字 & 同音别称
  [/(紫薇斗数|紫薇斗术|紫薇斗树|紫微斗术|紫微斗树|紫薇命盘|紫薇盘)/g, '紫微斗数'],
  [/紫薇/g, '紫微'],
  [/(奇门盾甲|起门遁甲|起门盾甲|奇门屯甲|奇门钝甲|奇门遁假|起门)/g, '奇门遁甲'],
  [/(塔罗排|他罗牌|他罗|塔洛|踏罗|塔啰|塔萝)/g, '塔罗'],
  [/(雷诺慢|雷诺曼牌)/g, '雷诺曼'],
  [/(六摇|流爻|陆爻|六交)/g, '六爻'],
  [/(小六任|小流壬)/g, '小六壬'],
  [/(大六任|大流壬|大六人)/g, '大六壬'],
  [/(金口决|金口爵)/g, '金口诀'],
  [/(梅花易术|梅花艺术|梅花意数|梅花易书)/g, '梅花易数'],
  [/(太乙神术|太一神数|太乙神书)/g, '太乙神数'],
  [/(皇极经事|皇极惊世|黄极经世)/g, '皇极经世'],
  [/(五运流气|五云六气|五运六器)/g, '五运六气'],
  [/(七政四鱼|七正四余|七政四玉)/g, '七政四余'],
  [/果老星踪/g, '果老星宗'],
  [/(三山国王签|三山灵签)/g, '三山国王灵签'],
  [/(诸葛神算|诸葛神术|诸葛神书)/g, '诸葛神数'],
  [/(玄空非星|旋空飞星|玄空飞兴)/g, '玄空飞星'],
  [/(八宅风睡|八摘风水)/g, '八宅风水'],
  [/(八字核不核|八字和不好|八字和不和)/g, '八字合不合'],
  [/(河婚|和婚)/g, '合婚'],
  [/风睡/g, '风水'],
  [/老黄力/g, '老黄历'],

  // 2. 常见英文术数术语
  [/\btarot\b/g, '塔罗'],
  [/\blenormand\b/g, '雷诺曼'],
  [/\bsynastry\b/g, '西洋星盘合盘'],
  [/\b(natal\s*chart|astrology|horoscope)\b/g, '西洋星盘'],
  [/\bbazi\b/g, '八字'],
  [/\bziwei\b/g, '紫微斗数'],
  [/\bqimen\b/g, '奇门遁甲'],
  [/\bliuyao\b/g, '六爻'],
  [/\bfengshui\b/g, '风水'],

  // 3. 当代网络黑话 / 隐喻语义归一化（保留可读语义，同时对齐模型与框架词表）
  [/(润出去|润国外|润欧美|润日本|润澳洲|润加拿大|润海外|想润)/g, '出国移民'],
  [/上岸/g, '考公考研考试上岸'],
  [/(太\s*emo|好\s*emo|很\s*emo|\bemo\b)/g, '焦虑低谷情绪差'],
  [/内耗/g, '焦虑低谷内耗'],
  [/(摆烂|躺平)/g, '低谷迷茫摆烂'],
  [/(破防|玉玉|快撑不住|撑不住|扛不住|麻了)/g, '焦虑低谷崩溃'],
  [/(被\s*pua|pua\s*我)/g, '感情困扰被控制'],
  [/(渣男|渣女|舔狗|海王|海后|养鱼|冷暴力|断联|恋爱脑)/g, '感情困扰恋爱'],
  [/(n\+1|被优化|被公司毕业|背锅|穿小鞋|提桶跑路|\bpip\b|卷不动)/g, '职场危机工作'],
  [/裁员/g, '裁员职场危机'],
  [/(暴富|搞钱|回血)/g, '发财财运'],
  [/(爆仓|套牢|割肉|梭哈)/g, '投资亏损财运'],
];

export function normalizeQuery(raw: string): string {
  let s = toSimplifiedBasic((raw || '').normalize('NFKC').toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, rep] of NORMALIZE_REPLACEMENTS) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 常见 1~2 字非单字查询白名单（避免把“搬家”“好累”“起名”“分手”误判为单字查询）
 */
const NON_CHAR_QUERY_SHORT_WORDS = new Set<string>([
  '搬家', '起名', '取名', '改名', '测名', '好累', '好烦', '好难', '好慌', '焦虑',
  '迷茫', '内耗', '崩溃', '分手', '复合', '失恋', '吵架', '离婚', '复婚', '结婚',
  '领证', '相亲', '表白', '暗恋', '暧昧', '出轨', '裁员', '跳槽', '离职', '辞职',
  '升职', '加薪', '面试', '创业', '合伙', '打工', '发财', '暴富', '赚钱', '搞钱',
  '理财', '炒股', '基金', '投资', '买房', '卖房', '租房', '装修', '动土', '开业',
  '考试', '考研', '考公', '考编', '上岸', '留学', '出国', '移民', '旅游', '出行',
  '自驾', '官司', '仲裁', '维权', '借钱', '欠款', '丢了', '失物', '找物', '寻物',
  '生病', '失眠', '养生', '怀孕', '生娃', '运势', '日运', '月运', '年运', '流年',
  '大运', '算命', '占卜', '起卦', '摇卦', '抽签', '求签', '解签', '合婚', '合盘',
  '八字', '紫微', '奇门', '六爻', '梅花', '塔罗', '星盘', '风水', '八宅', '玄空',
  '阳宅', '黄历', '择日', '吉日', '周易', '易经', '太乙', '皇极', '五运', '七政',
  '历法', '节气', '命录', '姓名', '车牌', '手机', '号码', '数字', '选啥', '去吗',
  '成吗', '行吗', '准吗', '救命', '完蛋', '躺平', '摆烂', '累', '烦', '慌', '难',
]);

const PILLAR_RE = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
const ISO_DATE_RE = /(?:19|20)\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}[日号]?|(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/g;
const PHONE_RE = /1[3-9]\d{9}/;
const PLATE_RE = /[京沪粤浙苏川渝鲁豫湘鄂皖闽辽吉黑晋陕甘青琼桂宁新藏云贵蒙][a-z][·.\s-]?[a-z0-9]{5,6}/i;

/**
 * 识别非自然语言结构化野生输入（纯日期、双人日期、纯四柱干支、纯手机号/车牌、纯单字、纯报数）
 */
export function detectWildStructuredInput(rawQuery: string): WildInputKind {
  const rawTrimmed = toSimplifiedBasic((rawQuery || '').normalize('NFKC').trim());
  const rawLower = rawTrimmed.toLowerCase();
  if (!rawTrimmed) return null;

  // 1. 纯四柱干支（如 "甲子 丙寅 戊辰 庚申"、"乙丑、丁亥、己卯、辛未 男"）
  const pillars = rawTrimmed.match(PILLAR_RE);
  if (pillars && pillars.length === 4 && !/(?:19|20)\d{2}/.test(rawTrimmed)) {
    const rest = rawTrimmed
      .replace(PILLAR_RE, '')
      .replace(/(乾造|坤造|四柱|干支|八字|男|女|反推|公历|出生|日期|查一下)/g, '')
      .replace(/[\s,，、.;；:：\-/()（）【】\[\]]+/g, '');
    if (rest.length <= 6) {
      return 'pure_four_pillars';
    }
  }

  // 2. 纯手机号 / 车牌号（如 "13812345678"、"京A88888"、"粤B·D68139"）
  if (PHONE_RE.test(rawLower) || PLATE_RE.test(rawLower)) {
    const rest = rawLower
      .replace(/1[3-9]\d{9}/g, '')
      .replace(/[京沪粤浙苏川渝鲁豫湘鄂皖闽辽吉黑晋陕甘青琼桂宁新藏云贵蒙][a-z][·.\s-]?[a-z0-9]{5,6}/gi, '')
      .replace(/(手机号|手机|号码|尾号|车牌号|车牌|门牌号|门牌|看看|测一下|测测|好不好|怎么样|数字|能量|磁场|和|与|对比|哪个好)/g, '')
      .replace(/[\s,，、.;；:：\-/()（）【】\[\]?？!！]+/g, '');
    if (rest.length <= 6) {
      return 'pure_phone_or_plate';
    }
  }

  // 3. 纯公历日期时间（双人 / 单人）
  const dates = rawLower.match(ISO_DATE_RE);
  if (dates && dates.length >= 1) {
    const rest = rawLower
      .replace(ISO_DATE_RE, '')
      .replace(/\d{1,2}[:点时]\d{0,2}分?半?/g, '')
      .replace(/(公历|阳历|农历|阴历|早上|上午|中午|下午|晚上|凌晨|半夜|左右|男|女|生|出生|和|与|合|配|北京|上海|广州|深圳|成都|杭州|南京|武汉|西安|重庆|长沙|青岛|苏州|天津|郑州)/g, '')
      .replace(/[\s,，、.;；:：\-/()（）【】\[\]?？!！]+/g, '');
    if (dates.length >= 2 && rest.length <= 8) {
      return 'pure_two_birthdates';
    }
    if (dates.length === 1 && rest.length <= 6) {
      return 'pure_birthdate';
    }
  }

  // 4. 纯报数（2个或3个正整数，如 "5 12"、"3 7 9"、"8, 16, 24"）
  const numOnlyMatch = rawTrimmed.match(/^\s*(\d{1,3})\s*[,，、\s/\-]+\s*(\d{1,3})(?:\s*[,，、\s/\-]+\s*(\d{1,3}))?\s*$/);
  if (numOnlyMatch) {
    return numOnlyMatch[3] ? 'pure_numbers_3' : 'pure_numbers_2';
  }

  // 5. 纯单个或两个汉字（生僻字/起名候选单字，如 "琂"、"珩"、"璟"、"梓 轩"）
  const hanOnly = rawTrimmed.replace(/[\s,，、.;；:："'“”‘’「」『』()（）【】\[\]?？!！]+/g, '');
  if (/^[\u4e00-\u9fff]{1,2}$/.test(hanOnly) && !NON_CHAR_QUERY_SHORT_WORDS.has(hanOnly)) {
    return 'pure_single_chars';
  }

  return null;
}

export function detectLongTermNatalIntent(q: string): boolean {
  return /(这辈子|一辈子|一生|终身|先天|本命|十年大运|大运|大限|未来几年|未来五年|未来十年|命格|命局|格局|长远|合婚|过日子|婚后|考时|定盘|校准时辰|生时校正|上升星座|命宫宿度|洞微|四柱反推|反推出生|个人命录|命理总|总档案|合盘|比较盘|命里|天生适合|正缘什么时候)/.test(
    q,
  );
}

export function detectShortTermEventIntent(q: string): boolean {
  return /(下周|明天|今天|今晚|下午|上午|这周|本月|下个月|刚才|刚刚|能不能过|能不能成|成不成|顺不顺|找不找得回|找得回来|要回来|拿不拿得到|会不会分|会不会回复|会复合吗|分手了|答应|批准|录用|上岸|中标|签约|谈判|面试|答辩|复试|裁员|快递|堵车|放鸽子|表白|暧昧|冷战|隐情|小人|选a还是选b|二选一|哪一家|去不去|该不该|跳槽吗|能发财吗|买房吗|选哪个)/.test(
    q,
  );
}

export function detectTwoPersonIntent(q: string): boolean {
  return /(合婚|合盘|双盘|比较盘|我们俩|两个人|双方|我和(对象|伴侣|男友|男朋友|女友|女朋友|老公|老婆|未婚夫|未婚妻|前任|暧昧|暗恋|合伙人|闺蜜|发小|上司|领导|婆婆|女儿|儿子|大宝|爸爸|弟弟|搭档)|母女|母子|父子|亲子缘|合不合财|合不合拍|谁更付出|跨盘|叠宫|八字合不合)/.test(
    q,
  );
}

export function detectExplicitMethod(rawQuery: string): MethodId | null {
  const q = normalizeQuery(rawQuery);

  // Check more specific compound methods BEFORE their base methods
  if (/(随机起卦|随机选一个|随机抽一种|随机挑一种|占卜盲盒|盲盒占卜|交给缘分|交给天意|随便随机)/.test(q)) {
    return 'random-divination';
  }
  if (/(四柱反推|反推出生|反查|倒推.*公历|干支.*反推|干支.*还原|还原.*出生)/.test(q)) {
    return 'bazi-reverse';
  }
  if (/(即时起盘|即时盘|即时西洋星盘|即时星盘|即时八字|即时紫微|即时七政|卜卦盘|按.*时刻起|按现在.*起一个.*盘)/.test(q)) {
    return 'instant';
  }
  if (/(个人命录|综合命录|命理总报告|命理全书|命理总档案|所有命盘.*总报告)/.test(q)) {
    return 'minglu';
  }
  if (/(八字紫微合参|八字和紫微|八字加紫微|八字.*紫微.*合|紫微.*八字.*合|双盘对照)/.test(q)) {
    return 'bazi-ziwei';
  }
  if (/(奇门终身局|奇门终身盘|奇门.*终身|奇门.*一辈子|奇门.*一生)/.test(q)) {
    return 'qimen-lifetime';
  }
  if (/(西洋星盘合盘|西洋双人合盘|西洋比较盘|比较盘|星盘合盘|双人.*星盘)/.test(q)) {
    return 'astrolabe-synastry';
  }
  if (/(西洋星盘出生范围|星盘.*范围|星盘.*时段|星盘.*时间段|星盘.*不确定|生时校正.*星盘|星盘.*生时校正)/.test(q)) {
    return 'astrolabe-range';
  }
  if (/(七政四余出生范围|七政.*范围|七政.*区间|七政.*时间段|果老星宗.*范围|果老星宗.*时段)/.test(q)) {
    return 'qizheng-range';
  }
  if (/(紫微合盘|紫微双盘|紫微双人合盘|紫微.*合一下|紫微.*叠宫)/.test(q)) {
    return 'ziwei-synastry';
  }
  if (/(八字合婚|八字合盘|八字双人合盘|双方八字|合个八字|合一下.*八字|八字合不合)/.test(q)) {
    return 'bazi-synastry';
  }
  if (/(三山国王|灵签|抽支.*签|求一支.*签|求签|解签)/.test(q) && !/诸葛/.test(q)) {
    return 'ssgw';
  }
  if (/(诸葛神数|诸葛亮神数|三十二课|384签)/.test(q)) {
    return 'zhuge';
  }
  if (/(雷诺曼)/.test(q)) {
    return 'lenormand';
  }
  if (/(塔罗|韦特塔罗)/.test(q)) {
    return 'tarot';
  }
  if (/(小六壬|掐指一算|道家小六壬)/.test(q)) {
    return 'xiaoliuren';
  }
  if (/(金口诀|地分)/.test(q)) {
    return 'jinkoujue';
  }
  if (/(大六壬)/.test(q)) {
    return 'liuren';
  }
  if (/(梅花易数|梅花卦|用梅花)/.test(q)) {
    return 'meihua';
  }
  if (/(六爻|铜钱摇|硬币摇|摇了一卦|摇好六爻|初爻到上爻)/.test(q)) {
    return 'liuyao';
  }
  if (/(奇门遁甲|奇门时盘|用奇门)/.test(q)) {
    return 'qimen';
  }
  if (/(太乙神数|太乙年计|太乙月计|太乙日计|太乙时计|太乙落宫|太乙移宫)/.test(q)) {
    return 'taiyi';
  }
  if (/(皇极经世|元会运世|值年卦|值运卦|邵雍|邵康节|六日逐爻)/.test(q)) {
    return 'huangji-jingshi';
  }
  if (/(五运六气|司天|在泉|初之气|三之气|四之气|五之气|终之气|主客加临)/.test(q)) {
    return 'wuyun-liuqi';
  }
  if (/(玄空飞星|玄空盘|玄空风水|旺山旺向|替卦|城门诀|流年飞星|五黄煞|二黑病符)/.test(q) && !/(八宅|阳宅风水|命卦)/.test(q)) {
    return 'xuankong';
  }
  if (/(阳宅风水|八宅和玄空|八宅.*玄空|玄空.*八宅|命卦.*飞星|飞星.*命卦)/.test(q)) {
    return 'residential';
  }
  if (/(八宅|东四命|西四命|坎宅|兑宅|震宅|离宅|命卦)/.test(q)) {
    return 'bazhai';
  }
  if (/(黄历|老黄历|择日|杨公忌|三娘煞|四离四绝|十恶大败|宜嫁娶|宜动土|宜开业|入宅乔迁)/.test(q)) {
    return 'almanac';
  }
  if (/(周易|易经).*(原文|卦辞|爻辞|象传|彖传|第\s*\d+\s*卦)/.test(q) || /(卦辞|爻辞|象传|大象传).*原文/.test(q)) {
    return 'zhouyi';
  }
  if (/(数字能量|八星磁场|天医.*延年|五鬼.*绝命|手机号.*磁场|车牌.*磁场|车牌号|门牌号.*数字)/.test(q)) {
    return 'number-energy';
  }
  if (/(真太阳时|儒略日|力学时|交节时间|交节|日出日落|晨昏蒙影|朔月|望月|新月.*满月)/.test(q)) {
    return 'calendar';
  }
  if (/(七政四余|果老星宗|洞微|二十八宿度|恩难|四余落宫)/.test(q)) {
    return 'qizheng';
  }
  if (/(西洋星盘|太阳返照|土星回归|法达星限|上升星座|星盘)/.test(q) && !/合盘|比较盘/.test(q)) {
    return 'astrolabe';
  }
  if (/(紫微斗数|紫微命盘|紫微盘|用紫微|夫妻宫.*官禄宫|杀破狼|机月同梁)/.test(q)) {
    return 'ziwei';
  }
  if (/(汉字查询|康熙字典|几画.*五行|五行.*几画|单查.*字|查一下.*[“"「].*[”"」].*字)/.test(q)) {
    return 'character-query';
  }
  return null;
}

/**
 * 多意图 / 复合提问次意图检测：
 * 当用户一句话里同时表达了主意图与次意图（如“合婚+挑领证吉日”“起名+看宝宝八字”“问面试+看未来几年大运”），
 * 返回应当被纳入 Top-3 的次意图代表方法列表。
 */
export function detectSecondaryIntentMethods(rawQuery: string, primaryMethod: MethodId): MethodId[] {
  const q = normalizeQuery(rawQuery);
  const secondary: MethodId[] = [];
  const pushIfNew = (m: MethodId) => {
    if (m !== primaryMethod && !secondary.includes(m)) secondary.push(m);
  };

  const hasAlmanac = /(黄历|择日|好日子|吉日|挑.*日子|哪天.*适合|领证.*日子|搬家.*日子|动土.*日子|开业.*日子|入宅.*日子)/.test(q);
  const hasFengshui = /(风水|朝向|坐向|飞星|八宅|阳宅|财位|床头|书桌|装修.*布局)/.test(q);
  const hasNaming = /(起名|取名|起个.*名|起几个.*名|改名)/.test(q);
  const hasNameAnalyze = /(测.*名|分析.*名|名字好不好)/.test(q);
  const hasNatal = /(八字|紫微|一辈子|一生|十年大运|大运|命格|命局|未来几年|未来三年|未来五年)/.test(q);
  const hasShortEvent = /(面试|跳槽|能不能过|能不能成|裁员|签约|谈判|分手|复合|答辩|复试|找不找得回|下周|明天)/.test(q);
  const hasSynastry = /(合婚|合盘|八字合不合|我们俩合不合)/.test(q);
  const hasTarotPsych = /(塔罗|怎么想我|潜意识|心理|疗愈|内心)/.test(q);
  const hasNumber = /(手机号|车牌号|门牌号|数字能量|八星磁场)/.test(q);

  if (hasAlmanac && primaryMethod !== 'almanac') pushIfNew('almanac');
  if (hasFengshui && !['bazhai', 'xuankong', 'residential'].includes(primaryMethod)) pushIfNew('residential');
  if (hasNaming && primaryMethod !== 'chinese-naming') pushIfNew('chinese-naming');
  if (hasNameAnalyze && primaryMethod !== 'chinese-name') pushIfNew('chinese-name');
  if (hasSynastry && !['bazi-synastry', 'ziwei-synastry', 'astrolabe-synastry'].includes(primaryMethod)) {
    pushIfNew('bazi-synastry');
  }
  if (hasNumber && primaryMethod !== 'number-energy') pushIfNew('number-energy');
  if (hasTarotPsych && primaryMethod !== 'tarot') pushIfNew('tarot');
  if (hasNatal && DIVINATION_METHODS.has(primaryMethod)) {
    pushIfNew(/紫微/.test(q) ? 'ziwei' : 'bazi');
  }
  if (hasShortEvent && !DIVINATION_METHODS.has(primaryMethod) && primaryMethod !== 'almanac') {
    pushIfNew(/(二选一|选a还是选b|谈判|策略)/.test(q) ? 'qimen' : 'liuyao');
  }

  return secondary;
}

function pushNgrams(tokens: string[], text: string) {
  const cleaned = text
    .replace(/1[3-9]\d{9}/g, 'P')
    .replace(/\d{4}年/g, 'Y年')
    .replace(/\d+/g, 'N')
    .replace(/[，。！？、；：“”‘’（）()【】\[\]《》<>—…·.,!?;:'"~`@#$%^&*+=\/\\|-]/g, ' ');

  const segments = cleaned.split(/\s+/).filter(Boolean);
  for (const seg of segments) {
    const chars = Array.from(seg);
    for (let i = 0; i < chars.length; i++) {
      tokens.push(`1:${chars[i]}`);
      if (i + 1 < chars.length) {
        tokens.push(`2:${chars[i]}${chars[i + 1]}`);
      }
      if (i + 2 < chars.length) {
        tokens.push(`3:${chars[i]}${chars[i + 1]}${chars[i + 2]}`);
      }
    }
  }
}

function pushSemanticSignals(tokens: string[], text: string) {
  if (/(起名|取名|改名|起几个.*名|单字名|二字名|辈分字|诗经.*名|艺名.*起|笔名.*起|重新起)/.test(text)) {
    tokens.push('SEM:naming_create');
  }
  if (/(测测.*名|测名|测名字|分析.*名|名字.*好不好|名字.*怎么样|现有名字|本名|原名|候选名|艺名.*分析|名字.*硬伤|名字.*重名|三才五格)/.test(text)) {
    tokens.push('SEM:naming_analyze');
  }
  if (/(几画|康熙|部首|单字|字形|释义|本义|怎么念|怎么读|笔画|筛.*字|找.*字)/.test(text)) {
    tokens.push('SEM:char_lookup');
  }
  if (/(手机号|车牌|门牌号|数字能量|八星磁场|尾号|座机|密码.*数字)/.test(text)) {
    tokens.push('SEM:number_energy');
  }
  if (/(周易|易经).*(原文|卦辞|爻辞|象传|彖传|出处|搜一下|查一下)/.test(text) || /(卦辞|爻辞|象传|小象|大象传)/.test(text)) {
    tokens.push('SEM:zhouyi_text');
  }
  if (/(节气|立春|冬至|夏至|清明|芒种|立秋|真太阳时|日出|日落|月相|满月|新月|儒略日|力学时|农历.*公历|闰月)/.test(text)) {
    tokens.push('SEM:calendar_astro');
  }
  if (/(黄历|择日|好日子|吉日|挑.*日子|哪天.*适合|哪一天.*吉利|动土|入宅|乔迁|嫁娶|提车|安床|杨公忌|三娘煞|^搬家$)/.test(text)) {
    tokens.push('SEM:almanac_date');
  }
  if (/(风水|坐北朝南|坐西朝东|坐东朝西|坐南朝北|坐子向午|坐壬向丙|坐乾向巽|坐坤向艮|朝向|罗盘|东四命|西四命|命卦|飞星|玄空|阳宅|八宅|床头|书桌|财位|文昌位|五黄|二黑)/.test(text)) {
    tokens.push('SEM:fengshui');
  }
  if (/(五运六气|司天|在泉|主气|客气|初之气|三之气|四之气|五之气|终之气|中医.*养生|气候.*养生)/.test(text)) {
    tokens.push('SEM:wuyun');
  }
  if (/(太乙|主客算|年计|月计|日计|时计|宏观大势|大环境气运)/.test(text)) {
    tokens.push('SEM:taiyi');
  }
  if (/(皇极经世|元会运世|值年卦|值运卦|邵雍|邵康节|泽火革|六日逐爻)/.test(text)) {
    tokens.push('SEM:huangji');
  }
  if (
    /(反推|倒推|四柱干支|干支.*公历|甲|乙|丙|丁|戊|己|庚|辛|壬|癸).*(子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥)/.test(text) &&
    /(反推|倒推|哪天|公历|还原|族谱|纸条|红纸)/.test(text)
  ) {
    tokens.push('SEM:bazi_reverse');
  }
  if (/(今日运势|今天.*运势|本月.*运势|这个月.*运势|月运|日运|年运|流年运势|通用.*运势|看运势|能发财吗)/.test(text)) {
    tokens.push('SEM:fortune_period');
  }
  if (/(到|之间|左右|前后|大概.*点|不确定.*分|记不清.*点|两小时)/.test(text)) {
    tokens.push('SEM:time_range_hint');
  }
  if (/(心理|潜意识|内心|怎么想我|疗愈|暧昧|忽冷忽热|焦虑低谷|情绪差|好累|牌阵|正位|逆位|感情困扰)/.test(text)) {
    tokens.push('SEM:tarot_psych');
  }
  if (/(直白|现实事件|邻牌|九宫牌阵|快递|邮件|简历|雷诺曼)/.test(text)) {
    tokens.push('SEM:lenormand_concrete');
  }
  if (/(灵签|求签|解签|签诗|祈福|保平安|三山国王)/.test(text)) {
    tokens.push('SEM:folk_sign');
  }
  if (/(三个字|三字|三数字|三个数|五枚铜钱|三十二课|诸葛)/.test(text)) {
    tokens.push('SEM:zhuge_sign');
  }
  if (/(报.*数|数字.*起卦|笔画起卦|摔碎|喜鹊|黑屏|外应|物象|梅花)/.test(text)) {
    tokens.push('SEM:meihua_sign');
  }
  if (/(铜钱|硬币|摇.*卦|六个爻|应期|官司|仲裁|借.*钱|要回来|六爻|分手了|会复合吗|考公考研考试上岸)/.test(text)) {
    tokens.push('SEM:liuyao_sign');
  }
  if (/(选a还是选b|二选一|两家|两个.*纠结|竞标|谈判|方位|策略|攻守|主客|奇门|选哪个)/.test(text)) {
    tokens.push('SEM:qimen_strategy');
  }
  if (/(隐情|瞒着|作梗|使绊子|谣言|背后|前因后果|来龙去脉|大六壬|失联|离家出走|职场危机)/.test(text)) {
    tokens.push('SEM:liuren_detail');
  }
  if (/(干脆利落|一针见血|快准狠|地分|金口诀|直断)/.test(text)) {
    tokens.push('SEM:jinkoujue_sharp');
  }
  if (/(掐指一算|堵车|误机|耳机|钥匙|排队|砍价|放鸽子|抢票|小六壬|丢东西)/.test(text)) {
    tokens.push('SEM:xiaoliuren_quick');
  }
}

/**
 * 提取文本与前置选项的结构化特征列表（允许重复以保留词频 TF）。
 */
export function extractFeatureTokens(input: RouterInput): string[] {
  const tokens: string[] = [];
  const rawOriginal = (input.query || '').trim();
  const raw = normalizeQuery(rawOriginal);
  const bt = input.birthTimeStatus ?? 'not_provided';
  const trad = input.traditionPref ?? 'any';
  const depth = input.depthPref ?? 'standard';

  // 0. Wild non-natural structured input detection
  const wildKind = detectWildStructuredInput(rawOriginal);
  if (wildKind) {
    tokens.push(`SEM:wild_${wildKind}`);
    tokens.push(`SEM:wild_${wildKind}`);
  }

  // Length bucket signals
  const charLen = Array.from(rawOriginal.replace(/\s+/g, '')).length;
  if (charLen <= 6) {
    tokens.push('SEM:short_fragment');
  } else if (charLen >= 75) {
    tokens.push('SEM:long_story');
  }

  // 1. Structured numeric semantic tokens
  if (PHONE_RE.test(raw) || /尾号\s*\d{3,4}/.test(raw)) tokens.push('SEM:phone_num');
  if (PLATE_RE.test(raw)) {
    tokens.push('SEM:car_plate');
  }
  if (/\d{1,3}\s*度/.test(raw)) tokens.push('SEM:compass_angle');
  if (/(19\d\d|20\d\d)年/.test(raw) || /(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(raw)) {
    tokens.push('SEM:has_year');
  }
  if (/\d{1,2}\s*[点时:]\s*\d{0,2}/.test(raw)) tokens.push('SEM:has_clock_time');

  // 2. Character 1-grams, 2-grams, 3-grams
  pushNgrams(tokens, raw);

  // 2b. Tail-focus boost for long stories (>= 75 chars):
  // People writing 150~300 char life stories almost always put their real question in the last ~45 chars.
  if (charLen >= 75) {
    const tail = Array.from(raw).slice(-45).join('');
    pushNgrams(tokens, tail);
    pushSemanticSignals(tokens, tail);
  }

  // 3. Pre-option tokens
  tokens.push(`OPT:bt=${bt}`);
  tokens.push(`OPT:trad=${trad}`);
  tokens.push(`OPT:depth=${depth}`);
  if (input.hasManualCast) tokens.push('OPT:manual=1');
  if (input.hasHouseFacing) tokens.push('OPT:facing=1');

  // 4. Semantic & domain intent tokens + option interactions
  const isLongTerm = detectLongTermNatalIntent(raw);
  const isShortTerm = detectShortTermEventIntent(raw);
  const isTwoPerson = detectTwoPersonIntent(raw);

  if (isLongTerm) tokens.push('SEM:long_term');
  if (isShortTerm) tokens.push('SEM:short_term');
  if (isTwoPerson) tokens.push('SEM:two_person');

  pushSemanticSignals(tokens, raw);

  // Option x Intent interaction features (crucial for dual-track & preference steering!)
  if (bt === 'unknown' && isShortTerm && !isLongTerm) {
    tokens.push('INT:unknown_short');
  }
  if (bt === 'unknown' && isLongTerm) {
    tokens.push('INT:unknown_long');
  }
  if (bt === 'range' && /(星盘|上升|西洋|占星)/.test(raw)) {
    tokens.push('INT:range_astrolabe');
  }
  if (bt === 'range' && /(七政|果老|宿度|命度)/.test(raw)) {
    tokens.push('INT:range_qizheng');
  }
  if (trad === 'western_cards' && isTwoPerson) {
    tokens.push('INT:western_synastry');
  }
  if (trad === 'western_cards' && isShortTerm) {
    tokens.push('INT:western_short');
  }
  if (trad === 'folk_signs' && isShortTerm) {
    tokens.push('INT:folk_short');
  }
  if (depth === 'quick' && isShortTerm) {
    tokens.push('INT:quick_short');
  }
  if (depth === 'deep' && isLongTerm) {
    tokens.push('INT:deep_long');
  }
  if (input.hasHouseFacing && /(命卦|八宅|我和|全家|老婆|老公|孩子|全屋|阳宅)/.test(raw)) {
    tokens.push('INT:facing_residential');
  }
  if (input.hasHouseFacing && !/(命卦|八宅|我和|全家|老婆|老公|孩子|阳宅)/.test(raw)) {
    tokens.push('INT:facing_xuankong');
  }

  return tokens;
}
