/**
 * 自然语言生辰、双人合盘与专项结构化信息提取器（纯同步、零依赖、< 2ms）
 *
 * 复用项目内置全国省市区县 + 海外城市经纬度数据库（location.ts），
 * 支持复杂多行模板、口语化长段描述、双人分块切分（防串台）、
 * 多种日期/时间格式以及号码/报数/测名/指定术数提取。
 */

import type { SynastryRelationship } from '../systems/focus-presets';
import {
  resolveLocationCoordinates,
  searchLocations,
  type LocationEntry,
} from '../systems/location';
import type { MethodId } from './features';

export interface ExtractedBirthProfile {
  name?: string;
  gender?: 'male' | 'female';
  calendarType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timeIndex: number | 'unknown';
  birthPlace?: string;
  latitude?: number;
  longitude?: number;
  timezone?: number;
  timeZoneId?: string;
  summary: string;
}

export interface ExtractedStructuredInputs {
  /** 用户明确点名的术数 */
  explicitMethod?: MethodId;
  /** 提取到的手机号 / 车牌号 / 门牌号（用于 number-energy） */
  numberEnergy?: string;
  /** 报数起卦数字序列（用于 meihua / xiaoliuren） */
  castNumbers?: number[];
  /** 测名目标姓名或起名姓氏 */
  targetName?: string;
  surname?: string;
  /** 是否包含完整四柱干支（用于判断是否真为 bazi-reverse） */
  hasFourPillarsGanzhi?: boolean;
}

export interface ExtractedBirthResult {
  profiles: ExtractedBirthProfile[];
  isTwoPerson: boolean;
  relationship?: SynastryRelationship;
  /** 若输入包含显式「问题：...」行或剥离生辰后的提问正文 */
  question?: string;
  structured: ExtractedStructuredInputs;
}

const SHICHEN_MAP: ReadonlyArray<{ chars: string[]; index: number; repHour: number }> = [
  { chars: ['早子时', '晚子时', '子时'], index: 0, repHour: 0 },
  { chars: ['丑时'], index: 1, repHour: 2 },
  { chars: ['寅时'], index: 2, repHour: 4 },
  { chars: ['卯时'], index: 3, repHour: 6 },
  { chars: ['辰时'], index: 4, repHour: 8 },
  { chars: ['巳时'], index: 5, repHour: 10 },
  { chars: ['午时'], index: 6, repHour: 12 },
  { chars: ['未时'], index: 7, repHour: 14 },
  { chars: ['申时'], index: 8, repHour: 16 },
  { chars: ['酉时'], index: 9, repHour: 18 },
  { chars: ['戌时'], index: 10, repHour: 20 },
  { chars: ['亥时'], index: 11, repHour: 22 },
];

const CN_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const SIXTY_GANZHI_RE =
  /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;

function parseCnNumber(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number.parseInt(s, 10);
  if (s === '十') return 10;
  if (s === '正') return 1;
  if (s === '冬') return 11;
  if (s === '腊') return 12;
  if (s.startsWith('初') && s.length === 2) {
    return CN_DIGIT[s[1]!] ?? null;
  }
  if (s.startsWith('廿')) {
    if (s.length === 1) return 20;
    const d = CN_DIGIT[s[1]!];
    return d !== undefined ? 20 + d : null;
  }
  if (s === '三十') return 30;
  if (s.includes('十')) {
    const [left, right] = s.split('十');
    const tens = left ? (CN_DIGIT[left] ?? null) : 1;
    const ones = right ? (CN_DIGIT[right] ?? null) : 0;
    if (tens === null || ones === null) return null;
    return tens * 10 + ones;
  }
  if (s.length === 1 && CN_DIGIT[s] !== undefined) return CN_DIGIT[s]!;
  return null;
}

function hourToTimeIndex(hour: number): number {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h === 23 || h === 0) return 0;
  return Math.floor((h + 1) / 2);
}

function normalizeYear(rawYear: string): number | null {
  const n = Number.parseInt(rawYear, 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 1900 && n <= 2100) return n;
  if (n >= 0 && n <= 99) {
    return n <= 29 ? 2000 + n : 1900 + n;
  }
  return null;
}

function detectExplicitName(segment: string): string | undefined {
  const m = /(?:姓名|名字|命主|称呼)\s*[:：\s]\s*([^\s，,。；;\n]{1,12})/.exec(segment);
  const candidate = m?.[1]?.trim();
  if (candidate && !/^(?:男|女|公历|农历|阴历|阳历|出生|未知|不详)/.test(candidate)) {
    return candidate;
  }
  const spoken = /(?:我叫|名字叫|名叫|本人)\s*([\u4e00-\u9fa5]{2,4})(?=[\s，,。；;\n]|$)/.exec(segment);
  const spokenCand = spoken?.[1]?.trim();
  if (spokenCand && !/^(?:公历|农历|阴历|阳历|出生|未知|不详|男命|女命)/.test(spokenCand)) {
    return spokenCand;
  }
  const roleName = /(?:男方|女方|命主[一二12]|甲方|乙方)\s*[:：]\s*([\u4e00-\u9fa5]{2,4})(?=[\s，,。；;\n]|$)/.exec(
    segment,
  );
  const roleCand = roleName?.[1]?.trim();
  if (roleCand && !/^(?:公历|农历|阴历|阳历|出生|未知|不详)/.test(roleCand)) {
    return roleCand;
  }
  return undefined;
}

