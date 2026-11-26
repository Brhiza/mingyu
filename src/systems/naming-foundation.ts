import { KE_MAP, SHENG_MAP } from './ganzhi-foundation';
import type { z } from 'zod';
import type { chineseNameInput } from '../schema';
import type { CharacterDetail } from './characters';
import type { CharacterShardLoader } from '../character-data';
import { characterDetails, characterMetadata } from './characters';
import numerology from './number-numerology.json';
import shuli81 from '../data/characters/shuli-81.json';
import sancaiData from '../data/characters/sancai.json';
import surnameReadings from '../data/characters/surname-readings.json';

type Birth = z.infer<typeof chineseNameInput>['birth'];
type BirthRange = z.infer<typeof chineseNameInput>['birthRange'];
const elements = ['水', '木', '木', '火', '火', '土', '土', '金', '金', '水'];
const generates: Record<string, string> = SHENG_MAP;
const controls: Record<string, string> = KE_MAP;
const numeral = [...numerology, shuli81];
const sancai = sancaiData as Record<string, { combo: string; tian_ren: string; ren_di: string; level: string; text: string }>;
const surnames = surnameReadings as Record<string, string>;
const compoundReadings: Record<string, string[]> = {
  欧阳: ['ōu', 'yáng'], 太史: ['tài', 'shǐ'], 端木: ['duān', 'mù'], 上官: ['shàng', 'guān'],
  司马: ['sī', 'mǎ'], 东方: ['dōng', 'fāng'], 独孤: ['dú', 'gū'], 南宫: ['nán', 'gōng'],
  万俟: ['mò', 'qí'], 闻人: ['wén', 'rén'], 夏侯: ['xià', 'hóu'], 诸葛: ['zhū', 'gě'],
  尉迟: ['yù', 'chí'], 公羊: ['gōng', 'yáng'], 赫连: ['hè', 'lián'], 澹台: ['tán', 'tái'],
  皇甫: ['huáng', 'fǔ'], 宗政: ['zōng', 'zhèng'], 濮阳: ['pú', 'yáng'], 公冶: ['gōng', 'yě'],
  太叔: ['tài', 'shū'], 申屠: ['shēn', 'tú'], 公孙: ['gōng', 'sūn'], 慕容: ['mù', 'róng'],
  仲孙: ['zhòng', 'sūn'], 钟离: ['zhōng', 'lí'], 长孙: ['zhǎng', 'sūn'], 宇文: ['yǔ', 'wén'],
  司徒: ['sī', 'tú'], 鲜于: ['xiān', 'yú'], 司空: ['sī', 'kōng'], 闾丘: ['lǘ', 'qiū'],
  子车: ['zǐ', 'jū'], 亓官: ['qí', 'guān'], 司寇: ['sī', 'kòu'], 巫马: ['wū', 'mǎ'],
  公西: ['gōng', 'xī'], 颛孙: ['zhuān', 'sūn'], 壤驷: ['rǎng', 'sì'], 公良: ['gōng', 'liáng'],
  漆雕: ['qī', 'diāo'], 乐正: ['yuè', 'zhèng'], 宰父: ['zǎi', 'fǔ'], 谷梁: ['gǔ', 'liáng'],
  拓跋: ['tuò', 'bá'], 夹谷: ['jiā', 'gǔ'], 轩辕: ['xuān', 'yuán'], 令狐: ['lìng', 'hú'],
  段干: ['duàn', 'gān'], 百里: ['bǎi', 'lǐ'], 呼延: ['hū', 'yán'], 东郭: ['dōng', 'guō'],
  南门: ['nán', 'mén'], 羊舌: ['yáng', 'shé'], 微生: ['wēi', 'shēng'], 公户: ['gōng', 'hù'],
  公玉: ['gōng', 'yù'], 公仪: ['gōng', 'yí'], 梁丘: ['liáng', 'qiū'], 公仲: ['gōng', 'zhòng'],
  公上: ['gōng', 'shàng'], 公门: ['gōng', 'mén'], 公山: ['gōng', 'shān'], 公坚: ['gōng', 'jiān'],
  左丘: ['zuǒ', 'qiū'], 公伯: ['gōng', 'bó'], 西门: ['xī', 'mén'], 公祖: ['gōng', 'zǔ'],
  第五: ['dì', 'wǔ'], 公乘: ['gōng', 'shèng'], 贯丘: ['guàn', 'qiū'], 公皙: ['gōng', 'xī'],
  南荣: ['nán', 'róng'], 东里: ['dōng', 'lǐ'], 东宫: ['dōng', 'gōng'], 仲长: ['zhòng', 'cháng'],
  子书: ['zǐ', 'shū'], 子桑: ['zǐ', 'sāng'], 即墨: ['jí', 'mò'], 达奚: ['dá', 'xī'],
  褚师: ['zhǔ', 'shī'], 单于: ['chán', 'yú'],
};
export const COMPOUND_SURNAMES = Object.keys(compoundReadings) as readonly string[];
const compoundSurnameSet = new Set<string>(COMPOUND_SURNAMES);

