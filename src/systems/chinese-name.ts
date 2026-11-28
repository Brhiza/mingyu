import type { z } from 'zod';
import type { chineseNameInput } from '../schema';
import type { CharacterIndexLoader, CharacterShardLoader } from '../character-data';
import type { StaticDatasetLoader } from '../static-data';
import { sameJsonValue } from '../json-value';
import { birthFacts, birthForNaming, nameFacts, nameStructure, namingDetails, namingPreferences, namingPromptSelection, splitSurname } from './naming-foundation';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof chineseNameInput>;
type Source = Omit<Input, 'question' | 'currentTime'>;
type NameAnalysis = ReturnType<typeof nameStructure>;
type NamePreference = ReturnType<typeof namingPreferences>;
type NameBirthContext = Awaited<ReturnType<typeof birthForNaming>>;

function primaryReading(item: NameAnalysis['chars'][number]): string {
  const raw = 'surnameReading' in item && typeof item.surnameReading === 'string' ? item.surnameReading : item.pinyin;
  return (raw ?? '').split(/[,，、/\s]+/)[0] ?? '';
}

function stripTone(pinyin: string): string {
  return pinyin.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectTone(pinyin: string): '平' | '仄' | '待考' {
  if (!pinyin) return '待考';
  if (/[āēīōūǖáéíóúǘ]/u.test(pinyin)) return '平';
  if (/[ǎěǐǒǔǚàèìòùǜ]/u.test(pinyin)) return '仄';
  return '待考';
}

export function analyzeChineseNameRelations(
  analysis: NameAnalysis,
  preference: NamePreference,
  birthContext: NameBirthContext,
) {
  const [tr, rd] = analysis.sancaiEvidence.relations;
  const isSupport = (rel: string) => rel === '生' || rel === '被生';
  const isConflict = (rel: string) => rel === '克' || rel === '被克';
  let sancaiFlow: string;
  if (tr.relation === '同' && rd.relation === '同') sancaiFlow = '三才同气比和';
  else if (!isConflict(tr.relation) && !isConflict(rd.relation)) {
    sancaiFlow = isSupport(tr.relation) || isSupport(rd.relation) ? '三才顺生流通（无相克）' : '三才平稳比和';
  } else if (isConflict(tr.relation) && isConflict(rd.relation)) {
    sancaiFlow = '天人、人地双重受克（流通受阻）';
  } else {
    sancaiFlow = `半通半克（${isConflict(tr.relation) ? '天人相克、人地可通' : '天人可通、人地相克'}）`;
  }

  const gridValues = Object.values(analysis.grids);
  const jiGrids = gridValues.filter((g) => g.level === '大吉' || g.level === '吉').length;
  const halfJiGrids = gridValues.filter((g) => g.level === '半吉').length;
  const xiongGrids = gridValues.filter((g) => g.level === '凶' || g.level === '大凶').length;

  const readings = analysis.chars.map((c) => ({ char: c.char, reading: primaryReading(c) }));
  const homophones: string[] = [];
  for (let i = 1; i < readings.length; i += 1) {
    const prev = readings[i - 1], curr = readings[i];
    if (!prev.reading || !curr.reading) continue;
    if (prev.reading === curr.reading) homophones.push(`${prev.char}${curr.char}（完全同音 ${curr.reading}）`);
    else if (stripTone(prev.reading) === stripTone(curr.reading)) {
      homophones.push(`${prev.char}${curr.char}（近音同韵 ${prev.reading}/${curr.reading}）`);
    }
  }
  const tones = readings.map((r) => detectTone(r.reading));
  const toneSummary =
    tones.every((t) => t !== '待考' && t === tones[0])
      ? `${tones.join('–')}（平仄单一）`
      : tones.includes('平') && tones.includes('仄')
        ? `${tones.join('–')}（平仄错落）`
        : tones.join('–');

  const structures = analysis.chars.map((c) => c.structure ?? '待考');
  const uniqueStructures = new Set(structures.filter((s) => s !== '待考'));
  const complexChars = analysis.chars.filter((c) => c.structure === '全包围' || c.structure === '穿插').map((c) => c.char);
  const strokes = analysis.chars.map((c) => c.kangxiStrokes);
  const strokeSpan = Math.max(...strokes) - Math.min(...strokes);
  const formSummary = `${structures.join('–')}（${uniqueStructures.size > 1 ? '结构错落' : '结构单一'}${complexChars.length ? `，含繁复结构：${complexChars.join('、')}` : ''}；康熙笔画跨度 ${strokeSpan} 画）`;

  const givenChars = analysis.chars.filter((c) => !c.isSurname);
  const renElement = analysis.grids.ren.wuxing;
  const zongElement = analysis.grids.zong.wuxing;

  const stableUnfavorable = birthContext
    ? birthContext.segments[0].unfavorable.filter((el) =>
        birthContext.segments.every((seg) => seg.unfavorable.includes(el)),
      )
    : [];
  const usefulAvoid = birthContext
    ? birthContext.segments[0].usefulGod.unfavorable.filter((el) =>
        birthContext.segments.every((seg) => seg.usefulGod.unfavorable.includes(el)),
      )
    : [];
  const avoidElements = [...new Set([...stableUnfavorable, ...usefulAvoid])];
  const favorableAll = [...new Set([...preference.stable, ...(birthContext?.stableUsefulGod ?? [])])];

  const charFavorableHits = givenChars.filter((c) => c.wuxing && favorableAll.includes(c.wuxing)).map((c) => `${c.char}（${c.wuxing}）`);
  const charConditionalHits = givenChars
    .filter((c) => c.wuxing && !favorableAll.includes(c.wuxing) && preference.conditional.includes(c.wuxing))
    .map((c) => `${c.char}（${c.wuxing}）`);
  const charAvoidHits = givenChars.filter((c) => c.wuxing && avoidElements.includes(c.wuxing)).map((c) => `${c.char}（${c.wuxing}）`);

  const gridCoordination: string[] = [];
  if (favorableAll.includes(renElement)) gridCoordination.push(`人格${renElement}合喜用`);
  else if (avoidElements.includes(renElement)) gridCoordination.push(`人格${renElement}涉忌神`);
  if (favorableAll.includes(zongElement)) gridCoordination.push(`总格${zongElement}合喜用`);
  else if (avoidElements.includes(zongElement)) gridCoordination.push(`总格${zongElement}涉忌神`);

  const wuxingBalanceLine =
    favorableAll.length || preference.conditional.length || avoidElements.length
      ? `喜忌五行制衡：名字补益喜用：${charFavorableHits.join('、') || '无'}${charConditionalHits.length ? `（条件喜用：${charConditionalHits.join('、')}）` : ''}；涉忌神冲突：${charAvoidHits.join('、') || '无'}${gridCoordination.length ? `；数理五行呼应：${gridCoordination.join('、')}` : ''}。`
      : `喜忌五行制衡：未指定喜用或出生资料，名字用字五行：${givenChars.map((c) => `${c.char}（${c.wuxing ?? '待考'}）`).join('、')}；人格属${renElement}、总格属${zongElement}。`;

  const lines = [
    `三才五格流通：${analysis.sancaiEvidence.combo}（${sancaiFlow}；成功运：${tr.explanation}，基础运：${rd.explanation}）；五格吉凶分布：吉 ${jiGrids}、半吉 ${halfJiGrids}、凶 ${xiongGrids}。`,
    `音形义与谐音检查：读音 ${readings.map((r) => `${r.char}(${r.reading || '待考'})`).join(' ')}，平仄 ${toneSummary}；相邻同音/近音：${homophones.length ? homophones.join('、') : '无同音或近音冲突'}；字形：${formSummary}。`,
    wuxingBalanceLine,
  ];

  return {
    sancaiFlow,
    homophones,
    toneSummary,
    charFavorableHits,
    charAvoidHits,
    gridCoordination,
    text: lines.join('\n'),
  };
}

async function dataFor(input: Source, loadShard?: CharacterShardLoader, loadIndex?: CharacterIndexLoader, staticDataset?: StaticDatasetLoader) {
  const { chars, surnameLength, surname, given } = splitSurname(input.fullName, input.surnameLength);
  if (chars.some((char) => !/\p{Script=Han}/u.test(char))) throw new Error('姓名只能包含汉字。');
  if (chars.length <= surnameLength || chars.length > surnameLength + 2) throw new Error('姓名需由一至二字姓氏和一至二字名字组成。');
  const [details, birthContext] = await Promise.all([namingDetails(chars, loadShard, loadIndex), birthForNaming(input.birth, input.birthRange, staticDataset)]);
  const preference = namingPreferences(input.preferredElements, birthContext);
  const analysis = nameStructure(surname, given, details, preference.stable, preference.conditional);
  return { input, birthContext, preference, analysis };
}
type Data = Awaited<ReturnType<typeof dataFor>>;
function render(data: Data, question: string, options: Input['prompt']) {
  const relations = analyzeChineseNameRelations(data.analysis, data.preference, data.birthContext);
  const digestLines = buildMethodSituationDigest('chinese-name', { ...data, relations }, question);
  const text = [
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【姓名资料与计算】\n${nameFacts(data.analysis)}`, `【音形义与三才喜忌制衡关系】\n${relations.text}`, `【出生与五行参考】\n五行方向来源：${data.preference.source}。\n${birthFacts(data.birthContext)}`,
    '【传统语境】\n《左传·桓公六年》记载命名五法；五格三才为后世姓名学数理取象，两者并非同一套规则。字库和资料来源仍需独立校勘。',
    namingPromptSelection(options, 'name-analysis'), '【任务】\n根据实际姓名、字义、读音、字形、五格三才和已列出生资料回答问题。分开说明字义与姓名学取象，具体读音以本人及家族用法为准；不要把数理或条件模型写成现实必然结果，不要虚构未提供的出生资料。', `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function chineseName(input: Input, loadShard?: CharacterShardLoader, loadIndex?: CharacterIndexLoader, staticDataset?: StaticDatasetLoader) {
  const { question, currentTime: _time, ...source } = input;
  const data = await dataFor(source, loadShard, loadIndex, staticDataset);
  return { data, summary: { title: '姓名分析', lines: [`${data.analysis.surname}${data.analysis.given}`, `三才：${data.analysis.sancaiEvidence.combo}`] }, prompt: render(data, question, input.prompt) };
}
export async function promptForSavedChineseName(
  data: unknown,
  source: Source,
  question: string,
  options: Input['prompt'],
  loadShard?: CharacterShardLoader,
  loadIndex?: CharacterIndexLoader,
  staticDataset?: StaticDatasetLoader,
) {
  const expected = await dataFor(source, loadShard, loadIndex, staticDataset);
  if (!sameJsonValue(data, expected)) throw new Error('姓名分析结果与输入不一致。');
  return render(expected, question, options ?? source.prompt);
}
