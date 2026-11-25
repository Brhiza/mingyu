/**
 * 四大扩展术数（奇门遁甲、六爻、西洋星盘、七政四余）
 * 100% 底层字段保真浓缩事实卡 + 本地铁律级硬核护栏
 */
import { calculate } from '../core';
import { getYearSixtyCycle } from '../systems/ganzhi-foundation';
import {
  STYLE_A_SECTIONS,
  STYLE_A_SYSTEM_PROMPT,
  inferStyleATopic,
  type StyleATopic,
} from './compact-card';
import type { GuardrailCheck, GuardrailReport } from './guardrail';

export type ExtraStyleASystem = 'qimen' | 'liuyao' | 'astrolabe' | 'qizheng';

export interface QimenGuardrailFacts {
  system: 'qimen';
  dunLabel: string;
  isYangDun: boolean;
  juShu: number;
  zhiFu: string;
  zhiShi: string;
  voidPalaces: string[];
  horsePalace: string;
  allowedGanZhi: string[];
}

export interface LiuyaoGuardrailFacts {
  system: 'liuyao';
  originalName: string;
  changedName: string | null;
  palaceName: string;
  changingYaos: number[];
  isStatic: boolean;
  worldLine: number;
  responseLine: number;
  allowedGanZhi: string[];
}

export interface AstrolabeGuardrailFacts {
  system: 'astrolabe';
  sunSign: string;
  moonSign: string;
  ascSign: string;
  planetSigns: Record<string, string>;
  retroPlanets: string[];
  targetYears: number[];
}

export interface QizhengGuardrailFacts {
  system: 'qizheng';
  sect: string; // '昼生' | '夜生'
  mingZhu: string;
  enStars: string[];
  nanStars: string[];
  starPalaces: Record<string, string>;
  targetYears: number[];
}

export type ExtraGuardrailFacts =
  | QimenGuardrailFacts
  | LiuyaoGuardrailFacts
  | AstrolabeGuardrailFacts
  | QizhengGuardrailFacts;

export interface ExtraCompactCardResult {
  system: ExtraStyleASystem;
  topic: StyleATopic;
  systemPrompt: string;
  userPrompt: string;
  facts: ExtraGuardrailFacts;
}

const BANNED_FLUFF_WORDS = [
  '亲爱的', '放宽心', '别太担心', '不用太担心', '一切都会好起来',
  '保持积极心态', '加油', '祝你', '希望你能', '愿你',
  '人生没有过不去的坎', '顺其自然就好', '放平心态', '开心最重要',
];

/** 通用五行生克硬表：检查显式“X克Y / X生Y / XY交战”常识错误 */
export function checkWuxingPhysics(text: string): string[] {
  const errors: string[] = [];
  const gen: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  // 1. 检查显式“X克Y”但实际 X 生 Y
  for (const m of text.matchAll(/([木火土金水])克([木火土金水])/g)) {
    const [, a, b] = m;
    if (a !== b && ke[a] !== b) {
      errors.push(`五行生克错：${a}不克${b}（${gen[a] === b ? `${a}生${b}` : `${a}与${b}非相克`}）`);
    }
  }
  // 2. 检查显式“X生Y”但实际 X 克 Y 或被生反了
  for (const m of text.matchAll(/([木火土金水])生([木火土金水])/g)) {
    const [, a, b] = m;
    if (a !== b && gen[a] !== b) {
      errors.push(`五行生克错：${a}不生${b}（${ke[a] === b ? `${a}克${b}` : `${a}与${b}非相生`}）`);
    }
  }
  // 3. 检查“XY交战”但实际相生（如金水交战、土火交战）
  for (const m of text.matchAll(/([木火土金水])([木火土金水])交战/g)) {
    const [, a, b] = m;
    if (gen[a] === b || gen[b] === a) {
      errors.push(`五行常识错：${a}${b}相生而非交战`);
    }
  }
  return [...new Set(errors)];
}