/** Split a Chinese full name into surname and given name, auto-detecting compound surnames when length is omitted. */
export function splitSurname(fullName: string, explicitLength?: 1 | 2) {
  const chars = [...fullName.trim()];
  let surnameLength: 1 | 2 = explicitLength ?? 1;
  if (explicitLength === undefined && chars.length >= 3) {
    const prefix = chars.slice(0, 2).map((char) => characterMetadata(char)?.simplified ?? char).join('');
    if (compoundSurnameSet.has(prefix)) surnameLength = 2;
  }
  return {
    chars,
    surnameLength,
    surname: chars.slice(0, surnameLength).join(''),
    given: chars.slice(surnameLength).join(''),
  };
}

const levelScores: Record<string, number> = { 大吉: 5, 吉: 4, 半吉: 2, 凶: -3, 大凶: -5 };

/** Score Wuge and Sancai auspiciousness for a surname + given-name stroke combination. */
export function evaluateStrokeScore(s: readonly number[], g: readonly number[]): number {
  const tian = s.length === 1 ? s[0] + 1 : s[0] + s[1];
  const ren = s[s.length - 1] + g[0];
  const di = g.length === 1 ? g[0] + 1 : g[0] + g[1];
  const wai = (s.length === 1 ? 1 : s[0]) + (g.length === 1 ? 1 : g[g.length - 1]);
  const zong = s.reduce((sum, n) => sum + n, 0) + g.reduce((sum, n) => sum + n, 0);
  const gridScore = (num: number) => {
    const index = num > 81 ? ((num - 1) % 80) + 1 : num;
    return levelScores[numeral[index - 1]?.level ?? ''] ?? 0;
  };
  const combo = [tian, ren, di].map((n) => elements[n % 10]).join('');
  const sancaiScore = levelScores[sancai[combo]?.level ?? ''] ?? 0;
  return sancaiScore * 3 + gridScore(ren) * 2 + gridScore(di) * 2 + gridScore(zong) * 2 + gridScore(wai);
}

