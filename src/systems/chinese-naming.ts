import type { z } from 'zod';
import type { chineseNamingInput } from '../schema';
import type { CharacterShardLoader } from '../character-data';
import { sameJsonValue } from '../json-value';
import { characterMetadata, searchOrderedMetadata, type CharacterDetail } from './characters';
import { birthFacts, birthForNaming, evaluateStrokeScore, nameCharacterFacts, nameFacts, nameStructure, namingDetails, namingPreferences, namingPromptSelection } from './naming-foundation';
import surnameReadings from '../data/characters/surname-readings.json';

const surnameReadingMap = surnameReadings as Record<string, string>;

type Input = z.infer<typeof chineseNamingInput>;
type Source = Omit<Input, 'question' | 'currentTime'>;
const pools = {
  male: '宇宸泽轩睿浩博彦辰昊铭骏承远航嘉瑞景安宁朗修文哲谦毅恒翊晨旭恺峻川源柏森楷钧锦熙煜昭曜清和弘允卓凡',
  female: '宁悦欣妍涵瑶琪琳玥璇诗雅舒婉晴萱芷若依然语桐清欢知夏念安嘉怡可馨慧敏灵韵昭月星澜雪柔梦竹云舒锦书沐瑾',
  general: '安宁嘉瑞清和知远明轩景行言希思齐书言亦辰予墨乐川星野云舟望舒怀瑾若水之恒以沫允和卓然修远闻溪',
} as const;
const han = (text?: string) => [...new Set([...(text ?? '')].filter((char) => /\p{Script=Han}/u.test(char)))];
const canonical = (char: string) => characterMetadata(char)?.simplified ?? char;

const UNSUITABLE_CHARS = new Set([
  ...'一二三四五六七八九十零百千万亿了么吗呢啊吧哦呀哇哪嘛啥死亡病杀凶鬼尸丧哭泪苦痛穷贫贱丑恶毒癌瘤粪尿屎屁猪狗贼盗砍刀刁狱囚灾祸刑罪',
  ...'肮脏臭肥胖瘦肺肝肠胃肾脾胆胰脑骨肉皮筋肪股肩臀腿脚趾甲疮脓痰血唾涕洞坑坟墓穴笆笼牢',
  ...'傻蠢笨呆痴癫狂聋哑瞎跛秃癞妖魔怪蛇虫鼠蚁蛆蝇蚊蝎毒煞孽',
]);
const GOOD_STRUCTURES = new Set(['左右', '上下', '独体', '左上包围', '左下包围']);
const COMPLEX_STRUCTURES = new Set(['全包围', '穿插']);
const MALE_RADICALS = new Set(['山', '日', '水', '氵', '木', '金', '钅', '玉', '王', '石', '火', '心', '言', '广', '宀', '马', '龙']);
const FEMALE_RADICALS = new Set(['女', '艹', '王', '玉', '月', '日', '木', '氵', '心', '言', '竹', '丝', '纟', '雨']);
const GENERAL_RADICALS = new Set(['木', '水', '氵', '日', '月', '玉', '王', '心', '言', '山', '竹', '艹']);