/** 通用十二地支三合局硬表检查 */
export function checkSanhePhysics(text: string): string[] {
  const errors: string[] = [];
  const sanhe: Record<string, string> = {
    申子辰: '水', 寅午戌: '火', 亥卯未: '木', 巳酉丑: '金',
  };
  for (const [grp, realEl] of Object.entries(sanhe)) {
    const m = text.match(new RegExp(`${grp}三?合([木火土金水])局?`));
    if (m && m[1] !== realEl) {
      errors.push(`三合局错：${grp}三合${realEl}局（误写为${m[1]}）`);
    }
  }
  return errors;
}

function extractSection(text: string, header: string): string {
  const idx = text.indexOf(header);
  if (idx < 0) return '';
  const start = idx + header.length;
  let end = text.length;
  for (const other of STYLE_A_SECTIONS) {
    if (other === header) continue;
    const oIdx = text.indexOf(other, start);
    if (oIdx >= 0 && oIdx < end) end = oIdx;
  }
  return text.slice(start, end).trim();
}

const WUXING_GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const QIMEN_PALACE_EL: Record<number, string> = {
  1: '水', 2: '土', 3: '木', 4: '木', 6: '金', 7: '金', 8: '土', 9: '火',
};
const QIMEN_DOOR_EL: Record<string, string> = {
  休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金',
};

function describeDoorPalaceRel(door: string, gong: number): string {
  const dEl = QIMEN_DOOR_EL[door];
  const pEl = QIMEN_PALACE_EL[gong];
  if (!dEl || !pEl) return '';
  if (dEl === pEl) return `[比和:${dEl}]`;
  if (WUXING_GEN[dEl] === pEl) return `[门生宫:${dEl}生${pEl}]`;
  if (WUXING_GEN[pEl] === dEl) return `[宫生门:${pEl}生${dEl}]`;
  if (WUXING_KE[dEl] === pEl) return `[门迫:${dEl}克${pEl}]`;
  if (WUXING_KE[pEl] === dEl) return `[宫克门:${pEl}克${dEl}]`;
  return '';
}

function describeLiuyaoChangeRel(origEl: string, chgEl: string): string {
  if (!origEl || !chgEl) return '';
  if (origEl === chgEl) return `[动化比和:${origEl}同${chgEl}]`;
  if (WUXING_GEN[chgEl] === origEl) return `[动化回头生:${chgEl}生${origEl}]`;
  if (WUXING_KE[chgEl] === origEl) return `[动化回头克:${chgEl}克${origEl}]`;
  if (WUXING_GEN[origEl] === chgEl) return `[动化泄气:${origEl}生${chgEl}]`;
  if (WUXING_KE[origEl] === chgEl) return `[动化耗气:${origEl}克${chgEl}]`;
  return '';
}

function describeWorldResponseRel(wEl: string, rEl: string): string {
  if (!wEl || !rEl) return '';
  if (wEl === rEl) return `世应比和(${wEl})`;
  if (WUXING_GEN[rEl] === wEl) return `应生世(${rEl}生${wEl})`;
  if (WUXING_KE[rEl] === wEl) return `应克世(${rEl}克${wEl})`;
  if (WUXING_GEN[wEl] === rEl) return `世生应(${wEl}生${rEl})`;
  if (WUXING_KE[wEl] === rEl) return `世克应(${wEl}克${rEl})`;
  return '';
}

