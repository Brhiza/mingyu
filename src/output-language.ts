import type { Method } from './method-meta';
import {
  BAZI_METHODS,
  CARD_SIGN_METHODS,
  FENGSHUI_METHODS,
  MULTI_NATAL_METHODS,
  QIZHENG_METHODS,
  TRADITIONAL_DIVINATION_METHODS,
  WESTERN_ASTRO_METHODS,
  ZIWEI_METHODS,
} from './method-registry';

export const OUTPUT_LANGUAGE_HEADER = '【Output Language / 输出语言】';

const DEFAULT_SIMPLIFIED_ALIASES = new Set([
  'zh',
  'zh-cn',
  'zh_cn',
  'zh-hans',
  'zh_hans',
  'zh-sg',
  'zh_sg',
  'cn',
  'chs',
  'chinese',
  'simplified chinese',
  '简体中文',
  '简体',
  '中文',
]);

const TRADITIONAL_CHINESE_ALIASES: Record<string, string> = {
  'zh-tw': 'zh-TW',
  'zh_tw': 'zh-TW',
  'zh-hk': 'zh-HK',
  'zh_hk': 'zh-HK',
  'zh-mo': 'zh-MO',
  'zh_mo': 'zh-MO',
  'zh-hant': 'zh-Hant',
  'zh_hant': 'zh-Hant',
  cht: 'zh-TW',
  tw: 'zh-TW',
  hk: 'zh-HK',
  'traditional chinese': 'zh-TW',
  繁體中文: 'zh-TW',
  繁体中文: 'zh-TW',
  繁體: 'zh-TW',
  繁体: 'zh-TW',
};

type LanguageBucket = 'zh-hant' | 'en' | 'ja' | 'ko' | 'vi' | 'other';

/**
 * 归一化输出语言标签；默认简体中文返回 undefined（保证默认输出与原有提示词零差异）。
 */
export function normalizeOutputLanguage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (DEFAULT_SIMPLIFIED_ALIASES.has(lower)) return undefined;
  if (lower in TRADITIONAL_CHINESE_ALIASES) return TRADITIONAL_CHINESE_ALIASES[lower];
  if (lower === 'en' || lower === 'eng' || lower === 'english' || /^en[-_]/.test(lower)) {
    return /^en[-_]/.test(lower) ? `en-${trimmed.slice(3).toUpperCase()}` : 'en';
  }
  if (lower === 'ja' || lower === 'jp' || lower === 'jpn' || lower === 'japanese' || lower === '日本語' || lower === '日语' || lower === '日文' || /^ja[-_]/.test(lower)) {
    return 'ja';
  }
  if (lower === 'ko' || lower === 'kr' || lower === 'kor' || lower === 'korean' || lower === '한국어' || lower === '韩语' || lower === '韩文' || /^ko[-_]/.test(lower)) {
    return 'ko';
  }
  if (lower === 'vi' || lower === 'vn' || lower === 'vie' || lower === 'vietnamese' || lower === 'tiếng việt' || lower === 'tieng viet' || lower === '越南语' || lower === '越语' || /^vi[-_]/.test(lower)) {
    return 'vi';
  }
  return trimmed;
}

function classifyLanguageBucket(normalized: string): LanguageBucket {
  const lower = normalized.toLowerCase();
  if (lower === 'zh-tw' || lower === 'zh-hk' || lower === 'zh-mo' || lower === 'zh-hant') return 'zh-hant';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  if (lower === 'ja') return 'ja';
  if (lower === 'ko') return 'ko';
  if (lower === 'vi') return 'vi';
  return 'other';
}

function getMethodFamilyFlags(method: Method) {
  const isBazi = BAZI_METHODS.has(method) || MULTI_NATAL_METHODS.has(method) || method === 'bazi-reverse' || method === 'instant';
  const isZiwei = ZIWEI_METHODS.has(method) || MULTI_NATAL_METHODS.has(method) || method === 'instant';
  const isWesternAstro = WESTERN_ASTRO_METHODS.has(method) || MULTI_NATAL_METHODS.has(method) || method === 'instant';
  const isQizheng = QIZHENG_METHODS.has(method);
  const isTraditionalDivination = TRADITIONAL_DIVINATION_METHODS.has(method) || method === 'qimen-lifetime' || method === 'random-divination' || method === 'zhouyi';
  const isCardOrNumber = CARD_SIGN_METHODS.has(method) || method === 'number-energy' || method === 'random-divination';
  const isFengshuiOrAlmanac = FENGSHUI_METHODS.has(method) || method === 'almanac' || method === 'calendar';
  return { isBazi, isZiwei, isWesternAstro, isQizheng, isTraditionalDivination, isCardOrNumber, isFengshuiOrAlmanac };
}