function basePinyin(pinyin?: string): string {
  if (!pinyin) return '';
  const first = pinyin.split(/[,，、/\s]+/)[0] ?? '';
  return first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function evaluateNamingHomophonePenalty(aPinyin?: string, bPinyin?: string): number {
  const pa = aPinyin?.split(/[,，、/\s]+/)[0] ?? '';
  const pb = bPinyin?.split(/[,，、/\s]+/)[0] ?? '';
  if (pa && pb && pa === pb) return -50;
  const ba = basePinyin(pa);
  const bb = basePinyin(pb);
  return ba && bb && ba === bb ? -30 : 0;
}

function homophonePenalty(a: CharacterDetail, b: CharacterDetail, aOverride?: string): number {
  return evaluateNamingHomophonePenalty(aOverride ?? a.pinyin, b.pinyin);
}

function scoreCharacter(
  meta: CharacterDetail,
  surnameStrokes: readonly number[],
  gender: 'male' | 'female' | 'general',
  stableElements: readonly string[],
  conditionalElements: readonly string[],
  preferredSet: ReadonlySet<string>,
  genderPoolSet: ReadonlySet<string>,
  generalPoolSet: ReadonlySet<string>,
): number {
  let score = 0;
  if (preferredSet.has(meta.char) || preferredSet.has(meta.simplified)) score += 200;
  if (genderPoolSet.has(meta.simplified)) score += 40;
  else if (generalPoolSet.has(meta.simplified)) score += 20;
  if (meta.wuxing && stableElements.includes(meta.wuxing)) score += 45;
  else if (meta.wuxing && conditionalElements.includes(meta.wuxing)) score += 22;

  const radical = meta.radical ?? '';
  if (gender === 'male') {
    if (MALE_RADICALS.has(radical)) score += 10;
    if (radical === '女') score -= 25;
  } else if (gender === 'female') {
    if (FEMALE_RADICALS.has(radical)) score += 10;
  } else if (GENERAL_RADICALS.has(radical)) {
    score += 6;
  }

  if (meta.structure && GOOD_STRUCTURES.has(meta.structure)) score += 6;
  else if (meta.structure && COMPLEX_STRUCTURES.has(meta.structure)) score -= 12;

  if (meta.kangxiStrokes >= 4 && meta.kangxiStrokes <= 16) score += 6;
  else if (meta.kangxiStrokes >= 3 && meta.kangxiStrokes <= 18) score += 2;

  score += evaluateStrokeScore(surnameStrokes, [meta.kangxiStrokes]);
  return score;
}

async function dataFor(input: Source, loadShard?: CharacterShardLoader) {
  const surname = input.surname.trim(), surnameChars = [...surname], length = input.givenNameLength ?? 2, gender = input.gender ?? 'general', limit = input.limit ?? 20;
  if (surnameChars.length < 1 || surnameChars.length > 2 || surnameChars.some((char) => !/\p{Script=Han}/u.test(char))) throw new Error('姓氏需为一至二个汉字。');
  const missing = surnameChars.filter((char) => !characterMetadata(char));
  if (missing.length) throw new Error(`姓氏用字暂未收录在字典中：${[...new Set(missing)].join('、')}。`);
  const generation = input.generationCharacter?.trim() || undefined;
  if (generation && ([...generation].length !== 1 || !/\p{Script=Han}/u.test(generation))) throw new Error('辈分字只能填写一个汉字。');
  if (!generation && input.generationPosition) throw new Error('指定辈分字位置时须提供辈分字。');
  if (generation && length === 1 && input.generationPosition === 'second') throw new Error('单字名不能指定辈分字为第二字。');
  if (generation && !characterMetadata(generation)) throw new Error('辈分字暂未收录在字典中。');
  const forbidden = new Set(han(input.forbiddenCharacters).map(canonical));
  if (generation && forbidden.has(canonical(generation))) throw new Error('辈分字不能同时设为忌用字。');
  const preferred = han(input.preferredCharacters).filter((char) => !forbidden.has(canonical(char))), preferredSet = new Set(preferred);
  const unavailablePreferredCharacters = preferred.filter((char) => !characterMetadata(char));
  const surnameMetas = surnameChars.map((char) => characterMetadata(char)!);
  const surnameStrokes = surnameMetas.map((item) => item.kangxiStrokes);
  const lastSurnameMeta = surnameMetas.at(-1)!;
  const lastSurnameReading = surnameMetas.length === 1 ? surnameReadingMap[lastSurnameMeta.simplified] : undefined;
  const birthContext = await birthForNaming(input.birth, input.birthRange), preference = namingPreferences(input.preferredElements, birthContext);
  const genderPoolSet = new Set([...pools[gender]]), generalPoolSet = new Set([...pools.general]), curatedSet = new Set([...genderPoolSet, ...generalPoolSet]);
  const candidateMap = new Map<string, { char: string; meta: CharacterDetail; score: number; order: number }>();
  let orderCounter = 0;
  const consider = (rawChar: string, fromLibrary: boolean) => {
    const meta = characterMetadata(rawChar);
    if (!meta) return;
    const key = canonical(rawChar);
    if (forbidden.has(key)) return;
    const char = preferredSet.has(rawChar) ? rawChar : key;
    if (candidateMap.has(char)) return;
    if (fromLibrary && !preferredSet.has(rawChar) && !curatedSet.has(key)) {
      if (!meta.common || !meta.wuxing || !meta.pinyin || UNSUITABLE_CHARS.has(key)) return;
      if (COMPLEX_STRUCTURES.has(meta.structure ?? '') || meta.kangxiStrokes < 2 || meta.kangxiStrokes > 22) return;
    }
    const score = scoreCharacter(meta, surnameStrokes, gender, preference.stable, preference.conditional, preferredSet, genderPoolSet, generalPoolSet);
    candidateMap.set(char, { char, meta, score, order: orderCounter++ });
  };
  for (const char of preferred) consider(char, false);
  for (const char of [...pools[gender], ...pools.general]) consider(char, false);
  for (const meta of searchOrderedMetadata()) consider(meta.char, true);

  const rankedChars = [...candidateMap.values()].sort((a, b) => b.score - a.score || a.order - b.order);
  const selectedEntries = rankedChars.slice(0, length === 2 ? 48 : 80);
  const pool = selectedEntries.map((entry) => entry.char);
  if (!pool.length) throw new Error('当前用字条件没有可用候选字。');

  const entryByChar = new Map(selectedEntries.map((entry) => [entry.char, entry]));
  const genMeta = generation ? characterMetadata(generation)! : null;
  const scoredNames: Array<{ given: string; score: number; order: number }> = [];
  let pairOrder = 0;

  if (length === 1) {
    for (const char of generation ? [generation] : pool) {
      const meta = generation ? genMeta! : entryByChar.get(char)!.meta;
      const charScore = generation ? 0 : entryByChar.get(char)!.score;
      const score = evaluateStrokeScore(surnameStrokes, [meta.kangxiStrokes]) * 2 + charScore + homophonePenalty(lastSurnameMeta, meta, lastSurnameReading);
      scoredNames.push({ given: char, score, order: pairOrder++ });
    }
  } else if (generation) {
    const isSecond = input.generationPosition === 'second';
    for (const char of pool) {
      const entry = entryByChar.get(char)!;
      const firstMeta = isSecond ? entry.meta : genMeta!, secondMeta = isSecond ? genMeta! : entry.meta;
      const structureBonus = firstMeta.structure && secondMeta.structure && firstMeta.structure !== secondMeta.structure ? 6 : 0;
      const score = evaluateStrokeScore(surnameStrokes, [firstMeta.kangxiStrokes, secondMeta.kangxiStrokes]) * 2
        + entry.score + structureBonus + homophonePenalty(firstMeta, secondMeta) + homophonePenalty(lastSurnameMeta, firstMeta, lastSurnameReading);
      scoredNames.push({ given: isSecond ? `${char}${generation}` : `${generation}${char}`, score, order: pairOrder++ });
    }
  } else {
    for (const first of selectedEntries) {
      for (const second of selectedEntries) {
        if (canonical(first.char) === canonical(second.char)) continue;
        const structureBonus = first.meta.structure && second.meta.structure && first.meta.structure !== second.meta.structure ? 6 : 0;
        const score = evaluateStrokeScore(surnameStrokes, [first.meta.kangxiStrokes, second.meta.kangxiStrokes]) * 2
          + first.score + second.score + structureBonus + homophonePenalty(first.meta, second.meta) + homophonePenalty(lastSurnameMeta, first.meta, lastSurnameReading);
        scoredNames.push({ given: first.char + second.char, score, order: pairOrder++ });
      }
    }
  }

  scoredNames.sort((a, b) => b.score - a.score || a.order - b.order);
  const names: string[] = [], seen = new Set<string>(), firstCounts = new Map<string, number>();
  for (const item of scoredNames) {
    const chars = [...item.given], keys = chars.map(canonical), first = chars[0];
    if (keys.some((key) => forbidden.has(key)) || (length === 2 && keys[0] === keys[1]) || seen.has(item.given) || (!generation && (firstCounts.get(first) ?? 0) >= 2)) continue;
    names.push(item.given);
    seen.add(item.given);
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
    if (names.length >= limit) break;
  }
  const details = await namingDetails([...new Set([...surname, ...names.join('')])], loadShard);
  const candidates = names.map((given) => {
    const analysis = nameStructure(surname, given, details, preference.stable, preference.conditional);
    return { fullName: surname + given, givenName: given, analysis, selectionEvidence: { preferredCharacters: [...given].filter((char) => preferredSet.has(char)), generationCharacter: generation ?? null,
      generationPosition: generation ? input.generationPosition ?? 'first' : null, favorableElementCharacters: [...analysis.elementMatches], conditionalFavorableElementCharacters: [...analysis.conditionalElementMatches] } };
  });
  return { input, birthContext, preference, unavailablePreferredCharacters, selectedCharacters: pool, candidates };
}
type Data = Awaited<ReturnType<typeof dataFor>>;

function detectToneCat(pinyin?: string): '平' | '仄' | '待考' {
  if (!pinyin) return '待考';
  const first = pinyin.split(/[,，、/\s]+/)[0] ?? '';
  if (/[āēīōūǖáéíóúǘ]/u.test(first)) return '平';
  if (/[ǎěǐǒǔǚàèìòùǜ]/u.test(first)) return '仄';
  return '待考';
}

export function analyzeChineseNamingRelations(data: Data) {
  const total = data.candidates.length;
  if (!total) {
    return {
      smoothSancaiCount: 0,
      homophoneConflictCount: 0,
      favorableHitCount: 0,
      avoidConflictCount: 0,
      text: '当前约束下未生成候选，暂无三才喜忌制衡统计。',
    };
  }

  const stableUnfavorable = data.birthContext
    ? data.birthContext.segments[0].unfavorable.filter((el) =>
        data.birthContext!.segments.every((seg) => seg.unfavorable.includes(el)),
      )
    : [];
  const usefulAvoid = data.birthContext
    ? data.birthContext.segments[0].usefulGod.unfavorable.filter((el) =>
        data.birthContext!.segments.every((seg) => seg.usefulGod.unfavorable.includes(el)),
      )
    : [];
  const avoidElements = [...new Set([...stableUnfavorable, ...usefulAvoid])];
  const favorableAll = [...new Set([...data.preference.stable, ...(data.birthContext?.stableUsefulGod ?? [])])];

  let smoothSancaiCount = 0;
  let balancedToneCount = 0;
  let homophoneConflictCount = 0;
  let variedStructureCount = 0;
  let favorableHitCount = 0;
  let avoidConflictCount = 0;
  const topLines: string[] = [];

  for (const [index, candidate] of data.candidates.entries()) {
    const { analysis } = candidate;
    const [tr, rd] = analysis.sancaiEvidence.relations;
    const isSmooth = tr.relation !== '克' && tr.relation !== '被克' && rd.relation !== '克' && rd.relation !== '被克';
    if (isSmooth) smoothSancaiCount += 1;

    const readings = analysis.chars.map((c) =>
      'surnameReading' in c && typeof c.surnameReading === 'string' ? c.surnameReading : c.pinyin ?? '',
    );
    const tones = readings.map(detectToneCat);
    const toneBalanced = tones.includes('平') && tones.includes('仄');
    if (toneBalanced) balancedToneCount += 1;

    let hasHomophone = false;
    for (let i = 1; i < readings.length; i += 1) {
      if (evaluateNamingHomophonePenalty(readings[i - 1], readings[i]) < 0) {
        hasHomophone = true;
        break;
      }
    }
    if (hasHomophone) homophoneConflictCount += 1;

    const structures = new Set(analysis.chars.map((c) => c.structure).filter(Boolean));
    if (structures.size > 1) variedStructureCount += 1;

    const givenChars = analysis.chars.filter((c) => !c.isSurname);
    const favHits = givenChars.filter((c) => c.wuxing && favorableAll.includes(c.wuxing)).map((c) => `${c.char}(${c.wuxing})`);
    const avoidHits = givenChars.filter((c) => c.wuxing && avoidElements.includes(c.wuxing)).map((c) => `${c.char}(${c.wuxing})`);
    if (favHits.length) favorableHitCount += 1;
    if (avoidHits.length) avoidConflictCount += 1;

    if (index < 3) {
      const sancaiTag = isSmooth ? `${analysis.sancaiEvidence.combo}顺通` : `${analysis.sancaiEvidence.combo}含克`;
      const soundTag = `${toneBalanced ? '平仄错落' : '平仄单一'}/${hasHomophone ? '含近同音' : '无谐音冲突'}`;
      const wxTag =
        favorableAll.length || avoidElements.length
          ? `补喜:${favHits.join('、') || '无'}｜涉忌:${avoidHits.join('、') || '无'}`
          : `名五行:${givenChars.map((c) => c.wuxing ?? '待考').join('/')}`;
      topLines.push(`${candidate.fullName}：${sancaiTag}｜${soundTag}｜${wxTag}`);
    }
  }

  const lines = [
    `三才流通统计：共 ${total} 个候选，三才顺生/比和无克 ${smoothSancaiCount}/${total} 个，含相克 ${total - smoothSancaiCount}/${total} 个。`,
    `音形义与谐音检查：平仄错落 ${balancedToneCount}/${total} 个；字形结构错落 ${variedStructureCount}/${total} 个；相邻同音/近音冲突 ${homophoneConflictCount}/${total} 个${homophoneConflictCount === 0 ? '（均无相邻同音/近音冲突）' : ''}。`,
    favorableAll.length || avoidElements.length
      ? `喜忌五行制衡：命中喜用（${favorableAll.join('、') || '无'}）候选 ${favorableHitCount}/${total} 个；涉共同忌神（${avoidElements.join('、') || '无'}）候选 ${avoidConflictCount}/${total} 个。`
      : `喜忌五行制衡：未指定喜用或出生资料，按三才五格与音形义排序。`,
    `前列候选制衡速览：${topLines.join('；')}。`,
  ];

  return {
    smoothSancaiCount,
    homophoneConflictCount,
    favorableHitCount,
    avoidConflictCount,
    text: lines.join('\n'),
  };
}

function render(data: Data, question: string, options: Input['prompt']) {
  const forbiddenForms = [...new Set(han(data.input.forbiddenCharacters).flatMap((char) => {
    const item = characterMetadata(char);
    return item ? [item.simplified, item.traditional] : [char];
  }))];
  const gender = { general: '通用', male: '男', female: '女' }[data.input.gender ?? 'general'];
  const position = data.input.generationPosition === 'second' ? '名字末字' : '名字首字';
  const characters = new Map<string, Parameters<typeof nameCharacterFacts>[0]>();
  for (const candidate of data.candidates) for (const item of candidate.analysis.chars) characters.set(`${item.isSurname}:${item.char}`, item);
  const relations = analyzeChineseNamingRelations(data);
  const text = [`【起名条件】\n姓氏${data.input.surname}；字数${data.input.givenNameLength ?? 2}；取向${gender}；偏好字${data.input.preferredCharacters || '未指定'}；忌用字${data.input.forbiddenCharacters || '未指定'}；辈分字${data.input.generationCharacter || '未指定'}${data.input.generationCharacter ? `（${position}）` : ''}。\n候选字池：${data.selectedCharacters.join('、')}。`,
    data.unavailablePreferredCharacters.length ? `【未收录偏好字】\n${data.unavailablePreferredCharacters.join('、')}未收录，未参与候选生成。` : '',
    forbiddenForms.length ? `【避讳字形】\n对应简繁字形均回避：${forbiddenForms.join('、')}。` : '',
    `【出生与五行参考】\n五行方向来源：${data.preference.source}。\n${birthFacts(data.birthContext)}`,
    `【音形义与三才喜忌制衡关系】\n${relations.text}`,
    `【候选用字】\n${[...characters.values()].map(nameCharacterFacts).join('\n') || '当前没有候选用字。'}`,
    `【候选姓名】\n${data.candidates.map((candidate, index) => `${index + 1}. ${candidate.fullName}\n${nameFacts(candidate.analysis, false)}`).join('\n\n') || '当前约束下没有形成候选。'}`,
    '【传统语境】\n《左传·桓公六年》记载命名五法；五格三才是后世姓名学数理取象。字库、数理和文献资料仍需独立校勘。',
    namingPromptSelection(options, 'naming'), '【任务】\n比较候选的字义、音律、字形、谐音、日常辨识和所列三才五格；严格遵守忌用字与辈分字。出生条件模型仅供参考，不当作最终喜用或现实必然结果；若提出新组合须标明并说明选字依据。', `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function chineseNaming(input: Input, loadShard?: CharacterShardLoader) {
  const { question, currentTime: _time, ...source } = input, data = await dataFor(source, loadShard);
  return { data, summary: { title: '中文起名', lines: [`姓氏：${source.surname}`, `${data.candidates.length} 个候选`] }, prompt: render(data, question, input.prompt) };
}
export async function promptForSavedChineseNaming(data: unknown, source: Source, question: string, options: Input['prompt'], loadShard?: CharacterShardLoader) {
  const expected = await dataFor(source, loadShard);
  if (!sameJsonValue(data, expected)) throw new Error('起名结果与输入不一致。');
  return render(expected, question, options ?? source.prompt);
}
