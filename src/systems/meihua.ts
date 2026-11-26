import type { z } from 'zod';
import { generateMeihuaChart } from './meihua/chart';
import { analyzeMeihuaEvidence } from './meihua/evidence';
import { findHexagramByTrigrams } from './meihua/hexagram';
import { isKe, isSheng } from './calendar';
import type { meihuaInput } from '../schema';
import type { MeihuaSettings } from './meihua/types';
import { sameJsonValue } from '../json-value';
import { beijingLunarDateDiscrepancy } from './birth-time';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateMeihuaSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectMeihuaClassics } from './classics';
import reference from './meihua-reference.json';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof meihuaInput>;
type Options = Input['prompt'];

type MeihuaData = ReturnType<typeof generateMeihuaChart>;
type Evidence = ReturnType<typeof analyzeMeihuaEvidence>;

const TRIGRAM_REVERSE_INDEX: Record<number, number> = {
  1: 1,
  2: 5,
  3: 3,
  4: 7,
  5: 2,
  6: 6,
  7: 4,
  8: 8,
};

const MEIHUA_TRIGRAM_IMAGERY: Record<string, string> = {
  乾: '乾（金/西北/先天一）：天、君父尊长、官贵、头首骨、圆硬金玉冠镜、马；性刚健果决、主导开创',
  兑: '兑（金/正西/先天二）：泽、少女、口舌言语、饮食喜悦、口齿肺痰、带口破损金属器皿、羊；主讲习交涉、口舌说合',
  离: '离（火/正南/先天三）：火、日、中女、文书科名、目心血脉、外刚内柔中虚发光之物、雉鸟；主文明显达、依附明丽',
  震: '震（木/正东/先天四）：雷、长男、足肝发、动象声响、竹木稼穑车器、龙；主奋发启动、虚惊迅疾',
  巽: '巽（木/东南/先天五）：风、长女、股肱气脉、命令信件商旅、草木绳帛长直之物、鸡；主柔顺渗透、进退不果',
  坎: '坎（水/正北/先天六）：水、月、中男、耳肾血液、险陷隐伏、舟车酒水盐液、豕鱼；主外柔内刚、曲折险阻與智谋',
  艮: '艮（土/东北/先天七）：山、少男、手背指节鼻、门阙路径丘陵土石、犬鼠；主静止笃实、阻隔守成与转折界限',
  坤: '坤（土/西南/先天八）：地、母、腹脾胃肉、民众田产、布帛方柔承载之物、牛；主厚重包容、顺从蓄养与迟缓',
};

function buildMeihuaExtendedImagery(data: MeihuaData): string {
  const upIdx = data.calculation.upperTrigramIndex;
  const lowIdx = data.calculation.lowerTrigramIndex;
  const cuoHex =
    upIdx && lowIdx ? findHexagramByTrigrams(9 - upIdx, 9 - lowIdx) : undefined;
  const zongHex =
    upIdx && lowIdx
      ? findHexagramByTrigrams(TRIGRAM_REVERSE_INDEX[lowIdx] ?? lowIdx, TRIGRAM_REVERSE_INDEX[upIdx] ?? upIdx)
      : undefined;

  const activeTrigrams = Array.from(
    new Set([
      data.tiGua.name,
      data.yongGua.name,
      data.interHexagram.upper,
      data.interHexagram.lower,
      data.changedHexagram.upper,
      data.changedHexagram.lower,
    ]),
  );

  const lines = [
    cuoHex && zongHex
      ? `旁通与反观：主卦错卦（旁通卦）为${cuoHex.name}（${cuoHex.symbol}，表潜藏对立面或外境反转）；主卦综卦（反对卦）为${zongHex.name}（${zongHex.symbol}，表换位反观或事态一体两面）。`
      : '',
    `阶段总势：${data.analysis.timelineTrend.trend}——${data.analysis.timelineTrend.summary}`,
    `月令体用衡定：${data.analysis.tiYongSeasonEvaluation}`,
    `《梅花易数·万物属类》本局涉卦类象：\n${activeTrigrams
      .map((name) => MEIHUA_TRIGRAM_IMAGERY[name])
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join('\n')}`,
  ].filter(Boolean);

  return lines.join('\n');
}