export async function buildQimenCompactCard(params: {
  divinationTime: string;
  question: string;
}): Promise<ExtraCompactCardResult> {
  const res = await calculate('qimen', {
    divinationTime: params.divinationTime,
    question: params.question,
  });
  const d: any = res.data;
  const dunLabel = `${d.isYangDun ? '阳遁' : '阴遁'}${d.juShu}局`;
  const gz = d.ganzhi ?? {};
  const gzList = [gz.year, gz.month, gz.day, gz.hour].filter(Boolean);

  const voidGongSet = new Set<number>((d.voidPalaces ?? []).map((v: any) => Number(v.palace)));
  const horseGong = typeof d.horseStar?.palace === 'number' ? d.horseStar.palace : -1;

  const palaces = (d.jiuGongGe ?? [])
    .filter((p: any) => p.gong !== 5)
    .map((p: any) => {
      const god = p.shenPan?.god ?? '';
      const star = [p.tianPan?.star, p.tianPan?.companionStar].filter(Boolean).join('+');
      const door = p.renPan?.door ?? '';
      const tStem = [p.tianPan?.stem, p.tianPan?.companionStem].filter(Boolean).join('/');
      const dStem = p.diPan?.stem ?? '';
      const rel = describeDoorPalaceRel(door, Number(p.gong));
      const marks = `${voidGongSet.has(p.gong) ? '(空)' : ''}${horseGong === p.gong ? '(马)' : ''}`;
      return `${p.name}:${god}/${star}/${door}${rel}/${tStem}+${dStem}${marks}`;
    });

  const voidNames = [...new Set<string>((d.voidPalaces ?? []).map((v: any) => String(v.name ?? `${v.palace}宫`)))];
  const horseName = String(d.horseStar?.name ?? '无');
  const specialDesc = String(d.specialConditions?.description ?? '').trim() || '无特殊伏反';
  const yingQiDesc = String(d.yingQi?.description ?? '').trim();
  const combos = Array.isArray(d.patternCombos)
    ? d.patternCombos.slice(0, 4).map((c: any) => c.summary ?? c.name ?? '').filter(Boolean).join('；')
    : '';
  const patternLine = combos || (d.patternTags ?? []).slice(0, 5).join('、') || '常格';

  const userPrompt = [
    `【奇门遁甲核心事实】`,
    `局数：${dunLabel}；四柱：${gzList.join(' ')}；值符：${d.zhiFu ?? ''}；值使：${d.zhiShi ?? ''}`,
    `空亡宫：${voidNames.join('、') || '无'}；马星：${horseName}；特殊局势：${specialDesc}`,
    `格局制衡：${patternLine}`,
    `八宫落位：\n${palaces.join('\n')}`,
    yingQiDesc ? `应期线索：${yingQiDesc}` : '',
    `【用户问题】${params.question}`,
  ].filter(Boolean).join('\n');

  return {
    system: 'qimen',
    topic: inferStyleATopic(params.question),
    systemPrompt: STYLE_A_SYSTEM_PROMPT,
    userPrompt,
    facts: {
      system: 'qimen',
      dunLabel,
      isYangDun: Boolean(d.isYangDun),
      juShu: Number(d.juShu),
      zhiFu: String(d.zhiFu ?? ''),
      zhiShi: String(d.zhiShi ?? ''),
      voidPalaces: voidNames,
      horsePalace: horseName,
      allowedGanZhi: gzList,
    },
  };
}