function detectExplicitPlace(segment: string): string | undefined {
  const m = /(?:出生地点?|出生地|籍贯|生于|所在城市|坐标)\s*[:：\s]\s*([^\n，,。；;]{2,36})/.exec(segment);
  const raw = m?.[1]?.trim();
  if (!raw || /^(?:公历|农历|阴历|阳历|\d)/.test(raw)) return undefined;
  return raw;
}

/**
 * 利用项目内置全国省市区县 + 海外城市数据库解析地点坐标与时区。
 */
function resolvePlaceFromText(explicitPlace: string | undefined, fallbackSegment: string): {
  birthPlace?: string;
  entry?: LocationEntry;
} {
  // 1. 优先解析显式标注的出生地（如「广东省 广州市 天河区」「江苏南通如皋」「美国 纽约」）
  if (explicitPlace) {
    const tokens = explicitPlace
      .split(/[\s,/、-]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length >= 2) {
      const exact =
        resolveLocationCoordinates(tokens[0]!, tokens[1], tokens[2]) ??
        resolveLocationCoordinates(tokens[0]!, tokens[1]);
      if (exact) {
        return { birthPlace: explicitPlace, entry: exact };
      }
    }

    // 尝试整串搜索或逐词从细粒度往粗粒度搜索（如 天河区 -> 广州市 -> 广东省）
    const directHits = searchLocations(explicitPlace.replace(/\s+/g, ''), 5);
    if (directHits.length > 0) {
      return { birthPlace: explicitPlace, entry: directHits[0] };
    }
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const token = tokens[i]!;
      if (token.length < 2) continue;
      const hits = searchLocations(token, 5);
      if (hits.length > 0) {
        return { birthPlace: explicitPlace, entry: hits[0] };
      }
    }
    return { birthPlace: explicitPlace };
  }

  // 2. 自由文本中探测「XX省XX市XX区」「XX市」「在XX出生」「XX人」或常见城市名
  const addrMatch =
    /([\u4e00-\u9fa5]{2,5}(?:省|自治区))?\s*([\u4e00-\u9fa5]{2,5}(?:市|州|盟))\s*([\u4e00-\u9fa5]{2,5}(?:区|县|旗))?/.exec(
      fallbackSegment,
    );
  if (addrMatch) {
    const prov = addrMatch[1]?.trim();
    const city = addrMatch[2]?.trim();
    const dist = addrMatch[3]?.trim();
    const full = [prov, city, dist].filter(Boolean).join(' ');
    const exact = prov
      ? resolveLocationCoordinates(prov, city, dist) ?? resolveLocationCoordinates(prov, city)
      : undefined;
    if (exact) return { birthPlace: full, entry: exact };
    const hits = searchLocations(dist ?? city ?? full, 5);
    if (hits.length > 0) return { birthPlace: full, entry: hits[0] };
  }

  const inCityMatch =
    /(?:出生在|生在|生于|坐标|来自|老家在?)\s*([\u4e00-\u9fa5A-Za-z]{2,12})/.exec(fallbackSegment);
  if (inCityMatch?.[1]) {
    const cand = inCityMatch[1].replace(/(?:的|人|附近|这边|那边)$/, '');
    if (cand.length >= 2 && !/^(?:公历|农历|阴历|阳历|早上|上午|中午|下午|晚上|凌晨)/.test(cand)) {
      const hits = searchLocations(cand, 5);
      if (hits.length > 0) {
        return { birthPlace: hits[0]!.displayName, entry: hits[0] };
      }
    }
  }

  // 3. 兜底匹配片段中出现的直辖市/省会/常见城市词
  const quickCities = [
    '北京', '上海', '广州', '深圳', '成都', '杭州', '重庆', '武汉', '西安', '南京',
    '天津', '苏州', '长沙', '郑州', '青岛', '沈阳', '哈尔滨', '昆明', '厦门', '福州',
    '合肥', '济南', '大连', '宁波', '太原', '石家庄', '南昌', '贵阳', '南宁', '兰州',
    '长春', '海口', '乌鲁木齐', '温州', '佛山', '东莞', '珠海', '无锡', '常州', '徐州',
    '泉州', '扬州', '烟台', '洛阳', '南通', '桂林', '香港', '台北', '新加坡', '东京',
    '首尔', '悉尼', '墨尔本', '伦敦', '巴黎', '纽约', '洛杉矶', '旧金山', '多伦多', '温哥华',
  ];
  const DESTINATION_PREFIX_RE = /(?:去|到|往|搬到|搬去|飞|飞往|留在|定居|调去|调到|外派|出差|旅游|逛|考去|考到|工作在|上班在|想回|回)$/;
  const DESTINATION_SUFFIX_RE = /^(?:发展|定居|出差|旅游|玩|买房|工作|上学|读书|留学|面试|跳槽|分公司|落户|打拼|闯荡)/;
  for (const name of quickCities) {
    let searchFrom = 0;
    while (searchFrom < fallbackSegment.length) {
      const idx = fallbackSegment.indexOf(name, searchFrom);
      if (idx === -1) break;
      searchFrom = idx + name.length;
      const prefix = fallbackSegment.slice(Math.max(0, idx - 4), idx);
      const suffix = fallbackSegment.slice(idx + name.length, idx + name.length + 4);
      if (DESTINATION_PREFIX_RE.test(prefix) || DESTINATION_SUFFIX_RE.test(suffix)) {
        continue;
      }
      const hits = searchLocations(name, 3);
      if (hits.length > 0) {
        return { birthPlace: hits[0]!.displayName, entry: hits[0] };
      }
    }
  }

  return {};
}

