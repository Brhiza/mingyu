import type { z } from 'zod';
import { castLiuyao, castYarrow } from './liuyao/cast';
import { generateLiuyaoChart } from './liuyao/chart';
import { analyzeLiuyaoEvidence } from './liuyao/evidence';
import type { LiuyaoData } from './liuyao/types';
import { EARTHLY_BRANCHES, getBranchIndex, isChong, isHe, isKe, isSheng, isXing } from './calendar';
import type { liuyaoInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { formatClassicExcerpts, selectLiuyaoClassics } from './classics';
import reference from './liuyao-reference.json';
import { parseQuestionContext } from './question-context';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof liuyaoInput>;
type Options = Input['prompt'];

type Evidence = ReturnType<typeof analyzeLiuyaoEvidence>;

const LIUYAO_GUIREN_MAP: Record<string, readonly string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};
const LIUYAO_LUSHEN_MAP: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};
const LIUYAO_YANGREN_MAP: Record<string, string> = {
  甲: '卯', 乙: '寅', 丙: '午', 戊: '午', 丁: '巳', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥',
};
const LIUYAO_WENCHANG_MAP: Record<string, string> = {
  甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};
const SANHE_SHENSHA_MAP: Record<string, { yima: string; taohua: string; huagai: string; jiangxing: string; jiesha: string; zaisha: string; mouxing: string }> = {
  申: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  子: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  辰: { yima: '寅', taohua: '酉', huagai: '辰', jiangxing: '子', jiesha: '巳', zaisha: '午', mouxing: '戌' },
  寅: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  午: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  戌: { yima: '申', taohua: '卯', huagai: '戌', jiangxing: '午', jiesha: '亥', zaisha: '子', mouxing: '辰' },
  巳: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  酉: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  丑: { yima: '亥', taohua: '午', huagai: '丑', jiangxing: '酉', jiesha: '寅', zaisha: '卯', mouxing: '未' },
  亥: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
  卯: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
  未: { yima: '巳', taohua: '子', huagai: '未', jiangxing: '卯', jiesha: '申', zaisha: '酉', mouxing: '丑' },
};
const MONTH_TIANXI_MAP: Record<string, string> = {
  寅: '戌', 卯: '戌', 辰: '戌',
  巳: '丑', 午: '丑', 未: '丑',
  申: '辰', 酉: '辰', 戌: '辰',
  亥: '未', 子: '未', 丑: '未',
};