function buildEnglishTerms(method: Method): string[] {
  const f = getMethodFamilyFlags(method);
  const lines: string[] = [];
  if (f.isBazi) {
    lines.push('- BaZi (Four Pillars): Day Master (日主), Heavenly Stems & Earthly Branches as Element+Hanzi (e.g., Jia Wood 甲木), Ten Gods (Direct/Indirect Officer or Seven Killings, Direct/Indirect Wealth, Eating God, Hurting Officer, Direct/Indirect Resource, Friend, Rob Wealth), 10-Year Luck Pillars (大运), Annual Pillar (流年), Useful God (用神).');
  }
  if (f.isZiwei || f.isQizheng) {
    lines.push('- Zi Wei Dou Shu / Qi Zheng: English palace names (Life, Siblings, Spouse, Children, Wealth, Health, Travel, Friends, Career, Property, Fortune/Mental, Parents), Four Transformations (Hua Lu 化禄, Hua Quan 化权, Hua Ke 化科, Hua Ji 化忌), and star names in "Pinyin (汉字)" format (e.g., Zi Wei (紫微), Po Jun (破军)).');
  }
  if (f.isWesternAstro) {
    lines.push('- Western Astrology: Standard English terms (Ascendant, Midheaven/MC, Houses 1–12, Transit, Solar Return, Secondary Progression, Solar Arc, Aspect).');
  }
  if (f.isTraditionalDivination) {
    lines.push('- I Ching / San Shi Divination: Use "Hexagram # · Pinyin (汉字) · Title" for hexagrams, Eight Gates (Open/Rest/Life/Harm/Delusion/Scenery/Death/Fear Gate) for Qi Men Dun Jia, and keep untranslatable proper nouns in "Pinyin (汉字)" on first mention with plain English gloss.');
  }
  if (f.isFengshuiOrAlmanac) {
    lines.push('- Feng Shui & Almanac: Eight Mansions (Ba Zhai), Xuan Kong Flying Stars (Period, Facing/Sitting Stars), 24 Mountains (e.g., Zi 子 North), Auspicious/Inauspicious activities.');
  }
  if (f.isCardOrNumber) {
    lines.push('- Cards / Oracle / Numerology: Standard English Tarot/Lenormand card names (Upright/Reversed); for Chinese oracle verses or Eight Stars numerology, quote key terms with natural English explanation.');
  }
  if (!lines.length) {
    lines.push('- Terminology: Translate conceptual terms into natural English and present Chinese proper nouns or characters as "Pinyin (汉字)" with concise explanation.');
  }
  return lines;
}

function buildJapaneseTerms(method: Method): string[] {
  const f = getMethodFamilyFlags(method);
  const lines: string[] = [];
  if (f.isBazi) lines.push('- 四柱推命：日干（日主）・通変星（正官/偏官/正財/偏財/食神/傷官/印綬/偏印/比肩/劫財）・大運・歳運・用神・十二運星など日本の四柱推命の標準用語を使用。');
  if (f.isZiwei || f.isQizheng) lines.push('- 紫微斗数・七政四余：命宮・財帛宮・官禄宮・夫妻宮・四化星（化禄/化権/化科/化忌）など日本の紫微斗数の標準表記を使用。');
  if (f.isWesternAstro) lines.push('- 西洋占星術：アセンダント（ASC）・MC・ハウス・トランジット・ソーラーリターン・アスペクト等の標準用語を使用。');
  if (f.isTraditionalDivination) lines.push('- 易経・奇門遁甲・六壬・太乙：日本語の標準術数用語（八卦・六十四卦・八門・九星・三伝四課など）で分かりやすく解説。');
  if (f.isFengshuiOrAlmanac) lines.push('- 風水・択日：八宅風水・玄空飛星・二十四山・吉凶日など日本語の慣用表現を使用。');
  if (f.isCardOrNumber) lines.push('- タロット・ルノルマン・霊籤：正位置・逆位置や日本語の自然なカード解説表現を使用（中国の籤詩は原文を活かしつつ自然な日本語訳を添える）。');
  if (!lines.length) lines.push('- 用語：日本の読者に自然な表現を用い、固有の漢語概念には簡潔な補足説明を付ける。');
  return lines;
}