function detectGender(segment: string): 'male' | 'female' | undefined {
  if (/(?:性别\s*[:：\s]?\s*男|乾造|男命|男方|男生|男士|男孩|男宝|男友|男朋友|老公|丈夫|爸爸|父亲|儿子|\b男\b|(?<![子女])男)/.test(segment)) {
    return 'male';
  }
  if (/(?:性别\s*[:：\s]?\s*女|坤造|女命|女方|女生|女士|女孩|女宝|女友|女朋友|老婆|妻子|妈妈|母亲|女儿|\b女\b|(?<![男])女)/.test(segment)) {
    return 'female';
  }
  return undefined;
}

function detectTime(segment: string): {
  hour?: number;
  minute?: number;
  second?: number;
  timeIndex: number | 'unknown';
} {
  // 0. 明确表示不知道时辰
  if (/(?:不知道时辰|时辰不详|时辰未知|忘了几点|不清楚几点|忘记时辰|不知时辰)/.test(segment)) {
    return { timeIndex: 'unknown' };
  }

  // 1. 精确时钟 HH:MM(:SS) 或 HH.MM（排除 2000.5.20 这种日期）
  const colonMatch =
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\s*(?<!\d[.-])(\d{1,2})\s*[:：.]\s*(\d{2})(?:\s*[:：]\s*(\d{2}))?(?![.-]\d)/.exec(
      segment,
    );
  if (colonMatch) {
    const period = colonMatch[1] ?? '';
    let h = Number.parseInt(colonMatch[2]!, 10);
    const m = Number.parseInt(colonMatch[3]!, 10);
    const s = colonMatch[4] ? Number.parseInt(colonMatch[4], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
      if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') && h >= 1 && h <= 11) {
        h += 12;
      } else if (period === '中午' && h >= 1 && h <= 11) {
        h += 12;
      } else if (period === '凌晨' && h === 12) {
        h = 0;
      }
      return { hour: h, minute: m, second: s, timeIndex: hourToTimeIndex(h) };
    }
  }

  // 2a. 口语双数字区间「早上七八点 / 下午三四点 / 晚上九十点」-> 取中点
  const approxRangeMatch =
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\s*([一二两三四五六七八九])\s*([二三四五六七八九十])\s*[点时]/.exec(
      segment,
    );
  if (approxRangeMatch) {
    const h1 = parseCnNumber(approxRangeMatch[2]!);
    const h2 = parseCnNumber(approxRangeMatch[3]!);
    if (h1 !== null && h2 !== null && h2 === h1 + 1) {
      const period = approxRangeMatch[1] ?? '';
      let h = h1;
      if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') && h >= 1 && h <= 11) {
        h += 12;
      } else if (period === '中午' && h >= 1 && h <= 11) {
        h += 12;
      }
      return { hour: h, minute: 30, second: 0, timeIndex: hourToTimeIndex(h) };
    }
  }

  // 2b. 口语“下午两点半 / 上午9点15分 / 14点30 / 晚上八点 / 12点整”
  const spokenMatch =
    /(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,3})\s*[点时]\s*(半|整|(\d{1,2}|[一二三四五六七八九十]{1,3})\s*分?)?/.exec(
      segment,
    );
  if (spokenMatch) {
    const period = spokenMatch[1] ?? '';
    const parsedH = parseCnNumber(spokenMatch[2]!);
    if (parsedH !== null && parsedH >= 0 && parsedH <= 23) {
      let h = parsedH;
      if ((period === '下午' || period === '傍晚' || period === '晚上' || period === '夜里') && h >= 1 && h <= 11) {
        h += 12;
      } else if (period === '中午' && h >= 1 && h <= 11) {
        h += 12;
      } else if (period === '凌晨' && h === 12) {
        h = 0;
      }
      let m = 0;
      if (spokenMatch[3] === '半') {
        m = 30;
      } else if (spokenMatch[4]) {
        const pm = parseCnNumber(spokenMatch[4]);
        if (pm !== null && pm >= 0 && pm <= 59) m = pm;
      }
      return { hour: h, minute: m, second: 0, timeIndex: hourToTimeIndex(h) };
    }
  }

  // 3. 十二地支时辰
  for (const item of SHICHEN_MAP) {
    if (item.chars.some((c) => segment.includes(c))) {
      return { hour: item.repHour, minute: 0, second: 0, timeIndex: item.index };
    }
  }

  // 4. 4位紧凑时钟（如「出生时间 1430」「 0930」「 1200」，排除 19xx/20xx 年份）
  const compactTimeMatch = /(?:时间\s*[:：\s]?|[\s,，])([01]\d|2[0-3])([0-5]\d)(?!\d)/.exec(segment);
  if (compactTimeMatch) {
    const full4 = `${compactTimeMatch[1]}${compactTimeMatch[2]}`;
    if (!full4.startsWith('19') && !full4.startsWith('20')) {
      const h = Number.parseInt(compactTimeMatch[1]!, 10);
      const m = Number.parseInt(compactTimeMatch[2]!, 10);
      return { hour: h, minute: m, second: 0, timeIndex: hourToTimeIndex(h) };
    }
  }

  // 5. 明确模糊时段词兜底（无具体钟点时定位代表时辰）
  if (/(?:半夜|深夜|子夜|午夜前后|凌晨)/.test(segment)) return { hour: 0, minute: 0, second: 0, timeIndex: 0 };
  if (/(?:大清早|清晨|拂晓|天刚亮|蒙蒙亮|天亮)/.test(segment)) return { hour: 6, minute: 0, second: 0, timeIndex: 3 };
  if (/(?:早饭前后|吃完早饭|早上上班)/.test(segment)) return { hour: 8, minute: 0, second: 0, timeIndex: 4 };
  if (/(?:正午|大中午|中午)/.test(segment)) return { hour: 12, minute: 0, second: 0, timeIndex: 6 };
  if (/(?:傍晚|黄昏|日落|快天黑)/.test(segment)) return { hour: 18, minute: 0, second: 0, timeIndex: 9 };
  if (/(?:晚饭后|吃完晚饭|刚入夜|夜里)/.test(segment)) return { hour: 20, minute: 0, second: 0, timeIndex: 10 };

  return { timeIndex: 'unknown' };
}