export async function birthForNaming(birth: Birth, range?: BirthRange) {
  if (!birth && !range) return null;
  if (birth && range) throw new Error('出生资料与出生范围不能同时提供。');
  const data = range ? { chart: null, unknown: await (await import('./bazi/unknown-time')).calculateBaziTimeRange({
    startTimestamp: Date.parse(range.start), endTimestamp: Date.parse(range.end), timezone: range.timezone, timeZoneId: range.timeZoneId, timeStandard: range.timeStandard, longitude: range.longitude,
  }) } : await (await import('./bazi')).calculateBaziIndependentData({ birth: birth! });
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const describe = (chart: Pick<NonNullable<typeof data.chart>, 'pillars' | 'strength' | 'patternOverview' | 'usefulBaseline' | 'usefulGod'>) => ({
    pillars: positions.map((key) => chart.pillars[key].ganZhi), strength: chart.strength.status,
    pattern: chart.patternOverview.pattern, favorable: chart.usefulBaseline.favorable,
    unfavorable: chart.usefulBaseline.unfavorable, rule: chart.usefulBaseline.rule,
    usefulGod: {
      status: chart.usefulGod.incrementStatus,
      primaryReason: chart.usefulGod.primaryReason,
      useful: chart.usefulGod.useful,
      avoid: chart.usefulGod.avoid,
      favorable: chart.usefulGod.favorableWuxing,
      unfavorable: chart.usefulGod.unfavorableWuxing,
    },
  });
  const segments = data.chart ? [{ ...describe(data.chart), timezone: data.chart.basis.timezone, start: null, end: null }]
    : data.unknown!.segments.map((segment) => ({ ...describe(segment), timezone: segment.timezone, start: new Date(segment.startTimestamp).toISOString(), end: new Date(segment.endTimestamp).toISOString() }));
  if (!segments.length) throw new Error('出生范围没有可用候选。');
  if (range?.pillars && segments.some((segment) => positions.some((key, index) => segment.pillars[index] !== range.pillars![key]))) throw new Error('出生范围内的干支与所给四柱来源不一致。');
  const stable = segments[0].favorable.filter((element) => segments.every((segment) => segment.favorable.includes(element)));
  const conditional = [...new Set(segments.flatMap((segment) => segment.favorable))].filter((element) => !stable.includes(element));
  const stableUsefulGod = segments[0].usefulGod.favorable.filter((element) => segments.every((segment) => segment.usefulGod.favorable.includes(element)));
  const conditionalUsefulGod = [...new Set(segments.flatMap((segment) => segment.usefulGod.favorable))].filter((element) => !stableUsefulGod.includes(element));
  const timeBasis = data.chart ? { kind: 'exact' as const, ...data.chart.basis }
    : range ? { kind: 'window' as const, startTimestamp: data.unknown!.source.startTimestamp, endTimestamp: data.unknown!.source.endTimestamp, excludedSeconds: data.unknown!.source.excludedSeconds }
      : { kind: 'range' as const, solarDate: data.unknown!.source.solarDate, startTimestamp: data.unknown!.source.startTimestamp, endTimestamp: data.unknown!.source.endTimestamp, excludedSeconds: data.unknown!.source.excludedSeconds };
  return { input: birth ?? null, ...(range ? { rangeInput: range } : {}), precision: data.chart ? 'exact' as const : 'range' as const, timeBasis, segments, stableFavorable: stable, conditionalFavorable: conditional, stableUsefulGod, conditionalUsefulGod,
    limitation: '所列基础方向为旺衰和格局模型的基础取向，不等于最终喜用；另附综合调候与病药的用神裁定参考。未知时辰的各候选不得当作确定出生时间。' };
}

export function namingPreferences(explicit: string[] | undefined, birth: Awaited<ReturnType<typeof birthForNaming>>) {
  return explicit?.length ? { stable: [...explicit], conditional: [], source: '用户指定' }
    : birth ? { stable: birth.stableFavorable, conditional: birth.conditionalFavorable, source: '出生条件模型' }
      : { stable: [], conditional: [], source: '未指定' };
}

export async function namingDetails(chars: string[], loadShard?: CharacterShardLoader) {
  const map = await characterDetails(chars, loadShard);
  const missing = chars.filter((char) => !map[char]);
  if (missing.length) throw new Error(`姓名用字暂未收录在字典中：${[...new Set(missing)].join('、')}。`);
  return map as Record<string, CharacterDetail>;
}