type MeihuaRelationTone = 'support' | 'control' | 'drain';

function classifyMeihuaToTi(otherElem: string, tiElem: string): { label: string; tone: MeihuaRelationTone } {
  if (otherElem === tiElem) return { label: '比和', tone: 'support' };
  if (isSheng(otherElem, tiElem)) return { label: '生体', tone: 'support' };
  if (isKe(tiElem, otherElem)) return { label: '体克', tone: 'control' };
  if (isKe(otherElem, tiElem)) return { label: '克体', tone: 'drain' };
  return { label: '体生泄气', tone: 'drain' };
}

export function buildMeihuaPatternRelations(data: MeihuaData): string {
  const tiElem = data.tiGua.element;
  const startRel = classifyMeihuaToTi(data.yongGua.element, tiElem);
  const interTiRel = classifyMeihuaToTi(data.interTiGua.element, tiElem);
  const interYongRel = classifyMeihuaToTi(data.interYongGua.element, tiElem);
  const endRel = classifyMeihuaToTi(data.changedYongGua.element, data.changedTiGua.element);

  const startOk = startRel.tone !== 'drain';
  const endOk = endRel.tone !== 'drain';
  const midHasDrain = interTiRel.tone === 'drain' || interYongRel.tone === 'drain';
  const midAllOk = !midHasDrain;

  let trajectory: '全程顺势' | '先顺后阻' | '先阻后通' | '全程受制' | '波动拉锯';
  if (startOk && midAllOk && endOk) {
    trajectory = '全程顺势';
  } else if (startOk && !endOk) {
    trajectory = '先顺后阻';
  } else if (!startOk && endOk) {
    trajectory = '先阻后通';
  } else if (!startOk && midHasDrain && !endOk) {
    trajectory = '全程受制';
  } else {
    trajectory = '波动拉锯';
  }

  const stageLine = `- 三阶段体用轨迹：本卦${data.tiGua.name}（体/${tiElem}）与${data.yongGua.name}（用/${data.yongGua.element}）为${data.analysis.tiYongRelation} → 互卦体互${data.interTiGua.name}（${data.interTiGua.element}，${data.analysis.inter1Relation}）、用互${data.interYongGua.name}（${data.interYongGua.element}，${data.analysis.inter2Relation}） → 变卦${data.changedTiGua.name}（体/${data.changedTiGua.element}）与${data.changedYongGua.name}（用/${data.changedYongGua.element}）为${data.analysis.changedTiYongRelation}；走势定性：${trajectory}。`;

  // 党众统计（主用、体互、用互、变用四位对体卦）
  const partySlots = [
    { role: '主用', gua: data.yongGua, rel: startRel },
    { role: '体互', gua: data.interTiGua, rel: interTiRel },
    { role: '用互', gua: data.interYongGua, rel: interYongRel },
    { role: '变用', gua: data.changedYongGua, rel: endRel },
  ];
  const supportParty = partySlots.filter((s) => s.rel.tone === 'support');
  const drainParty = partySlots.filter((s) => s.rel.tone === 'drain');
  const controlParty = partySlots.filter((s) => s.rel.tone === 'control');
  const fmtSlots = (items: typeof partySlots) =>
    items.length ? items.map((s) => `${s.role}${s.gua.name}${s.gua.element}(${s.rel.label})`).join('、') : '无';

  const partyBalance =
    supportParty.length > drainParty.length
      ? `体党占优（助体${supportParty.length}位 vs 克泄${drainParty.length}位）`
      : drainParty.length > supportParty.length
        ? `克泄党众偏重（克泄${drainParty.length}位 vs 助体${supportParty.length}位）`
        : `体党与克泄势均（助体${supportParty.length}位 vs 克泄${drainParty.length}位）`;
  const partyLine = `- 体用党众对比：${partyBalance}；助体党［${fmtSlots(supportParty)}］，克泄党［${fmtSlots(drainParty)}］${controlParty.length ? `，体克耗力［${fmtSlots(controlParty)}］` : ''}。`;

  // 月令旺衰与体用制衡
  const tiSeason = data.analysis.tiSeasonState;
  const yongSeason = data.analysis.yongSeasonState;
  const tiStrong = tiSeason === '旺' || tiSeason === '相';
  const yongStrong = yongSeason === '旺' || yongSeason === '相';
  const hasInterOrChangedDrain = midHasDrain || !endOk;

  let seasonBalance: string;
  if (tiStrong && (startRel.tone === 'drain' || hasInterOrChangedDrain)) {
    seasonBalance = `体卦${data.tiGua.name}${tiElem}月令${tiSeason}（旺相），虽遇${startRel.tone === 'drain' ? '主卦' : ''}${hasInterOrChangedDrain ? '互变' : ''}克泄，但体旺足以抗克/承泄${!yongStrong && startRel.tone === 'drain' ? '，且用卦月令休囚死，克体之力偏轻' : ''}`;
  } else if (!tiStrong && (startRel.tone === 'drain' || hasInterOrChangedDrain)) {
    seasonBalance = `体卦${data.tiGua.name}${tiElem}月令${tiSeason}（休囚死），又遇${startRel.tone === 'drain' ? '主卦' : ''}${hasInterOrChangedDrain ? '互变' : ''}克泄，阻力与消耗明显加剧${yongStrong ? '，用卦月令旺相更增压力' : ''}`;
  } else if (tiStrong && supportParty.length >= 2) {
    seasonBalance = `体卦${data.tiGua.name}${tiElem}月令${tiSeason}（旺相），且互变多见生扶比和，体气充实、推力顺畅`;
  } else if (!tiStrong && supportParty.length >= 2) {
    seasonBalance = `体卦${data.tiGua.name}${tiElem}月令${tiSeason}（休囚死），但互变多见生扶比和可补体气，须待体卦旺相之期发力`;
  } else {
    seasonBalance = `体卦${data.tiGua.name}${tiElem}月令${tiSeason}、用卦${data.yongGua.name}${data.yongGua.element}月令${yongSeason}；${data.analysis.tiYongSeasonEvaluation}`;
  }

  const seasonLine = `- 月令旺衰与体用制衡：月建${data.analysis.monthBranch}（${data.analysis.monthElement}）；${seasonBalance}。`;

  return [stageLine, partyLine, seasonLine].join('\n');
}