function detectRelationship(text: string): SynastryRelationship | undefined {
  if (/(合伙|创业|合作|同事|搭档|共事|老板|上下级)/.test(text)) return 'career';
  if (/(闺蜜|朋友|兄弟情|室友|友情|铁哥们)/.test(text)) return 'friendship';
  if (/(儿子|女儿|孩子|宝宝|亲子|小孩)/.test(text)) return 'children';
  if (/(父母|爸爸|妈妈|父亲|母亲|长辈|婆婆|公公)/.test(text)) return 'parents';
  if (/(兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|手足)/.test(text)) return 'siblings';
  if (/(结婚|婚恋|合婚|对象|伴侣|男友|女友|男朋友|女朋友|老公|老婆|夫妻|恋爱|感情|复合|分手|暧昧|相亲)/.test(text)) {
    return 'marriage';
  }
  return undefined;
}

function detectStructuredInputs(text: string): ExtractedStructuredInputs {
  const out: ExtractedStructuredInputs = {};

  // 1. 明确指定的术数方法
  if (/(?:紫微合盘|紫微双盘)/.test(text)) out.explicitMethod = 'ziwei-synastry';
  else if (/(?:星盘合盘|比较盘|组合盘|马盘)/.test(text)) out.explicitMethod = 'astrolabe-synastry';
  else if (/(?:八字合盘|八字合婚)/.test(text)) out.explicitMethod = 'bazi-synastry';
  else if (/(?:八字紫微|星平合参)/.test(text)) out.explicitMethod = 'bazi-ziwei';
  else if (/(?:紫微斗数|紫微盘|排紫微)/.test(text)) out.explicitMethod = 'ziwei';
  else if (/(?:西洋星盘|占星|本命星盘|排星盘)/.test(text)) out.explicitMethod = 'astrolabe';
  else if (/(?:七政四余)/.test(text)) out.explicitMethod = 'qizheng';
  else if (/(?:奇门终身|终身奇门)/.test(text)) out.explicitMethod = 'qimen-lifetime';
  else if (/(?:奇门遁甲|奇门起局|排奇门)/.test(text)) out.explicitMethod = 'qimen';
  else if (/(?:六爻|摇卦|铜钱卦)/.test(text)) out.explicitMethod = 'liuyao';
  else if (/(?:梅花易数|梅花起卦)/.test(text)) out.explicitMethod = 'meihua';
  else if (/(?:大六壬|六壬)/.test(text)) out.explicitMethod = 'liuren';
  else if (/(?:小六壬)/.test(text)) out.explicitMethod = 'xiaoliuren';
  else if (/(?:金口诀)/.test(text)) out.explicitMethod = 'jinkoujue';
  else if (/(?:塔罗牌|抽塔罗|塔罗占卜|塔罗)/.test(text)) out.explicitMethod = 'tarot';
  else if (/(?:雷诺曼)/.test(text)) out.explicitMethod = 'lenormand';
  else if (/(?:观音灵签|抽签|求签|灵签)/.test(text)) out.explicitMethod = 'ssgw';
  else if (/(?:诸葛神算)/.test(text)) out.explicitMethod = 'zhuge';
  else if (/(?:玄空飞星|九宫飞星)/.test(text)) out.explicitMethod = 'xuankong';
  else if (/(?:八宅风水|八宅)/.test(text)) out.explicitMethod = 'bazhai';
  else if (/(?:阳宅风水|看风水|住宅风水)/.test(text)) out.explicitMethod = 'residential';
  else if (/(?:黄历|择吉|择日|选吉日|挑日子)/.test(text)) out.explicitMethod = 'almanac';
  else if (/(?:数字能量|测手机号|测车牌|手机号码吉凶|车牌号吉凶)/.test(text)) out.explicitMethod = 'number-energy';
  else if (/(?:四柱反推|八字反推)/.test(text)) out.explicitMethod = 'bazi-reverse';
  else if (/(?:宝宝起名|给孩子起名|起个名字|取名字|帮忙起名|起名)/.test(text)) out.explicitMethod = 'chinese-naming';
  else if (/(?:测名字|测姓名|姓名评测|名字打分)/.test(text)) out.explicitMethod = 'chinese-name';

  // 2. 四柱干支检测（至少 4 组独立六十甲子）
  const gzMatches = text.match(SIXTY_GANZHI_RE) ?? [];
  if (gzMatches.length >= 4) {
    out.hasFourPillarsGanzhi = true;
  }

  // 3. 手机号 / 车牌号 / 门牌号（用于数字能量）
  const phoneMatch = /(?<!\d)(1[3-9]\d{9})(?!\d)/.exec(text);
  const plateMatch = /([京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5,6})/.exec(text);
  if (phoneMatch?.[1]) {
    out.numberEnergy = phoneMatch[1];
  } else if (plateMatch?.[1]) {
    out.numberEnergy = plateMatch[1];
  } else if (/(?:数字能量|号码|门牌号|工号|微信号|QQ号)/.test(text)) {
    const seq = /(?<!\d)(\d{4,12})(?!\d)/.exec(text);
    if (seq?.[1]) out.numberEnergy = seq[1];
  }

  // 4. 报数起卦数字（如「报数 3、8、5」「数字 12 34 56」）
  const castMatch = /(?:报数|数字|报了|随机数)\s*[:：\s]?\s*(\d{1,3})\s*[,，、\s]+\s*(\d{1,3})(?:\s*[,，、\s]+\s*(\d{1,3}))?/.exec(
    text,
  );
  if (castMatch) {
    const nums = [castMatch[1], castMatch[2], castMatch[3]]
      .filter((x): x is string => Boolean(x))
      .map((x) => Number.parseInt(x, 10));
    if (nums.length >= 2) out.castNumbers = nums;
  } else {
    const freeCast =
      /(?:想了|心里想|选了|给了)\s*(?:两|三|2|3)?\s*个?数字?\s*(\d{1,3})\s*(?:和|与|,|，|、|\s)+\s*(\d{1,3})(?:\s*(?:和|与|,|，|、|\s)+\s*(\d{1,3}))?/.exec(
        text,
      );
    if (freeCast) {
      const nums = [freeCast[1], freeCast[2], freeCast[3]]
        .filter((x): x is string => Boolean(x))
        .map((x) => Number.parseInt(x, 10));
      if (nums.length >= 2) out.castNumbers = nums;
    }
  }

  // 5. 测名 / 起名姓氏
  const nameCheckMatch =
    /(?:测名|测名字|测姓名|姓名评测)\s*[:：\s]?\s*([\u4e00-\u9fa5]{2,4})/.exec(text) ??
    /([\u4e00-\u9fa5]{2,4})\s*(?:这个名字|这名字|的名字)\s*(?:怎么样|好不好|如何|打分|吉凶)/.exec(text);
  if (nameCheckMatch?.[1]) {
    out.targetName = nameCheckMatch[1];
    if (!out.explicitMethod) out.explicitMethod = 'chinese-name';
  }
  const surnameMatch = /(?:姓|父姓|宝宝姓)\s*[:：\s]?\s*([\u4e00-\u9fa5]{1,2})/.exec(text);
  if (surnameMatch?.[1]) out.surname = surnameMatch[1];

  return out;
}