export function nameStructure(surname: string, given: string, map: Record<string, CharacterDetail>, preferred: string[], conditional: string[]) {
  const surnameChars = [...surname], givenChars = [...given], surnameDetails = surnameChars.map((char) => ({ ...map[char], char })), givenDetails = givenChars.map((char) => ({ ...map[char], char }));
  const s = surnameDetails.map((item) => item.kangxiStrokes), g = givenDetails.map((item) => item.kangxiStrokes);
  const definitions = [
    { key: 'tian', name: '天格', operands: s.length === 1 ? [s[0], 1] : s, rule: s.length === 1 ? '单姓笔画加一' : '复姓两字笔画相加' },
    { key: 'ren', name: '人格', operands: [s.at(-1)!, g[0]], rule: '姓氏末字与名字首字笔画相加' },
    { key: 'di', name: '地格', operands: g.length === 1 ? [g[0], 1] : g, rule: g.length === 1 ? '单字名笔画加一' : '名字两字笔画相加' },
    { key: 'wai', name: '外格', operands: [s.length === 1 ? 1 : s[0], g.length === 1 ? 1 : g.at(-1)!], rule: '取姓氏外侧与名字外侧笔画，单姓或单字名一侧以一补位' },
    { key: 'zong', name: '总格', operands: [...s, ...g], rule: '姓名全部汉字笔画相加' },
  ];
  const gridDerivations = definitions.map((item) => { const value = item.operands.reduce((sum, n) => sum + n, 0); return { ...item, value, expression: `${item.operands.join(' + ')} = ${value}` }; });
  const rawGrids = Object.fromEntries(gridDerivations.map((item) => [item.key, item.value])) as Record<'tian' | 'ren' | 'di' | 'wai' | 'zong', number>;
  const roles: Record<string, string> = { tian: '祖运', ren: '主运', di: '前运', wai: '副运', zong: '后运' };
  const grids = Object.fromEntries(Object.entries(rawGrids).map(([key, num]) => {
    const index = num > 81 ? ((num - 1) % 80) + 1 : num;
    return [key, { num, wuxing: elements[num % 10], role: roles[key], ...numeral[index - 1] }];
  }));
  const positions = (['tian', 'ren', 'di'] as const).map((key, index) => {
    const value = rawGrids[key], name = ['天格', '人格', '地格'][index], tail = value % 10, element = elements[tail];
    return { name, value, tail, element, explanation: `${name}${value}，尾数${tail}属${element}` };
  });
  const relation = (a: typeof positions[number], b: typeof positions[number]) => {
    const kind = a.element === b.element ? '同' : generates[a.element] === b.element ? '生' : generates[b.element] === a.element ? '被生' : controls[a.element] === b.element ? '克' : '被克';
    const reverse = kind === '被生' || kind === '被克', from = reverse ? b : a, to = reverse ? a : b, verb = kind === '生' || kind === '被生' ? '生' : '克';
    return { left: a.name, right: b.name, relation: kind, explanation: kind === '同' ? `${a.name}与${b.name}同属${a.element}` : `${from.name}${from.element}${verb}${to.name}${to.element}` };
  };
  const combo = positions.map((item) => item.element).join('');
  const comboReadings = compoundReadings[surnameDetails.map((item) => item.simplified).join('')];
  return { surname, given, chars: [...surnameDetails.map((item, index) => ({ ...item, isSurname: true,
    ...(surnameDetails.length === 1 ? (surnames[item.simplified] ? { surnameReading: surnames[item.simplified] } : {}) : comboReadings?.[index] ? { surnameReading: comboReadings[index] } : {}) })), ...givenDetails.map((item) => ({ ...item, isSurname: false }))],
    rawGrids, gridDerivations, grids, sancai: { ...sancai[combo] }, sancaiEvidence: { combo, positions, relations: [relation(positions[0], positions[1]), relation(positions[1], positions[2])], rule: '三才依次取天格、人格、地格；尾数一二属木、三四属火、五六属土、七八属金、九零属水。' },
    preferredElements: [...preferred], conditionalPreferredElements: [...conditional],
    elementMatches: givenDetails.filter((item) => item.wuxing && preferred.includes(item.wuxing)).map((item) => item.char),
    conditionalElementMatches: givenDetails.filter((item) => item.wuxing && conditional.includes(item.wuxing)).map((item) => item.char) };
}

function detectToneCategory(pinyin?: string): '平' | '仄' | '待考' {
  if (!pinyin) return '待考';
  const first = pinyin.split(/[,，、/\s]+/)[0] ?? '';
  if (/[āēīōūǖáéíóúǘ]/u.test(first)) return '平';
  if (/[ǎěǐǒǔǚàèìòùǜ]/u.test(first)) return '仄';
  return '待考';
}