function buildKoreanTerms(method: Method): string[] {
  const f = getMethodFamilyFlags(method);
  const lines: string[] = [];
  if (f.isBazi) lines.push('- 사주팔자(四柱八字): 일간(日主)·월령·십성(정관/편관/정재/편재/식신/상관/정인/편인/비견/겁재)·대운·세운·용신·신살 등 한국 명리학 표준 용어 사용.');
  if (f.isZiwei || f.isQizheng) lines.push('- 자미두수(紫微斗數)·칠정사여: 명궁·재백궁·관록궁·부처궁·사화(화록/화권/화과/화기) 등 한국 표준 명칭 사용.');
  if (f.isWesternAstro) lines.push('- 서양 점성술: 어센던트(ASC)·미드헤븐(MC)·하우스·트랜짓·솔라 리턴·애스펙트 등 한국 점성술 표준 용어 사용.');
  if (f.isTraditionalDivination) lines.push('- 주역·육효·기문둔갑·대육임: 64괘·동효·세응·팔문·구성·삼전사과 등 한국 전통 역학 표준 용어 사용.');
  if (f.isFengshuiOrAlmanac) lines.push('- 풍수·택일: 팔택풍수·현공비성·24산·황력 길흉일 등 한국어 표준 표현 사용.');
  if (f.isCardOrNumber) lines.push('- 타로·레노먼드·영첨: 정방향/역방향 및 자연스러운 한국어 리딩 표현 사용(한문 점괘는 원문을 간단히 인용하고 한국어로 풀어 설명).');
  if (!lines.length) lines.push('- 용어: 한국 독자에게 자연스러운 표준 용어를 사용하고, 난해한 한자 고유어는 괄호로 원어나 쉬운 풀이를 병기.');
  return lines;
}

function buildVietnameseTerms(method: Method): string[] {
  const f = getMethodFamilyFlags(method);
  const lines: string[] = [];
  if (f.isZiwei || f.isQizheng) lines.push('- Tử Vi Đẩu Số: Dùng chuẩn thuật ngữ Việt Nam (Cung Mệnh, Tài Bạch, Quan Lộc, Phu Thê, Thiên Di, Phúc Đức; Tứ Hóa: Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ; tên sao chuẩn Việt kèm chữ Hán nếu cần).');
  if (f.isBazi) lines.push('- Bát Tự (Tứ Trụ): Nhật Chủ (日主), Thập Thần (Chính Quan, Thất Sát, Chính Tài, Thiên Tài, Thực Thần, Thương Quan, Chính Ấn, Thiên Ấn, Tỷ Kiên, Kiếp Tài), Đại Vận, Lưu Niên, Dụng Thần.');
  if (f.isTraditionalDivination) lines.push('- Kỳ Môn Độn Giáp / Kinh Dịch / Lục Hào / Đại Lục Nhâm: Dùng thuật ngữ Hán-Việt chuẩn (Bát Môn: Khai/Hưu/Sinh/Thương/Đỗ/Cảnh/Tử/Kinh; tên quẻ Dịch kèm giải thích dễ hiểu).');
  if (f.isFengshuiOrAlmanac) lines.push('- Phong Thủy & Xem Ngày: Bát Trạch, Huyền Không Phi Tinh, 24 Sơn Hướng, ngày Hoàng Đạo / Hắc Đạo theo thói quen tiếng Việt.');
  if (f.isWesternAstro) lines.push('- Chiêm Tinh Phương Tây: Cung Mọc (Ascendant), Thiên Đỉnh (MC), Nhà 1–12, Transit, Solar Return bằng tiếng Việt tự nhiên.');
  if (f.isCardOrNumber) lines.push('- Tarot / Lenormand / Quẻ xăm: Dùng tên lá bài và diễn giải xuôi/ngược tự nhiên; với thơ xăm chữ Hán hãy dịch nghĩa mượt mà.');
  if (!lines.length) lines.push('- Thuật ngữ: Diễn đạt tự nhiên theo chuẩn Hán-Việt phổ thông, chú thích ngắn gọn các khái niệm chuyên sâu.');
  return lines;
}