interface RawDateHit {
  start: number;
  end: number;
  year: number;
  month: number;
  day: number;
  calendarType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}

function normalizeChineseYearDigits(raw: string): string {
  // 把「二零零零年」「一九九二年」「九六年」里的中文年份转换成阿拉伯数字，保持字符长度一致或仅用于日期匹配
  return raw
    .replace(/([一二][零〇一二三四五六七八九]{3})\s*年/g, (_, y: string) => {
      const d = [...y].map((c) => (CN_DIGIT[c] !== undefined ? String(CN_DIGIT[c]) : c)).join('');
      return `${d}年`;
    })
    .replace(/(?<![一二三四五六七八九十零〇\d])([零〇一二三四五六七八九]{2})\s*年/g, (_, y: string) => {
      const d = [...y].map((c) => (CN_DIGIT[c] !== undefined ? String(CN_DIGIT[c]) : c)).join('');
      return `${d}年`;
    });
}

function findDateHits(rawText: string): RawDateHit[] {
  const text = normalizeChineseYearDigits(rawText);
  const hits: RawDateHit[] = [];
  const maxBirthYear = new Date().getFullYear();

  const hasOverlap = (start: number, end: number) =>
    hits.some((h) => start < h.end && end > h.start);

  // 格式 1: 1990年(农历/阴历/闰)5月15日 / 1990年八月十二 / 二零零零年五月二十
  const reCn =
    /((?:19|20)\d{2}|\d{2})\s*年\s*(农历|阴历|旧历|公历|阳历|新历|国历)?\s*(闰|润)?\s*(\d{1,2}|正|冬|腊|[一二三四五六七八九十]{1,2})\s*月\s*(\d{1,2}|初[一二三四五六七八九十]|廿[一二三四五六七八九]?|三十|[一二三四五六七八九十]{1,3})\s*[日号]?/g;
  let m: RegExpExecArray | null;
  while ((m = reCn.exec(text)) !== null) {
    const year = normalizeYear(m[1]!);
    const month = parseCnNumber(m[4]!);
    const day = parseCnNumber(m[5]!);
    if (!year || year > maxBirthYear || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      continue;
    }
    const prefixWindow = text.slice(Math.max(0, m.index - 10), m.index);
    const calTag = m[2] ?? '';
    const isLunar =
      calTag === '农历' ||
      calTag === '阴历' ||
      calTag === '旧历' ||
      /(?:农历|阴历|旧历)/.test(prefixWindow) ||
      Boolean(m[3]) ||
      /^初|^廿/.test(m[5]!);
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      year,
      month,
      day,
      calendarType: isLunar ? 'lunar' : 'solar',
      ...(isLunar && m[3] ? { isLeapMonth: true } : {}),
    });
  }

  // 格式 2: 1990-05-15 / 1990.5.15 / 1990/5/15 / 98.11.03 / 1996 3 8（空格分隔）
  const reIso = /(?<!\d)((?:19|20)\d{2}|\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g;
  while ((m = reIso.exec(text)) !== null) {
    if (hasOverlap(m.index, m.index + m[0].length)) continue;
    const year = normalizeYear(m[1]!);
    const month = Number.parseInt(m[2]!, 10);
    const day = Number.parseInt(m[3]!, 10);
    if (!year || year > maxBirthYear || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const prefixWindow = text.slice(Math.max(0, m.index - 10), m.index);
    const isLunar = /(?:农历|阴历|旧历)/.test(prefixWindow);
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      year,
      month,
      day,
      calendarType: isLunar ? 'lunar' : 'solar',
    });
  }

  // 格式 2b: 空格分隔 4 位年份日期「1996 3 8」「2000 05 20」
  const reSpaced = /(?<!\d)((?:19|20)\d{2})\s+(\d{1,2})\s+(\d{1,2})(?!\d)/g;
  while ((m = reSpaced.exec(text)) !== null) {
    if (hasOverlap(m.index, m.index + m[0].length)) continue;
    const year = Number.parseInt(m[1]!, 10);
    const month = Number.parseInt(m[2]!, 10);
    const day = Number.parseInt(m[3]!, 10);
    if (year > maxBirthYear || month < 1 || month > 12 || day < 1 || day > 31) continue;
    const prefixWindow = text.slice(Math.max(0, m.index - 10), m.index);
    const isLunar = /(?:农历|阴历|旧历)/.test(prefixWindow);
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      year,
      month,
      day,
      calendarType: isLunar ? 'lunar' : 'solar',
    });
  }

  // 格式 3: 8 位紧凑数字日期 20000520（排除 11 位手机号）
  const reCompact8 = /(?<!\d)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g;
  while ((m = reCompact8.exec(text)) !== null) {
    if (hasOverlap(m.index, m.index + m[0].length)) continue;
    const year = Number.parseInt(m[1]!, 10);
    const month = Number.parseInt(m[2]!, 10);
    const day = Number.parseInt(m[3]!, 10);
    if (year > maxBirthYear) continue;
    const prefixWindow = text.slice(Math.max(0, m.index - 10), m.index);
    const isLunar = /(?:农历|阴历|旧历)/.test(prefixWindow);
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      year,
      month,
      day,
      calendarType: isLunar ? 'lunar' : 'solar',
    });
  }

  // 格式 4: 6~7 位紧凑无分隔日期（如 199638 -> 1996-03-08；1996315 -> 1996-03-15；1996128 -> 1996-12-08）
  const reCompact67 = /(?<!\d)((?:19|20)\d{2})(\d{2,3})(?!\d)/g;
  while ((m = reCompact67.exec(text)) !== null) {
    if (hasOverlap(m.index, m.index + m[0].length)) continue;
    const year = Number.parseInt(m[1]!, 10);
    const rest = m[2]!;
    if (year > maxBirthYear) continue;
    let month: number | null = null;
    let day: number | null = null;
    if (rest.length === 2) {
      // 6 位：YYYYMD（如 199638 -> 1996-3-8）
      const m1 = Number.parseInt(rest[0]!, 10);
      const d1 = Number.parseInt(rest[1]!, 10);
      if (m1 >= 1 && m1 <= 9 && d1 >= 1 && d1 <= 9) {
        month = m1;
        day = d1;
      }
    } else if (rest.length === 3) {
      // 7 位：优先唯一合法拆法（M + DD 或 MM + D）
      const mA = Number.parseInt(rest.slice(0, 2), 10);
      const dA = Number.parseInt(rest.slice(2), 10);
      const validA = mA >= 10 && mA <= 12 && dA >= 1 && dA <= 9;
      const mB = Number.parseInt(rest.slice(0, 1), 10);
      const dB = Number.parseInt(rest.slice(1), 10);
      const validB = mB >= 1 && mB <= 9 && dB >= 10 && dB <= 31;
      if (validA && !validB) {
        month = mA;
        day = dA;
      } else if (validB && !validA) {
        month = mB;
        day = dB;
      } else if (validA && validB) {
        // 两者均合法（如 1996128：12月8日 vs 1月28日），优先 12月8日
        month = mA;
        day = dA;
      }
    }
    if (!month || !day) continue;
    const prefixWindow = text.slice(Math.max(0, m.index - 10), m.index);
    const isLunar = /(?:农历|阴历|旧历)/.test(prefixWindow);
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      year,
      month,
      day,
      calendarType: isLunar ? 'lunar' : 'solar',
    });
  }

  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function buildProfileFromWindow(
  hit: RawDateHit,
  beforeSlice: string,
  afterSlice: string,
  idx: number,
  total: number,
): ExtractedBirthProfile {
  const explicitName = detectExplicitName(beforeSlice) ?? detectExplicitName(afterSlice);
  const gender = detectGender(beforeSlice) ?? detectGender(afterSlice);
  const timeInfo = detectTime(afterSlice);
  const explicitPlace = detectExplicitPlace(afterSlice) ?? detectExplicitPlace(beforeSlice);
  const placeRes = explicitPlace
    ? resolvePlaceFromText(explicitPlace, afterSlice)
    : (() => {
        const fromAfter = resolvePlaceFromText(undefined, afterSlice);
        return fromAfter.birthPlace ? fromAfter : resolvePlaceFromText(undefined, beforeSlice);
      })();

  const calLabel = hit.calendarType === 'lunar' ? (hit.isLeapMonth ? '农历闰' : '农历') : '公历';
  const timeLabel =
    timeInfo.hour !== undefined
      ? `${String(timeInfo.hour).padStart(2, '0')}:${String(timeInfo.minute ?? 0).padStart(2, '0')}`
      : '时辰待定';
  const genderLabel = gender === 'male' ? '男' : gender === 'female' ? '女' : '性别待定';
  const name =
    explicitName ??
    (total > 1
      ? idx === 0
        ? gender === 'male'
          ? '男方'
          : gender === 'female'
            ? '女方'
            : '命主一'
        : gender === 'male'
          ? '男方'
          : gender === 'female'
            ? '女方'
            : '命主二'
      : undefined);

  const summary = [
    name,
    genderLabel,
    `${calLabel} ${hit.year}-${String(hit.month).padStart(2, '0')}-${String(hit.day).padStart(2, '0')}`,
    timeLabel,
    placeRes.birthPlace,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    ...(name ? { name } : {}),
    ...(gender ? { gender } : {}),
    calendarType: hit.calendarType,
    ...(hit.isLeapMonth ? { isLeapMonth: true } : {}),
    year: hit.year,
    month: hit.month,
    day: hit.day,
    ...(timeInfo.hour !== undefined
      ? {
          hour: timeInfo.hour,
          minute: timeInfo.minute ?? 0,
          ...(timeInfo.second ? { second: timeInfo.second } : {}),
        }
      : {}),
    timeIndex: timeInfo.timeIndex,
    ...(placeRes.birthPlace
      ? {
          birthPlace: placeRes.birthPlace,
          ...(placeRes.entry
            ? {
                latitude: placeRes.entry.latitude,
                longitude: placeRes.entry.longitude,
                timezone: placeRes.entry.timezone,
                timeZoneId: placeRes.entry.timeZoneId,
              }
            : {}),
        }
      : {}),
    summary,
  };
}