export function nameCharacterFacts(item: ReturnType<typeof nameStructure>['chars'][number]) {
  const reading = 'surnameReading' in item && typeof item.surnameReading === 'string' ? item.surnameReading : item.pinyin;
  const conciseDef = item.definition ? item.definition.split('；').slice(0, 4).join('；') : '待考';
  return `${item.isSurname ? '姓' : '名'}字「${item.char}」：${item.pinyin ?? '读音待考'}${'surnameReading' in item && item.surnameReading ? `（姓氏读音参考${item.surnameReading}）` : ''}，声调属${detectToneCategory(reading)}，部首「${item.radical ?? '待考'}」，${item.structure ?? '结构待考'}结构，姓名学康熙${item.kangxiStrokes}画，五行${item.wuxing ?? '待考'}；字义：${conciseDef}${item.readingNote ? `\n音义说明：${item.readingNote}` : ''}${item.strokeNote ? `\n笔画说明：${item.strokeNote}` : ''}`;
}
export function nameFacts(analysis: ReturnType<typeof nameStructure>, includeCharacters = true) {
  const tones = analysis.chars.map((c) => detectToneCategory('surnameReading' in c && typeof c.surnameReading === 'string' ? c.surnameReading : c.pinyin));
  const tonePattern = tones.join('–');
  const allSameTone = tones.every((t) => t !== '待考' && t === tones[0]);
  const toneNote = allSameTone ? '（全名平仄单一，诵读略显平直）' : tones.includes('平') && tones.includes('仄') ? '（平仄相间，声律富于抑扬变化）' : '';
  const structures = analysis.chars.map((c) => c.structure ?? '待考').join('–');
  const gridsLine = includeCharacters
    ? analysis.gridDerivations.map((item) => { const grid = analysis.grids[item.key]; return `${item.name}：${item.expression}（${grid.role}，${item.rule}），${grid.wuxing}；${grid.poem}（${grid.level}），${grid.keywords}。`; }).join('\n')
    : `${analysis.gridDerivations.map((item) => { const grid = analysis.grids[item.key]; return `${item.name}：${item.expression}（${grid.wuxing}，${grid.poem}·${grid.level}，${grid.keywords}）`; }).join('；')}。`;
  const elemMatchLine = includeCharacters || analysis.elementMatches.length || analysis.conditionalElementMatches.length
    ? `所选五行对应字：${analysis.elementMatches.join('、') || '无'}；条件方向对应字：${analysis.conditionalElementMatches.join('、') || '无'}。`
    : '';
  return [`姓名：${analysis.surname}${analysis.given}（音律平仄：${tonePattern}${toneNote}；字形结构：${structures}）。`,
    ...(includeCharacters ? analysis.chars.map(nameCharacterFacts) : []),
    gridsLine,
    `三才：${analysis.sancaiEvidence.combo}；成功运（${analysis.sancaiEvidence.relations[0].explanation}）、基础运（${analysis.sancaiEvidence.relations[1].explanation}）。${analysis.sancai.level}：${analysis.sancai.text}`,
    elemMatchLine].filter(Boolean).join('\n');
}