export async function buildLiuyaoCompactCard(params: {
  divinationTime: string;
  question: string;
}): Promise<ExtraCompactCardResult> {
  const res = await calculate('liuyao', {
    divinationTime: params.divinationTime,
    question: params.question,
  });
  const d: any = res.data;
  const gz = d.ganzhi ?? {};
  const gzList = [gz.year, gz.month, gz.day, gz.hour].filter(Boolean);
  const palaceName = typeof d.palace === 'string' ? d.palace : String(d.palace?.name ?? '');
  const changing: number[] = (d.changingYaos ?? [])
    .map((c: any) => (typeof c === 'number' ? c : Number(c?.position)))
    .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 6);
  const isStatic = changing.length === 0;

  const details: any[] = d.yaosDetail ?? [];
  const wrArr: string[] = Array.isArray(d.worldAndResponse) ? d.worldAndResponse : [];
  const worldLine =
    details.find((y) => y.isWorld)?.position ??
    (wrArr.indexOf('世') >= 0 ? wrArr.indexOf('世') + 1 : 0);
  const responseLine =
    details.find((y) => y.isResponse)?.position ??
    (wrArr.indexOf('应') >= 0 ? wrArr.indexOf('应') + 1 : 0);

  const yaos = details.map((y: any, idx: number) => {
    const pos = Number(y.position ?? idx + 1);
    const tag = pos === worldLine ? '[世]' : pos === responseLine ? '[应]' : '';
    const chgRel = y.isChanging && y.changedYao
      ? describeLiuyaoChangeRel(String(y.wuxing ?? ''), String(y.changedYao.wuxing ?? ''))
      : '';
    const chg = y.isChanging && y.changedYao
      ? `→动变${y.changedYao.liuqin ?? ''}${y.changedYao.dizhi ?? ''}${y.changedYao.wuxing ?? ''}${chgRel}`
      : y.isChanging
        ? '→动'
        : '';
    const state = y.seasonState ? `(${y.seasonState})` : '';
    return `${pos}爻${tag}:${y.sixGod ?? ''}/${y.sixRelative ?? ''}/${y.najiaDizhi ?? ''}${y.wuxing ?? ''}${state}${y.isVoid ? '(空)' : ''}${y.isMonthBreak ? '(破)' : ''}${chg}`;
  });
  const worldYao = details.find((y: any, idx: number) => Number(y.position ?? idx + 1) === worldLine);
  const respYao = details.find((y: any, idx: number) => Number(y.position ?? idx + 1) === responseLine);
  const wrRel = describeWorldResponseRel(String(worldYao?.wuxing ?? ''), String(respYao?.wuxing ?? ''));
  const hidden = (d.hiddenSpirits ?? [])
    .slice(0, 3)
    .map((h: any) => `${h.sixRelative ?? ''}${h.najiaDizhi ?? ''}${h.wuxing ?? ''}伏${h.position ?? ''}爻`)
    .join('、');

  const userPrompt = [
    `【六爻纳甲核心事实】`,
    `卦名：本卦${d.originalName}（${palaceName}宫）${isStatic ? '（六爻静卦）' : `→变卦${d.changedName}（动爻第${changing.join('、')}爻）`}`,
    `时间干支：${gzList.join(' ')}；旬空：${(d.voidBranches ?? []).join('、') || '无'}；世爻第${worldLine}爻、应爻第${responseLine}爻${wrRel ? `（${wrRel}）` : ''}`,
    d.specialPattern ? `特殊卦象：${d.specialPattern}` : '',
    `六爻明细：\n${yaos.join('\n')}`,
    hidden ? `伏神：${hidden}` : '',
    `【用户问题】${params.question}`,
  ].filter(Boolean).join('\n');

  return {
    system: 'liuyao',
    topic: inferStyleATopic(params.question),
    systemPrompt: STYLE_A_SYSTEM_PROMPT,
    userPrompt,
    facts: {
      system: 'liuyao',
      originalName: String(d.originalName ?? ''),
      changedName: isStatic ? null : String(d.changedName ?? ''),
      palaceName,
      changingYaos: changing,
      isStatic,
      worldLine,
      responseLine,
      allowedGanZhi: gzList,
    },
  };
}

export async function buildAstrolabeCompactCard(params: {
  birth: { year: number; month: number; day: number; hour: number; minute: number; second: number; timezone: number; longitude: number; latitude: number };
  question: string;
}): Promise<ExtraCompactCardResult> {
  const res = await calculate('astrolabe', {
    birth: params.birth,
    question: params.question,
  });
  const d: any = res.data;
  const pts: any[] = d.points ?? [];
  const idToLabel = new Map<string, string>();
  const planetSigns: Record<string, string> = {};
  for (const p of pts) {
    const label = String(p.label ?? p.name ?? '');
    if (p.id) idToLabel.set(String(p.id), label);
    if (label && (p.signLabel ?? p.sign)) planetSigns[label] = String(p.signLabel ?? p.sign);
  }
  const getPt = (name: string) => pts.find((p) => (p.label ?? p.name) === name);
  const sun = getPt('太阳');
  const moon = getPt('月亮');
  const ascSign = String(d.houses?.[0]?.sign ?? '');
  const retro = pts.filter((p) => p.retrograde).map((p) => String(p.label ?? p.name));

  const ptLines = pts.slice(0, 10).map((p) => `${p.label ?? p.name}:${p.signLabel ?? p.sign}${p.house}宫${p.retrograde ? '(逆)' : ''}`);
  const aspects = (d.aspects ?? [])
    .filter((a: any) => Math.abs(a.deviation ?? 99) <= 5)
    .slice(0, 8)
    .map((a: any) => {
      const p1 = idToLabel.get(String(a.first)) ?? a.first;
      const p2 = idToLabel.get(String(a.second)) ?? a.second;
      return `${p1}${a.name ?? a.type}${p2}`;
    });
  const patterns = (d.patterns ?? []).slice(0, 3).map((p: any) => p.name ?? p.label ?? '').filter(Boolean);
  const profectionMatch = (res.prompt.text ?? '').match(/【小限与年运窗口[\s\S]*?(?=\n\n【|$)/);

  const userPrompt = [
    `【西洋星盘核心事实】`,
    `核心三轴：上升${ascSign}｜太阳${sun?.signLabel ?? sun?.sign ?? ''}${sun?.house ?? ''}宫｜月亮${moon?.signLabel ?? moon?.sign ?? ''}${moon?.house ?? ''}宫`,
    `十大星体：${ptLines.join('｜')}`,
    `逆行星体：${retro.join('、') || '无'}；相位格局：${patterns.join('、') || '无特格'}`,
    `核心相位：${aspects.join('、') || '无紧相位'}`,
    profectionMatch ? profectionMatch[0] : '',
    `【用户问题】${params.question}`,
  ].filter(Boolean).join('\n');

  return {
    system: 'astrolabe',
    topic: inferStyleATopic(params.question),
    systemPrompt: STYLE_A_SYSTEM_PROMPT,
    userPrompt,
    facts: {
      system: 'astrolabe',
      sunSign: String(sun?.signLabel ?? sun?.sign ?? ''),
      moonSign: String(moon?.signLabel ?? moon?.sign ?? ''),
      ascSign,
      planetSigns,
      retroPlanets: retro,
      targetYears: [2026, 2027, 2028],
    },
  };
}