/**
 * 从自然语言文本中提取 1~2 人的出生信息、合盘关系、纯问题与专项结构化线索。
 */
export function extractBirthProfiles(text: string): ExtractedBirthResult {
  const clean = text.trim();
  const relationship = detectRelationship(clean);
  const structured = detectStructuredInputs(clean);
  if (!clean) {
    return { profiles: [], isTwoPerson: false, relationship, structured };
  }

  // 若包含显式「问题：...」行，拆分生辰信息区与纯问题区
  const questionMatch = /(?:^|\n)\s*(?:问题|想问|所问之事|咨询问题|求测事项)\s*[:：\s]\s*([\s\S]+)$/.exec(clean);
  const extractedQuestion = questionMatch?.[1]?.trim() || undefined;
  const profileSource = questionMatch ? clean.slice(0, questionMatch.index).trim() : clean;

  // 1. 尝试按角色分块切分（彻底防止双人多行模板信息串台）
  const roleSplitRe =
    /(?:^|\n)\s*(?=(?:男方|女方|命主[一二12]|甲方|乙方|本人|自己|对方|对象|伴侣|男友|女友|老公|老婆)\s*[:：\s])/;
  const roleBlocks = profileSource
    .split(roleSplitRe)
    .map((b) => b.trim())
    .filter(Boolean);

  if (roleBlocks.length >= 2) {
    const blockProfiles: ExtractedBirthProfile[] = [];
    for (const block of roleBlocks) {
      const blockHits = findDateHits(block);
      if (blockHits.length === 0) continue;
      const hit = blockHits[0]!;
      const beforeSlice = block.slice(0, hit.start);
      const afterSlice = block.slice(hit.end);
      blockProfiles.push(buildProfileFromWindow(hit, beforeSlice, afterSlice, blockProfiles.length, 2));
      if (blockProfiles.length >= 2) break;
    }
    if (blockProfiles.length >= 2) {
      return {
        profiles: blockProfiles,
        isTwoPerson: true,
        relationship,
        ...(extractedQuestion ? { question: extractedQuestion } : {}),
        structured,
      };
    }
  }

  // 2. 常规单/双人日期定位提取（用相邻日期边界隔离窗口，避免串台）
  const hits = findDateHits(profileSource).slice(0, 2);
  if (hits.length === 0) {
    const isTwoPerson = /(?:合盘|合婚|配对|两个人|双方|我和他|我和她|我和对象|我和伴侣|我和男友|我和女友)/.test(clean);
    return {
      profiles: [],
      isTwoPerson,
      relationship,
      ...(extractedQuestion ? { question: extractedQuestion } : {}),
      structured,
    };
  }

  const profiles: ExtractedBirthProfile[] = hits.map((hit, idx) => {
    const prevEnd = idx > 0 ? hits[idx - 1]!.end : 0;
    const nextStart = idx + 1 < hits.length ? hits[idx + 1]!.start : profileSource.length;

    // 两人同行时，取前一个日期之后的空白/标点分界，避免越界读取另一人的字段
    const beforeLimit =
      idx === 0
        ? Math.max(0, hit.start - 64)
        : Math.max(prevEnd, hit.start - 24);
    const afterLimit =
      idx + 1 < hits.length
        ? Math.min(nextStart, hit.end + 42)
        : Math.min(profileSource.length, hit.end + 80);

    const beforeSlice = profileSource.slice(beforeLimit, hit.start);
    const afterSlice = profileSource.slice(hit.end, afterLimit);
    return buildProfileFromWindow(hit, beforeSlice, afterSlice, idx, hits.length);
  });

  const isTwoPerson =
    profiles.length >= 2 ||
    /(?:合盘|合婚|双人配对)/.test(clean);

  return {
    profiles,
    isTwoPerson,
    relationship,
    ...(extractedQuestion ? { question: extractedQuestion } : {}),
    structured,
  };
}