function buildLiuyaoGuaShenAndShenshaSummary(data: LiuyaoData): string {
  const gs = data.guaShen;
  const gsVoid = gs && data.voidBranches.includes(gs.branch) ? '（逢旬空）' : '';
  const guaShenLine = !gs
    ? '月卦身：伏藏未上主卦（《卜筮正宗》以卦身不现主事体未显或尚缺依托）。'
    : typeof gs.position === 'number'
      ? `月卦身：${gs.branch}（${gs.sixRelative}），落第${gs.position}爻${gsVoid}。`
      : `月卦身：${gs.branch}（${gs.sixRelative}），伏藏未上主卦${gsVoid}（《卜筮正宗》以卦身不现主事体未显或尚缺依托）。`;

  const shiYao = data.yaosDetail.find((y) => y.isWorld);
  const yingYao = data.yaosDetail.find((y) => y.isResponse);
  let shiYingLine = '';
  if (shiYao && yingYao) {
    const elemRel =
      shiYao.wuxing === yingYao.wuxing
        ? '世应比和'
        : isSheng(shiYao.wuxing, yingYao.wuxing)
          ? '世生应（我生彼，主我方主动付出或迁就）'
          : isSheng(yingYao.wuxing, shiYao.wuxing)
            ? '应生世（彼生我，主他方助益或事就我）'
            : isKe(shiYao.wuxing, yingYao.wuxing)
              ? '世克应（我克彼，主我方掌控或主动求取）'
              : '应克世（彼克我，主外境施压或对方占优）';
    const branchInteraction: string[] = [];
    if (isHe(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应六合');
    if (isChong(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应六冲');
    if (isXing(shiYao.najiaDizhi, yingYao.najiaDizhi)) branchInteraction.push('世应相刑');
    shiYingLine = `世应枢机：世居第${shiYao.position}爻${shiYao.sixRelative}${shiYao.najiaDizhi}${shiYao.wuxing}（${shiYao.sixGod}），应居第${yingYao.position}爻${yingYao.sixRelative}${yingYao.najiaDizhi}${yingYao.wuxing}（${yingYao.sixGod}）；${elemRel}${branchInteraction.length ? `，${branchInteraction.join('、')}` : ''}。`;
  }

  const dayStem = data.ganzhi.day[0] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const monthBranch = data.ganzhi.month[1] ?? '';
  const monthIdx = getBranchIndex(monthBranch);
  const tianyiBranch = monthIdx >= 0 ? EARTHLY_BRANCHES[(monthIdx + 11) % 12] : '';
  const tianxiBranch = MONTH_TIANXI_MAP[monthBranch] ?? '';
  const sanhe = SANHE_SHENSHA_MAP[dayBranch];

  const locateBranches = (branches: readonly string[]) => {
    const hits = data.yaosDetail
      .filter((y) => branches.includes(y.najiaDizhi))
      .map((y) => `${y.position}爻${y.sixRelative}${y.najiaDizhi}`);
    return hits.length ? `［临${hits.join('/')}］` : '';
  };

  const shenshaParts: string[] = [];
  const guiren = LIUYAO_GUIREN_MAP[dayStem];
  if (guiren) shenshaParts.push(`天乙贵人${guiren.join('、')}${locateBranches(guiren)}`);
  const lushen = LIUYAO_LUSHEN_MAP[dayStem];
  if (lushen) shenshaParts.push(`禄神${lushen}${locateBranches([lushen])}`);
  const yangren = LIUYAO_YANGREN_MAP[dayStem];
  if (yangren) shenshaParts.push(`羊刃${yangren}${locateBranches([yangren])}`);
  const wenchang = LIUYAO_WENCHANG_MAP[dayStem];
  if (wenchang) shenshaParts.push(`文昌${wenchang}${locateBranches([wenchang])}`);
  if (sanhe) {
    shenshaParts.push(`驿马${sanhe.yima}${locateBranches([sanhe.yima])}`);
    shenshaParts.push(`桃花${sanhe.taohua}${locateBranches([sanhe.taohua])}`);
    shenshaParts.push(`华盖${sanhe.huagai}${locateBranches([sanhe.huagai])}`);
    shenshaParts.push(`将星${sanhe.jiangxing}${locateBranches([sanhe.jiangxing])}`);
    shenshaParts.push(`谋星${sanhe.mouxing}${locateBranches([sanhe.mouxing])}`);
    shenshaParts.push(`劫煞${sanhe.jiesha}${locateBranches([sanhe.jiesha])}`);
    shenshaParts.push(`灾煞${sanhe.zaisha}${locateBranches([sanhe.zaisha])}`);
  }
  if (tianyiBranch) shenshaParts.push(`天医（月）${tianyiBranch}${locateBranches([tianyiBranch])}`);
  if (tianxiBranch) shenshaParts.push(`天喜（月）${tianxiBranch}${locateBranches([tianxiBranch])}`);

  return [
    guaShenLine,
    shiYingLine,
    shenshaParts.length ? `常用神煞：${shenshaParts.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function buildPrompt(data: LiuyaoData, evidence: Evidence, question: string, options: Options, now: string, timeLabel = '起卦') {
  const selection = resolvePromptSelection('liuyao', options);
  const parsed = parseQuestionContext(question);
  const template = options?.liuyaoTemplate ?? (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen' ? parsed.inferredTopic : 'general');
  const schools = formatSchoolGuidance(options?.schools, reference.schools, {
    multiNote: '多口径合参：分别依据各口径判断，再比较共同点、分歧与对应卦爻依据。',
  });
  const classics = options?.includeClassics
    ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n')
    : '';
  const zhouyi = options?.includeClassics ? (await import('./zhouyi-text')).hexagramClassics(data.originalName, data.changedName!, data.changingYaos.filter((line) => line.isChanging).map((line) => line.position)) : '';
  const actualChangeTypes: string[] = data.yaosDetail
    .filter((y) => y.isChanging)
    .flatMap((y) => [y.changeDirection, ...(y.changeRelations ?? [])])
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const structSummary = evidence.structureFacts.map((s) => s.promptText).join(' ');
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectLiuyaoClassics({
          movingCount: data.changingYaos.filter((line) => line.isChanging).length,
          hasFuShen: evidence.hiddenSpiritFacts.length > 0,
          category: parsed.liuyaoCategory ?? (template === 'general' ? undefined : template),
          changeTypes: actualChangeTypes,
          isSixClash: structSummary.includes('六冲'),
          isSixHarmony: structSummary.includes('六合'),
          fanFuYin: structSummary,
          originalHexagram: data.originalName,
          changedHexagram: data.changedName ?? data.originalName,
        }),
        '典籍片段',
      )
    : '';
  const digestLines = buildMethodSituationDigest('liuyao', { ...data, evidenceAnalysis: evidence }, question);
  const schoolAlgorithmsText = evidence.schoolAlgorithms?.length
    ? `【流派算法口径核验】\n${evidence.schoolAlgorithms.map((item) => `${item.label}：卦身口径＝${item.guaShenRule}；日冲口径＝${item.dayClashRule}；本盘核验：${item.findings.join('；')}。`).join('\n')}`
    : '';
  const sections = [
    '【传统依据】\n依八宫纳甲、六亲世应、月日旺衰与动变取证；用神须结合实际所问事项。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【时间】\n${timeLabel}：${new Date(data.timestamp).toISOString()}；时区偏移：UTC${(data.timezoneOffsetMinutes ?? 480) >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(data.timezoneOffsetMinutes ?? 480) / 60)).padStart(2, '0')}:${String(Math.abs(data.timezoneOffsetMinutes ?? 480) % 60).padStart(2, '0')}；提示词时间：${now}。`,
    `【起卦方式】\n${evidence.generationFact.promptText}`,
    `【卦盘】\n主卦：${data.originalName}；变卦：${data.changedName}；互卦：${data.interName}；卦宫：${data.palace.name}（${data.palace.wuxing}），${data.palaceStage}。\n干支：${[data.ganzhi.year, data.ganzhi.month, data.ganzhi.day, data.ganzhi.hour].join(' ')}；旬空：${data.voidBranches.join('、')}；六爻值（初至上）：${data.yaoArray.join('、')}。\n${buildLiuyaoGuaShenAndShenshaSummary(data)}`,
    `【逐爻与伏神】\n${evidence.lineFacts.map((item) => item.promptText).join('\n')}${evidence.hiddenSpiritFacts.length ? `\n伏神：${evidence.hiddenSpiritFacts.map((item) => item.promptText).join('；')}` : '\n伏神：无已记录伏神。'}`,
    `【用神与作用链】\n${parsed.liuyaoRelativeReason ? `${parsed.liuyaoRelativeReason}\n` : ''}${evidence.selectionFact.promptText}\n${evidence.candidates.map((item) => item.promptText).join('\n')}${evidence.godChain.length ? `\n${evidence.godChain.map((item) => item.promptText).join('；')}` : ''}`,
    evidence.structureFacts.length ? `【卦内结构】\n${evidence.structureFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.counterEvidenceFacts.length ? `【反证条件】\n${evidence.counterEvidenceFacts.map((item) => item.promptText).join('；')}` : '',
    evidence.timingFacts.length ? `【应期条件】\n${evidence.timingFacts.map((item) => item.promptText).join('；')}` : '',
    `【问题范围】\n${reference.templates[template]}`,
    selection ? `【解读选择】\n${selection.section}` : '',
    schools,
    schoolAlgorithmsText,
    classics ? `【经典依据】\n${classics}` : '',
    zhouyi ? `【周易经文】\n${zhouyi}` : '',
    classicExcerpts,
    `【任务】\n围绕问题先定世应和用神候选，逐项核对月日、动变、空破、伏神及支持和反证；区分传统取义、现实事实和成立条件。${selection ? `\n${selection.task}` : ''}\n应期只按已列触发条件讨论，不将爻位或空亡机械换算成确定日期。`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}

export function reconstruct(data: LiuyaoData & { evidenceAnalysis?: unknown }) {
  if (!data || !Number.isSafeInteger(data.timestamp) || !Number.isFinite(new Date(data.timestamp).getTime()) || !Number.isInteger(data.timezoneOffsetMinutes) || data.timezoneOffsetMinutes! < -720 || data.timezoneOffsetMinutes! > 840 || !data.generation) {
    throw new Error('六爻结果缺少有效的起卦时间、时区或起卦记录。');
  }
  const generation = data.generation;
  let cast: ReturnType<typeof castLiuyao>;
  if (generation.method === 'manual') {
    cast = castLiuyao(data.timestamp, { method: 'manual', yaos: data.yaoArray });
  } else if (generation.method === 'time') {
    cast = castLiuyao(data.timestamp, { method: 'time' });
  } else if (generation.method === 'coins') {
    if (!Array.isArray(generation.coinThrows)) throw new Error('六爻结果缺少三钱记录。');
    if (!['user-record', 'simulated'].includes(generation.coinSource ?? '')) throw new Error('六爻结果缺少有效的三钱来源。');
    const reconstructed = castLiuyao(data.timestamp, { method: 'coins', coinThrows: generation.coinThrows });
    cast = { ...reconstructed, generation: { ...reconstructed.generation, coinSource: generation.coinSource } };
  } else if (generation.method === 'yarrow') {
    const saved = generation.yarrow;
    if (!saved || !Array.isArray(saved.lines) || saved.lines.length !== 6 || !saved.lines.every((line) => Array.isArray(line?.changes) && line.changes.length === 3) || !['手工分堆', '余数等概率，类内分堆等概率'].includes(saved.samplingModel)) {
      throw new Error('六爻结果缺少有效的蓍草分堆记录。');
    }
    const reconstructed = castYarrow(saved.lines.flatMap((line) => line.changes.map((change) => change.left)));
    const yarrow = { ...reconstructed, samplingModel: saved.samplingModel };
    cast = { yaos: yarrow.yaos, generation: { method: 'yarrow', yarrow } };
  } else {
    throw new Error('六爻结果的起卦方式无效。');
  }
  if (data.ziHourMode !== undefined && data.ziHourMode !== '23:00' && data.ziHourMode !== '00:00') {
    throw new Error('六爻结果的早晚子时换日口径无效。');
  }
  const chart = generateLiuyaoChart(new Date(data.timestamp), cast, data.timezoneOffsetMinutes, data.ziHourMode);
  const { evidenceAnalysis: _cached, ...saved } = data;
  if (!sameJsonValue(saved, chart)) throw new Error('六爻卦盘与起卦记录不一致。');
  return { chart, cast };
}

export async function liuyao(input: Input, now: string) {
  if (input.range) return (await import('./liuyao-range')).calculateLiuyaoRange(input, now);
  const date = new Date(input.divinationTime ?? now);
  const cast = castLiuyao(date.getTime(), input.liuyao);
  const data = generateLiuyaoChart(date, cast, input.liuyao?.timezoneOffsetMinutes, input.liuyao?.ziHourMode);
  const parsed = parseQuestionContext(input.question);
  const hasExplicitBackground = input.question.includes('【求测背景】');
  const topic =
    input.prompt?.liuyaoTemplate ??
    (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen'
      ? parsed.inferredTopic
      : 'general');
  const evidenceAnalysis = analyzeLiuyaoEvidence(data, {
    topic,
    ...(hasExplicitBackground && parsed.liuyaoRelative ? { usefulGodRelative: parsed.liuyaoRelative } : {}),
    ...(input.prompt?.schools?.length ? { schools: input.prompt.schools } : {}),
  });
  const summary = {
    title: '六爻起卦结果',
    tags: [`主卦：${data.originalName}`, `变卦：${data.changedName}`, `互卦：${data.interName}`],
    lines: [evidenceAnalysis.selectionFact.promptText, ...evidenceAnalysis.structureFacts.map((item) => item.promptText)],
  };
  return { data: { ...data, evidenceAnalysis }, summary, prompt: await buildPrompt(data, evidenceAnalysis, input.question, input.prompt, now) };
}

export function promptForLiuyao(value: unknown, question: string, options: Options, now: string) {
  const { chart } = reconstruct((value && typeof value === 'object' ? value : {}) as LiuyaoData & { evidenceAnalysis?: unknown });
  const parsed = parseQuestionContext(question);
  const hasExplicitBackground = question.includes('【求测背景】');
  const topic =
    options?.liuyaoTemplate ??
    (parsed.inferredTopic === 'ganqing' || parsed.inferredTopic === 'shiye' || parsed.inferredTopic === 'caifu' || parsed.inferredTopic === 'guaishen'
      ? parsed.inferredTopic
      : 'general');
  return buildPrompt(
    chart,
    analyzeLiuyaoEvidence(chart, {
      topic,
      ...(hasExplicitBackground && parsed.liuyaoRelative ? { usefulGodRelative: parsed.liuyaoRelative } : {}),
      ...(options?.schools?.length ? { schools: options.schools } : {}),
    }),
    question,
    options,
    now,
  );
}