export async function buildQizhengCompactCard(params: {
  birth: { year: number; month: number; day: number; hour: number; minute: number; second: number; timezone: number; longitude: number; latitude: number };
  gender: 'male' | 'female';
  question: string;
  flowYear?: number;
}): Promise<ExtraCompactCardResult> {
  const year = params.flowYear ?? 2026;
  const res = await calculate('qizheng', {
    birth: params.birth,
    gender: params.gender,
    flow: { kind: 'year', year },
    question: params.question,
  });
  const d: any = res.data;
  const en = d.enNan ?? {};
  const starPalaces: Record<string, string> = {};
  const stars = (d.stars ?? [])
    .slice(0, 11)
    .map((s: any) => {
      const name = String(s.name ?? s.label ?? '');
      const palace = String(s.palace ?? '');
      const palaceDisplay = palace.endsWith('宫') ? palace : `${palace}宫`;
      starPalaces[name] = palaceDisplay;
      return `${name}:${palaceDisplay}${s.xiu ? `(${s.xiu}宿)` : ''}${s.retrograde ? '逆' : ''}`;
    });
  const flowMatch = (res.prompt.text ?? '').match(/【行限与流年小限[\s\S]*?(?=\n\n【|$)/);

  const mEl = String(en.mingElement ?? '');
  const enEl = Object.keys(WUXING_GEN).find((k) => WUXING_GEN[k] === mEl) ?? '';
  const yongEl = WUXING_GEN[mEl] ?? '';
  const nanEl = Object.keys(WUXING_KE).find((k) => WUXING_KE[k] === mEl) ?? '';
  const chouEl = Object.keys(WUXING_KE).find((k) => WUXING_KE[k] === enEl) ?? '';
  const wxGuide = mEl && enEl && yongEl && nanEl && chouEl
    ? `五行生克速查：恩(${enEl})生命主(${mEl})｜命主(${mEl})生用(${yongEl})｜难(${nanEl})克命主(${mEl})｜仇(${chouEl})克恩(${enEl})`
    : '';

  const userPrompt = [
    `【七政四余核心事实】`,
    `昼夜与命主：${en.sect ?? ''}；命主${d.mingZhu ?? en.mingZhu ?? ''}（五行${mEl}）；命度${d.mingDu?.xiu ?? ''}${d.mingDu?.xiu ? '宿' : ''}`,
    `恩用仇难：恩星[${(en.enStars ?? []).join('、')}]｜用星[${(en.yongStars ?? []).join('、')}]｜仇星[${(en.chouStars ?? []).join('、')}]｜难星[${(en.nanStars ?? []).join('、')}]`,
    wxGuide,
    `星曜落宫：${stars.join('｜')}`,
    flowMatch ? flowMatch[0] : `参考流年：${year}${getYearSixtyCycle(year)}`,
    `【用户问题】${params.question}`,
  ].filter(Boolean).join('\n');

  return {
    system: 'qizheng',
    topic: inferStyleATopic(params.question),
    systemPrompt: STYLE_A_SYSTEM_PROMPT,
    userPrompt,
    facts: {
      system: 'qizheng',
      sect: String(en.sect ?? ''),
      mingZhu: String(d.mingZhu ?? en.mingZhu ?? ''),
      enStars: (en.enStars ?? []).map(String),
      nanStars: (en.nanStars ?? []).map(String),
      starPalaces,
      targetYears: [year, year + 1, year + 2],
    },
  };
}