async function buildPrompt(data: MeihuaData, evidence: Evidence, question: string, options: Options, now: string) {
  const selection = resolvePromptSelection('meihua', options);
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径分析，再比较共同点、分歧及其对应盘面依据。',
  });
  const schoolAlgorithmsText = formatSchoolAlgorithmSection(evaluateMeihuaSchoolAlgorithms(data, options?.schools));
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const zhouyi = options?.includeClassics ? (await import('./zhouyi-text')).hexagramClassics(data.originalName, data.changedName, [data.movingYao.position]) : '';
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectMeihuaClassics({
          trigrams: [data.tiGua.name, data.yongGua.name, data.changedHexagram.upper, data.changedHexagram.lower],
          relation: data.analysis.tiYongRaw,
          originalHexagram: data.originalName,
          changedHexagram: data.changedName,
        }),
        '典籍片段',
      )
    : '';
  const digestLines = buildMethodSituationDigest('meihua', { ...data, evidenceAnalysis: evidence }, question);
  const sections = [
    '【传统依据】\n依取数、动爻与体用确定主卦、互卦和变卦；逐阶段考察五行生克及月令旺衰。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【时间】\n起卦：${new Date(data.timestamp).toISOString()}；提示词时间：${now}；干支：${Object.values(data.ganzhi).join(' ')}。`,
    beijingLunarDateDiscrepancy(data.timestamp) ? `【历法差异】\n${beijingLunarDateDiscrepancy(data.timestamp)}` : '',
    `【取数与卦象】\n${evidence.calculationFact.promptText}\n${evidence.hexagramStructureFacts.map((item) => item.promptText).join('；')}\n逐爻：${evidence.yaoStructureFacts.map((item) => item.promptText).join('；')}`,
    `【体用与阶段】\n${evidence.stages.map((item) => item.promptText).join('\n')}\n演变：${evidence.transitionFacts.map((item) => item.promptText).join('；')}\n${buildMeihuaExtendedImagery(data)}`,
    `【体用阶段演变与制衡关系】\n${buildMeihuaPatternRelations(data)}`,
    evidence.counterEvidenceFacts.length ? `【反证】\n${evidence.counterEvidenceFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.timingFacts.length ? `【应期条件】\n${evidence.timingFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.traditionalFacts.length ? `【卦爻辞辅助资料】\n${evidence.traditionalFacts.map((item) => `${item.promptText}${item.originalText && !item.promptText.includes(item.originalText) ? `；原文：${item.originalText}` : ''}`).join('；')}` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    schools,
    schoolAlgorithmsText,
    classics ? `【经典依据】\n${classics}` : '',
    zhouyi ? `【周易彖象资料】\n${zhouyi}` : '',
    classicExcerpts,
    `【任务】\n围绕问题复核起卦取数、主互变、动爻、体用和月令；分别说明支持、反证、成立条件与边界限制。${selection ? `\n${selection.task}` : ''}`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}

function reconstruct(data: MeihuaData & { evidenceAnalysis?: unknown }): MeihuaData {
  if (!data || !Number.isSafeInteger(data.timestamp) || !Number.isFinite(new Date(data.timestamp).getTime()) || !data.calculation || data.calculation.timezoneOffsetMinutes !== 480) {
    throw new Error('梅花结果缺少有效的北京时间和起卦资料。');
  }
  const c = data.calculation;
  if (!c.methodKey || !['time', 'number', 'sound', 'character', 'direction', 'random'].includes(c.methodKey)) {
    throw new Error('梅花结果缺少有效起卦方式。');
  }
  const settings: MeihuaSettings = {
    method: c.methodKey,
    ...(c.number === undefined ? {} : { number: c.number }),
    ...(c.soundCount === undefined ? {} : { soundCount: c.soundCount }),
    ...(c.characterText === undefined ? {} : { characterText: c.characterText }),
    ...(c.characterCount === undefined ? {} : { characterCount: c.characterCount }),
    ...(c.characterTones === undefined ? {} : { characterTones: c.characterTones }),
    ...(c.characterStrokeCounts === undefined ? {} : { characterStrokeCounts: c.characterStrokeCounts }),
    ...(c.characterLeftStrokes === undefined ? {} : { characterLeftStrokes: c.characterLeftStrokes }),
    ...(c.characterRightStrokes === undefined ? {} : { characterRightStrokes: c.characterRightStrokes }),
    ...(c.direction === undefined ? {} : { direction: c.direction }),
    ...(c.objectType === undefined ? {} : { objectType: c.objectType }),
  };
  const savedRandom = settings.method === 'random' ? {
    upperTrigramIndex: c.upperTrigramIndex!, lowerTrigramIndex: c.lowerTrigramIndex!, movingYaoIndex: c.movingYaoIndex!,
  } : undefined;
  const rebuilt = generateMeihuaChart(new Date(data.timestamp), settings, savedRandom);
  const { evidenceAnalysis: _cached, ...saved } = data;
  if (!sameJsonValue(saved, rebuilt)) throw new Error('梅花卦盘与起卦资料不一致。');
  return rebuilt;
}

export async function meihua(input: Input, now: string) {
  const data = generateMeihuaChart(new Date(input.divinationTime ?? now), input.meihua);
  const evidenceAnalysis = analyzeMeihuaEvidence(data);
  return {
    data: { ...data, evidenceAnalysis },
    summary: { title: '梅花易数起卦结果', tags: [`主卦：${data.originalName}`, `互卦：${data.interName}`, `变卦：${data.changedName}`], lines: [...evidenceAnalysis.stages.map((item) => item.promptText), ...(beijingLunarDateDiscrepancy(data.timestamp) ? [beijingLunarDateDiscrepancy(data.timestamp)!] : [])] },
    prompt: await buildPrompt(data, evidenceAnalysis, input.question, input.prompt, now),
  };
}

export function promptForMeihua(value: unknown, question: string, options: Options, now: string) {
  const rebuilt = reconstruct((value && typeof value === 'object' ? value : {}) as MeihuaData);
  return buildPrompt(rebuilt, analyzeMeihuaEvidence(rebuilt), question, options, now);
}