/**
 * 按目标语言与术数体系生成极简、无跨体系串味的主流术语与输出语言指令块。
 */
export function buildOutputLanguageDirective(outputLanguage: string | undefined, method: Method): string {
  const normalized = normalizeOutputLanguage(outputLanguage);
  if (!normalized) return '';
  const bucket = classifyLanguageBucket(normalized);

  if (bucket === 'zh-hant') {
    return [
      OUTPUT_LANGUAGE_HEADER,
      `- Write the entire response in natural Traditional Chinese (${normalized} / 繁體中文), matching Taiwan/Hong Kong metaphysics conventions (如：紫微斗數、四柱八字、命宮、財帛宮、官祿宮、化祿化權化科化忌、正官七殺、陽宅風水).`,
      '- Do NOT recalculate, modify, or fabricate any chart facts above. Classical Chinese quotes may remain verbatim alongside clear Traditional Chinese explanation.',
    ].join('\n');
  }

  if (bucket === 'en') {
    return [
      OUTPUT_LANGUAGE_HEADER,
      `- Write the entire response in clear, natural English (${normalized}).`,
      ...buildEnglishTerms(method),
      '- Do NOT recalculate, alter, or invent chart data above. When referencing classical Chinese quotes or verse titles, provide an accurate English explanation.',
    ].join('\n');
  }

  if (bucket === 'ja') {
    return [
      OUTPUT_LANGUAGE_HEADER,
      '- 回答全体は自然な日本語（ja）で出力してください。',
      ...buildJapaneseTerms(method),
      '- 上記の算出済み盤面・数値・事実データを再計算したり改変したりしないでください。漢文原典を引用する場合は自然な日本語訳を添えてください。',
    ].join('\n');
  }

  if (bucket === 'ko') {
    return [
      OUTPUT_LANGUAGE_HEADER,
      '- 전체 답변을 자연스러운 한국어(ko)로 작성하세요.',
      ...buildKoreanTerms(method),
      '- 위에 엔진이 산출한 명반/괘상/수치 데이터를 절대 재계산하거나 임의로 바꾸지 마세요. 한문 원문 인용 시 쉬운 한국어 풀이를 함께 제시하세요.',
    ].join('\n');
  }

  if (bucket === 'vi') {
    return [
      OUTPUT_LANGUAGE_HEADER,
      '- Hãy viết toàn bộ câu trả lời bằng tiếng Việt (vi) tự nhiên, dễ hiểu.',
      ...buildVietnameseTerms(method),
      '- Tuyệt đối KHÔNG tự tính lại hay sửa đổi các dữ liệu lá số/quẻ đã được hệ thống tính chính xác ở trên. Nếu trích dẫn cổ văn chữ Hán, hãy kèm bản dịch tiếng Việt dễ hiểu.',
    ].join('\n');
  }

  return [
    OUTPUT_LANGUAGE_HEADER,
    `- Write the entire response strictly in "${normalized}".`,
    '- Translate conceptual divination/astrology terms naturally into that language. For untranslatable Chinese proper nouns, render them as "Romanization/Pinyin (汉字)" on first mention with a concise plain-language gloss.',
    '- Do NOT recalculate, alter, or invent any chart facts above; translate any quoted classical lines faithfully.',
  ].join('\n');
}

export function applyOutputLanguageToPrompt<T extends { text?: string }>(
  prompt: T,
  outputLanguage: string | undefined,
  method: Method,
): T {
  if (!prompt || typeof prompt.text !== 'string' || !prompt.text.trim()) return prompt;
  if (prompt.text.includes(OUTPUT_LANGUAGE_HEADER)) return prompt;
  const directive = buildOutputLanguageDirective(outputLanguage, method);
  if (!directive) return prompt;
  return { ...prompt, text: `${prompt.text.trimEnd()}\n\n${directive}` };
}