export function birthFacts(context: Awaited<ReturnType<typeof birthForNaming>>) {
  if (!context) return '未提供出生资料，不推断四柱或喜用。';
  const birth = context.input, range = context.rangeInput;
  const timeBasis = context.timeBasis.kind === 'exact' ? (() => {
    const clock = context.timeBasis.calculationClock, pad = (value: number) => String(value).padStart(2, '0');
    const corrected = `${clock.year}-${pad(clock.month)}-${pad(clock.day)} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`;
    const solar = context.timeBasis.trueSolar;
    return `出生瞬时 ${new Date(context.timeBasis.utcTimestamp).toISOString()}；排盘钟表 ${corrected}${solar ? `；经度修正${solar.longitudeCorrectionMinutes.toFixed(2)}分钟，均时差修正${solar.equationOfTimeMinutes.toFixed(2)}分钟，合计${solar.totalCorrectionMinutes.toFixed(2)}分钟` : ''}。`;
  })() : `${context.timeBasis.kind === 'range' ? `当地公历日 ${context.timeBasis.solarDate}；` : ''}真实范围 ${new Date(context.timeBasis.startTimestamp).toISOString()} 至 ${new Date(context.timeBasis.endTimestamp).toISOString()}（终点不含）；排除${context.timeBasis.excludedSeconds}秒。`;
  const clock = birth?.clock;
  const clockText = !clock ? '' : clock.kind === 'exact' ? `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}:${String(clock.second).padStart(2, '0')}` : clock.kind === 'shichen' ? `当地时辰索引${clock.index}` : '时辰未知';
  const record = birth ? `出生记录：${birth.calendar === 'lunar' ? `农历${birth.leapMonth ? '闰' : ''}` : '公历'}${birth.year}-${birth.month}-${birth.day} ${clockText}；${birth.timeZoneId ? `时区 ${birth.timeZoneId}${birth.timezone !== undefined ? `，UTC${birth.timezone}` : ''}` : `UTC${birth.timezone ?? 8}`}；${birth.timeStandard === 'true-solar' ? `真太阳时，经度${birth.longitude}°` : '当地民用时'}。`
    : `出生范围：${range!.start} 至 ${range!.end}（起点含、终点不含）；${range!.timeZoneId ? `时区 ${range!.timeZoneId}` : `UTC${range!.timezone ?? 8}`}；${range!.timeStandard === 'true-solar' ? `真太阳时，经度${range!.longitude}°` : '当地民用时'}。${range!.pillars ? `四柱来源：${positionsForRange(range!.pillars)}；已核对所有分段。` : ''}`;
  return [`${record}\n${timeBasis}`,
    `出生取向：${context.precision === 'exact' ? '精确出生' : '出生时段候选'}；共同方向${context.stableFavorable.join('、') || '随候选分化'}；仅部分候选方向${context.conditionalFavorable.join('、') || '无'}；用神裁定共同喜用${context.stableUsefulGod.join('、') || '随候选动态调衡'}${context.conditionalUsefulGod.length ? `，条件喜用${context.conditionalUsefulGod.join('、')}` : ''}。`,
    ...context.segments.map((item) => `${item.start ? `${item.start} 至 ${item.end}（终点不含）` : '精确出生'}，UTC${item.timezone >= 0 ? '+' : ''}${item.timezone}：${item.pillars.join(' ')}；旺衰${item.strength}；格局${item.pattern}；基础方向${item.favorable.join('、') || '中和随运调衡'}（${item.rule}）；用神裁定${item.usefulGod.status}（主用${item.usefulGod.useful}、喜${item.usefulGod.favorable.join('、') || '中和平衡'}、忌${item.usefulGod.unfavorable.join('、') || '偏颇过盛'}）。`), context.limitation].join('\n');
}

function positionsForRange(pillars: NonNullable<NonNullable<BirthRange>['pillars']>) {
  return [pillars.year, pillars.month, pillars.day, pillars.hour].join(' ');
}

export function namingPromptSelection(options: { topicId?: 'general'; subtopicId?: string; scope?: 'natal' | 'event' | 'custom' } | undefined, method: 'naming' | 'name-analysis') {
  if (!options || (!options.topicId && !options.subtopicId && !options.scope)) return '';
  const scope = options.scope ?? 'natal';
  const focus = scope === 'event' ? '针对用户当前事项或使用场景说明；场景未给出时明确缺口。' : scope === 'custom' ? '按照用户问题限定分析范围，不补造使用背景。' : '围绕姓名本身与已提供的出生资料比较，不推断未提供的岁运。';
  return `【解读选择】\n通用；${method === 'naming' ? '起名方案' : '姓名解析'}；${{ natal: '姓名本身', event: '当前事项', custom: '自定义范围' }[scope]}。${focus}`;
}