const SIGN_RULERS: Record<string, string[]> = {
  白羊: ['火星'], 金牛: ['金星'], 双子: ['水星'], 巨蟹: ['月亮'],
  狮子: ['太阳'], 处女: ['水星'], 天秤: ['金星'], 天蝎: ['火星', '冥王星'],
  射手: ['木星'], 摩羯: ['土星'], 水瓶: ['土星', '天王星'], 双鱼: ['木星', '海王星'],
};
const SIGNS_ORDER = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const GUA_NUM: Record<string, string> = { 坎: '1', 坤: '2', 震: '3', 巽: '4', 乾: '6', 兑: '7', 艮: '8', 离: '9' };
const CN_NUM: Record<string, string> = { 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9' };

/** 4 大扩展术数本地铁律级硬核护栏（1 毫秒真值核验） */
export function verifyExtraStyleAOutput(
  output: string,
  facts: ExtraGuardrailFacts,
): GuardrailReport {
  const text = output.trim();
  const charCount = text.replace(/\s+/g, '').length;
  const checks: GuardrailCheck[] = [];

  // 1. 5 段格式完整
  const missing = STYLE_A_SECTIONS.filter((s) => !text.includes(s));
  const empty = STYLE_A_SECTIONS.filter((s) => text.includes(s) && extractSection(text, s).length < 8);
  checks.push({
    name: 'format_sections',
    passed: missing.length === 0 && empty.length === 0,
    detail: missing.length ? `缺少分段：${missing.join('、')}` : empty.length ? `分段过短：${empty.join('、')}` : '5段结构完整',
  });

  // 2. 字数范围
  const lenOk = charCount >= 130 && charCount <= 440;
  checks.push({
    name: 'length_bounds',
    passed: lenOk,
    detail: lenOk ? `字数合规（${charCount}字）` : `字数越界（${charCount}字）`,
  });

  // 3. 零鸡汤
  const hitFluff = BANNED_FLUFF_WORDS.filter((w) => text.includes(w));
  checks.push({
    name: 'no_fluff',
    passed: hitFluff.length === 0,
    detail: hitFluff.length ? `命中禁用词：${hitFluff.join('、')}` : '无通俗鸡汤',
  });

  // 4. 年份 60 甲子真值验算
  const yearErrors: string[] = [];
  for (const m of text.matchAll(/(19\d{2}|20\d{2})年?([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g)) {
    const yr = Number(m[1]);
    const realGz = getYearSixtyCycle(yr);
    if (realGz !== m[2]) yearErrors.push(`${yr}年干支应为${realGz}（误写${m[2]}）`);
  }
  checks.push({
    name: 'jiazi_math',
    passed: yearErrors.length === 0,
    detail: yearErrors.length ? yearErrors.join('；') : '流年甲子准确',
  });

  // 5. 通用五行生克与三合局铁律（适用奇门/六爻/七政）
  const physicsErrors = facts.system === 'astrolabe'
    ? []
    : [...checkWuxingPhysics(text), ...checkSanhePhysics(text)];
  checks.push({
    name: 'wuxing_physics',
    passed: physicsErrors.length === 0,
    detail: physicsErrors.length ? physicsErrors.join('；') : '五行生克与三合铁律无误',
  });

  // 6. 各术数专属基础题铁律核验
  const domainErrors: string[] = [];
  if (facts.system === 'qimen') {
    const wrongDun = facts.isYangDun ? /阴遁\d?局/ : /阳遁\d?局/;
    if (wrongDun.test(text)) domainErrors.push(`阴阳遁写反（实际为${facts.dunLabel}）`);
    const juMatch = text.match(/[阴阳]遁(\d)局/);
    if (juMatch && Number(juMatch[1]) !== facts.juShu) {
      domainErrors.push(`局数写错（写了${juMatch[0]}，实际为${facts.dunLabel}）`);
    }
    if (facts.zhiFu && text.includes('值符') && !text.includes(facts.zhiFu)) {
      domainErrors.push(`值符与排盘不符（实际值符为${facts.zhiFu}）`);
    }
    // 洛书宫数 ↔ 八卦一一对应铁律（拦截“艮二”“艮八(4宫)”等）
    for (const m of text.matchAll(/([坎坤震巽乾兑艮离])([1-9一二三四五六七八九])/g)) {
      const gua = m[1];
      const num = CN_NUM[m[2]] ?? m[2];
      if (GUA_NUM[gua] && GUA_NUM[gua] !== num) {
        domainErrors.push(`洛书宫数错配：${gua}应为${GUA_NUM[gua]}宫（误写为${m[0]}）`);
      }
    }
    for (const m of text.matchAll(/([坎坤震巽乾兑艮离])[一二三四五六七八九1-9]?[（(]([1-9])宫[）)]/g)) {
      if (GUA_NUM[m[1]] && GUA_NUM[m[1]] !== m[2]) {
        domainErrors.push(`洛书宫数错配：${m[1]}不是${m[2]}宫`);
      }
    }
    // 门迫五行铁律（死门/生门属土不迫坤2/艮8；休门水不迫坎1；伤杜木不迫震3/巽4；景火不迫离9；开惊金不迫乾6/兑7）
    if (/(坤[2二]|艮[8八])[^，。；\n]{0,4}(死门|生门)迫|(死门|生门)[^，。；\n]{0,4}(坤[2二]|艮[8八])[^，。；\n]{0,4}门迫/.test(text)) {
      domainErrors.push('门迫铁律错：死门/生门属土，落坤2/艮8土宫为比和而非门迫');
    }
  } else if (facts.system === 'liuyao') {
    if (facts.originalName && !text.includes(facts.originalName.slice(0, 2))) {
      domainErrors.push(`未准确锚定本卦（${facts.originalName}）`);
    }
    if (facts.isStatic && /动爻化|变卦为|初爻动|二爻动|三爻动|四爻动|五爻动|上爻动/.test(text)) {
      domainErrors.push('本卦为六爻静卦，不得虚构动爻或变卦');
    }
    // 世应隔二铁律（|世 - 应| === 3 且匹配真实世应）
    const syMatch = text.match(/世[爻第]?([1-6一二三四五六])[^，。；\n]{0,4}应[爻第]?([1-6一二三四五六])/);
    if (syMatch) {
      const s = Number(CN_NUM[syMatch[1]] ?? syMatch[1]);
      const y = Number(CN_NUM[syMatch[2]] ?? syMatch[2]);
      if (Math.abs(s - y) !== 3) {
        domainErrors.push(`世应铁律错：世${s}应${y}违背隔二差3铁律（实际世${facts.worldLine}应${facts.responseLine}）`);
      } else if (facts.worldLine > 0 && s !== facts.worldLine) {
        domainErrors.push(`世爻位置错：写了世${s}（实际为世${facts.worldLine}应${facts.responseLine}）`);
      }
    }
  } else if (facts.system === 'astrolabe') {
    // 跨术数串台黑名单
    const crossTerms = ['出空', '旬空', '伏吟', '反吟', '回头克', '门迫'].filter((w) => text.includes(w));
    if (crossTerms.length) domainErrors.push(`西洋星盘出现中式占卜串台词：${crossTerms.join('、')}`);

    // 上升命主星校验
    const rulers = SIGN_RULERS[facts.ascSign];
    const rulerMatch = text.match(/命主[星为是]?([日月水金火木土天海冥](?:星|王星)?)/);
    if (rulers && rulerMatch) {
      const shortMap: Record<string, string> = {
        日: '太阳', 月: '月亮', 水: '水星', 金: '金星', 火: '火星', 木: '木星', 土: '土星', 天: '天王星', 海: '海王星', 冥: '冥王星',
      };
      const claimed = shortMap[rulerMatch[1][0]] ?? rulerMatch[1];
      if (!rulers.includes(claimed)) {
        domainErrors.push(`上升${facts.ascSign}命主应为${rulers.join('/')}（误写为${claimed}）`);
      }
    }
    // 太阳/月亮/上升星座 + 逐星落座校验
    const checkSign = (planet: string, actual: string) => {
      if (!actual) return;
      const re = new RegExp(`${planet}落?(白羊|金牛|双子|巨蟹|狮子|处女|天秤|天蝎|射手|摩羯|水瓶|双鱼)`);
      const m = text.match(re);
      if (m && m[1] !== actual) domainErrors.push(`${planet}星座写错（写了${m[1]}，实际为${actual}）`);
    };
    checkSign('太阳', facts.sunSign);
    checkSign('月亮', facts.moonSign);
    checkSign('上升', facts.ascSign);
    for (const [pname, realSign] of Object.entries(facts.planetSigns ?? {})) {
      if (['太阳', '月亮'].includes(pname)) continue;
      checkSign(pname, realSign);
    }
    // 太阳狮子落陷常识错
    if (/日[^，。；\n]{0,4}狮子落陷|太阳狮子落陷/.test(text)) {
      domainErrors.push('星体庙旺常识错：太阳在狮子座为入庙而非落陷');
    }
    // 同星座或拱相星座写冲相几何错（如白羊冲白羊、白羊冲狮子）
    const chongSun = text.match(/入(白羊|金牛|双子|巨蟹|狮子|处女|天秤|天蝎|射手|摩羯|水瓶|双鱼)[^，。；\n]{0,6}冲日/);
    if (chongSun && facts.sunSign) {
      const dIdx = (SIGNS_ORDER.indexOf(chongSun[1]) - SIGNS_ORDER.indexOf(facts.sunSign) + 12) % 12;
      if (dIdx !== 6) {
        domainErrors.push(`相位几何错：${chongSun[1]}与太阳${facts.sunSign}并非180°对冲（相距${dIdx * 30}°）`);
      }
    }
  } else if (facts.system === 'qizheng') {
    // 日月永不逆行铁律
    if (/(太阳|太阴|日|月)(?:得时|失时)?[而且]?逆(?:行|居|守)/.test(text)) {
      domainErrors.push('天文铁律错：太阳与月亮永不逆行');
    }
    // 昼夜得时铁律
    if (facts.sect === '夜生' && /日恩?夜旺|太阳夜旺|日得时/.test(text)) {
      domainErrors.push('昼夜得时错：夜生太阳失时而非得时/夜旺');
    }
    for (const enStar of facts.enStars) {
      if (new RegExp(`${enStar}为难星|难星[为是：:（(]?${enStar}`).test(text)) {
        domainErrors.push(`恩难反转：${enStar}实际为恩星而非难星`);
      }
    }
    for (const nanStar of facts.nanStars) {
      if (new RegExp(`${nanStar}为恩星|恩星[为是：:（(]?${nanStar}`).test(text)) {
        domainErrors.push(`恩难反转：${nanStar}实际为难星而非恩星`);
      }
    }
  }
  checks.push({
    name: 'domain_ground_truth',
    passed: domainErrors.length === 0,
    detail: domainErrors.length ? [...new Set(domainErrors)].join('；') : `${facts.system}基础盘面与铁律100%准确`,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const failures = checks.filter((c) => !c.passed).map((c) => `[${c.name}] ${c.detail}`);
  const correctionPrompt = failures.length
    ? `上一版输出未通过本地排盘铁律校验，请严格按真实盘面修正以下错误后重新输出完整 5 段风格 A 断语：\n${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : '';

  return {
    passed: failures.length === 0,
    score: Math.round((passedCount / checks.length) * 100),
    charCount,
    checks,
    failures,
    correctionPrompt,
  };
}
